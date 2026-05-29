/* ============================================================
   Input: quick tap (contextual) + drag-to-aim Strike Moments
   ============================================================ */
import type { MatchPlayer } from "../core/types";
import { clamp, dist, dist2, now } from "../core/utils";
import { PITCH, AIM_MAXLEN } from "../core/config";
import { initAudio, SFX } from "../audio/audio";
import { RT } from "./runtime";
import { awayGoalY, stHasSpace, tapQuality } from "./geometry";
import { doShoot, doPass, doTackle, doPress, doChase, keeperSave, doStrikeAim } from "./actions";
import { spawnGrade, pulseSlow } from "./fx";
import { addMomentum } from "./drama";

export function getActiveHome(): MatchPlayer | null {
  const M = RT.M, b = M.ball;
  if (b.owner && b.owner.team === "home") return b.owner;
  if (b.shot && b.fromTeam === "away" && b.vy > 20 && b.y > PITCH.cy) return M.home.find(p => p.role === "GK") || null;
  let best: MatchPlayer | null = null, bd = 1e9;
  for (const p of M.home) { if (p.role === "GK" && b.y < PITCH.cy) continue; const d = dist2(p.x, p.y, b.x, b.y); if (d < bd) { bd = d; best = p; } }
  return best || M.home[0];
}

export function computeContext() {
  const M = RT.M, b = M.ball, act = getActiveHome();
  M.active = act;
  let type = "pass", label = "PASS", cls = "";
  if (!act) { M.ctx = { type, label, cls }; return; }
  const goalY = awayGoalY(), distGoal = dist(act.x, act.y, PITCH.cx, goalY);
  if (b.owner === act) {
    const inBox = act.y < PITCH.top + 150 && Math.abs(act.x - PITCH.cx) < 140;
    if (inBox && distGoal < 175) { type = "shoot"; label = distGoal < 95 ? "FINAL SHOT" : "SHOOT NOW"; cls = "shoot"; }
    else {
      const st = M.home.find(p => p.role === "ST");
      const lane = st && stHasSpace(st);
      if (lane && act.role !== "ST") { type = "through"; label = "THROUGH BALL"; cls = "hot"; }
      else { type = "pass"; label = (now() - act.lastTouch < 450) ? "ONE-TOUCH" : "PASS"; }
    }
  } else if (b.owner && b.owner.team === "away") {
    const d = dist(act.x, act.y, b.x, b.y);
    if (d < 28) { type = "tackle"; label = "TACKLE"; cls = "tackle"; }
    else if (d < 54) { type = "slide"; label = "SLIDE TACKLE"; cls = "tackle"; }
    else { type = "press"; label = "PRESS"; }
  } else if (b.shot && b.fromTeam === "away" && b.y > PITCH.cy && b.vy > 20) {
    type = "save"; label = "KEEPER SAVE!"; cls = "danger";
  } else {
    const d = dist(act.x, act.y, b.x, b.y);
    type = "chase"; label = d < 60 ? "INTERCEPT" : "CHASE BALL"; cls = d < 60 ? "hot" : "";
  }
  M.ctx = { type, label, cls };
}

export function screenToWorld(clientX: number, clientY: number) {
  const r = RT.canvas.getBoundingClientRect();
  return { x: (clientX - r.left - RT.offX) / RT.scale, y: (clientY - r.top - RT.offY) / RT.scale };
}

export function strikeEligible(act: MatchPlayer | null): boolean {
  const M = RT.M;
  if (!act || act.role === "GK") return false;
  if (M.ball.owner !== act || act.team !== "home") return false;
  const dG = dist(act.x, act.y, PITCH.cx, awayGoalY());
  return act.y < PITCH.cy + 50 && dG < 245;
}

export function computeCurve(am: { path: [number, number][] }): number {
  const p = am.path; if (p.length < 4) return 0;
  const a = p[0], b = p[p.length - 1], m = p[(p.length / 2) | 0];
  const vx = b[0] - a[0], vy = b[1] - a[1], L = Math.hypot(vx, vy) || 1;
  const lat = ((m[0] - a[0]) * vy - (m[1] - a[1]) * vx) / L;
  return clamp(lat / 55, -1, 1);
}

export function onDown(clientX: number, clientY: number) {
  const M = RT.M;
  if (!RT.running || RT.paused || M.ended) return;
  if (M.kickoffLock > 0 || M.celebrate) return;
  initAudio();
  RT.pointerDown = true; RT.pStartX = clientX; RT.pStartY = clientY; RT.pStartT = now();
  computeContext();
  const act = M.active;
  if (act && strikeEligible(act)) {
    M.aim = { sx: clientX, sy: clientY, cx: clientX, cy: clientY, path: [[clientX, clientY]], hasBall: true, t0: now(), moved: 0 };
    M.ring.t = 0;
  } else M.aim = null;
}
export function onMove(clientX: number, clientY: number) {
  const M = RT.M;
  if (!RT.pointerDown || !M.aim) return;
  const am = M.aim;
  am.cx = clientX; am.cy = clientY;
  am.moved = Math.max(am.moved, Math.hypot(clientX - am.sx, clientY - am.sy));
  const p = am.path; if (p.length < 40) p.push([clientX, clientY]); else { p.shift(); p.push([clientX, clientY]); }
}
export function onUp() {
  const M = RT.M;
  if (!RT.pointerDown) { if (M && M.aim) M.aim = null; return; }
  RT.pointerDown = false;
  if (!RT.running || RT.paused || M.ended) { if (M) M.aim = null; return; }
  const hold = (now() - RT.pStartT) / 1000;
  if (M.aim) {
    const am = M.aim; M.aim = null;
    const act = M.active;
    if (!act || M.ball.owner !== act) return;
    const dx = am.cx - am.sx, dy = am.cy - am.sy;
    const lenScreen = Math.hypot(dx, dy);
    const len = lenScreen / Math.max(RT.scale, 0.0001);
    if (len < 12) { handleTap(0); return; }
    const dir = Math.atan2(dy, dx);
    const power = clamp(len / AIM_MAXLEN, 0.25, 1);
    const curve = computeCurve(am);
    doStrikeAim(act, dir, power, curve);
    return;
  }
  handleTap(clamp(hold / 0.55, 0, 1));
}

export function handleTap(charge: number) {
  const M = RT.M;
  if (M.kickoffLock > 0) return;
  initAudio();
  const q = tapQuality(M.timing.phase);
  const ctxt = M.ctx; if (!ctxt) return;
  const act = M.active; if (!act) return;
  spawnGrade(q, act.x, act.y - 22);
  if (q === "PERFECT") { M.stat.perfects++; SFX.perfect(); pulseSlow(0.14); addMomentum(act.team === "home" ? 6 : -6); }
  else if (q !== "MISS") SFX.tap();

  switch (ctxt.type) {
    case "shoot": doShoot(act, q, charge); break;
    case "pass": doPass(act, q, false); break;
    case "through": doPass(act, q, true); break;
    case "tackle": doTackle(act, q, false); break;
    case "slide": doTackle(act, q, true); break;
    case "press": doPress(act, q); break;
    case "save": keeperSave(act, q); break;
    case "chase": doChase(act, q); break;
  }
}
