// Carrier-shell discovery: every assets/pcie-carrier/<id>.svg becomes a
// selectable carrier automatically, same convention as tray-skins (see
// assets/pcie-carrier/README.md). Unlike tray skins, a carrier has no
// orientation and no meta.json yet - just a shell, since there's only one
// today; add a meta.json convention here if/when a second one needs a
// display name, description, or unofficial/disclaimer flag.

export interface PcieCarrier {
  id: string;
  name: string;
  svg: string;
}

const svgModules = import.meta.glob("../../../assets/pcie-carrier/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function idOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.svg$/, "");
}

function titleCase(id: string): string {
  return id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const pcieCarriers: PcieCarrier[] = Object.entries(svgModules).map(([path, svg]) => {
  const id = idOf(path);
  return { id, name: titleCase(id), svg };
});
