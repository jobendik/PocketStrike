/* ============================================================
   Role-based football AI: off-ball movement + on-ball decisions
   ============================================================ */
import type { MatchPlayer } from "../core/types";
import { lerp, rand, dist, now, pointSegDist } from "../core/utils";
import { PITCH, BALLSPD, STYLES } from "../core/config";
import { SFX } from "../audio/audio";
import { RT } from "./runtime";
import {
  formationPos, defendY, attackY, awayGoalY, homeGoalY,
  nearestFieldPlayer, nearestOppDist, stHasSpace, hasTrait,
} from "./geometry";
import { releaseBall, ballToVel } from "./ball";
import { doPass, doShoot } from "./actions";

export function updateAITargets(_dt: number) {
  const M = RT.M, b = M.ball;
  const attTeam = b.owner ? b.owner.team : null;
  const cele = M.celebrate;
  const homeChaser = nearestFieldPlayer("home", b.x, b.y);
  const awayChaser = nearestFieldPlayer("away", b.x, b.y);

  for (const p of M.players) {
    if (cele && p.team === cele.team) { p.tx = cele.scorer.x + rand(-30, 30); p.ty = cele.scorer.y + rand(10, 40); continue; }
    if (M.kickoffLock > 0 && !cele) { p.tx = p.hx; p.ty = p.hy; continue; }
    const a = formationPos(p.role, p.team);
    p.hx = a.x; p.hy = a.y;
    const weAttack = p.team === attTeam;
    const goalUp = (p.team === "home");
    const dir = goalUp ? -1 : 1;

    if (p.role === "GK") {
      const gy = defendY(p.team);
      // during the tutorial goal window keep the away keeper parked at the near post
      if (p.team === "away" && (M.tutGoalWindow || 0) > 0) { p.tx = PITCH.cx - 24; p.ty = gy + 10; continue; }
      let tx = Math.max(PITCH.cx - 52 + 8, Math.min(b.x, PITCH.cx + 52 - 8));
      let ty = gy + (p.team === "home" ? -10 : 10);
      const ballNear = Math.abs(b.y - gy) < 150 && Math.abs(b.x - PITCH.cx) < 150;
      if ((!b.owner || b.owner.team !== p.team) && ballNear && (hasTrait(p, "SweeperGK") || Math.abs(b.y - gy) < 90)) {
        tx = lerp(tx, b.x, 0.5); ty = lerp(ty, b.y, 0.35);
      }
      p.tx = tx; p.ty = ty; continue;
    }

    if (p.role === "DEF") {
      const ogy = defendY(p.team);
      const oppST = M.players.find(q => q.team !== p.team && q.role === "ST");
      if (weAttack) { p.tx = lerp(a.x, b.x, 0.2); p.ty = a.y + dir * 40; }
      else {
        let mx = PITCH.cx;
        if (oppST) mx = lerp(oppST.x, b.x, 0.4);
        p.tx = lerp(mx, b.x, 0.35);
        p.ty = lerp(ogy, b.y, 0.42);
        if (p === homeChaser && p.team === "home") { p.tx = b.x; p.ty = b.y; }
        if (p === awayChaser && p.team === "away") { p.tx = b.x; p.ty = b.y; }
      }
      continue;
    }

    if (p.role === "MID") {
      if (weAttack) {
        const off = (p.x < b.x ? -1 : 1) * -40;
        p.tx = Math.max(PITCH.left + 20, Math.min(b.x + off, PITCH.right - 20));
        p.ty = b.y + dir * 70;
      } else {
        p.tx = lerp(PITCH.cx, b.x, 0.55);
        p.ty = lerp(PITCH.cy, b.y, 0.5);
        if ((p.team === "home" && p === homeChaser) || (p.team === "away" && p === awayChaser)) { p.tx = b.x; p.ty = b.y; }
      }
      continue;
    }

    // ST
    if (weAttack) {
      const oppDEF = M.players.find(q => q.team !== p.team && q.role === "DEF");
      let tx = PITCH.cx + (b.x < PITCH.cx ? 46 : -46);
      if (oppDEF) tx = oppDEF.x + (oppDEF.x < PITCH.cx ? 64 : -64);
      tx = Math.max(PITCH.left + 26, Math.min(tx, PITCH.right - 26));
      const boxY = (p.team === "home") ? PITCH.top + 92 : PITCH.bottom - 92;
      const advancing = (p.team === "home") ? b.y < PITCH.cy : b.y > PITCH.cy;
      const ty = advancing ? boxY + dir * 10 : lerp(boxY, b.y + dir * 72, 0.4);
      p.tx = tx; p.ty = ty;
    } else {
      const tgt = b.owner && b.owner.team !== p.team ? b.owner : null;
      if (tgt && dist(p.x, p.y, tgt.x, tgt.y) < 120) { p.tx = tgt.x; p.ty = tgt.y; }
      else { p.tx = a.x; p.ty = a.y - dir * 60; }
    }
  }
}

export function aiAutoAction(dt: number) {
  const M = RT.M;
  if (M.aim && M.aim.hasBall) return;   // player is aiming a strike
  if (M.tut && M.tut.active) return;    // tutorial drives the ball itself
  const b = M.ball; if (!b.owner) return;
  const o = b.owner;
  o.decT = (o.decT || 0) - dt;
  if (o.decT > 0) return;

  if (o.team === "away") {
    const st = STYLES[M.rival.style];
    o.decT = rand(0.45, 1.0);
    const goalY = homeGoalY(); const dG = dist(o.x, o.y, PITCH.cx, goalY);
    const press = nearestOppDist(o);
    const shootRange = 150 + st.shootBias * 70;
    if (dG < shootRange && (Math.random() < (st.shootBias * 0.55) + (dG < 95 ? 0.35 : 0) || press < 26)) awayShoot(o);
    else if (press < 42 || Math.random() < st.passBias * 0.5) awayPass(o, st);
  } else {
    o.decT = rand(0.6, 1.2);
    const goalY = awayGoalY(); const dG = dist(o.x, o.y, PITCH.cx, goalY);
    const press = nearestOppDist(o);
    const st = M.home.find(p => p.role === "ST");
    if (o.role !== "ST" && st && st !== o && stHasSpace(st) && Math.random() < 0.5) doPass(o, "GOOD", true);
    else if (press < 24 && Math.random() < 0.7) doPass(o, "GOOD", false);
    else if (dG < 66 && press < 22 && Math.random() < 0.4) doShoot(o, "GOOD", 0);
    else if (press < 40 && Math.random() < 0.25) doPass(o, "OK", false);
  }
}
function awayForwardTarget(from: MatchPlayer): MatchPlayer | null {
  const M = RT.M;
  let best: MatchPlayer | null = null, bs = -1e9;
  for (const p of M.away) {
    if (p === from || p.role === "GK") continue;
    const fwd = (p.y - from.y);
    let lane = 0;
    for (const h of M.home) { if (h.role === "GK") continue; const dd = pointSegDist(h.x, h.y, from.x, from.y, p.x, p.y); if (dd < 26) lane -= 40; else if (dd < 46) lane -= 12; }
    const score = fwd * 0.7 + lane - dist(from.x, from.y, p.x, p.y) * 0.05 + (p.role === "ST" ? 20 : 0);
    if (score > bs) { bs = score; best = p; }
  }
  return best;
}
function awayPass(o: MatchPlayer, _st: any) {
  const M = RT.M;
  const tgt = awayForwardTarget(o); if (!tgt) return;
  releaseBall();
  let tx = tgt.x, ty = tgt.y;
  const err = 18; tx += rand(-err, err); ty += rand(-err, err);
  const speed = 130 * (0.85 + o.f.pas * 0.4);
  ballToVel(M.ball, tx, ty, speed);
  M.ball.lockT = 0.12; M.ball.shot = false; M.ball.chip = false; M.ball.fromTeam = "away"; M.ball.lastKicker = o; M.ball.spin = 0;
  o.lastTouch = now(); SFX.pass();
}
function awayShoot(o: MatchPlayer) {
  const M = RT.M;
  releaseBall();
  const goalY = homeGoalY(); const gk = M.home.find(p => p.role === "GK");
  let side = gk && gk.x > PITCH.cx ? -1 : 1; if (Math.random() < 0.35) side *= -1;
  let aimX = PITCH.cx + side * (52 - 14), aimY = goalY + 2;
  const dG = dist(o.x, o.y, PITCH.cx, goalY);
  const err = (40 + dG * 0.2) * (1 - o.f.sht * 0.4); aimX += rand(-err, err);
  let power = BALLSPD * (0.7 + o.f.sht * 0.5);
  ballToVel(M.ball, aimX, aimY, power);
  M.ball.lockT = 0.1; M.ball.shot = true; M.ball.fromTeam = "away"; M.ball.lastKicker = o; M.ball.quality = "GOOD"; M.ball.shotType = "drive"; M.ball.shotDist = dG;
  o.lastTouch = now(); SFX.shot();
}
