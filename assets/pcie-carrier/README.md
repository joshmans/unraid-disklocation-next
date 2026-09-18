# Contributing a PCIe carrier shell

Same idea as [assets/tray-skins/](../tray-skins/README.md), scaled down: every
`assets/pcie-carrier/<id>.svg` is picked up automatically by
`src/frontend/lib/pciecarriers.ts` - adding a carrier is a new file and a PR,
no code change.

- ViewBox `0 0 520 150`.
- Draw the card frame, heatsink, and edge connector only. Leave the region
  roughly `x: 90-505, y: 14-134` empty - `PcieCarrier.svelte` overlays the
  per-module rows (status LED, drive-type icon, serial label) there at
  render time, sized to however many modules that card is configured for.
- No manufacturer logos, for the same trademark reason as tray skins.
- Optional: a sibling `assets/pcie-carrier/<id>.json` with `name`,
  `description`, `unofficial`, and `disclaimer` fields (same meaning as tray
  skins' `meta.json`) supplies the display name/description for a
  vendor-styled shell. A carrier with no json just falls back to a
  title-cased id (fine for an unbranded shell like `default.svg`).

`default.svg` is a plain unbranded x16 carrier shell. `asus.svg`,
`supermicro.svg`, and `hpe.svg` are unofficial, fan-styled recreations of
popular quad-NVMe carrier cards - see their `.json` files for what each is
modeled on.
