<script lang="ts">
  import { onMount } from "svelte";
  import TrayMap from "./lib/TrayMap.svelte";
  import Settings from "./lib/Settings.svelte";
  import DiskAssignment from "./lib/DiskAssignment.svelte";
  import { driveIconMeta } from "./lib/driveicons";
  import { exampleLayout, exampleDrives, exampleLogos, exampleLedColors } from "./lib/chassis";
  import type { ChassisLayout, LogoConfig, LedColorConfig, Assignments, BayDrive } from "./lib/chassis";
  import type { DiskResult } from "../graphql/queries";
  import { driveFromDisk } from "../shared/derive-drive";

  const API_BASE = "/plugins/unraid-disklocation-next/api";

  type Tab = "map" | "assign" | "settings";
  let activeTab: Tab = "map";

  let liveLayout: ChassisLayout = exampleLayout;
  let liveLogos: LogoConfig = exampleLogos;
  let liveLedColors: LedColorConfig = exampleLedColors;
  let liveAssignments: Assignments = {};
  let disks: DiskResult[] | null = null;
  let disksError = "";
  // Split from disks on purpose: /layout is fast, /disks can take 20+
  // seconds on a large real array (unraid-api gathers SMART data per disk
  // under the hood) - the layout/settings/tray-map structure shouldn't sit
  // blocked behind that.
  let layoutLoaded = false;
  // True once we've confirmed the daemon is reachable AND has no saved
  // layout yet (a real, unconfigured production install) - as opposed to
  // the daemon/proxy being unreachable (local dev without it in front),
  // where falling back to the bundled demo layout is still the right call.
  let productionEmpty = false;

  onMount(() => {
    loadLayout();
    loadDisks();
  });

  async function loadLayout() {
    try {
      const res = await fetch(`${API_BASE}/layout`);
      if (res.ok) {
        const stored = await res.json();
        if (stored) {
          liveLayout = stored.layout;
          liveLogos = stored.logos;
          liveAssignments = stored.assignments ?? {};
          liveLedColors = stored.ledColors ?? {};
        } else {
          productionEmpty = true;
        }
      }
    } catch {
      // Daemon/proxy not reachable (e.g. local dev) - fall back to the demo layout.
    }
    layoutLoaded = true;
  }

  async function loadDisks() {
    try {
      const res = await fetch(`${API_BASE}/disks`);
      if (res.ok) {
        disks = await res.json();
      } else {
        disksError = (await res.json())?.error ?? `HTTP ${res.status}`;
      }
    } catch (err) {
      disksError = err instanceof Error ? err.message : String(err);
    }
  }

  // Real assigned occupancy once disks have loaded; the bundled demo occupancy
  // otherwise (unconfigured daemon, local dev without the proxy in front, or
  // just still loading).
  $: liveDrives = computeDrives(liveAssignments, disks);

  function computeDrives(assignments: Assignments, disks: DiskResult[] | null): Record<string, BayDrive> {
    if (!disks) return exampleDrives;
    const bySerial = new Map(disks.map((d) => [d.serialNum, d]));
    const result: Record<string, BayDrive> = {};
    for (const [bayId, serial] of Object.entries(assignments)) {
      const disk = bySerial.get(serial);
      if (disk) result[bayId] = driveFromDisk(disk);
    }
    return result;
  }

  async function persistAll(next: {
    layout?: ChassisLayout;
    logos?: LogoConfig;
    ledColors?: LedColorConfig;
    assignments?: Assignments;
  }): Promise<{ ok: boolean; error?: string }> {
    const merged = {
      layout: next.layout ?? liveLayout,
      logos: next.logos ?? liveLogos,
      ledColors: next.ledColors ?? liveLedColors,
      assignments: next.assignments ?? liveAssignments,
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
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  function saveSettings(layout: ChassisLayout, logos: LogoConfig, ledColors: LedColorConfig) {
    return persistAll({ layout, logos, ledColors });
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
    <button type="button" class:active={activeTab === "settings"} on:click={() => (activeTab = "settings")}>
      Settings
    </button>
  </nav>

  <!-- All three tab panels stay mounted once loaded - switching tabs only
       toggles visibility, so nothing re-fetches or re-initializes on every
       switch back to a tab you already visited. -->
  <section class="tab-panel" class:hidden={activeTab !== "map"}>
    {#if layoutLoaded}
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
    <DiskAssignment layout={liveLayout} {disks} {disksError} assignments={liveAssignments} save={saveAssignments} />
  </section>

  <section class="tab-panel" class:hidden={activeTab !== "settings"}>
    {#if layoutLoaded}
      <Settings
        initialLayout={liveLayout}
        initialLogos={liveLogos}
        initialLedColors={liveLedColors}
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
  .legend {
    font-size: 13px;
    padding-left: 18px;
  }
</style>
