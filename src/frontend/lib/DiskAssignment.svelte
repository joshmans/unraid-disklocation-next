<script lang="ts">
  import { onMount } from "svelte";
  import type { ChassisLayout, Assignments } from "./chassis";
  import type { DiskResult } from "../../graphql/queries";

  const API_BASE = "/plugins/unraid-disklocation-next/api";

  // Read-only inputs; App.svelte owns the fetch/persist for the same reason
  // Settings.svelte does - one source of truth for the stored document.
  export let layout: ChassisLayout;
  export let disks: DiskResult[] | null;
  export let disksError = "";
  export let assignments: Assignments;
  export let save: (assignments: Assignments) => Promise<{ ok: boolean; error?: string }>;

  let locating = new Set<string>();
  let selectedBay: Record<string, string> = {};
  let status: "idle" | "saving" | "error" = "idle";
  let errorMessage = "";

  onMount(async () => {
    try {
      const res = await fetch(`${API_BASE}/locate`);
      if (res.ok) {
        const { devices } = await res.json();
        locating = new Set(devices);
      }
    } catch {
      // best-effort sync of already-running locate sessions after a reload
    }
  });

  // Every assignable slot in the layout: a bay id, or `${cardId}-m${index}` per PCIe module.
  $: allSlots = layout.groups.flatMap((g) => {
    if (g.kind === "bays") {
      return g.bays.map((b) => ({ id: b.id, label: `${g.label} - row ${b.row + 1}, col ${b.col + 1}` }));
    }
    return g.cards.flatMap((c) =>
      Array.from({ length: c.moduleCount }, (_, i) => ({
        id: `${c.id}-m${i}`,
        label: `${g.label} - ${c.label} - module ${i + 1}`,
      })),
    );
  });
  $: emptySlots = allSlots.filter((slot) => !assignments[slot.id]);
  $: slotLabel = new Map(allSlots.map((s) => [s.id, s.label]));

  $: assignedSerials = new Set(Object.values(assignments));
  $: unassignedDisks = (disks ?? []).filter((d) => !assignedSerials.has(d.serialNum));

  async function toggleLocate(device: string) {
    const starting = !locating.has(device);
    try {
      await fetch(`${API_BASE}/locate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ device, action: starting ? "start" : "stop" }),
      });
    } catch {
      // best-effort - the backend also auto-stops after a few minutes as a safety net
    }
    if (starting) locating.add(device);
    else locating.delete(device);
    locating = locating;
  }

  async function stopAllLocate() {
    try {
      await fetch(`${API_BASE}/locate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "stopAll" }),
      });
    } catch {
      // best-effort
    }
    locating = new Set();
  }

  async function persist(next: Assignments) {
    status = "saving";
    const result = await save(next);
    status = result.ok ? "idle" : "error";
    errorMessage = result.error ?? "";
  }

  async function assign(disk: DiskResult) {
    const bayId = selectedBay[disk.serialNum];
    if (!bayId) return;
    if (locating.has(disk.device)) await toggleLocate(disk.device);
    await persist({ ...assignments, [bayId]: disk.serialNum });
  }

  async function unassign(bayId: string) {
    const next = { ...assignments };
    delete next[bayId];
    await persist(next);
  }
</script>

<div class="assignment">
  {#if disksError}
    <p class="err">
      Couldn't load drives from unraid-api: {disksError}. The daemon needs an API key/URL saved
      (see README) before drives can be listed here.
    </p>
  {:else if disks === null}
    <p class="hint">Loading drives...</p>
  {:else}
    <div class="section-header">
      <h3>Unassigned drives ({unassignedDisks.length})</h3>
      {#if locating.size > 0}
        <button type="button" on:click={stopAllLocate}>Stop all locate ({locating.size})</button>
      {/if}
    </div>
    {#if unassignedDisks.length === 0}
      <p class="hint">Every detected drive is assigned to a bay.</p>
    {/if}
    {#each unassignedDisks as disk (disk.id)}
      <div class="drive-row">
        <div class="drive-info">
          <strong>{disk.vendor} {disk.name}</strong>
          <span class="mono">{disk.serialNum}</span>
          <span class="hint">{disk.interfaceType} - {(disk.size / 1e9).toFixed(0)} GB</span>
        </div>
        <button type="button" class:active={locating.has(disk.device)} on:click={() => toggleLocate(disk.device)}>
          {locating.has(disk.device) ? "Stop" : "Locate"}
        </button>
        <select bind:value={selectedBay[disk.serialNum]}>
          <option value="">Assign to...</option>
          {#each emptySlots as slot (slot.id)}
            <option value={slot.id}>{slot.label}</option>
          {/each}
        </select>
        <button type="button" disabled={!selectedBay[disk.serialNum]} on:click={() => assign(disk)}>Assign</button>
      </div>
    {/each}

    <h3>Assigned bays ({Object.keys(assignments).length})</h3>
    {#if Object.keys(assignments).length === 0}
      <p class="hint">No bays assigned yet.</p>
    {/if}
    {#each Object.entries(assignments) as [bayId, serial] (bayId)}
      <div class="drive-row">
        <span class="mono">{slotLabel.get(bayId) ?? bayId}</span>
        <span class="mono">{serial}</span>
        <button type="button" on:click={() => unassign(bayId)}>Unassign</button>
      </div>
    {/each}
  {/if}
  {#if status === "error"}<p class="err">Error: {errorMessage}</p>{/if}
</div>

<style>
  .assignment {
    font-size: 13px;
  }
  .section-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  h3 {
    font-size: 13px;
    margin: 12px 0 4px;
  }
  .hint {
    color: var(--muted);
  }
  .drive-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
  }
  .drive-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1 1 auto;
    min-width: 0;
  }
  .mono {
    font: 12px ui-monospace, "SFMono-Regular", Menlo, monospace;
  }
  .assignment :global(button),
  .assignment :global(select) {
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 5px 10px;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .assignment :global(button.active) {
    background: var(--accent-warn);
    color: #1b1b1d;
    border-color: var(--accent-warn);
  }
  .err {
    color: var(--accent-critical);
  }
</style>
