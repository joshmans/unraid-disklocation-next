import type { DiskResult } from "../graphql/queries.js";
import type { BayDrive, DriveType } from "./chassis-types.js";

/**
 * `interfaceType: "PCIE"` reliably means NVMe. Beyond that, the 2026-09
 * schema verification (see ROADMAP.md) didn't pin down what values
 * `disks.type` actually returns for SATA/SAS drives, so SSD vs spinning HDD
 * is a best-effort substring match on that field, defaulting to "hdd" - only
 * affects which icon/legend entry is shown, never correctness of the
 * assignment itself. Revisit against a live box if this turns out wrong.
 */
function inferDriveType(disk: DiskResult): DriveType {
  if (disk.interfaceType === "PCIE") return "nvme";
  return /ssd/i.test(disk.type) ? "ssd" : "hdd";
}

export function driveFromDisk(disk: DiskResult): BayDrive {
  return {
    driveType: inferDriveType(disk),
    // unraid-api's disks.smartStatus is only ever "OK" or "UNKNOWN" (no
    // detailed attributes over GraphQL - see ROADMAP.md), so "UNKNOWN" is
    // surfaced as a caution rather than assumed healthy.
    status: disk.smartStatus === "OK" ? "ok" : "warn",
    label: disk.serialNum || disk.name,
  };
}
