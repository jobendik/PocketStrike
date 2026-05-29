/* ============================================================
   Player movement, ball-carrier steering and separation
   ============================================================ */
import type { MatchPlayer } from "../core/types";
import { clamp, lerp, dist } from "../core/utils";
import { PITCH, PLAYER_R, SP } from "../core/config";
import { RT } from "./runtime";
import { attackY, defendY, nearestFieldOpp } from "./geometry";

export function clampPlayer(p: MatchPlayer) {
  const m = PLAYER_R;
  p.x = clamp(p.x, PITCH.left + m, PITCH.right - m);
  p.y = clamp(p.y, PITCH.top - 2, PITCH.bottom + 2);
  if (p.role === "GK") {
    const gy = defendY(p.team);
    if (p.team === "home") p.y = clamp(p.y, gy - 70, gy + 4); else p.y = clamp(p.y, gy - 4, gy + 70);
  }
}

export function movePlayer(p: MatchPlayer, dt: number) {
  const M = RT.M;
  if (p.stun > 0) { p.stun -= dt; p.vx *= 0.8; p.vy *= 0.8; p.x += p.vx * dt; p.y += p.vy * dt; clampPlayer(p); return; }
  let spd = SP * (0.7 + p.f.pac * 0.7);
  if (p.boost > 0) { spd *= 1.5; p.boost -= dt; }
  let tx = p.tx as number, ty = p.ty as number;
  if (M.ball.owner === p && M.aim && M.aim.hasBall) { p.vx *= 0.6; p.vy *= 0.6; p.x += p.vx * dt; p.y += p.vy * dt; clampPlayer(p); return; }
  if (M.ball.owner === p && M.kickoffLock <= 0 && !M.celebrate) {
    tx = PITCH.cx + (p.x - PITCH.cx) * 0.6; ty = attackY(p.team);
    const o = nearestFieldOpp(p);
    if (o && dist(p.x, p.y, o.x, o.y) < 40) tx += (p.x < o.x ? -30 : 30);
    spd *= 0.92;
  }
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
  const ax = (dx / d) * spd, ay = (dy / d) * spd;
  p.vx = lerp(p.vx, d > 4 ? ax : 0, clamp(dt * 8, 0, 1));
  p.vy = lerp(p.vy, d > 4 ? ay : 0, clamp(dt * 8, 0, 1));
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (Math.abs(p.vx) > 1 || Math.abs(p.vy) > 1) { const m = Math.hypot(p.vx, p.vy); p.face = p.vy / m; }
  if (p.cel > 0) p.cel -= dt;
  if (p.dive > 0) p.dive -= dt;
  if (p.lunge > 0) p.lunge -= dt;
  clampPlayer(p);
}

export function separatePlayers() {
  const ps = RT.M.players;
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j];
      const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy);
      const min = PLAYER_R * 2 - (a.team === b.team ? 2 : 6);
      if (d < min && d > 0.001) {
        const push = (min - d) / 2; const nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
        clampPlayer(a); clampPlayer(b);
      }
    }
  }
}
