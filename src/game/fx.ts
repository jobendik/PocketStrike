/* ============================================================
   Match FX: particles, confetti, floating text, net ripples,
   screen shake, slow-mo pulse, zoom punch and goal flash.
   ============================================================ */
import { clamp, rand, pick } from "../core/utils";
import { PITCH, GOAL_L, GOAL_R } from "../core/config";
import { S } from "../state/save";
import { RT } from "./runtime";

export function shakeAdd(v: number) { if (S.shake && RT.M) RT.M.shake = Math.min(RT.M.shake + v, 26); }
export function pulseSlow(dur: number) { if (S.slowmo && RT.M) RT.M.slowT = Math.max(RT.M.slowT, dur); }
export function zoomPunch(z: number) { const M = RT.M; if (!M) return; M.zoom = Math.max(M.zoom || 0, z); }
export function flash(v: number) { const M = RT.M; if (!M) return; M.flashV = Math.max(M.flashV || 0, v); }

export function spawnBurst(x: number, y: number, col: string, n: number, glow = false) {
  const arr = RT.M.fx.parts;
  for (let i = 0; i < n; i++) {
    if (arr.length > 150) break;
    const a = rand(0, Math.PI * 2), sp = rand(40, 190);
    arr.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.3, 0.7), max: 0.7, col, size: rand(2, 4.2), grav: 120, kind: glow ? "glow" : "spark" });
  }
}
/* expanding shock ring for big goals */
export function spawnRing(x: number, y: number, col: string) {
  RT.M.fx.parts.push({ x, y, vx: 0, vy: 0, life: 0.55, max: 0.55, col, size: 4, grav: 0, kind: "ring", r0: 4, r1: 120 });
}
export function confetti(n: number) {
  const arr = RT.M.fx.parts;
  const cols = ["#ffd23f", "#22d3ee", "#34d399", "#fb7185", "#ffffff", "#a78bfa"];
  for (let i = 0; i < n; i++) {
    if (arr.length > 200) break;
    arr.push({ x: rand(PITCH.left, PITCH.right), y: rand(-20, PITCH.top), vx: rand(-30, 30), vy: rand(40, 160), life: rand(1.0, 1.9), max: 1.9, col: pick(cols), size: rand(3, 6), grav: 60, kind: "confetti", rot: rand(0, 6.28), vr: rand(-7, 7) });
  }
}
export function spawnGrade(q: string, x: number, y: number) {
  if (q === "MISS") return;
  const col = q === "PERFECT" ? "#ffd23f" : q === "GREAT" ? "#7df0ff" : q === "GOOD" ? "#34d399" : "#cdd9f0";
  RT.M.fx.floaters.push({ x, y, vy: -44, life: 0.8, max: 0.8, text: q, col, size: q === "PERFECT" ? 20 : 16 });
  if (RT.M.fx.floaters.length > 14) RT.M.fx.floaters.shift();
}
export function floaterText(x: number, y: number, text: string, col: string, size?: number) {
  RT.M.fx.floaters.push({ x, y, vy: -40, life: 1.0, max: 1.0, text, col, size: size || 15 });
  if (RT.M.fx.floaters.length > 14) RT.M.fx.floaters.shift();
}
export function netRipple(lineY: number, x: number) {
  RT.M.fx.ripples.push({ y: lineY, x: clamp(x, GOAL_L + 6, GOAL_R - 6), t: 0, max: 0.6 });
}
export function updateFX(dt: number) {
  const M = RT.M;
  const P = M.fx.parts;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i]; p.life -= dt; if (p.life <= 0) { P.splice(i, 1); continue; }
    if (p.kind === "ring") continue;
    p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.vr) p.rot += p.vr * dt;
  }
  const F = M.fx.floaters;
  for (let i = F.length - 1; i >= 0; i--) { const f = F[i]; f.life -= dt; f.y += f.vy * dt; if (f.life <= 0) F.splice(i, 1); }
  const R = M.fx.ripples;
  for (let i = R.length - 1; i >= 0; i--) { R[i].t += dt; if (R[i].t >= R[i].max) R.splice(i, 1); }
  if (M.shake > 0) M.shake = Math.max(0, M.shake - dt * 42);
  if ((M.zoom || 0) > 0) M.zoom = Math.max(0, (M.zoom as number) - dt * 1.5);
  if ((M.flashV || 0) > 0) M.flashV = Math.max(0, (M.flashV as number) - dt * 1.8);
}
export function popEl(id: string) {
  const el = document.getElementById(id); if (!el) return;
  el.style.transition = "none"; el.style.transform = "scale(1.5)"; el.style.color = "#fff";
  requestAnimationFrame(() => { el.style.transition = "transform .4s cubic-bezier(.2,.9,.25,1.4), color .4s"; el.style.transform = "scale(1)"; el.style.color = ""; });
}
