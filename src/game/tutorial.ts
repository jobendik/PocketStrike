/* ============================================================
   On-canvas, learn-by-doing tutorial for the first match.
   Freezes the action and demonstrates each control with an
   animated ghost hand, waiting for the player to perform it.
   CrazyGames-style: zero up-front friction, taught in context.
   ============================================================ */
import type { TutState } from "../core/types";
import { clamp, rand, cssVar } from "../core/utils";
import { PITCH, GOAL_L, GOAL_R } from "../core/config";
import { S, save } from "../state/save";
import { RT } from "./runtime";
import { gainPossession } from "./ball";
import { banner } from "./drama";

const TAU = 6.2832;

export function makeTut(): TutState | null {
  if (S.seenTutorial) return null;
  return { active: true, step: "intro", waiting: false, handT: 0, t: 0, holder: null };
}

/* the sim (movement, ball, clock) is frozen while a prompt is open */
export function tutIsWaiting(): boolean {
  const M = RT.M;
  return !!(M.tut && M.tut.active && M.tut.waiting);
}
export function tutIsActive(): boolean {
  const M = RT.M;
  return !!(M.tut && M.tut.active);
}

export function tutUpdate(realDt: number) {
  const M = RT.M, tut = M.tut;
  if (!tut || !tut.active) return;
  tut.handT += realDt;
  const b = M.ball;
  switch (tut.step) {
    case "intro":
      // wait until kickoff resolves and our midfielder is on the ball
      if (M.kickoffLock <= 0 && b.owner && b.owner.team === "home") {
        tut.holder = b.owner; tut.step = "tap"; tut.waiting = true; tut.handT = 0;
        M.active = b.owner;
        banner("TAP TO PASS", "bn-info", 6);
      }
      break;
    case "tap":
      // completed once the held ball is released (a pass was made)
      if (b.owner !== tut.holder) { tut.step = "tapDone"; tut.waiting = false; tut.t = 1.0; }
      break;
    case "tapDone":
      tut.t -= realDt;
      if (tut.t <= 0) startStrikeStep();
      break;
    case "strike":
      // completed once a home shot leaves the foot
      if (b.shot && b.fromTeam === "home") { tutComplete(); break; }
      // if they released it as a pass instead of shooting, re-arm the chance
      if (tut.holder && b.owner !== tut.holder && !b.shot) startStrikeStep();
      break;
  }
}

function startStrikeStep() {
  const M = RT.M, tut = M.tut!;
  const st = M.home.find(p => p.role === "ST");
  if (!st) { tutComplete(); return; }
  st.x = clamp(PITCH.cx - 16, PITCH.left + 30, PITCH.right - 30); st.y = PITCH.top + 118;
  st.vx = 0; st.vy = 0;
  gainPossession(st); st.decT = 999;            // never auto-acts during the lesson
  // sim is frozen, so place the ball on the striker's foot ourselves
  const b = M.ball; b.x = st.x; b.y = st.y - 2; b.vx = 0; b.vy = 0; b.height = 0; b.vz = 0; b.spin = 0; b.shot = false; b.trail.length = 0; b.lockT = 0.1;
  const gk = M.away.find(p => p.role === "GK"); // bias keeper to the near post so the demoed corner is open
  if (gk) { gk.x = PITCH.cx - 24; gk.vx = 0; gk.vy = 0; gk.saveBoost = 0; }
  tut.holder = st; tut.step = "strike"; tut.waiting = true; tut.handT = 0;
  M.active = st;
  banner("DRAG TO AIM — THEN RELEASE", "bn-chance", 7);
}

export function tutComplete() {
  const M = RT.M, tut = M.tut;
  if (!tut) return;
  tut.step = "done"; tut.waiting = false; tut.active = false;
  M.tutGoalWindow = 1.4;   // let the demoed strike beat the keeper for a rewarding first goal
  if (!S.seenTutorial) { S.seenTutorial = true; save(); }
  banner("NICE! NOW PLAY ON", "bn-info", 5);
}

/* quadratic path from ball to goal used by the demo hand + guide arc */
function tutPath(bx: number, by: number, gx: number, gy: number, u: number) {
  const cx = (bx + gx) / 2 + 34, cy = (by + gy) / 2; // bow to the side -> implies a curve
  const mu = 1 - u;
  return { x: mu * mu * bx + 2 * mu * u * cx + u * u * gx, y: mu * mu * by + 2 * mu * u * cy + u * u * gy };
}

function drawHand(ctx: CanvasRenderingContext2D, x: number, y: number, glyph: string, size: number) {
  ctx.save();
  ctx.font = "900 " + size + "px " + cssVar("--ui");
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 6;
  ctx.fillText(glyph, x, y);
  ctx.restore();
}

function drawCoach(ctx: CanvasRenderingContext2D, title: string, sub: string) {
  const cx = PITCH.cx, cy = PITCH.cy + 138;
  ctx.save();
  ctx.font = "900 18px " + cssVar("--ui");
  const w = Math.max(ctx.measureText(title).width, ctx.measureText(sub).width) + 44;
  const x = cx - w / 2, y = cy - 22, h = 50;
  ctx.fillStyle = "rgba(6,12,22,0.82)";
  ctx.beginPath();
  const rd = 14;
  ctx.moveTo(x + rd, y); ctx.arcTo(x + w, y, x + w, y + h, rd); ctx.arcTo(x + w, y + h, x, y + h, rd);
  ctx.arcTo(x, y + h, x, y, rd); ctx.arcTo(x, y, x + w, y, rd); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,210,63,0.4)"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = cssVar("--gold"); ctx.font = "900 17px " + cssVar("--ui"); ctx.textBaseline = "alphabetic";
  ctx.fillText(title, cx, cy - 1);
  ctx.fillStyle = "rgba(180,200,230,0.9)"; ctx.font = "700 11px " + cssVar("--ui");
  ctx.fillText(sub, cx, cy + 15);
  ctx.restore();
}

export function tutDraw() {
  const M = RT.M, tut = M.tut, ctx = RT.ctx;
  if (!tut || !tut.active) return;

  if (tut.step === "tap" && tut.waiting && tut.holder) {
    const p = tut.holder;
    const pulse = (Math.sin(tut.handT * 6) + 1) / 2;
    ctx.strokeStyle = "rgba(255,210,63," + (0.45 + 0.45 * pulse) + ")"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 19 + pulse * 10, 0, TAU); ctx.stroke();
    drawHand(ctx, p.x + 11, p.y + 10 + Math.sin(tut.handT * 6) * 5, "👆", 26);
    drawCoach(ctx, "TAP TO PASS", "tap anywhere to release the ball");
  } else if (tut.step === "strike" && tut.waiting) {
    const b = M.ball, gx = PITCH.cx + 34, gy = PITCH.top + 14; // guide to the open far corner
    if (M.aim && M.aim.hasBall) {
      drawCoach(ctx, "RELEASE TO SHOOT", "let go to strike the ball");
    } else {
      // dashed guide arc from ball to goal
      ctx.save();
      ctx.setLineDash([5, 6]); ctx.strokeStyle = "rgba(255,210,63,0.6)"; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 22; i++) { const pt = tutPath(b.x, b.y, gx, gy, i / 22); if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); }
      ctx.stroke(); ctx.setLineDash([]);
      // target glow on goal
      ctx.fillStyle = "rgba(255,210,63,0.18)";
      ctx.beginPath(); ctx.arc(gx, gy, 13, 0, TAU); ctx.fill();
      ctx.restore();
      // pulsing ring on the ball + a hand sweeping along the path
      const pulse = (Math.sin(tut.handT * 5) + 1) / 2;
      ctx.strokeStyle = "rgba(255,210,63," + (0.4 + 0.4 * pulse) + ")"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(b.x, b.y, 16 + pulse * 8, 0, TAU); ctx.stroke();
      const u = (tut.handT * 0.55) % 1;
      const hp = tutPath(b.x, b.y, gx, gy, u);
      drawHand(ctx, hp.x, hp.y, "🫳", 30);
      drawCoach(ctx, "DRAG TO AIM", "drag from the ball toward the goal");
    }
  }
}
