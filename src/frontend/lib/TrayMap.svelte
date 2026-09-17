<script lang="ts">
  import type { ChassisLayout, BayDrive, LogoConfig, LedColorConfig } from "./chassis";
  import { skins } from "./trayskins";
  import TraySkin from "./TraySkin.svelte";
  import PcieCarrier from "./PcieCarrier.svelte";
  import { resolveLedColor } from "./status";

  export let layout: ChassisLayout;
  /** Keyed by BayConfig.id (bays) or `${cardId}-m${index}` (PCIe modules); no entry = empty. */
  export let drives: Record<string, BayDrive> = {};
  /** Manufacturer logo URL per tray-skin id (see assets/tray-skins/README.md); no entry = no logo overlay. */
  export let logos: LogoConfig = {};
  /** Status-LED color overrides per tray-skin id; no entry = that skin's own meta.json default. */
  export let ledColors: LedColorConfig = {};

  $: skinById = new Map(skins.map((s) => [s.id, s]));
</script>

<div class="tray-map">
  {#each layout.groups as group (group.id)}
    <section class="group">
      <h3>{group.label}</h3>
      {#if group.kind === "bays"}
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
                  logoUrl={logos[bay.skinId] ?? null}
                  ledColor={resolveLedColor(skin, ledColors, drive.status)}
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
      {:else}
        <div class="cards">
          {#each group.cards as card (card.id)}
            {@const cardModules = Array.from({ length: card.moduleCount }, (_, i) => drives[`${card.id}-m${i}`])}
            <div class="card" title={card.id}>
              <PcieCarrier
                carrierId={card.carrierId}
                label={card.label}
                moduleCount={card.moduleCount}
                modules={cardModules}
              />
            </div>
          {/each}
        </div>
      {/if}
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
    color: var(--muted);
    margin: 0 0 8px;
  }
  .grid {
    display: grid;
    gap: 6px;
    align-items: end;
  }
  .cards {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  .card {
    width: 220px;
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
    border: 1px dashed var(--border);
    border-radius: 3px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    font: 8px ui-monospace, "SFMono-Regular", Menlo, monospace;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
  }
</style>
