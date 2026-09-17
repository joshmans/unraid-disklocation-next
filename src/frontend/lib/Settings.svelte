<script lang="ts">
  import type { ChassisLayout, BayGroup, PcieGroup, BayConfig, LogoConfig, Orientation } from "./chassis";
  import { skins } from "./trayskins";
  import { pcieCarriers } from "./pciecarriers";

  // App.svelte owns the fetch/persist and the assignments this layout's bay
  // ids get joined against elsewhere, so it stays the single source of truth
  // for the whole stored document - this component only edits a draft copy
  // and hands it back through `save` (a prop, not an event, so it can await
  // the result and show success/failure inline).
  export let initialLayout: ChassisLayout;
  export let initialLogos: LogoConfig;
  export let save: (layout: ChassisLayout, logos: LogoConfig) => Promise<{ ok: boolean; error?: string }>;

  function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }

  let layout: ChassisLayout = clone(initialLayout);
  let logos: LogoConfig = { ...initialLogos };
  let status: "idle" | "saving" | "saved" | "error" = "idle";
  let errorMessage = "";

  function buildBays(rows: number, columns: number, existing: BayConfig[]): BayConfig[] {
    const byPos = new Map(existing.map((b) => [`${b.row}-${b.col}`, b]));
    const bays: BayConfig[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const prior = byPos.get(`${row}-${col}`);
        bays.push(
          prior ?? {
            id: `bay-${crypto.randomUUID()}`,
            row,
            col,
            skinId: skins[0]?.id ?? "classic",
            orientation: "horizontal",
          },
        );
      }
    }
    return bays;
  }

  function resizeGroup(group: BayGroup, rows: number, columns: number) {
    group.rows = Math.max(1, rows);
    group.columns = Math.max(1, columns);
    group.bays = buildBays(group.rows, group.columns, group.bays);
    layout = layout;
  }

  function setGroupSkin(group: BayGroup, skinId: string) {
    group.bays = group.bays.map((b) => ({ ...b, skinId }));
    layout = layout;
  }

  function setGroupOrientation(group: BayGroup, orientation: string) {
    const o = orientation as Orientation;
    group.bays = group.bays.map((b) => ({ ...b, orientation: o }));
    layout = layout;
  }

  function addGroup(kind: "bays" | "pcie") {
    const group: BayGroup | PcieGroup =
      kind === "bays"
        ? { kind: "bays", id: `group-${crypto.randomUUID()}`, label: "New bay group", rows: 1, columns: 4, bays: buildBays(1, 4, []) }
        : {
            kind: "pcie",
            id: `pcie-${crypto.randomUUID()}`,
            label: "New PCIe group",
            cards: [{ id: `card-${crypto.randomUUID()}`, carrierId: pcieCarriers[0]?.id ?? "default", label: "x16 NVMe carrier", moduleCount: 4 }],
          };
    layout.groups = [...layout.groups, group];
  }

  function removeGroup(id: string) {
    layout.groups = layout.groups.filter((g) => g.id !== id);
  }

  function addCard(group: PcieGroup) {
    group.cards = [
      ...group.cards,
      { id: `card-${crypto.randomUUID()}`, carrierId: pcieCarriers[0]?.id ?? "default", label: "New card", moduleCount: 4 },
    ];
    layout = layout;
  }

  function removeCard(group: PcieGroup, id: string) {
    group.cards = group.cards.filter((c) => c.id !== id);
    layout = layout;
  }

  function setLogo(skinId: string, url: string) {
    logos = { ...logos, [skinId]: url };
  }

  async function onSaveClick() {
    status = "saving";
    errorMessage = "";
    const result = await save(clone(layout), { ...logos });
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

<div class="settings">
  {#each layout.groups as group (group.id)}
    <div class="group-editor">
      <div class="group-header">
        <input type="text" bind:value={group.label} placeholder="Group label" />
        <button type="button" class="remove" on:click={() => removeGroup(group.id)}>Remove group</button>
      </div>

      {#if group.kind === "bays"}
        <div class="fields">
          <label>
            Rows
            <input
              type="number"
              min="1"
              value={group.rows}
              on:change={(e) => resizeGroup(group, +e.currentTarget.value, group.columns)}
            />
          </label>
          <label>
            Columns
            <input
              type="number"
              min="1"
              value={group.columns}
              on:change={(e) => resizeGroup(group, group.rows, +e.currentTarget.value)}
            />
          </label>
          <label>
            Skin
            <select value={group.bays[0]?.skinId} on:change={(e) => setGroupSkin(group, e.currentTarget.value)}>
              {#each skins as s (s.id)}
                <option value={s.id}>{s.name}</option>
              {/each}
            </select>
          </label>
          <label>
            Orientation
            <select
              value={group.bays[0]?.orientation}
              on:change={(e) => setGroupOrientation(group, e.currentTarget.value)}
            >
              <option value="horizontal">Horizontal (3.5&quot;)</option>
              <option value="vertical">Vertical (2.5&quot;)</option>
            </select>
          </label>
        </div>
        <p class="hint">{group.bays.length} bay(s). Skin/orientation apply to the whole group.</p>
      {:else}
        {#each group.cards as card (card.id)}
          <div class="fields card-row">
            <label class="grow">
              Label
              <input type="text" bind:value={card.label} />
            </label>
            <label>
              Modules
              <input type="number" min="1" max="8" bind:value={card.moduleCount} />
            </label>
            <label>
              Shell
              <select bind:value={card.carrierId}>
                {#each pcieCarriers as c (c.id)}
                  <option value={c.id}>{c.name}</option>
                {/each}
              </select>
            </label>
            <button type="button" class="remove" on:click={() => removeCard(group, card.id)}>Remove</button>
          </div>
        {/each}
        <button type="button" on:click={() => addCard(group)}>Add card</button>
      {/if}
    </div>
  {/each}

  <div class="add-group">
    <button type="button" on:click={() => addGroup("bays")}>+ Bay group</button>
    <button type="button" on:click={() => addGroup("pcie")}>+ PCIe group</button>
  </div>

  <h3>Manufacturer logos</h3>
  <p class="hint">Hotlinked logo URL applied to every bay using that skin. Leave blank for none.</p>
  {#each skins as s (s.id)}
    <label class="logo-row">
      <span>{s.name}</span>
      <input
        type="url"
        placeholder="https://..."
        value={logos[s.id] ?? ""}
        on:change={(e) => setLogo(s.id, e.currentTarget.value)}
      />
    </label>
  {/each}

  <div class="save-row">
    <button type="button" on:click={onSaveClick} disabled={status === "saving"}>
      {status === "saving" ? "Saving..." : "Save layout"}
    </button>
    {#if status === "saved"}<span class="ok">Saved</span>{/if}
    {#if status === "error"}<span class="err">Error: {errorMessage}</span>{/if}
  </div>
</div>

<style>
  .settings {
    font-size: 13px;
  }
  .group-editor {
    border: 1px solid rgba(36, 36, 32, 0.15);
    border-radius: 4px;
    padding: 10px 12px;
    margin-bottom: 10px;
  }
  .group-header {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }
  .group-header input {
    flex: 1;
    font-weight: 600;
  }
  .fields {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: end;
  }
  .fields label {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .fields label.grow {
    flex: 1 1 auto;
    min-width: 120px;
  }
  .fields input[type="number"] {
    width: 60px;
  }
  .card-row {
    margin-bottom: 8px;
  }
  .hint {
    color: #78776f;
    margin: 6px 0 0;
  }
  .add-group {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
  }
  h3 {
    font-size: 13px;
    margin: 0 0 4px;
  }
  .logo-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 4px 0;
  }
  .logo-row span {
    width: 110px;
    flex: 0 0 auto;
  }
  .logo-row input {
    flex: 1;
  }
  .save-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 16px;
  }
  .remove {
    color: #a33;
  }
  .ok {
    color: #4a9d5f;
  }
  .err {
    color: #c9463c;
  }
</style>
