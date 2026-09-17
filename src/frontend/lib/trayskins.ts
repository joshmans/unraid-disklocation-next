// Skin discovery: every directory under assets/tray-skins/ with a meta.json
// becomes a selectable skin automatically - adding a new skin is a new
// directory + a PR, not a code change. See assets/tray-skins/README.md for
// the contribution format.

export interface SkinOverlayAnchor {
  cx?: number;
  cy?: number;
  r?: number;
  x?: number;
  y?: number;
  size?: number;
  /** Only meaningful on the `label` anchor - text color chosen to suit the skin's body color. */
  color?: string;
}

export interface SkinOverlays {
  led: SkinOverlayAnchor;
  icon: SkinOverlayAnchor;
  logo: SkinOverlayAnchor;
  label: SkinOverlayAnchor;
}

export interface SkinMeta {
  id: string;
  name: string;
  description: string;
  unofficial: boolean;
  disclaimer?: string;
  overlays: { horizontal: SkinOverlays; vertical: SkinOverlays };
}

export interface Skin extends SkinMeta {
  svg: { horizontal: string; vertical: string };
}

const metaModules = import.meta.glob("../../../assets/tray-skins/*/meta.json", {
  eager: true,
  import: "default",
}) as Record<string, SkinMeta>;

const horizontalModules = import.meta.glob("../../../assets/tray-skins/*/horizontal.svg", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const verticalModules = import.meta.glob("../../../assets/tray-skins/*/vertical.svg", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function dirOf(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}

export const skins: Skin[] = Object.entries(metaModules).map(([path, meta]) => {
  const dir = dirOf(path);
  return {
    ...meta,
    svg: {
      horizontal: horizontalModules[`${dir}/horizontal.svg`] ?? "",
      vertical: verticalModules[`${dir}/vertical.svg`] ?? "",
    },
  };
});
