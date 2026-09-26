/**
 * A random UUID for ids the layout editor hands out (bays, groups, cards).
 *
 * `crypto.randomUUID()` only exists in secure contexts (HTTPS or localhost), and Unraid is
 * very often opened over plain `http://<ip>`. There it is undefined, so calling it threw and
 * the Chassis layout buttons (+ Bay group, + PCIe group, ...) silently did nothing.
 * `getRandomValues` is available everywhere, so it is the fallback.
 */
export function uid(): string {
  const c: Crypto | undefined = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
