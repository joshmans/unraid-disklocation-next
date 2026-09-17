<script lang="ts">
  import type { Skin } from "./trayskins";
  import { driveIconColors, driveIconSvg } from "./driveicons";
  import { statusColor } from "./status";

  export let skin: Skin;
  export let orientation: "horizontal" | "vertical" = "horizontal";
  export let status: "ok" | "warn" | "critical" = "ok";
  export let driveType: "hdd" | "ssd" | "nvme" = "hdd";
  export let label = "";
  export let logoUrl: string | null = null;

  $: vb = orientation === "horizontal" ? { w: 220, h: 64 } : { w: 76, h: 190 };
  $: svgMarkup = orientation === "horizontal" ? skin.svg.horizontal : skin.svg.vertical;
  $: o = skin.overlays[orientation];
  $: ledColor = statusColor(status);
  $: iconColor = driveIconColors[driveType] ?? "#666";
  $: iconSvg = driveIconSvg[driveType] ?? "";

  function pct(value: number, total: number): string {
    return `${(value / total) * 100}%`;
  }
</script>

<div class="tray-skin" style="aspect-ratio:{vb.w}/{vb.h}">
  <div class="base">{@html svgMarkup}</div>

  <div
    class="led"
    style="left:{pct(o.led.cx ?? 0, vb.w)};top:{pct(o.led.cy ?? 0, vb.h)};width:{pct((o.led.r ?? 4) * 2, vb.w)};background:{ledColor}"
  ></div>

  <div
    class="icon"
    style="left:{pct((o.icon.cx ?? 0) - (o.icon.r ?? 8), vb.w)};top:{pct((o.icon.cy ?? 0) - (o.icon.r ?? 8), vb.h)};width:{pct((o.icon.r ?? 8) * 2, vb.w)};height:{pct((o.icon.r ?? 8) * 2, vb.h)};background:{iconColor}"
  >
    <div class="glyph">{@html iconSvg}</div>
  </div>

  <div
    class="logo"
    style="left:{pct(o.logo.x ?? 0, vb.w)};top:{pct(o.logo.y ?? 0, vb.h)};width:{pct(o.logo.size ?? 16, vb.w)};height:{pct(o.logo.size ?? 16, vb.h)}"
  >
    {#if logoUrl}
      <img src={logoUrl} alt="" />
    {/if}
  </div>

  <div
    class="label"
    style="left:{pct(o.label.x ?? 0, vb.w)};top:{pct((o.label.y ?? 0) - 6, vb.h)};color:{o.label.color ?? '#242420'}"
  >
    {label}
  </div>
</div>

<style>
  .tray-skin {
    position: relative;
    width: 100%;
    color: #242420;
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
  .led {
    position: absolute;
    aspect-ratio: 1;
    border-radius: 50%;
    transform: translate(-50%, -50%);
  }
  .icon {
    position: absolute;
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
  .logo {
    position: absolute;
    border: 1px dashed rgba(0, 0, 0, 0.35);
    border-radius: 3px;
    overflow: hidden;
    box-sizing: border-box;
  }
  .logo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
  .label {
    position: absolute;
    font: 8px ui-monospace, "SFMono-Regular", Menlo, monospace;
    white-space: nowrap;
  }
</style>
