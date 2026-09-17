<script lang="ts">
  import { onMount } from "svelte";
  import { skins } from "./lib/trayskins";
  import TraySkin from "./lib/TraySkin.svelte";
  import TrayMap from "./lib/TrayMap.svelte";
  import Settings from "./lib/Settings.svelte";
  import { driveIconMeta } from "./lib/driveicons";
  import { exampleLayout, exampleDrives, exampleLogos } from "./lib/chassis";
  import type { ChassisLayout, LogoConfig } from "./lib/chassis";

  let selectedId = skins[0]?.id;
  let orientation: "horizontal" | "vertical" = "horizontal";

  $: skin = skins.find((s) => s.id === selectedId) ?? skins[0];

  let liveLayout: ChassisLayout = exampleLayout;
  let liveLogos: LogoConfig = exampleLogos;
  let loaded = false;

  onMount(async () => {
    try {
      const res = await fetch("/plugins/unraid-disklocation-next/api/layout");
      if (res.ok) {
        const stored = await res.json();
        if (stored) {
          liveLayout = stored.layout;
          liveLogos = stored.logos;
        }
      }
    } catch {
      // Daemon/proxy not reachable (e.g. local dev) - fall back to the demo layout.
    }
    loaded = true;
  });

  function onSettingsSave(e: CustomEvent<{ layout: ChassisLayout; logos: LogoConfig }>) {
    liveLayout = e.detail.layout;
    liveLogos = e.detail.logos;
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
      {liveLayout.name} - occupancy shown here is sample data; live disk-to-bay assignment isn't
      wired up yet, so a saved layout of your own will render with every bay empty until then.
    </p>
    <div class="map">
      <TrayMap layout={liveLayout} drives={exampleDrives} logos={liveLogos} />
    </div>

    <h2>Layout settings</h2>
    <Settings initialLayout={liveLayout} initialLogos={liveLogos} on:save={onSettingsSave} />
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
