/* ============================================================
   Pitch geometry + nearest-entity helpers used across systems
   ============================================================ */
import type { MatchPlayer, Team } from "../core/types";
import { dist, dist2 } from "../core/utils";
import { PITCH } from "../core/config";
import { RT } from "./runtime";

export const homeGoalY = () => PITCH.bottom;
export const awayGoalY = () => PITCH.top;
export const attackY = (team: Team) => (team === "home" ? awayGoalY() : homeGoalY());
export const defendY = (team: Team) => (team === "home" ? homeGoalY() : awayGoalY());

export function formationPos(role: string, team: Team) {
  const x = PITCH.cx; let y: number;
  if (role === "GK") y = PITCH.bottom - 24;
  else if (role === "DEF") y = PITCH.bottom - 150;
  else if (role === "MID") y = PITCH.cy + 30;
  else y = PITCH.top + 165; // ST
  if (team === "away") y = 2 * PITCH.cy - y;
  return { x, y };
}

export function nearestFieldPlayer(team: Team, x: number, y: number): MatchPlayer | null {
  let best: MatchPlayer | null = null, bd = 1e9;
  for (const p of RT.M.players) { if (p.team !== team || p.role === "GK") continue; const d = dist2(p.x, p.y, x, y); if (d < bd) { bd = d; best = p; } }
  return best;
}
export function nearestOppDist(p: MatchPlayer): number {
  let bd = 1e9; for (const o of RT.M.players) { if (o.team === p.team) continue; const d = dist2(p.x, p.y, o.x, o.y); if (d < bd) bd = d; }
  return Math.sqrt(bd);
}
export function nearestFieldOpp(p: MatchPlayer): MatchPlayer | null {
  let best: MatchPlayer | null = null, bd = 1e9;
  for (const o of RT.M.players) { if (o.team === p.team) continue; const d = dist2(p.x, p.y, o.x, o.y); if (d < bd) { bd = d; best = o; } }
  return best;
}
export function stHasSpace(st: MatchPlayer): boolean {
  if (st.y > PITCH.cy + 20) return false;
  for (const p of RT.M.away) { if (p.role === "GK") continue; if (p.y < st.y + 10 && Math.abs(p.x - st.x) < 46) return false; }
  return true;
}
export function hasTrait(mp: MatchPlayer, t: string): boolean { return !!(mp.ref && mp.ref.trait === t); }

/* timing quality (shared by input + render rings) */
const SWEET = 0.82;
export function tapQuality(phase: number): string {
  let d = Math.abs(phase - SWEET);
  if (d > 0.5) d = 1 - d;
  if (d < 0.045) return "PERFECT";
  if (d < 0.11) return "GREAT";
  if (d < 0.20) return "GOOD";
  if (d < 0.33) return "OK";
  return "MISS";
}
export const QFACTOR: Record<string, number> = { PERFECT: 1.0, GREAT: 0.86, GOOD: 0.7, OK: 0.5, MISS: 0.26 };
