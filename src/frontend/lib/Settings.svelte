<script lang="ts">
  import { onMount } from "svelte";
  import type { ChassisLayout, BayGroup, PcieGroup, BayConfig, LogoConfig, LedColorConfig, DriveStatus, Orientation } from "./chassis";
  import { skins } from "./trayskins";
  import { pcieCarriers } from "./pciecarriers";
  import { resolveLedColor } from "./status";
  import { getDaemonStatus, startDaemon, setDaemonPort, type DaemonStatus } from "./daemon-control";

  // App.svelte owns the fetch/persist and the assignments this layout's bay
  // ids get joined against elsewhere, so it stays the single source of truth
  // for the whole stored document - this component only edits a draft copy
  // and hands it back through `save` (a prop, not an event, so it can await
  // the result and show success/failure inline).
  export let initialLayout: ChassisLayout;
  export let initialLogos: LogoConfig;
  export let initialLedColors: LedColorConfig;
  export let initialSmartHistoryDbPath = "";
  export let save: (
    layout: ChassisLayout,
    logos: LogoConfig,
    ledColors: LedColorConfig,
    smartHistoryDbPath: string,
  ) => Promise<{ ok: boolean; error?: string }>;

  const DEFAULT_SMART_DB_PATH = "/boot/config/plugins/unraid-disklocation-next/smart-history.db";

  function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }

  let layout: ChassisLayout = clone(initialLayout);
  let logos: LogoConfig = { ...initialLogos };
  let ledColors: LedColorConfig = clone(initialLedColors);
  let smartHistoryDbPath = initialSmartHistoryDbPath;
  let status: "idle" | "saving" | "saved" | "error" = "idle";
  let errorMessage = "";

  let daemonStatus: DaemonStatus | null = null;
  let daemonActionInFlight = false;
  let daemonMessage = "";
  let portDraft = "";

  async function refreshDaemonStatus() {
    daemonStatus = await getDaemonStatus();
    if (daemonStatus) portDraft = String(daemonStatus.port);
  }

  onMount(refreshDaemonStatus);

  async function onStartDaemonClick() {
    daemonActionInFlight = true;
    daemonMessage = "";
    const result = await startDaemon();
    daemonMessage = result.message ?? (result.ok ? "Started" : "Failed to start");
    daemonActionInFlight = false;
    setTimeout(refreshDaemonStatus, 1500);
  }

  async function onSavePortClick() {
    const port = parseInt(portDraft, 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      daemonMessage = "Port must be an integer between 1 and 65535";
      return;
    }
    daemonActionInFlight = true;
    daemonMessage = "";
    const result = await setDaemonPort(port);
    daemonMessage = result.message ?? (result.ok ? "Saved" : "Failed to save");
    daemonActionInFlight = false;
    refreshDaemonStatus();
  }

  const LED_STATUSES: DriveStatus[] = ["ok", "warn", "critical"];
  const LED_STATUS_LABELS: Record<DriveStatus, string> = { ok: "OK", warn: "Warn", critical: "Critical" };

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

  function setLedColor(skinId: string, ledStatus: DriveStatus, color: string) {
    ledColors = { ...ledColors, [skinId]: { ...ledColors[skinId], [ledStatus]: color } };
  }

  function resetLedColors(skinId: string) {
    const next = { ...ledColors };
    delete next[skinId];
    ledColors = next;
  }

  async function onSaveClick() {
    status = "saving";
    errorMessage = "";
    const result = await save(clone(layout), { ...logos }, clone(ledColors), smartHistoryDbPath.trim());
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

  <section class="settings-section">
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
  </section>

  <section class="settings-section">
    <h3>LED colors</h3>
    <p class="hint">
      Each skin has its own default status-LED color (real trays don't all blink the same color) -
      override any of them here. Reset clears an override back to that skin's default.
    </p>
    {#each skins as s (s.id)}
      <div class="led-row">
        <span class="skin-name">{s.name}</span>
        {#each LED_STATUSES as st (st)}
          <label class="led-swatch">
            {LED_STATUS_LABELS[st]}
            <input
              type="color"
              value={resolveLedColor(s, ledColors, st)}
              on:input={(e) => setLedColor(s.id, st, e.currentTarget.value)}
            />
          </label>
        {/each}
        <button
          type="button"
          class="remove"
          disabled={!ledColors[s.id]}
          on:click={() => resetLedColors(s.id)}
        >
          Reset
        </button>
      </div>
    {/each}
  </section>

  <section class="settings-section">
    <h3>Daemon</h3>
    {#if daemonStatus === null}
      <p class="hint">Checking daemon status...</p>
    {:else}
      <p class="hint">
        Status:
        <span class:ok={daemonStatus.running} class:err={!daemonStatus.running}>
          {daemonStatus.running ? `Running on port ${daemonStatus.port}` : `Not running (configured port: ${daemonStatus.port})`}
        </span>
      </p>
      <div class="daemon-row">
        <button type="button" on:click={onStartDaemonClick} disabled={daemonActionInFlight}>
          {daemonActionInFlight ? "Working..." : daemonStatus.running ? "Restart daemon" : "Start daemon"}
        </button>
      </div>
      <label class="db-path-row">
        Port
        <input type="number" min="1" max="65535" bind:value={portDraft} disabled={daemonStatus.running} />
      </label>
      <button type="button" on:click={onSavePortClick} disabled={daemonStatus.running || daemonActionInFlight}>
        Save port
      </button>
      <p class="hint">
        Only changeable while the daemon isn't running, so a Docker container or another
        service can't collide with whatever it's currently bound to. Takes effect the next
        time it starts.
      </p>
    {/if}
    {#if daemonMessage}<p class="hint">{daemonMessage}</p>{/if}
  </section>

  <section class="settings-section">
    <h3>Storage</h3>
    <label class="db-path-row">
      SMART history database path
      <input type="text" bind:value={smartHistoryDbPath} placeholder={DEFAULT_SMART_DB_PATH} />
    </label>
    <p class="hint">
      This is the one file this plugin writes to often (every SMART poll cycle) rather than
      only when you save a change here, and the default lives on the flash boot drive - some
      people prefer to redirect it to the array or a cache pool instead. Leave blank to use
      the default. Takes effect the next time the plugin's service restarts.
    </p>
  </section>

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
  .settings :global(input),
  .settings :global(select) {
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 4px 6px;
    font: inherit;
    font-size: 13px;
  }
  .settings :global(input[type="color"]) {
    padding: 0;
  }
  .settings :global(button) {
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 5px 10px;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .group-editor {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 10px 12px;
    margin-bottom: 10px;
  }
  .settings-section {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 10px 12px;
    margin-bottom: 16px;
  }
  .settings-section h3 {
    margin-top: 0;
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
    color: var(--muted);
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
  .db-path-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 4px 0 0;
    max-width: 480px;
  }
  .daemon-row {
    margin: 4px 0;
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
  .led-row {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 6px 0;
  }
  .led-row .skin-name {
    width: 110px;
    flex: 0 0 auto;
  }
  .led-swatch {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--muted);
  }
  .led-swatch input[type="color"] {
    width: 28px;
    height: 22px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 3px;
    background: none;
    cursor: pointer;
  }
  .save-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 16px;
  }
  .settings :global(button.remove) {
    color: var(--accent-critical);
  }
  .settings :global(button:disabled) {
    opacity: 0.4;
    cursor: default;
  }
  .ok {
    color: var(--accent-ok);
  }
  .err {
    color: var(--accent-critical);
  }
</style>
