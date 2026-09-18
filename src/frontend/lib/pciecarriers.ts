// Carrier-shell discovery: every assets/pcie-carrier/<id>.svg becomes a
// selectable carrier automatically, same idea as tray-skins (see
// assets/pcie-carrier/README.md) but flat rather than one directory per
// carrier - a carrier has no orientation, just a shell. An optional sibling
// assets/pcie-carrier/<id>.json supplies a display name/description/
// unofficial+disclaimer flag for vendor-styled shells (mirrors tray-skins'
// meta.json fields); a carrier with no json falls back to a title-cased id.

export interface PcieCarrier {
  id: string;
  name: string;
  description?: string;
  unofficial?: boolean;
  disclaimer?: string;
  svg: string;
}

interface PcieCarrierMeta {
  name?: string;
  description?: string;
  unofficial?: boolean;
  disclaimer?: string;
}

const svgModules = import.meta.glob("../../../assets/pcie-carrier/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const metaModules = import.meta.glob("../../../assets/pcie-carrier/*.json", {
  eager: true,
  import: "default",
}) as Record<string, PcieCarrierMeta>;

function idOf(path: string, ext: string): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(new RegExp(`\\.${ext}$`), "");
}

function titleCase(id: string): string {
  return id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const metaById = new Map(Object.entries(metaModules).map(([path, meta]) => [idOf(path, "json"), meta]));

// Unbranded default first, then vendor-styled ones - same rationale as
// trayskins.ts's SKIN_ORDER (import.meta.glob's alphabetical order would
// otherwise bury "default" among the vendor names).
const CARRIER_ORDER = ["default", "asus", "hpe", "supermicro"];

export const pcieCarriers: PcieCarrier[] = Object.entries(svgModules)
  .map(([path, svg]) => {
    const id = idOf(path, "svg");
    const meta = metaById.get(id);
    return { id, name: meta?.name ?? titleCase(id), description: meta?.description, unofficial: meta?.unofficial, disclaimer: meta?.disclaimer, svg };
  })
  .sort((a, b) => {
    const ai = CARRIER_ORDER.indexOf(a.id);
    const bi = CARRIER_ORDER.indexOf(b.id);
    if (ai === -1 && bi === -1) return a.id.localeCompare(b.id);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
