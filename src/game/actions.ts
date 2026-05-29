/* ============================================================
   Player actions: passing, shooting, Strike Moments, defending
   ============================================================ */
import type { MatchPlayer } from "../core/types";
import { clamp, lerp, rand, dist, now, pointSegDist } from "../core/utils";
import { PITCH, GOAL_L, GOAL_R, BALLSPD } from "../core/config";
import { upgradeBonus } from "../state/save";
import { SFX } from "../audio/audio";
import { RT } from "./runtime";
import { awayGoalY, hasTrait, tapQuality, QFACTOR } from "./geometry";
import { releaseBall, ballToVel, gainPossession } from "./ball";
import { addMomentum, addFlow, banner } from "./drama";
import { spawnBurst, floaterText, pulseSlow, shakeAdd } from "./fx";

export function bestPassTarget(from: MatchPlayer, through: boolean): MatchPlayer | null {
  const M = RT.M;
  let best: MatchPlayer | null = null, bs = -1e9;
  for (const p of M.home) {
    if (p === from || p.role === "GK") continue;
    const fwd = (from.y - p.y);
    let lane = 0;
    for (const o of M.away) {
      if (o.role === "GK") continue;
      const dd = pointSegDist(o.x, o.y, from.x, from.y, p.x, p.y);
      if (dd < 26) lane -= 40; else if (dd < 46) lane -= 12;
    }
    const distPen = -dist(from.x, from.y, p.x, p.y) * 0.06;
    let score = fwd * 0.7 + lane + distPen;
    if (through && p.role === "ST") score += 60;
    if (p.role === "ST") score += 18;
    if (score > bs) { bs = score; best = p; }
  }
  return best;
}

export function doPass(from: MatchPlayer, q: string, through: boolean) {
  const M = RT.M, b = M.ball; if (b.owner !== from) return;
  const tgt = bestPassTarget(from, through);
  if (!tgt) return;
  releaseBall();
  const ub = upgradeBonus();
  let tx = tgt.x, ty = tgt.y;
  if (through) { ty = tgt.y - 70; tx = tgt.x + (tgt.x - from.x) * 0.15; }
  const err = (1 - QFACTOR[q]) * (through ? 34 : 24);
  tx += rand(-err, err); ty += rand(-err, err);
  const speed = (through ? 150 : 128) * (0.8 + from.f.pas * 0.5) * (1 + ub.pass * 0.6) * (0.82 + QFACTOR[q] * 0.28);
  ballToVel(b, tx, ty, speed);
  b.lockT = 0.12; b.shot = false; b.chip = false; b.fromTeam = "home"; b.lastKicker = from; b.spin = 0;
  from.lastTouch = now();
  M.lastPasser = from; M.lastPassT = now();
  if (through) SFX.through(); else SFX.pass();
  M.passStreak++; M.stat.passStreak = M.passStreak;
  if (M.passStreak > M.stat.bestPassStreak) M.stat.bestPassStreak = M.passStreak;
  if (q === "PERFECT" || q === "GREAT") addFlow(through ? 16 : 11);
  addMomentum(2);
}

export function doShoot(from: MatchPlayer, q: string, charge: number) {
  const M = RT.M, b = M.ball; if (b.owner !== from) return;
  releaseBall();
  const ub = upgradeBonus();
  const goalY = awayGoalY();
  const gk = M.away.find(p => p.role === "GK");
  let side = gk && gk.x > PITCH.cx ? -1 : 1;
  if (Math.random() < 0.3) side *= -1;
  let aimX = PITCH.cx + side * (52 - 12);
  let aimY = goalY - 2;
  const distGoal = dist(from.x, from.y, PITCH.cx, goalY);
  const err = (1 - QFACTOR[q]) * (60 + distGoal * 0.18);
  aimX += rand(-err, err); aimY += rand(-6, 2);
  let type = "drive", power = BALLSPD * (0.78 + from.f.sht * 0.55) * (1 + ub.shot * 0.7) * (0.7 + QFACTOR[q] * 0.42);
  const keeperRush = gk && dist(gk.x, gk.y, PITCH.cx, goalY) > 34;
  const clutchBoost = (M.timeLeft <= 15 && hasTrait(from, "Clutch")) ? 1.12 : 1;
  power *= clutchBoost;
  if (keeperRush && distGoal < 150 && q !== "MISS") {
    type = "chip"; b.chip = true; b.height = 10; b.vz = 34; power *= 0.62; SFX.chip();
  } else if (q === "PERFECT" && distGoal < 150) {
    if (charge > 0.5 || (hasTrait(from, "Finisher") && Math.random() < 0.5)) { type = "power"; power *= 1.28; SFX.power(); }
    else { type = "finesse"; b.spin = side * -140; SFX.finesse(); }
  } else if (q === "PERFECT" || q === "GREAT") {
    if (charge > 0.6) { type = "power"; power *= 1.2; SFX.power(); } else SFX.shot();
  } else SFX.shot();
  if (hasTrait(from, "LongShot") && distGoal > 150) power *= 1.12;
  power += charge * 22;
  ballToVel(b, aimX, aimY, power);
  b.lockT = 0.1; b.shot = true; b.fromTeam = "home"; b.lastKicker = from; b.quality = q; b.shotType = type; b.shotDist = distGoal;
  from.lastTouch = now();
  M.stat.shots++;
  if (Math.abs(aimX - PITCH.cx) < 52 + 6) M.stat.homeShotsOnTarget++;
  addMomentum(4);
  if (q === "PERFECT" || q === "GREAT") addFlow(8);
}

/* ---------- Strike Moment: player-aimed shot via drag/release ---------- */
export function doStrikeAim(from: MatchPlayer, dir: number, power: number, curve: number) {
  const M = RT.M, b = M.ball; if (b.owner !== from) return;
  const goalY = awayGoalY();
  const distGoal = dist(from.x, from.y, PITCH.cx, goalY);
  const towardGoal = Math.sin(dir) < -0.12;
  const q = tapQuality(M.ring.t);
  if (q === "PERFECT") { M.stat.perfects++; SFX.perfect(); }
  if (!towardGoal) { doAimedPass(from, dir, power, q); return; }

  releaseBall();
  const ub = upgradeBonus();
  const gk = M.away.find(p => p.role === "GK");
  const keeperRush = gk && dist(gk.x, gk.y, PITCH.cx, goalY) > 34;
  const absCurve = Math.abs(curve);

  let type = "drive";
  if (keeperRush && power < 0.62 && distGoal < 175) type = "chip";
  else if (absCurve > 0.34) type = "finesse";
  else if (power > 0.80) type = "power";

  let speed = BALLSPD * (0.74 + from.f.sht * 0.5) * (1 + ub.shot * 0.6) * lerp(0.62, 1.06, power) * lerp(0.84, 1.06, QFACTOR[q]);
  if (hasTrait(from, "Finisher")) speed *= 1.07;
  if (hasTrait(from, "LongShot") && distGoal > 150) speed *= 1.12;
  if (M.timeLeft <= 15 && hasTrait(from, "Clutch")) speed *= 1.12;

  let spin = 0, vz = 0, height = 0;
  if (type === "finesse") { spin = curve * 155 * (q === "PERFECT" ? 1.2 : 1); SFX.finesse(); }
  else if (type === "power") { speed *= 1.22; spin = curve * 60; SFX.power(); shakeAdd(6); }
  else if (type === "chip") { speed *= 0.66; vz = 34; height = 8; SFX.chip(); }
  else { spin = curve * 120; SFX.shot(); }

  const err = (1 - QFACTOR[q]) * 0.085;
  dir += rand(-err, err);
  b.vx = Math.cos(dir) * speed; b.vy = Math.sin(dir) * speed;
  b.spin = spin; b.vz = vz; b.height = height; b.chip = (type === "chip");
  b.lockT = 0.08; b.shot = true; b.fromTeam = "home"; b.lastKicker = from; b.quality = q; b.shotType = type; b.shotDist = distGoal;
  from.face = Math.sin(dir) < 0 ? -1 : 1; from.lastTouch = now();

  M.stat.shots++;
  const t = Math.max(0.05, (goalY - b.y) / (b.vy || -1));
  const predX = b.x + b.vx * t + (spin ? spin * t * t * 0.5 * 0.04 : 0);
  if (predX > GOAL_L - 4 && predX < GOAL_R + 4) M.stat.homeShotsOnTarget++;
  addMomentum(5);
  if (q === "PERFECT" || q === "GREAT") { addFlow(9); pulseSlow(0.10); }
  spawnBurst(from.x, from.y, "#ffd23f", 5, true);
  const label = type === "power" ? "POWER SHOT!" : type === "finesse" ? (absCurve > 0.55 ? "CURLER!" : "FINESSE!") : type === "chip" ? "CHIP!" : "STRIKE!";
  floaterText(from.x, from.y - 24, label, "#ffd23f", 15);
}

export function doAimedPass(from: MatchPlayer, dir: number, power: number, q: string) {
  const M = RT.M, b = M.ball; if (b.owner !== from) return;
  releaseBall();
  const ub = upgradeBonus();
  let best: MatchPlayer | null = null, bd = 46, rx = Math.cos(dir), ry = Math.sin(dir);
  for (const p of M.home) {
    if (p === from || p.role === "GK") continue;
    const rel = (p.x - from.x) * rx + (p.y - from.y) * ry; if (rel < 18) continue;
    const off = dist(from.x + rx * rel, from.y + ry * rel, p.x, p.y);
    if (off < bd) { bd = off; best = p; }
  }
  let tx: number, ty: number, through = false;
  if (best) { tx = best.x; ty = best.y; if (best.role === "ST" && best.y < PITCH.cy) { through = true; ty = best.y - 50; } }
  else { const reach = 120 + power * 140; tx = from.x + rx * reach; ty = from.y + ry * reach; }
  const err = (1 - QFACTOR[q]) * 22; tx += rand(-err, err); ty += rand(-err, err);
  const speed = (through ? 150 : 130) * (0.82 + from.f.pas * 0.5) * (1 + ub.pass * 0.6) * lerp(0.85, 1.1, power);
  ballToVel(b, tx, ty, speed);
  b.lockT = 0.12; b.shot = false; b.chip = false; b.fromTeam = "home"; b.lastKicker = from; b.spin = 0; b.height = 0; b.vz = 0;
  from.lastTouch = now();
  M.lastPasser = from; M.lastPassT = now();
  M.passStreak++; M.stat.passStreak = M.passStreak;
  if (M.passStreak > M.stat.bestPassStreak) M.stat.bestPassStreak = M.passStreak;
  if (through) SFX.through(); else SFX.pass();
  if (q === "PERFECT" || q === "GREAT") addFlow(through ? 12 : 8);
  addMomentum(2);
}

export function doTackle(from: MatchPlayer, q: string, slide: boolean) {
  const M = RT.M, b = M.ball; const owner = b.owner;
  if (!owner || owner.team !== "home") { if (!owner) { doChase(from, q); return; } }
  if (!owner) return;
  const d = dist(from.x, from.y, owner.x, owner.y);
  const reach = slide ? 60 : 34;
  if (d > reach) { from.lunge = 0.18; return; }
  let chance = 0.32 + from.f.def * 0.5 + QFACTOR[q] * 0.25 - owner.f.pac * 0.18;
  if (hasTrait(from, "Wall")) chance += 0.08;
  if (slide) { chance += 0.06; from.lunge = 0.32; }
  chance = clamp(chance, 0.08, 0.95);
  if (Math.random() < chance) {
    b.owner = from; b.vx = 0; b.vy = 0; b.lockT = 0.18; b.fromTeam = "home"; b.shot = false; b.chip = false;
    from.lastTouch = now();
    M.stat.tackles++; from.mTackles++;
    if (slide) SFX.slide(); else SFX.tackle();
    addMomentum(8); addFlow(7);
    spawnBurst(from.x, from.y, M.rival.color, 8);
    if (M.ctx) M.ctx.label = "WON IT!";
  } else {
    owner.boost = 0.3; from.stun = slide ? 0.5 : 0.28;
    SFX.tackle();
    addMomentum(-3);
  }
  M.passStreak = 0;
}
export function doPress(from: MatchPlayer, _q: string) {
  const M = RT.M;
  from.boost = 0.6 + QFACTOR[_q] * 0.4;
  const owner = M.ball.owner;
  if (owner && owner.team === "away") owner.boost = Math.max(owner.boost, 0.15);
  addMomentum(2);
}
export function doChase(from: MatchPlayer, q: string) {
  from.boost = 0.7 + QFACTOR[q] * 0.5;
  if (q === "PERFECT" || q === "GREAT") addFlow(5);
}
export function keeperSave(gk: MatchPlayer | null, q: string) {
  if (!gk) return;
  const M = RT.M;
  gk.dive = 0.4;
  gk.saveBoost = 0.35 + QFACTOR[q] * 0.4 + (hasTrait(gk, "SweeperGK") ? 0.12 : 0);
  const b = M.ball;
  const a = Math.atan2(b.vy, b.vx);
  gk.vx += Math.cos(a) * 20;
  const t = Math.max(0.05, (PITCH.bottom - b.y) / (b.vy || 1));
  const predX = b.x + b.vx * t;
  gk.vx += clamp(predX - gk.x, -40, 40);
  addMomentum(2);
}
