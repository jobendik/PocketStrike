/* ============================================================
   Ball physics, possession, keeper saves and goals
   ============================================================ */
import type { MatchPlayer, Team, Ball } from "../core/types";
import { clamp, rand, pick, dist, dist2, now } from "../core/utils";
import { PITCH, GOAL_L, GOAL_R, BALL_R, PLAYER_R } from "../core/config";
import { upgradeBonus } from "../state/save";
import { SFX } from "../audio/audio";
import { RT } from "./runtime";
import { homeGoalY, defendY, hasTrait } from "./geometry";
import { addMomentum, banner } from "./drama";
import { spawnBurst, spawnRing, confetti, netRipple, shakeAdd, pulseSlow, popEl, flash, zoomPunch } from "./fx";

export function releaseBall() { RT.M.ball.owner = null; }
export function ballToVel(b: Ball, tx: number, ty: number, speed: number) {
  const a = Math.atan2(ty - b.y, tx - b.x);
  b.vx = Math.cos(a) * speed; b.vy = Math.sin(a) * speed;
}

export function gainPossession(p: MatchPlayer) {
  const M = RT.M, b = M.ball;
  const prevTeam = b.fromTeam;
  b.owner = p; b.vx = 0; b.vy = 0; b.lockT = 0.1; b.shot = false; b.chip = false; b.height = 0; b.spin = 0; b.vz = 0;
  p.lastTouch = now();
  if (prevTeam && prevTeam !== p.team) {
    if (p.team === "home") { M.counterFlag = now(); addMomentum(3); }
    else { M.passStreak = 0; addMomentum(-2); }
  }
}

export function updateBall(dt: number) {
  const M = RT.M, b = M.ball;
  if (b.owner) {
    const o = b.owner;
    let fdx = o.vx, fdy = o.vy; const mag = Math.hypot(fdx, fdy);
    if (mag < 8) { fdx = 0; fdy = (o.team === "home" ? -1 : 1); } else { fdx /= mag; fdy /= mag; }
    b.x = o.x + fdx * 15; b.y = o.y + fdy * 15; b.vx = o.vx; b.vy = o.vy; b.height = 0;
    if ((M.frame || 0) % 2 === 0) { b.trail.push({ x: b.x, y: b.y, a: 0.5 }); if (b.trail.length > 10) b.trail.shift(); }
    return;
  }
  b.lockT -= dt;
  if (b.spin) { const m = Math.hypot(b.vx, b.vy) || 1; const px = -b.vy / m, py = b.vx / m; b.vx += px * b.spin * dt; b.vy += py * b.spin * dt; b.spin *= Math.pow(0.5, dt * 1.1); if (Math.abs(b.spin) < 5) b.spin = 0; }
  b.x += b.vx * dt; b.y += b.vy * dt;
  b.rot = (b.rot || 0) + Math.hypot(b.vx, b.vy) * dt * 0.04;
  if (b.height > 0 || b.vz !== 0) { b.vz -= 130 * dt; b.height += b.vz * dt; if (b.height <= 0) { b.height = 0; b.vz = Math.abs(b.vz) < 8 ? 0 : -b.vz * 0.3; } }
  const fr = Math.pow(0.5, dt * (b.shot ? 0.9 : 1.9));
  b.vx *= fr; b.vy *= fr;
  const spd = Math.hypot(b.vx, b.vy);
  if (spd < 3 && b.height <= 0) { b.vx = 0; b.vy = 0; b.shot = false; b.chip = false; }
  if ((M.frame || 0) % 2 === 0 && spd > 30) { b.trail.push({ x: b.x, y: b.y, a: 1 }); if (b.trail.length > 16) b.trail.shift(); }
  for (const t of b.trail) t.a -= dt * 2.6;
  while (b.trail.length && b.trail[0].a <= 0) b.trail.shift();

  if (b.x < PITCH.left + BALL_R) { b.x = PITCH.left + BALL_R; b.vx = Math.abs(b.vx) * 0.62; }
  if (b.x > PITCH.right - BALL_R) { b.x = PITCH.right - BALL_R; b.vx = -Math.abs(b.vx) * 0.62; }

  if (b.y < PITCH.top + BALL_R) {
    if (b.x > GOAL_L && b.x < GOAL_R) { if (!tryGoalSave(b, "away")) { scoreGoal("home"); return; } }
    else { hitPost(b); b.y = PITCH.top + BALL_R; b.vy = Math.abs(b.vy) * 0.55; }
  }
  if (b.y > PITCH.bottom - BALL_R) {
    if (b.x > GOAL_L && b.x < GOAL_R) { if (!tryGoalSave(b, "home")) { scoreGoal("away"); return; } }
    else { hitPost(b); b.y = PITCH.bottom - BALL_R; b.vy = -Math.abs(b.vy) * 0.55; }
  }

  if (b.lockT <= 0) {
    let best: MatchPlayer | null = null, bd = (PLAYER_R + BALL_R + 3) * (PLAYER_R + BALL_R + 3);
    for (const p of M.players) { if (p.stun > 0) continue; const dd = dist2(p.x, p.y, b.x, b.y); if (dd < bd) { bd = dd; best = p; } }
    if (best) {
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 150 && best.role !== "GK" && Math.random() < 0.45) { /* zips past */ }
      else {
        if (best.role !== "GK") {
          if (b.fromTeam && b.fromTeam !== best.team && hasTrait(best, "Interceptor")) SFX.intercept();
          gainPossession(best);
        } else {
          const gy = defendY(best.team);
          if (Math.abs(b.y - gy) < 70) { gainPossession(best); SFX.save(); }
          else gainPossession(best);
        }
      }
    }
  }
}

export function hitPost(b: Ball) {
  if (Math.abs(b.x - GOAL_L) < 11 || Math.abs(b.x - GOAL_R) < 11) {
    SFX.post(); spawnBurst(b.x, b.y, "#ffffff", 6); shakeAdd(5);
    b.vx *= -0.7; banner("OFF THE POST!", "bn-info", 2);
  }
}

export function tryGoalSave(b: Ball, defTeam: Team): boolean {
  const M = RT.M;
  const gk = M.players.find(p => p.team === defTeam && p.role === "GK");
  if (!gk) return false;
  const gy = defendY(defTeam);
  let reach = 20 + gk.f.def * 22 + (gk.saveBoost || 0) * 40;
  if (defTeam === "home") reach += upgradeBonus().gk;
  if (defTeam === "away" && (M.tutGoalWindow || 0) > 0) reach *= 0.3; // reward the tutorial strike
  const d = dist(gk.x, gk.y, b.x, b.y);
  if (b.chip && b.height > 7) return false;
  if (d < reach) {
    gk.dive = 0.45; gk.mSaves++;
    const power = Math.hypot(b.vx, b.vy);
    if (defTeam === "away") b.y = PITCH.top + BALL_R + 2; else b.y = PITCH.bottom - BALL_R - 2;
    if (power > 165 || b.quality === "PERFECT") {
      b.vx = rand(-70, 70); b.vy = (defTeam === "away" ? 1 : -1) * rand(60, 110); b.shot = false; b.lockT = 0.18; b.chip = false; b.spin = 0;
      SFX.save(); spawnBurst(gk.x, gk.y, "#bfe9ff", 7, true);
      banner("GREAT SAVE!", "bn-info", 3);
    } else {
      gainPossession(gk); SFX.save();
      banner("SAVED!", "bn-info", 2);
    }
    if (defTeam === "home") { M.stat.saves++; addMomentum(5); } else addMomentum(-5);
    return true;
  }
  return false;
}

export function scoreGoal(team: Team) {
  const M = RT.M, b = M.ball;
  const beforeH = M.homeScore, beforeA = M.awayScore;
  if (team === "home") M.homeScore++; else M.awayScore++;
  const kicker = b.lastKicker;
  document.getElementById(team === "home" ? "sbHome" : "sbAway")!.textContent = String(team === "home" ? M.homeScore : M.awayScore);
  popEl(team === "home" ? "sbHome" : "sbAway");

  let tag = "GOAL!", cls = team === "home" ? "bn-chance" : "bn-danger", big = false, bonus = { c: 0, f: 0, x: 0 };
  const late = M.timeLeft <= 10;
  const counter = team === "home" && M.counterFlag && (now() - M.counterFlag < 2600);
  const comeback = team === "home" && M.stat.concededFirst && beforeH <= beforeA && M.homeScore > M.awayScore;
  const validKick = kicker && kicker.team === team;
  if (team === "home") {
    if (late) { tag = "LAST-SECOND WINNER!"; big = true; bonus = { c: 30, f: 6, x: 6 }; M.stat.lateGoal = true; }
    else if (comeback) { tag = "COMEBACK GOAL!"; big = true; bonus = { c: 25, f: 5, x: 5 }; }
    else if (counter) { tag = "COUNTERATTACK!"; big = true; bonus = { c: 18, f: 4, x: 3 }; }
    else if (validKick && b.shotType === "power" && (b.shotDist || 0) > 150) { tag = "ROCKET!"; big = true; bonus = { c: 20, f: 4, x: 4 }; }
    else if (validKick && b.shotType === "finesse" && Math.abs(b.spin) > 80) { tag = "CURLED IN!"; big = true; bonus = { c: 20, f: 4, x: 4 }; }
    else if (validKick && b.shotType === "finesse") { tag = "TOP CORNER!"; big = true; bonus = { c: 18, f: 4, x: 3 }; }
    else if (validKick && b.shotType === "chip") { tag = "CHEEKY CHIP!"; big = true; bonus = { c: 16, f: 4, x: 3 }; }
    else if (validKick && b.shotType === "power") { tag = "THUNDERBOLT!"; bonus = { c: 14, f: 3, x: 2 }; }
    else if (validKick && (b.shotDist || 0) < 45) { tag = "TAP-IN!"; }
    else tag = pick(["GOOOAL!", "GOAL!", "SCORES!"]);
    if (validKick) {
      const rank = big ? 2 : 1;
      if (!M.bestMoment || rank >= M.bestMoment.rank) M.bestMoment = { tag, name: kicker!.ref ? kicker!.ref.name : "", rank };
    }
  } else {
    tag = pick(["RIVAL SCORES", "THEY SCORE", "CONCEDED!"]);
    if (beforeH === 0 && M.awayScore === 1 && beforeA === 0) M.stat.concededFirst = true;
    if (beforeA === 0 && M.homeScore === 0) M.stat.concededFirst = true;
  }
  if (team === "home" && validKick) {
    kicker!.mGoals++;
    if (kicker!.role === "ST") M.stat.strikerGoal = true;
    if (M.lastPasser && M.lastPasser !== kicker && M.lastPasser.team === "home" && (now() - (M.lastPassT || 0) < 3600)) M.lastPasser.mAssists++;
  }
  M.bonus = M.bonus || { c: 0, f: 0, x: 0 };
  M.bonus.c! += bonus.c; M.bonus.f! += bonus.f; M.bonus.x! += bonus.x;

  SFX.goal();
  banner(tag, cls, 9);
  netRipple(team === "home" ? PITCH.top : PITCH.bottom, b.x);
  const perfect = validKick && (b.quality === "PERFECT");
  if (team === "home") {
    confetti(big ? 64 : 36); addMomentum(40); M.crowdTarget = 1;
    spawnRing(b.x, PITCH.top, "#ffd23f"); flash(big ? 0.55 : 0.4); zoomPunch(big ? 0.06 : 0.04);
    if ((perfect || big) && true) pulseSlow(0.55);
    shakeAdd(big ? 16 : 11);
    if (kicker) { kicker.cel = 2.0; M.celebrate = { scorer: kicker, team: "home", t: 1.5 }; }
  } else {
    addMomentum(-34); M.crowdTarget = Math.max(M.crowdTarget, 0.5); shakeAdd(8); flash(0.22);
    spawnBurst(b.x, b.y, M.rival.color, 14);
    if (kicker) { kicker.cel = 1.4; M.celebrate = { scorer: kicker, team: "away", t: 1.1 }; }
  }
  M.stat.biggestLead = Math.max(M.stat.biggestLead, M.homeScore - M.awayScore);
  M.passStreak = 0; M.counterFlag = 0;

  b.owner = null; b.x = PITCH.cx; b.y = PITCH.cy; b.vx = 0; b.vy = 0; b.shot = false; b.chip = false; b.height = 0; b.vz = 0; b.spin = 0; b.trail.length = 0; b.fromTeam = null; b.lastKicker = null;
  b.lockT = 0.95;
  M.kickoffLock = 0.95;
  const conceder: Team = team === "home" ? "away" : "home";
  const mid = M.players.find(p => p.team === conceder && p.role === "MID");
  M.kickoffTo = mid || null;
}
