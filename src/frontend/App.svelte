<script lang="ts">
  import { onMount } from "svelte";
  import { skins } from "./lib/trayskins";
  import TraySkin from "./lib/TraySkin.svelte";
  import TrayMap from "./lib/TrayMap.svelte";
  import Settings from "./lib/Settings.svelte";
  import DiskAssignment from "./lib/DiskAssignment.svelte";
  import { driveIconMeta } from "./lib/driveicons";
  import { exampleLayout, exampleDrives, exampleLogos, exampleLedColors } from "./lib/chassis";
  import type { ChassisLayout, LogoConfig, LedColorConfig, Assignments, BayDrive } from "./lib/chassis";
  import type { DiskResult } from "../graphql/queries";
  import { driveFromDisk } from "../shared/derive-drive";

  const API_BASE = "/plugins/unraid-disklocation-next/api";

  let selectedId = skins[0]?.id;
  let orientation: "horizontal" | "vertical" = "horizontal";

  $: skin = skins.find((s) => s.id === selectedId) ?? skins[0];

  let liveLayout: ChassisLayout = exampleLayout;
  let liveLogos: LogoConfig = exampleLogos;
  let liveLedColors: LedColorConfig = exampleLedColors;
  let liveAssignments: Assignments = {};
  let disks: DiskResult[] | null = null;
  let disksError = "";
  let loaded = false;

  onMount(async () => {
    try {
      const res = await fetch(`${API_BASE}/layout`);
      if (res.ok) {
        const stored = await res.json();
        if (stored) {
          liveLayout = stored.layout;
          liveLogos = stored.logos;
          liveAssignments = stored.assignments ?? {};
          liveLedColors = stored.ledColors ?? {};
        }
      }
    } catch {
      // Daemon/proxy not reachable (e.g. local dev) - fall back to the demo layout.
    }

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

    loaded = true;
  });

  // Real assigned occupancy once disks have loaded; the bundled demo occupancy
  // otherwise (unconfigured daemon, or local dev without the proxy in front).
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
  <h1>Disk Location</h1>
  <p class="status">
    Scaffold preview - tray skin picker, not yet wired to live disk data.
  </p>

  <div class="controls">
    <label>
      Skin
      <select bind:value={selectedId}>
        {#each skins as s (s.id)}
          <option value={s.id}>{s.name}</option>
        {/each}
      </select>
    </label>
    <label>
      Orientation
      <select bind:value={orientation}>
        <option value="horizontal">Horizontal (3.5&quot;)</option>
        <option value="vertical">Vertical (2.5&quot;)</option>
      </select>
    </label>
  </div>

  {#if skin}
    <div class="preview" class:vertical={orientation === "vertical"}>
      <TraySkin {skin} {orientation} status="ok" driveType="hdd" label="SN A1B2C3D4" />
    </div>
    <p class="description">{skin.description}</p>
    {#if skin.unofficial}
      <p class="disclaimer">{skin.disclaimer}</p>
    {/if}
  {/if}

  <h2>Drive types</h2>
  <ul class="legend">
    {#each Object.entries(driveIconMeta) as [type, info] (type)}
      <li><strong>{info.name}</strong> - {info.description}</li>
    {/each}
  </ul>

  {#if loaded}
    <h2>Tray map</h2>
    <p class="status">
      {liveLayout.name}
      {#if !disks}- occupancy shown here is sample data ({disksError || "daemon not reachable"}).{/if}
    </p>
    <div class="map">
      <TrayMap layout={liveLayout} drives={liveDrives} logos={liveLogos} ledColors={liveLedColors} />
    </div>

    <h2>Disk assignment</h2>
    <DiskAssignment
      layout={liveLayout}
      {disks}
      {disksError}
      assignments={liveAssignments}
      save={saveAssignments}
    />

    <h2>Layout settings</h2>
    <Settings
      initialLayout={liveLayout}
      initialLogos={liveLogos}
      initialLedColors={liveLedColors}
      save={saveSettings}
    />
  {:else}
    <p class="status">Loading layout...</p>
  {/if}
</main>

<style>
  main {
    font-family: system-ui, -apple-system, sans-serif;
    max-width: 640px;
    color: #242420;
  }
  h1 {
    font-size: 20px;
    margin-bottom: 4px;
  }
  .status {
    font-size: 12px;
    color: #78776f;
    margin-top: 0;
  }
  .controls {
    display: flex;
    gap: 16px;
    margin: 16px 0;
    font-size: 13px;
  }
  .controls label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .preview {
    width: 240px;
    margin: 16px 0;
  }
  .preview.vertical {
    width: 90px;
  }
  .description,
  .disclaimer {
    font-size: 13px;
    color: #78776f;
    margin: 4px 0;
  }
  .legend {
    font-size: 13px;
    padding-left: 18px;
  }
  .map {
    margin: 16px 0 24px;
  }
</style>
