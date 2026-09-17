// Verified 2026-09 against a live Unraid 7.2+ instance's unraid-api GraphQL
// schema (source: https://github.com/unraid/api, api/src/unraid-api/graph/resolvers).
// Field shapes here are real, not guessed - see ROADMAP.md for what this
// confirmed and what it ruled out.

export const DISKS_QUERY = `
  query Disks {
    disks {
      id
      device
      name
      type
      vendor
      size
      serialNum
      interfaceType
      temperature
      smartStatus
      isSpinning
    }
  }
`;

export interface DiskResult {
  id: string;
  device: string;
  name: string;
  type: string;
  vendor: string;
  size: number;
  serialNum: string;
  interfaceType: "SAS" | "SATA" | "USB" | "PCIE" | "UNKNOWN";
  temperature: number | null;
  smartStatus: "OK" | "UNKNOWN";
  isSpinning: boolean;
}

// `array` gives the logical Unraid slot assignment (disk1, disk2, parity,
// cacheN, flash) - not a physical bay/tray position. Unraid has no concept
// of chassis layout; that mapping stays entirely this plugin's own stored
// config, same as the original PHP plugin. `idx` semantics per the source
// comment: parity1=0, parity2=29, data disks 1-28, caches 30-53, flash
// nominally 54 (observed 38 on a live box with 24 data disks + 8 caches -
// idx is evidently assigned sequentially from actual slot usage, not fixed
// per the doc comment - don't hardcode boundaries, just use the returned idx
// and disk `type` to group).
export const ARRAY_QUERY = `
  query Array {
    array {
      state
      disks { idx name device size status type temp rotational transport fsType }
      parities { idx name device type }
      caches { idx name device type }
      boot { idx name device type }
    }
  }
`;

export interface ArrayDiskResult {
  idx: number;
  name: string | null;
  device: string | null;
  size: number | null;
  status: string | null;
  type: "DATA" | "PARITY" | "BOOT" | "FLASH" | "CACHE";
  temp: number | null;
  rotational: boolean | null;
  transport: string | null;
  fsType: string | null;
}

export interface ArrayResult {
  state: string;
  disks: ArrayDiskResult[];
  parities: ArrayDiskResult[];
  caches: ArrayDiskResult[];
  boot: ArrayDiskResult | null;
}
