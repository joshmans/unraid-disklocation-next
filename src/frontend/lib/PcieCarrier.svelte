<script lang="ts">
  import type { BayDrive } from "./chassis";
  import { pcieCarriers } from "./pciecarriers";
  import { driveIconColors, driveIconSvg, driveIconMeta } from "./driveicons";
  import { statusColor } from "./status";
  import { ROLE_COLORS, ROLE_BADGE_LETTER, roleBadgeBackground, roleLabel, formatSize } from "./role";

  export let carrierId = "default";
  export let label = "";
  export let moduleCount = 4;
  /** Indexed 0..moduleCount-1; a missing/undefined entry renders that slot as empty. */
  export let modules: (BayDrive | undefined)[] = [];
  export let showRoleColor = false;
  export let showRoleIcon = false;

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
      class:fault={row.drive?.status === "critical"}
      style="left:{pct(workArea.x, vb.w)};top:{pct(row.top, vb.h)};width:{pct(workArea.w, vb.w)};height:{pct(rowH, vb.h)};--fault-color:{row.drive ? statusColor(row.drive.status) : 'transparent'}"
    >
      {#if row.drive}
        <div class="notch"></div>
        <div class="pcb" class:role-tinted={showRoleColor} style="--role-color:{row.drive.role ? ROLE_COLORS[row.drive.role] : 'transparent'}">
          <div
            class="chip"
            style="background:{driveIconColors[row.drive.driveType] ?? '#666'}"
            title={driveIconMeta[row.drive.driveType]?.name ?? row.drive.driveType}
          >
            <div class="glyph">{@html driveIconSvg[row.drive.driveType] ?? ""}</div>
          </div>
          <div class="label">
            {row.drive.label}{#if formatSize(row.drive.sizeBytes)} &middot; {formatSize(row.drive.sizeBytes)}{/if}
          </div>
          {#if showRoleIcon && row.drive.role}
            <div class="role-badge" style="background:{roleBadgeBackground(row.drive.role)}" title={roleLabel(row.drive.role, row.drive.poolName)}>
              {ROLE_BADGE_LETTER[row.drive.role]}
            </div>
          {/if}
          <div class="led" style="background:{statusColor(row.drive.status)}"></div>
          <div class="screw"></div>
        </div>
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
    /* No gap - the notch and pcb should butt together like a card actually
       seated in its connector, not float apart. */
    gap: 0;
    box-sizing: border-box;
    border-radius: 2px;
  }
  .module.fault {
    animation: module-fault-flash 1s ease-in-out infinite;
  }
  @keyframes module-fault-flash {
    0%,
    100% {
      box-shadow: 0 0 0 0 transparent;
    }
    50% {
      box-shadow: 0 0 0 2px var(--fault-color);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .module.fault {
      animation: none;
      box-shadow: 0 0 0 2px var(--fault-color);
    }
  }
  /* The gold edge-connector "finger" a real M.2 stick plugs in with - kept
     as its own flush-left sliver so the pcb body reads as a card inserted
     into a slot, not just a rounded rectangle. */
  .notch {
    flex: 0 0 3%;
    height: 55%;
    background: #c9a227;
    border-radius: 1px 0 0 1px;
  }
  /* The rest of the stick: a dark PCB strip with a controller-chip square
     (drive-type icon), a label "sticker", a status LED, and a mounting
     screw grommet at the far end - the visual cues a real M.2 module has,
     not just an icon-in-a-circle. */
  .pcb {
    flex: 1 1 auto;
    height: 68%;
    min-width: 0;
    box-sizing: border-box;
    background: #14231a;
    border: 1px solid rgba(232, 231, 226, 0.12);
    border-left: none;
    border-radius: 0 2px 2px 0;
    display: flex;
    align-items: center;
    gap: 5%;
    padding: 0 4%;
  }
  .pcb.role-tinted {
    box-shadow: inset 0 0 0 1px var(--role-color);
  }
  .role-badge {
    flex: 0 0 auto;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font: 700 7px ui-monospace, "SFMono-Regular", Menlo, monospace;
    color: #fff;
  }
  .chip {
    flex: 0 0 auto;
    aspect-ratio: 1;
    height: 68%;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
  }
  .chip .glyph {
    width: 62%;
    height: 62%;
  }
  .chip .glyph :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
  .label {
    flex: 1 1 auto;
    min-width: 0;
    font: 8px ui-monospace, "SFMono-Regular", Menlo, monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .led {
    flex: 0 0 auto;
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }
  .screw {
    flex: 0 0 auto;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #d8d7d2, #6b6c68 75%);
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
