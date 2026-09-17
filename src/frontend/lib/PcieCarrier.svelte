<script lang="ts">
  import type { BayDrive } from "./chassis";
  import { pcieCarriers } from "./pciecarriers";
  import { driveIconColors, driveIconSvg } from "./driveicons";
  import { statusColor } from "./status";

  export let carrierId = "default";
  export let label = "";
  export let moduleCount = 4;
  /** Indexed 0..moduleCount-1; a missing/undefined entry renders that slot as empty. */
  export let modules: (BayDrive | undefined)[] = [];

  const vb = { w: 520, h: 150 };
  // Leaves room for the heatsink block (x 16-80) and the edge-connector
  // fingers (y 140-154) baked into the shell - see assets/pcie-carrier/README.md.
  const workArea = { x: 90, y: 14, w: 415, h: 120 };
  const gap = 6;

  $: carrier = pcieCarriers.find((c) => c.id === carrierId) ?? pcieCarriers[0];
  $: rowH = (workArea.h - gap * Math.max(moduleCount - 1, 0)) / Math.max(moduleCount, 1);
  $: rows = Array.from({ length: moduleCount }, (_, i) => ({
    top: workArea.y + i * (rowH + gap),
    drive: modules[i],
  }));

  function pct(value: number, total: number): string {
    return `${(value / total) * 100}%`;
  }
</script>

<div class="pcie-carrier" style="aspect-ratio:{vb.w}/{vb.h}">
  <div class="base">{@html carrier?.svg ?? ""}</div>

  {#each rows as row, i (i)}
    <div
      class="module"
      style="left:{pct(workArea.x, vb.w)};top:{pct(row.top, vb.h)};width:{pct(workArea.w, vb.w)};height:{pct(rowH, vb.h)}"
    >
      {#if row.drive}
        <div class="notch"></div>
        <div class="icon" style="background:{driveIconColors[row.drive.driveType] ?? '#666'}">
          <div class="glyph">{@html driveIconSvg[row.drive.driveType] ?? ""}</div>
        </div>
        <div class="label">{row.drive.label}</div>
        <div class="led" style="background:{statusColor(row.drive.status)}"></div>
      {:else}
        <div class="empty">empty</div>
      {/if}
    </div>
  {/each}
</div>
{#if label}<p class="card-label">{label}</p>{/if}

<style>
  .pcie-carrier {
    position: relative;
    width: 100%;
    color: #e8e7e2;
  }
  .base {
    position: absolute;
    inset: 0;
  }
  .base :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }
  .module {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 3%;
    box-sizing: border-box;
  }
  .notch {
    flex: 0 0 4%;
    height: 60%;
    background: #c9a227;
    border-radius: 1px;
  }
  .icon {
    flex: 0 0 auto;
    aspect-ratio: 1;
    height: 78%;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
  }
  .icon .glyph {
    width: 62%;
    height: 62%;
  }
  .icon .glyph :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
  .label {
    flex: 1 1 auto;
    font: 8px ui-monospace, "SFMono-Regular", Menlo, monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .led {
    flex: 0 0 auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .empty {
    width: 100%;
    height: 100%;
    border: 1px dashed rgba(232, 231, 226, 0.3);
    border-radius: 3px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    font: 8px ui-monospace, "SFMono-Regular", Menlo, monospace;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: rgba(232, 231, 226, 0.4);
  }
  .card-label {
    font-size: 12px;
    color: #78776f;
    margin: 4px 0 0;
  }
</style>
