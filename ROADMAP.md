# Roadmap

## Background

This project starts from the "Phase 3" idea in
[unraid-disklocation](https://github.com/joshmans/unraid-disklocation)'s
[ROADMAP.md](https://github.com/joshmans/unraid-disklocation/blob/master/ROADMAP.md):
rebuild the Disk Location concept (tray/bay drive map, SMART health history) on Unraid's
modern plugin stack instead of the classic PHP/webGUI architecture, once that PHP codebase
reached feature-complete/maintenance mode. That milestone was reached 2026-09-16, and this
repo is the result of scoping what "rebuild on the modern stack" actually means in practice.

This is a clean-room rewrite. It does not share code, files, or git history with the PHP
plugin, and depends on nothing from it at runtime. The relationship is inspiration and
mechanics only — the tray-map/SMART-history *ideas* carry over conceptually; nothing else
does.

## Key finding that shaped this repo's architecture

The original framing was "a native `unraid-api` plugin that registers its own GraphQL
resolvers and WebGUI components," on the assumption that `unraid-api` (Unraid's built-in
NestJS/GraphQL service, shipped in the OS since 7.2, Aug 2025) has a documented extensibility
point for third-party plugins to hook into that process, the way the PHP webGUI has
`.plg`/`.page` files.

As of this writing (2026-09), that doesn't appear to exist for outside developers:

- The official [unraid/api](https://github.com/unraid/api) repo's own developer docs cover
  building the first-party API/Connect package itself, not a third-party plugin contract.
- Unraid's own published roadmap lists "Developer Tools for Plugins" as a Q2 2025 target,
  still unshipped as of this writing.
- Every real third-party project found in the wild that touches `unraid-api`
  (Home Assistant integrations, MCP servers, monitoring agents) does so as an external
  client authenticating with an API key and querying the existing GraphQL schema — none
  extend the schema or inject WebGUI components in-process.

Decision: build as a **standalone TypeScript/Node.js service** that authenticates to
`unraid-api` via an API key and reads array/disk/SMART state over GraphQL, rather than
attempting in-process plugin registration. If Unraid ships a real third-party plugin SDK
later, revisit — this project's GraphQL-client core should mostly carry over either way, since
the in-process gap is only in *how it's loaded and how it draws UI*, not in *how it reads
data*.

## Settled decisions

- **Minimum Unraid version: 7.2+.** `unraid-api` is not present before that, so there's no
  lower floor to design around.
- **Repo/codebase: fully separate from `unraid-disklocation`.** Independent history,
  independent versioning, independent distribution — not a package inside that repo.
- **Approach: full rewrite, not a gradual migration.** There's no PHP logic worth wrapping
  behind a resolver; the data access pattern (GraphQL query vs. file-parsing/`smartctl`
  shell-out) is different enough that a wrapper would be its own throwaway layer.
- **Distribution: `.plg`-installed Node.js daemon, not a Docker container.** Closer to the
  original plugin's install experience and lets it register in Unraid's own nav (`Tools/`),
  rather than living in the Docker tab as a separate app. Precedent: plugins like
  netbird-unraid already install/supervise non-PHP daemons this way, via an `rc.d` script
  under `/usr/local/etc/rc.d/` (never `/etc/rc.d/`, which Unraid owns as a runtime symlink -
  packaging into it can break nginx/php-fpm/samba/docker) started by an array-start event
  hook. Skeleton: [plugin/rc.d/rc.unraid-disklocation-next](plugin/rc.d/rc.unraid-disklocation-next),
  [plugin/unraid-disklocation-next.plg](plugin/unraid-disklocation-next.plg).
- **UI delivery: mounted into the DOM, not an iframe.** The `.page` file is a normal plugin
  page with a mount `<div>` and a `<script>` tag loading this project's own bundled
  frontend JS - it renders in the same document, not a nested browsing context (iframing
  Unraid's own UI is a known source of breakage, e.g. the Connect plugin's iframe issues on
  the forums). API calls stay same-origin via an nginx `conf.d` drop-in snippet that
  reverse-proxies a path to the local daemon - Unraid's nginx already includes
  `/etc/nginx/conf.d/*.conf`, so this needs no separate reverse-proxy container. Skeleton:
  [plugin/pages/DiskLocationNext.page](plugin/pages/DiskLocationNext.page),
  [plugin/nginx/unraid-disklocation-next.conf](plugin/nginx/unraid-disklocation-next.conf).
- **Runtime packaging: Node.js + Single Executable Applications (SEA), not Bun.** SEA has
  been stable since Node 22 and streamlined further in Node 24 (`--build-sea`), so the
  `.plg` ships a compiled binary with no separate Node.js install required on the box
  (Unraid doesn't bundle Node.js itself). Chosen over Bun's `--compile` because it keeps the
  project on the actual Node.js runtime's long-term stability guarantees, which matters more
  than Bun's currently-smoother build ergonomics for something meant to run unattended for
  years. SQLite storage will use the built-in `node:sqlite` (Release Candidate, API-stable)
  rather than `better-sqlite3` specifically so there's no native `.node` addon that SEA can't
  embed in the blob - `node:sqlite` ships inside Node itself, so this isn't an issue.
  Note this doesn't help multiple independent Node-based plugins share a runtime: each
  compiled binary is its own OS process with its own heap regardless of packaging method -
  Node has no mechanism for one process to attach to another's running runtime, so this
  isn't something to design around.
- **The `unraid-api` GraphQL schema, verified 2026-09 against a live 7.2+ instance** (both
  by reading [unraid/api](https://github.com/unraid/api)'s resolver source and by running
  real queries against a real box - see [src/graphql/queries.ts](src/graphql/queries.ts)).
  Three findings that shape everything below:
  - `disks` (physical inventory: serial, model, vendor, size, `temperature`, and only a
    coarse `smartStatus: OK | UNKNOWN` - no detailed attributes) and `array` (logical
    Unraid slot assignment: `idx`, disk1/disk2/parity/cacheN/flash groupings) both work as
    expected and are now real, typed queries, not guesses.
  - **Unraid has no concept of physical bay/tray position, confirmed by the schema having
    none.** `array.idx` is a *logical* slot number, not a chassis location. This was always
    true of the original PHP plugin too (it's the entire reason "Disk Location" exists as
    a plugin rather than something Unraid itself shows) - it just confirms the physical
    mapping stays 100% this plugin's own stored config either way, unaffected by the
    rewrite.
  - **Detailed SMART attributes are not exposed over GraphQL, even though `unraid-api`
    reads them internally.** `DisksService.getTemperature()` runs `smartctl -A -j <device>`
    and parses the full `ata_smart_attributes.table` (the standard ATA attribute table -
    power-on hours, reallocated sectors, etc.) via its own zod schema, then discards
    everything except `temperature.current` before it reaches GraphQL. So this plugin's
    SMART-history feature (the whole reason for the original plugin's Trends tab) has to
    shell out to `smartctl` itself, the same way the PHP version did - `unraid-api` doesn't
    give us a shortcut here. This is a point in favor of the `.plg`-daemon-on-host
    distribution decision already made: a Docker container would need extra
    privileged/device-passthrough config to run `smartctl` against physical devices, a
    host-native daemon just does it directly.
- **Auth: always a stored API key, no session/cookie reuse.** `unraid-api` does support
  cookie-based auth alongside API keys (confirmed in `auth.service.ts`), but it doesn't
  matter here: SMART-history collection has to run as a background poll independent of any
  open browser tab, which only a persistent API key can do. Passing through a browser
  session cookie would still leave the background-polling path needing a stored key, so
  there's no scenario where it replaces one - not worth the added complexity.
- **SMART history storage.** The PHP version's purpose-built SQLite time series (temp,
  power-on hours, sector counts, wear level, overall status; configurable retention) is a
  good design and the plan is to carry the *idea* forward using `node:sqlite` (see runtime
  packaging above), fed by this plugin's own `smartctl` calls per the finding above - not
  yet built.
- **Frontend framework: Svelte, built with Vite.** Chosen for a widget mounted directly
  into someone else's page (no iframe, per the UI-delivery decision above): Svelte compiles
  away to plain JS with no runtime framework object to load, and its scoped-by-default CSS
  and built-in transitions suit a small, visually-controlled widget better than shipping a
  full framework runtime. Verified with a real build, not just assumed - see below.
- **Tray-map visuals: a contributable, directory-discovered skin system**, not a hardcoded
  set of hand-picked designs. Each skin is a plain SVG pair (`horizontal.svg` /
  `vertical.svg` - real hardware mounts 3.5" drives flat/wide and 2.5" drives on edge/narrow,
  and either orientation should be selectable regardless of drive size) plus a `meta.json`
  declaring anchor points for four runtime overlays: SMART-status LED, drive-type icon,
  optional manufacturer logo, and a serial/model label. Skins draw only the hardware shell -
  never the dynamic bits, and never a manufacturer logo (logos stay exclusively on the
  existing user-configured logo framework, so a skin PR carries no trademark risk).
  [assets/tray-skins/README.md](assets/tray-skins/README.md) is the contribution guide.
  The frontend enumerates skins via `import.meta.glob('assets/tray-skins/*/meta.json')` at
  build time - adding a skin is a new directory and a PR, no code change. Shipped with six
  skins: a `classic` flat swatch (matching the original plugin), an unbranded `generic`
  archetype, and four vendor-styled ones researched against real part numbers rather than
  memory (SuperMicro SC93301, Dell 8FKXC/PowerEdge 13th-gen, HP 651687-001/651314-001,
  NetApp DS4246) - each corrected at least once after checking an actual product photo
  turned up a detail (Dell's orange accent ring, not a blue latch) that general recollection
  had wrong. Built and rendered end-to-end in a real browser against the compiled
  `dist/frontend.js` before being called done - see [src/frontend/](src/frontend/).
- **Drive-type icons**: real distinct silhouettes, not three variations on a rounded
  rectangle - HDD is a platter+arm circle, SSD is a flat rectangular drive body, NVMe is a
  notched gumstick (the actual M.2 module shape). [assets/drive-icons/](assets/drive-icons/).
- **Tray-map grid: a chassis is a list of groups, not one flat grid.** A real chassis is
  physically segmented (e.g. a front 3.5" hot-swap cage, a separate rear 2.5" cage, and an
  add-in PCIe carrier aren't one continuous grid), so
  [chassis-types.ts](src/shared/chassis-types.ts) models a `ChassisLayout` as a list of
  `Group`s - either a `BayGroup` (its own `rows`/`columns` grid of `BayConfig` entries, skin
  id + orientation per bay) or a `PcieGroup` (a list of carrier cards, each with a module
  count and shell id). [TrayMap.svelte](src/frontend/lib/TrayMap.svelte) renders each group as
  its own labeled section - a CSS grid of `TraySkin` instances for a `BayGroup`, a row of
  `PcieCarrier` instances for a `PcieGroup` - keyed by a stable id (`bay.id`, or
  `` `${card.id}-m${index}` `` per module) that live drive data merges onto; an unoccupied id
  renders as an empty placeholder rather than nothing. Verified end-to-end in a real browser
  against a mixed-orientation, multi-skin, multi-group example layout (24 SuperMicro-skinned
  horizontal bays + 4 HP-skinned vertical bays + a 4-module PCIe carrier) - confirmed
  programmatically, not just visually, that per-bay/per-module status and drive-type colors
  compute correctly for the right slots.
- **PCIe NVMe carrier as a live component.** [assets/pcie-carrier/default.svg](assets/pcie-carrier/default.svg)
  stays a static shell (frame, heatsink, edge connector only, per
  [assets/pcie-carrier/README.md](assets/pcie-carrier/README.md)); the per-module rows (status
  LED, drive-type icon, serial label - as many as the card's configured module count) are
  overlaid at render time by [PcieCarrier.svelte](src/frontend/lib/PcieCarrier.svelte), the
  same pattern `TraySkin.svelte` uses. Carrier shells are directory-discovered the same way
  tray skins are (`assets/pcie-carrier/*.svg`), just without per-skin metadata yet since there's
  only the one unbranded shell so far.
- **Settings UI for layout + logos, persisted through a real (if minimal) backend route.**
  [Settings.svelte](src/frontend/lib/Settings.svelte) edits groups/bays/cards and a
  per-tray-skin manufacturer-logo URL, and saves them via `POST /layout` (see
  [src/layout.ts](src/layout.ts) and the two routes added to
  [src/server.ts](src/server.ts)) to the same `/boot/config/plugins/...` convention
  `config.ts` already uses. `App.svelte` loads any saved layout on mount and falls back to the
  bundled example layout when none exists yet. Deliberately simple: a group's skin/orientation
  is set once for the whole group rather than per-bay (real chassis are usually uniform per
  physical cage), and there's no drag-and-drop grid editor - just rows/columns counts. Verified
  against the real daemon process (not a mock): saved an edited layout through the actual
  `POST /layout` handler, reloaded the page, and confirmed both the settings form and the tray
  map picked the saved config back up, including a configured logo URL actually rendering on
  the tray it was assigned to.
- **Live disk-to-bay assignment, with a Locate button to identify drives before assigning
  them.** [DiskAssignment.svelte](src/frontend/lib/DiskAssignment.svelte) lists every disk from
  `GET /disks` (a new backend route that calls the already-verified `getDisks()` GraphQL query)
  that isn't yet in the `assignments` map (bay/module id -> disk serial number - serial rather
  than `/dev/sdX` because device names aren't stable across reboots), lets the user pick an
  empty bay/module for it, and persists that mapping through the same `POST /layout` document
  as the settings UI (now `{layout, logos, assignments}`). [derive-drive.ts](src/shared/derive-drive.ts)
  turns an assigned disk into the `BayDrive` `TrayMap`/`PcieCarrier` already know how to render
  (driveType from `interfaceType`/`type`, status from `smartStatus`).
  **Locate**: the original plugin's "Locate" button worked by hammering a drive with `smartctl`
  in a loop, since read-only SMART queries are enough I/O to make a hot-swap bay's activity LED
  blink noticeably. [locate.ts](src/locate.ts) reimplements that same mechanic directly (not the
  original's compiled `smartlocate` binary) - `smartctl -a <device>` every 700ms via `execFile`
  with an argv array (never a shell string, so a device name can't inject anything), with the
  raw input strictly validated down to a bare alphanumeric name before a path is ever
  constructed from it, and a 5-minute auto-stop safety net in case the UI never sends stop.
  Each unassigned drive gets a Locate/Stop toggle; assigning a drive stops its locate session
  automatically. Verified for real, not mocked: ran the actual compiled route against a local
  `smartctl` (installed for this), confirmed with an instrumented wrapper that starting locate
  produces real repeating `smartctl -a <device>` calls on a ~700ms cadence and stopping it
  halts them immediately with zero further calls; confirmed device-name validation rejects
  shell-metacharacter and path-traversal payloads outright; and exercised the full assignment
  path against a local mock GraphQL server standing in for unraid-api (real request/response
  shape) - assigned a disk to a bay through the actual UI, watched the tray map render its real
  derived icon color/status LED/serial label, unassigned it, and confirmed persistence and the
  locate-stops-on-assign behavior via the real running daemon throughout.
- **`derive-drive.ts`'s field-shape guesses confirmed against a live 43-disk array (2026-09).**
  Re-ran the `disks` query against the same real box used for the original schema
  verification: `device` really does come back as a full path (`/dev/sda`, `/dev/nvme5n1`,
  ...), which `locate.ts`'s `normalizeDevice()` already handled defensively either way, and
  `type` really is `"HD"` / `"SSD"` / `"NVMe"`, which the existing `/ssd/i` substring check and
  the `interfaceType === "PCIE"` check correctly classify - no code changes needed, this just
  confirms the guesses were right. `smartStatus` was `"OK"` for every drive except one USB boot
  device (`"UNKNOWN"`), matching the documented OK/UNKNOWN-only shape. Still not verified: that
  the Locate mechanic actually produces a visible LED blink on real hot-swap hardware - that
  needs the daemon physically running on the box (GraphQL has no way to trigger or observe it),
  which didn't happen this session.
- **Per-skin default LED color, with a user override per skin/status.** Real trays don't agree
  on one green/amber/red convention - NetApp DS-series shelves are commonly blue for normal
  status rather than green, for instance (a general-knowledge call, not verified against a real
  NetApp shelf this session - flagging it the same way the vendor-styled skins themselves flag
  unverified visual details). So each skin's `meta.json` now carries its own `ledColors: {ok,
  warn, critical}` default (all five other skins keep the original green/amber/red;
  [netapp/meta.json](assets/tray-skins/netapp/meta.json) is `#2f6fd6`/amber/red) -
  [assets/tray-skins/README.md](assets/tray-skins/README.md) documents the field for
  contributors. [status.ts](src/frontend/lib/status.ts)'s `resolveLedColor(skin, overrides,
  status)` picks user override > skin default > the old hardcoded default, in that order.
  The settings UI's new "LED colors" section gives every skin three `<input type="color">`
  swatches (one per status) pre-filled with whatever's currently resolved, plus a Reset button
  that clears back to the skin's own default; overrides persist in the same `StoredLayout`
  document as everything else (`ledColors: LedColorConfig`, keyed by skin id then status).
  Verified in a real browser against the real daemon: confirmed all six skins' defaults resolve
  correctly (five green/amber/red, NetApp blue/amber/red) on an actually-rendered tray, set an
  override through the color picker and watched the tray's LED update immediately, reloaded the
  page and confirmed the override survived, then hit Reset and confirmed it reverted to the
  skin's own default color on the real rendered tray.

## Open questions (not yet decided)

- **No settings-UI step for adding a brand-new bay group when a drive shows up in an unexpected
  physical slot** - assignment only works against slots the layout editor already created.

## Conventions carried forward

Same house rules as `unraid-disklocation`: one branch per feature, PR'd and merged
individually; verbose commit messages explaining *why* not just *what*; never bundle or
redistribute trademarked manufacturer logos (relevant again if/when a drive-brand-logo
feature is rebuilt here).
