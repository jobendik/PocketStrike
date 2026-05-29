/* ============================================================
   Tiny math / DOM / formatting helpers
   ============================================================ */

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const pick = <T>(arr: T[]): T => arr[(Math.random() * arr.length) | 0];
export const dist = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy);
};
export const dist2 = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy;
};
export const uid = () => Math.random().toString(36).slice(2, 9);
export const now = () => Date.now();
export const todayStr = () => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };

export function fmt(n: number): string {
  n = Math.round(n);
  if (n >= 10000) return (n / 1000).toFixed(n >= 100000 ? 0 : 1) + "k";
  return n.toLocaleString();
}
export function fmtTime(sec: number): string {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ":" + (s < 10 ? "0" : "") + s;
}
export function clip(s: string, n: number): string { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

export function shade(hex: string, amt: number): string {
  let h = hex.replace("#", ""); if (h.length === 3) h = h.split("").map(x => x + x).join("");
  let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  r = clamp(r + amt, 0, 255); g = clamp(g + amt, 0, 255); b = clamp(b + amt, 0, 255);
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}

/* segment-distance helper used by passing/AI lane scoring */
export function pointSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay; const l2 = dx * dx + dy * dy;
  if (l2 === 0) return dist(px, py, ax, ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / l2; t = clamp(t, 0, 1);
  return dist(px, py, ax + t * dx, ay + t * dy);
}

let _varCache: Record<string, string> = {};
export function cssVar(n: string): string {
  if (_varCache[n]) return _varCache[n];
  const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  _varCache[n] = v || "#22d3ee"; return _varCache[n];
}
export function clearVarCache() { _varCache = {}; }
