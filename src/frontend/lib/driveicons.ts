export interface DriveIconMeta {
  name: string;
  description: string;
  color: string;
}

const svgModules = import.meta.glob("../../../assets/drive-icons/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const metaModules = import.meta.glob("../../../assets/drive-icons/meta.json", {
  eager: true,
  import: "default",
}) as Record<string, Record<string, DriveIconMeta>>;

function nameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.svg$/, "");
}

export const driveIconSvg: Record<string, string> = {};
for (const [path, svg] of Object.entries(svgModules)) {
  driveIconSvg[nameOf(path)] = svg;
}

export const driveIconMeta: Record<string, DriveIconMeta> = Object.values(metaModules)[0] ?? {};

export const driveIconColors: Record<string, string> = Object.fromEntries(
  Object.entries(driveIconMeta).map(([type, meta]) => [type, meta.color]),
);
