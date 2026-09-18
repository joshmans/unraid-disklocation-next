<script lang="ts">
  import { onMount } from "svelte";
  import TrayMap from "./lib/TrayMap.svelte";
  import Settings from "./lib/Settings.svelte";
  import DiskAssignment from "./lib/DiskAssignment.svelte";
  import SmartHistory from "./lib/SmartHistory.svelte";
  import { driveIconMeta } from "./lib/driveicons";
  import { exampleDrives, emptyLayout } from "./lib/chassis";
  import type { ChassisLayout, LogoConfig, LedColorConfig, Assignments, BayDrive, DriveStatus } from "./lib/chassis";
  import type { DiskResult } from "../graphql/queries";
  import { driveFromDisk } from "../shared/derive-drive";
  import { startDaemon as phpStartDaemon } from "./lib/daemon-control";

  const API_BASE = "/plugins/unraid-disklocation-next/api";

  type Tab = "map" | "assign" | "settings" | "history";
  let activeTab: Tab = "map";

  let liveLayout: ChassisLayout = emptyLayout;
  let liveLogos: LogoConfig = {};
  let liveLedColors: LedColorConfig = {};
  let liveAssignments: Assignments = {};
  let liveSmartHistoryDbPath = "";
  let disks: DiskResult[] | null = null;
  let disksError = "";
  let disksLoading = false;
  // This plugin's own smartctl-derived assessment (src/smart-history.ts) -
  // the only way a real "critical" status is reachable, since unraid-api's
  // smartStatus is OK/UNKNOWN only. Keyed by serial; missing entry means no
  // poll sample yet.
  let historyStatus: Record<string, DriveStatus> = {};
  // Split from disks on purpose: /layout is fast, /disks can take 20+
  // seconds on a large real array (unraid-api gathers SMART data per disk
  // under the hood) - the layout/settings/tray-map structure shouldn't sit
  // blocked behind that.
  let layoutLoaded = false;
  // True once we've confirmed the daemon is reachable and has no saved
  // layout yet (a real, unconfigured production install).
  let productionEmpty = false;
  // False when /layout couldn't be reached at all (network error, or nginx
  // returning a non-ok status because nothing's listening upstream) - shows
  // a "start the daemon" panel instead of ever quietly falling back to
  // demo data, which used to happen here and was actively misleading (a
  // real down daemon looked identical to a normal, working install).
  let daemonReachable = true;
  let startingDaemon = false;
  let startDaemonMessage = "";
  // Guards loadDisks so it only ever fires once. Used to also require at
  // least one bay/PCIe group to exist first (nothing to assign otherwise),
  // but the SMART History tab needs disks/history regardless of whether a
  // chassis has been configured at all - so this just waits for the fast
  // /layout fetch to finish, not for any particular layout content.
  let disksRequested = false;

  onMount(() => {
    loadLayout();
  });

  $: if (layoutLoaded && !disksRequested) {
    disksRequested = true;
    loadDisks();
  }

  async function loadLayout() {
    try {
      const res = await fetch(`${API_BASE}/layout`);
      if (res.ok) {
        daemonReachable = true;
        const stored = await res.json();
        if (stored) {
          liveLayout = stored.layout;
          liveLogos = stored.logos;
          liveAssignments = stored.assignments ?? {};
          liveLedColors = stored.ledColors ?? {};
          liveSmartHistoryDbPath = stored.smartHistoryDbPath ?? "";
        } else {
          productionEmpty = true;
          liveLayout = emptyLayout;
          liveLogos = {};
          liveLedColors = {};
        }
      } else {
        daemonReachable = false;
      }
    } catch {
      daemonReachable = false;
    }
    layoutLoaded = true;
  }

  async function handleStartDaemon() {
    startingDaemon = true;
    startDaemonMessage = "";
    const result = await phpStartDaemon();
    startDaemonMessage = result.message ?? (result.ok ? "Started" : "Failed to start");
    startingDaemon = false;
    if (result.ok) {
      // Give it a moment to actually come up and start listening before
      // retrying - matches the ~1s the rc.d script itself waits before
      // reporting success.
      setTimeout(loadLayout, 1500);
    }
  }

  async function loadDisks() {
    disksLoading = true;
    try {
      const res = await fetch(`${API_BASE}/disks`);
      if (res.ok) {
        disks = await res.json();
        disksError = "";
      } else {
        disksError = (await res.json())?.error ?? `HTTP ${res.status}`;
      }
    } catch (err) {
      disksError = err instanceof Error ? err.message : String(err);
    }
    disksLoading = false;

    // Best-effort - a disk simply not having a poll sample yet isn't an
    // error state worth surfacing, driveFromDisk() already treats a missing
    // entry as "no negative signal from history yet".
    try {
      const res = await fetch(`${API_BASE}/smart-history/latest`);
      if (res.ok) historyStatus = await res.json();
    } catch {
      // leave historyStatus as-is
    }
  }

  // Real assigned occupancy once disks have loaded; the bundled demo occupancy
  // otherwise (unconfigured daemon, local dev without the proxy in front, or
  // just still loading).
  $: liveDrives = computeDrives(liveAssignments, disks, historyStatus);

  function computeDrives(
    assignments: Assignments,
    disks: DiskResult[] | null,
    historyStatus: Record<string, DriveStatus>,
  ): Record<string, BayDrive> {
    if (!disks) return exampleDrives;
    const bySerial = new Map(disks.map((d) => [d.serialNum, d]));
    const result: Record<string, BayDrive> = {};
    for (const [bayId, serial] of Object.entries(assignments)) {
      const disk = bySerial.get(serial);
      if (disk) result[bayId] = driveFromDisk(disk, historyStatus[serial]);
    }
    return result;
  }

  async function persistAll(next: {
    layout?: ChassisLayout;
    logos?: LogoConfig;
    ledColors?: LedColorConfig;
    assignments?: Assignments;
    smartHistoryDbPath?: string;
  }): Promise<{ ok: boolean; error?: string }> {
    const merged = {
      layout: next.layout ?? liveLayout,
      logos: next.logos ?? liveLogos,
      ledColors: next.ledColors ?? liveLedColors,
      assignments: next.assignments ?? liveAssignments,
      smartHistoryDbPath: next.smartHistoryDbPath ?? liveSmartHistoryDbPath,
    };
    try {
      const res = await fetch(`${API_BASE}/layout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(merged),
      });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      liveLayout = merged.layout;
      liveLogos = merged.logos;
      liveLedColors = merged.ledColors;
      liveAssignments = merged.assignments;
      liveSmartHistoryDbPath = merged.smartHistoryDbPath;
      // A successful save proves the daemon is reachable, so this always
      // reflects real state going forward (not just the initial classification).
      productionEmpty = merged.layout.groups.length === 0;
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  function saveSettings(layout: ChassisLayout, logos: LogoConfig, ledColors: LedColorConfig, smartHistoryDbPath: string) {
    return persistAll({ layout, logos, ledColors, smartHistoryDbPath });
  }

  function saveAssignments(assignments: Assignments) {
    return persistAll({ assignments });
  }
</script>

<main>
  <nav class="tabs">
    <button type="button" class:active={activeTab === "map"} on:click={() => (activeTab = "map")}>
      Tray Map
    </button>
    <button type="button" class:active={activeTab === "assign"} on:click={() => (activeTab = "assign")}>
      Disk Assignment
    </button>
    <button type="button" class:active={activeTab === "history"} on:click={() => (activeTab = "history")}>
      SMART History
    </button>
    <button type="button" class:active={activeTab === "settings"} on:click={() => (activeTab = "settings")}>
      Settings
    </button>
  </nav>

  <!-- All four tab panels stay mounted once loaded - switching tabs only
       toggles visibility, so nothing re-fetches or re-initializes on every
       switch back to a tab you already visited. -->
  <section class="tab-panel" class:hidden={activeTab !== "map"}>
    {#if !daemonReachable}
      <p class="status err">The plugin's service isn't running.</p>
      <button type="button" on:click={handleStartDaemon} disabled={startingDaemon}>
        {startingDaemon ? "Starting..." : "Start daemon"}
      </button>
      {#if startDaemonMessage}<p class="status">{startDaemonMessage}</p>{/if}
    {:else if layoutLoaded}
      {#if productionEmpty}
        <p class="status">To begin, go to the Settings tab and define at least one tray group.</p>
      {:else}
        <p class="status">
          {liveLayout.name}
          {#if !disks}- occupancy shown here is sample data ({disksError || "loading drives..."}).{/if}
        </p>
        <TrayMap layout={liveLayout} drives={liveDrives} logos={liveLogos} ledColors={liveLedColors} />

        <h2>Drive types</h2>
        <ul class="legend">
          {#each Object.entries(driveIconMeta) as [type, info] (type)}
            <li><strong>{info.name}</strong> - {info.description}</li>
          {/each}
        </ul>
      {/if}
    {:else}
      <p class="status">Loading layout...</p>
    {/if}
  </section>

  <section class="tab-panel" class:hidden={activeTab !== "assign"}>
    <DiskAssignment
      layout={liveLayout}
      {disks}
      {disksError}
      {disksLoading}
      assignments={liveAssignments}
      save={saveAssignments}
      redetect={loadDisks}
    />
  </section>

  <section class="tab-panel" class:hidden={activeTab !== "history"}>
    <SmartHistory {disks} {disksError} />
  </section>

  <section class="tab-panel" class:hidden={activeTab !== "settings"}>
    {#if layoutLoaded}
      <Settings
        initialLayout={liveLayout}
        initialLogos={liveLogos}
        initialLedColors={liveLedColors}
        initialSmartHistoryDbPath={liveSmartHistoryDbPath}
        save={saveSettings}
      />
    {:else}
      <p class="status">Loading layout...</p>
    {/if}
  </section>
</main>

<style>
  main {
    /* Self-contained panel with its own light/dark pairing rather than
       inheriting the host page's theme - Unraid's webGUI defaults to dark,
       and assuming a light host background made most of this unreadable
       there (confirmed against a real install). */
    --bg: #1b1b1d;
    --bg-panel: #242427;
    --fg: #e9e8e3;
    --muted: #9b9a94;
    --border: rgba(233, 232, 227, 0.14);
    --accent-ok: #4a9d5f;
    --accent-warn: #d9a72e;
    --accent-critical: #c9463c;

    font-family: system-ui, -apple-system, sans-serif;
    max-width: 720px;
    background: var(--bg);
    color: var(--fg);
    padding: 16px 20px 24px;
    border-radius: 6px;
  }
  h2 {
    font-size: 15px;
    margin: 20px 0 8px;
  }
  .tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 16px;
  }
  .tabs button {
    background: none;
    border: none;
    color: var(--muted);
    font: inherit;
    font-size: 13px;
    padding: 8px 12px;
    cursor: pointer;
    border-bottom: 2px solid transparent;
  }
  .tabs button.active {
    color: var(--fg);
    border-bottom-color: var(--accent-ok);
  }
  .tab-panel.hidden {
    display: none;
  }
  .status {
    font-size: 12px;
    color: var(--muted);
    margin-top: 0;
  }
  .status.err {
    color: var(--accent-critical);
  }
  .legend {
    font-size: 13px;
    padding-left: 18px;
  }
  main button {
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 5px 10px;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
</style>
