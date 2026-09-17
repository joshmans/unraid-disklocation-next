<script lang="ts">
  import type { ChassisLayout, BayDrive } from "./chassis";
  import { skins } from "./trayskins";
  import TraySkin from "./TraySkin.svelte";

  export let layout: ChassisLayout;
  /** Keyed by BayConfig.id; a bay with no entry renders as empty. */
  export let drives: Record<string, BayDrive> = {};

  $: skinById = new Map(skins.map((s) => [s.id, s]));
</script>

<div class="tray-map">
  {#each layout.groups as group (group.id)}
    <section class="group">
      <h3>{group.label}</h3>
      <div
        class="grid"
        style="grid-template-columns: repeat({group.columns}, minmax(0, 1fr)); grid-template-rows: repeat({group.rows}, auto);"
      >
        {#each group.bays as bay (bay.id)}
          {@const skin = skinById.get(bay.skinId) ?? skins[0]}
          {@const drive = drives[bay.id]}
          <div
            class="bay"
            class:vertical={bay.orientation === "vertical"}
            style="grid-row:{bay.row + 1};grid-column:{bay.col + 1};"
            title={bay.id}
          >
            {#if drive && skin}
              <TraySkin
                {skin}
                orientation={bay.orientation}
                status={drive.status}
                driveType={drive.driveType}
                label={drive.label}
                logoUrl={drive.logoUrl ?? null}
              />
            {:else}
              <div
                class="empty"
                style="aspect-ratio:{bay.orientation === 'horizontal' ? '220/64' : '76/190'}"
              >
                empty
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/each}
</div>

<style>
  .tray-map {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .group h3 {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #78776f;
    margin: 0 0 8px;
  }
  .grid {
    display: grid;
    gap: 6px;
    align-items: end;
  }
  .bay {
    width: 100%;
  }
  .bay.vertical {
    width: 42px;
    justify-self: start;
  }
  .empty {
    width: 100%;
    border: 1px dashed rgba(36, 36, 32, 0.25);
    border-radius: 3px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    font: 8px ui-monospace, "SFMono-Regular", Menlo, monospace;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: rgba(36, 36, 32, 0.35);
  }
</style>
