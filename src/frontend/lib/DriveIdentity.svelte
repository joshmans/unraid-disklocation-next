<script lang="ts">
  import type { ChassisLayout, Assignments, BrandLogoConfig, ManufacturerOverrides } from "./chassis";
  import type { DiskResult } from "../../graphql/queries";
  import { KNOWN_BRANDS, detectBrand, brandName } from "./brand";
  import { uploadLogoFile } from "./logo-upload";

  // Same draft-copy/hand-back-through-save pattern as Settings.svelte - App.svelte
  // owns the persisted brandLogos/manufacturerOverrides.
  export let layout: ChassisLayout;
  export let assignments: Assignments;
  export let disks: DiskResult[] | null;
  export let initialBrandLogos: BrandLogoConfig;
  export let initialManufacturerOverrides: ManufacturerOverrides;
  export let save: (
    brandLogos: BrandLogoConfig,
    manufacturerOverrides: ManufacturerOverrides,
  ) => Promise<{ ok: boolean; error?: string }>;

  function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }

  let brandLogos: BrandLogoConfig = { ...initialBrandLogos };
  let manufacturerOverrides: ManufacturerOverrides = clone(initialManufacturerOverrides);
  let status: "idle" | "saving" | "saved" | "error" = "idle";
  let errorMessage = "";

  // Every assignable slot's label, same numbering DiskAssignment.svelte's
  // dropdown uses ("Group - Bay N"), plus the order they appear in the
  // layout so rows read top-to-bottom instead of assignment-insertion order.
  $: slotInfo = new Map(
    layout.groups.flatMap((g, gi) => {
      if (g.kind === "bays") {
        return g.bays.map((b, i) => [b.id, { label: `${g.label} - Bay ${i + 1}`, order: gi * 1000 + i }] as const);
      }
      return g.cards.flatMap((c, ci) =>
        Array.from({ length: c.moduleCount }, (_, i) => [
          `${c.id}-m${i}`,
          { label: `${g.label} - ${c.label} - module ${i + 1}`, order: gi * 1000 + ci * 100 + i },
        ] as const),
      );
    }),
  );

  interface Row {
    bayId: string;
    label: string;
    order: number;
    disk?: DiskResult;
    serial: string;
  }

  $: rows = ((): Row[] => {
    const bySerial = new Map((disks ?? []).map((d) => [d.serialNum, d]));
    return Object.entries(assignments)
      .map(([bayId, serial]) => ({
        bayId,
        serial,
        disk: bySerial.get(serial),
        label: slotInfo.get(bayId)?.label ?? bayId,
        order: slotInfo.get(bayId)?.order ?? Infinity,
      }))
      .sort((a, b) => a.order - b.order);
  })();

  function setOverride(bayId: string, brandId: string) {
    const next = { ...manufacturerOverrides };
    if (brandId) next[bayId] = brandId;
    else delete next[bayId];
    manufacturerOverrides = next;
  }

  function setBrandLogo(brandId: string, url: string) {
    brandLogos = { ...brandLogos, [brandId]: url };
  }

  let logoUploadMessage = "";

  async function onLogoFileChange(brandId: string, e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    logoUploadMessage = "Uploading...";
    const result = await uploadLogoFile("brand", brandId, file);
    if (result.ok && result.url) {
      setBrandLogo(brandId, result.url);
      logoUploadMessage = "";
    } else {
      logoUploadMessage = `Error: ${result.error}`;
    }
    input.value = "";
  }

  async function onSaveClick() {
    status = "saving";
    errorMessage = "";
    const result = await save({ ...brandLogos }, clone(manufacturerOverrides));
    if (result.ok) {
      status = "saved";
      setTimeout(() => {
        if (status === "saved") status = "idle";
      }, 2000);
    } else {
      status = "error";
      errorMessage = result.error ?? "unknown error";
    }
  }
</script>

<div class="identity">
  <section class="settings-section">
    <h3>Brand logos</h3>
    <p class="hint">
      Hotlinked logo URL per detected drive manufacturer, or upload your own SVG instead
      (stored on this box, no hotlinking needed). A bay showing a drive of that brand uses
      this logo instead of its tray skin's own configured logo (Settings tab) - leave
      blank for none.
    </p>
    {#if logoUploadMessage}<p class="hint" class:err={logoUploadMessage.startsWith("Error")}>{logoUploadMessage}</p>{/if}
    {#each KNOWN_BRANDS as brand (brand.id)}
      <label class="logo-row">
        <span>{brand.name}</span>
        <input
          type="url"
          placeholder="https://..."
          value={brandLogos[brand.id] ?? ""}
          on:change={(e) => setBrandLogo(brand.id, e.currentTarget.value)}
        />
        <input type="file" accept=".svg,image/svg+xml" on:change={(e) => onLogoFileChange(brand.id, e)} />
      </label>
    {/each}
  </section>

  <section class="settings-section">
    <h3>Per-bay brand override</h3>
    <p class="hint">
      The brand is auto-detected from each drive's reported vendor/model, which isn't
      always right (rebadged/OEM drives, generic vendor strings). Override it here for a
      specific bay when you know better - "Auto-detect" goes back to the guess.
    </p>
    {#if rows.length === 0}
      <p class="hint">No bays are assigned yet - assign disks on the Disk Assignment tab first.</p>
    {/if}
    {#each rows as row (row.bayId)}
      {@const detected = row.disk ? detectBrand(row.disk.vendor, row.disk.name) : undefined}
      <div class="identity-row">
        <div class="identity-info">
          <strong>{row.label}</strong>
          {#if row.disk}
            <span class="hint">
              {row.disk.vendor} {row.disk.name} ({row.serial}) - detected: {brandName(detected) ?? "unknown"}
            </span>
          {:else}
            <span class="hint">{row.serial} - not currently detected</span>
          {/if}
        </div>
        <select
          value={manufacturerOverrides[row.bayId] ?? ""}
          on:change={(e) => setOverride(row.bayId, e.currentTarget.value)}
        >
          <option value="">Auto-detect{detected ? ` (${brandName(detected)})` : ""}</option>
          {#each KNOWN_BRANDS as brand (brand.id)}
            <option value={brand.id}>{brand.name}</option>
          {/each}
        </select>
      </div>
    {/each}
  </section>

  <div class="save-row">
    <button type="button" on:click={onSaveClick} disabled={status === "saving"}>
      {status === "saving" ? "Saving..." : "Save"}
    </button>
    {#if status === "saved"}<span class="ok">Saved</span>{/if}
    {#if status === "error"}<span class="err">Error: {errorMessage}</span>{/if}
  </div>
</div>

<style>
  .identity {
    font-size: 13px;
  }
  .settings-section {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 10px 12px;
    margin-bottom: 16px;
  }
  .settings-section h3 {
    margin: 0 0 4px;
    font-size: 13px;
  }
  .hint {
    color: var(--muted);
    margin: 6px 0 0;
  }
  .logo-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 4px 0;
  }
  .logo-row span {
    width: 130px;
    flex: 0 0 auto;
  }
  .logo-row input[type="url"] {
    flex: 1;
  }
  .logo-row input[type="file"] {
    flex: 0 0 auto;
    max-width: 160px;
  }
  .identity-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
  }
  .identity-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1 1 auto;
    min-width: 0;
  }
  .identity :global(input),
  .identity :global(select) {
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 4px 6px;
    font: inherit;
    font-size: 13px;
  }
  .identity :global(button) {
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 5px 10px;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .save-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 16px;
  }
  .ok {
    color: var(--accent-ok);
  }
  .err {
    color: var(--accent-critical);
  }
</style>
