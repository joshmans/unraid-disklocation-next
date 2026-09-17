import { execFile } from "node:child_process";

// The original plugin's "Locate" button worked by running `smartctl` against
// a drive in a tight loop (every 0.5s) - repeated SMART queries are enough
// I/O traffic to make a hot-swap bay's activity LED blink noticeably, and
// smartctl is read-only, ships with Unraid, and is a tool this project
// already depends on for SMART history. Same mechanic here, just targeting
// the plain device node (e.g. /dev/sda) that unraid-api's `disks.device`
// field gives us, rather than the SCSI generic /dev/bsg/H:C:T:L address the
// original used - simpler, and works uniformly for SATA/SAS/NVMe.

const BARE_DEVICE_PATTERN = /^[a-zA-Z0-9]+$/;
const INTERVAL_MS = 700;
const AUTO_STOP_MS = 5 * 60 * 1000; // safety net if the UI never sends stop (browser closed mid-locate, etc.)

interface LocateSession {
  timer: NodeJS.Timeout;
}

const sessions = new Map<string, LocateSession>();

/** Strips an optional leading "/dev/" and validates what's left is a bare device name - never trust the raw input into a shell or path. */
export function normalizeDevice(input: string): string {
  const bare = input.replace(/^\/dev\//, "");
  if (!BARE_DEVICE_PATTERN.test(bare)) {
    throw new Error(`refusing to locate unrecognized device: ${JSON.stringify(input)}`);
  }
  return `/dev/${bare}`;
}

export function startLocate(rawDevice: string): string {
  const device = normalizeDevice(rawDevice);
  stopLocate(device);
  const tick = () => execFile("smartctl", ["-a", device], () => {});
  tick();
  const timer = setInterval(tick, INTERVAL_MS);
  const session: LocateSession = { timer };
  sessions.set(device, session);
  setTimeout(() => {
    if (sessions.get(device) === session) stopLocate(device);
  }, AUTO_STOP_MS);
  return device;
}

export function stopLocate(rawDevice: string): string {
  const device = normalizeDevice(rawDevice);
  const session = sessions.get(device);
  if (session) {
    clearInterval(session.timer);
    sessions.delete(device);
  }
  return device;
}

export function stopAllLocate(): void {
  for (const device of [...sessions.keys()]) stopLocate(device);
}

export function activeLocateDevices(): string[] {
  return [...sessions.keys()];
}
