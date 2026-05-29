/* ============================================================
   Canvas rendering: pitch, crowd, players, ball, aim preview, FX.
   All code-drawn — no image assets.
   ============================================================ */
import { clamp, lerp, dist, cssVar } from "../core/utils";
import {
  VW, VH, PITCH, GOAL_L, GOAL_R, GOAL_W, BALL_R, PLAYER_R, BALLSPD, AIM_MAXLEN,
} from "../core/config";
import { upgradeBonus } from "../state/save";
import { RT } from "./runtime";
import { awayGoalY, tapQuality } from "./geometry";
import { bestPassTarget } from "./actions";
import { computeCurve } from "./input";
import { tutDraw } from "./tutorial";

export function resizeCanvas() {
  const r = document.getElementById("stage")!.getBoundingClientRect();
  RT.DPR = Math.min(window.devicePixelRatio || 1, 2.5);
  RT.canvas.width = Math.round(r.width * RT.DPR); RT.canvas.height = Math.round(r.height * RT.DPR);
  const sx = r.width / VW, sy = r.height / VH; RT.scale = Math.min(sx, sy);
  RT.offX = (r.width - VW * RT.scale) / 2; RT.offY = (r.height - VH * RT.scale) / 2;
}

function worldTransform() {
  const M = RT.M, ctx = RT.ctx;
  let sx = 0, sy = 0, z = 1;
  if (M && M.shake > 0) { const a = Math.random() * 6.283; sx = Math.cos(a) * M.shake * 0.45; sy = Math.sin(a) * M.shake * 0.45; }
  if (M && (M.zoom || 0) > 0) z = 1 + (M.zoom as number);
  const s = RT.scale * RT.DPR * z;
  const ox = (RT.offX + sx) * RT.DPR - (z - 1) * PITCH.cx * RT.scale * RT.DPR;
  const oy = (RT.offY + sy) * RT.DPR - (z - 1) * PITCH.cy * RT.scale * RT.DPR;
  ctx.setTransform(s, 0, 0, s, ox, oy);
}

export function render(t: number) {
  const M = RT.M, ctx = RT.ctx;
  ctx.setTransform(RT.DPR, 0, 0, RT.DPR, 0, 0);
  const r = document.getElementById("stage")!.getBoundingClientRect();
  ctx.clearRect(0, 0, r.width, r.height);
  ctx.fillStyle = "#04130c"; ctx.fillRect(0, 0, r.width, r.height);
  worldTransform();
  drawPitch(t);
  const aiming = M.aim && M.aim.hasBall;
  const tutFocus = !!(M.tut && M.tut.active && M.tut.waiting);
  if (aiming || tutFocus) { ctx.fillStyle = "rgba(3,9,15,0.40)"; ctx.fillRect(0, 0, VW, VH); }
  drawPreviews();
  drawPlayers();
  drawBall();
  if (aiming) drawAim();
  drawTimingRing();
  drawFX();
  tutDraw();
}

function rrect(x: number, y: number, w: number, h: number, rd: number) {
  const ctx = RT.ctx;
  ctx.beginPath(); ctx.moveTo(x + rd, y); ctx.arcTo(x + w, y, x + w, y + h, rd); ctx.arcTo(x + w, y + h, x, y + h, rd); ctx.arcTo(x, y + h, x, y, rd); ctx.arcTo(x, y, x + w, y, rd); ctx.closePath();
}

function drawPitch(t: number) {
  const ctx = RT.ctx, P = PITCH;
  ctx.fillStyle = "#06160d"; ctx.fillRect(0, 0, VW, VH);
  drawCrowd(t, true); drawCrowd(t, false);
  const grad = ctx.createLinearGradient(0, P.top, 0, P.bottom);
  grad.addColorStop(0, "#13994f"); grad.addColorStop(0.5, "#0f8a46"); grad.addColorStop(1, "#0c7a3d");
  ctx.fillStyle = grad; rrect(P.left, P.top, P.w, P.h, 10); ctx.fill();
  ctx.save(); rrect(P.left, P.top, P.w, P.h, 10); ctx.clip();
  const stripes = 8, sh = P.h / stripes;
  for (let i = 0; i < stripes; i++) { ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.045)"; ctx.fillRect(P.left, P.top + i * sh, P.w, sh); }
  for (const [gx, gy] of [[P.left + 40, P.top + 40], [P.right - 40, P.top + 40], [P.left + 40, P.bottom - 40], [P.right - 40, P.bottom - 40], [P.cx, P.cy]]) {
    const rg = ctx.createRadialGradient(gx, gy, 4, gx, gy, 150); rg.addColorStop(0, "rgba(255,255,255,0.10)"); rg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = rg; ctx.fillRect(P.left, P.top, P.w, P.h);
  }
  // subtle outer vignette for depth
  const vg = ctx.createRadialGradient(P.cx, P.cy, 120, P.cx, P.cy, 360);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = vg; ctx.fillRect(P.left, P.top, P.w, P.h);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 2.2;
  rrect(P.left + 4, P.top + 4, P.w - 8, P.h - 8, 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(P.left + 4, P.cy); ctx.lineTo(P.right - 4, P.cy); ctx.stroke();
  ctx.beginPath(); ctx.arc(P.cx, P.cy, 46, 0, 6.2832); ctx.stroke();
  ctx.beginPath(); ctx.arc(P.cx, P.cy, 3, 0, 6.2832); ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fill();
  const bw = 150, bh = 66;
  ctx.strokeRect(P.cx - bw / 2, P.top + 4, bw, bh);
  ctx.strokeRect(P.cx - bw / 2, P.bottom - 4 - bh, bw, bh);
  const sbw = 84, sbh = 26;
  ctx.strokeRect(P.cx - sbw / 2, P.top + 4, sbw, sbh);
  ctx.strokeRect(P.cx - sbw / 2, P.bottom - 4 - sbh, sbw, sbh);
  drawGoal(P.top, true);
  drawGoal(P.bottom, false);
  const M = RT.M;
  if (M && M.ball.owner && M.ball.owner.team === "away" && M.ball.y > P.bottom - 150) goalGlow(P.bottom, "rgba(255,84,104,0.25)");
  if (M && M.ball.owner && M.ball.owner.team === "home" && M.ball.y < P.top + 150) goalGlow(P.top, "rgba(34,211,238,0.22)");
}

function drawCrowd(t: number, top: boolean) {
  const ctx = RT.ctx, P = PITCH, h = top ? P.top : VH - P.bottom, y0 = top ? 0 : P.bottom;
  ctx.fillStyle = "#081a10"; ctx.fillRect(P.left - 6, y0, P.w + 12, h);
  const inten = RT.M ? RT.M.crowd : 0.3;
  const rows = 3, cols = 26;
  for (let rI = 0; rI < rows; rI++) {
    const ry = top ? (8 + rI * ((h - 12) / rows)) : (y0 + 8 + rI * ((h - 12) / rows));
    for (let c = 0; c < cols; c++) {
      const cx2 = P.left + (c + 0.5) * (P.w / cols);
      const fl = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.002 + c * 0.7 + rI * 1.3));
      const b = clamp(0.18 + inten * 0.5 * fl, 0, 0.8);
      ctx.fillStyle = `rgba(${120 + rI * 30},${160},${200},${b})`;
      ctx.fillRect(cx2 - 1.6, ry, 3.2, 3.2);
    }
  }
}

function drawGoal(lineY: number, top: boolean) {
  const ctx = RT.ctx, P = PITCH;
  ctx.save();
  const depth = 14, ny = top ? lineY - depth : lineY + depth;
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(GOAL_L, Math.min(lineY, ny), GOAL_W, depth);
  ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 0.7;
  for (let x = GOAL_L; x <= GOAL_R; x += 8) { ctx.beginPath(); ctx.moveTo(x, lineY); ctx.lineTo(x, ny); ctx.stroke(); }
  for (let yy = 0; yy <= depth; yy += 5) { const y = top ? lineY - yy : lineY + yy; ctx.beginPath(); ctx.moveTo(GOAL_L, y); ctx.lineTo(GOAL_R, y); ctx.stroke(); }
  const M = RT.M;
  if (M) for (const rp of M.fx.ripples) {
    if (Math.abs((top ? P.top : P.bottom) - lineY) < 1 && rp.y === lineY) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(rp.x, lineY, 6 + rp.t * 40, 0, 6.2832); ctx.globalAlpha = Math.max(0, 1 - rp.t / rp.max); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(GOAL_L - 3, lineY - 3, 6, 6); ctx.fillRect(GOAL_R - 3, lineY - 3, 6, 6);
  ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(GOAL_L, lineY); ctx.lineTo(GOAL_R, lineY); ctx.stroke();
  ctx.restore();
}

function goalGlow(lineY: number, col: string) {
  const ctx = RT.ctx;
  const rg = ctx.createRadialGradient(PITCH.cx, lineY, 4, PITCH.cx, lineY, 90);
  rg.addColorStop(0, col); rg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rg; ctx.fillRect(GOAL_L - 40, lineY - 60, GOAL_W + 80, 120);
}

function teamColor(team: string) { return team === "home" ? cssVar("--home") : (RT.M ? RT.M.rival.color : cssVar("--away")); }

function drawPreviews() {
  const M = RT.M;
  if (!M || M.kickoffLock > 0 || M.celebrate) return;
  if (M.aim && M.aim.hasBall) return;
  const ctx = RT.ctx, b = M.ball, c = M.ctx, act = M.active;
  if (!c || !act) return;
  ctx.save();
  if ((c.type === "pass" || c.type === "through") && b.owner === act) {
    const tgt = bestPassTarget(act, c.type === "through");
    if (tgt) {
      let tx = tgt.x, ty = tgt.y; if (c.type === "through") ty = tgt.y - 70;
      ctx.strokeStyle = c.type === "through" ? "rgba(255,210,63,0.7)" : "rgba(125,240,255,0.6)";
      ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.setLineDash([]);
      const a = Math.atan2(ty - b.y, tx - b.x);
      ctx.fillStyle = c.type === "through" ? "rgba(255,210,63,0.9)" : "rgba(125,240,255,0.85)";
      ctx.beginPath(); ctx.moveTo(tx, ty);
      ctx.lineTo(tx - Math.cos(a - 0.4) * 9, ty - Math.sin(a - 0.4) * 9);
      ctx.lineTo(tx - Math.cos(a + 0.4) * 9, ty - Math.sin(a + 0.4) * 9);
      ctx.closePath(); ctx.fill();
    }
  } else if (c.type === "shoot" && b.owner === act) {
    const goalY = awayGoalY();
    ctx.fillStyle = "rgba(255,210,63,0.12)";
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(GOAL_L + 10, goalY + 2); ctx.lineTo(GOAL_R - 10, goalY + 2); ctx.closePath(); ctx.fill();
  } else if ((c.type === "tackle" || c.type === "slide" || c.type === "press") && b.owner) {
    ctx.strokeStyle = "rgba(154,255,192,0.8)"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(b.owner.x, b.owner.y, PLAYER_R + 7, 0, 6.2832); ctx.stroke();
  }
  ctx.restore();
}

function drawPlayers() {
  const M = RT.M, ctx = RT.ctx;
  for (const p of M.players) {
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath(); ctx.ellipse(p.x, p.y + PLAYER_R * 0.7, PLAYER_R * 0.85, PLAYER_R * 0.4, 0, 0, 6.2832); ctx.fill();
  }
  for (const p of M.players) {
    const col = teamColor(p.team);
    const isActive = (p === M.active && p.team === "home" && M.kickoffLock <= 0);
    let py = p.y;
    // run bob + celebration hop
    const spd = Math.hypot(p.vx, p.vy);
    if (p.cel > 0) py += -Math.abs(Math.sin(p.cel * 12)) * 5;
    else if (spd > 8) py += -Math.abs(Math.sin((M.frame || 0) * 0.4 + p.x)) * 1.4;
    if (isActive) {
      ctx.strokeStyle = cssVar("--gold"); ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(p.x, py, PLAYER_R + 5, 0, 6.2832); ctx.stroke(); ctx.globalAlpha = 1;
      const rg = ctx.createRadialGradient(p.x, py, 2, p.x, py, PLAYER_R + 10); rg.addColorStop(0, "rgba(255,210,63,0.3)"); rg.addColorStop(1, "rgba(255,210,63,0)");
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(p.x, py, PLAYER_R + 10, 0, 6.2832); ctx.fill();
    }
    let rx = PLAYER_R, ry = PLAYER_R;
    if (p.role === "GK" && p.dive > 0) rx = PLAYER_R * 1.35;
    // body with soft radial shading
    const bg = ctx.createRadialGradient(p.x - rx * 0.35, py - ry * 0.4, 1, p.x, py, rx * 1.15);
    bg.addColorStop(0, "#ffffff"); bg.addColorStop(0.18, col); bg.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = bg as any;
    ctx.beginPath(); ctx.ellipse(p.x, py, rx, ry, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.beginPath(); ctx.arc(p.x, py - 2, PLAYER_R * 0.5, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = p.role === "GK" ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.35)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, py, PLAYER_R, 0, 6.2832); ctx.stroke();
    ctx.fillStyle = "rgba(6,18,26,0.9)"; ctx.font = "900 11px " + cssVar("--ui"); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(p.role === "GK" ? "GK" : p.role[0], p.x, py + 0.5);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath(); ctx.arc(p.x, py + (p.face < 0 ? -1 : 1) * PLAYER_R * 0.95, 2.2, 0, 6.2832); ctx.fill();
  }
}

function drawBall() {
  const M = RT.M, ctx = RT.ctx, b = M.ball;
  // glowing trail (additive)
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (const tr of b.trail) {
    ctx.globalAlpha = tr.a * 0.5;
    const g = ctx.createRadialGradient(tr.x, tr.y, 0, tr.x, tr.y, BALL_R * 1.4);
    g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(1, "rgba(160,230,255,0)");
    ctx.fillStyle = g as any; ctx.beginPath(); ctx.arc(tr.x, tr.y, BALL_R * 1.4, 0, 6.2832); ctx.fill();
  }
  ctx.restore(); ctx.globalAlpha = 1;
  // ground shadow scales with height
  const hgt = b.height || 0;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath(); ctx.ellipse(b.x, b.y + 3, BALL_R * (0.9 + hgt * 0.01), BALL_R * (0.45 + hgt * 0.004), 0, 0, 6.2832); ctx.fill();
  const by = b.y - hgt;
  // ball with rotating panel hint
  ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(b.x, by, BALL_R, 0, 6.2832); ctx.fill();
  const rot = b.rot || 0;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath(); ctx.arc(b.x + Math.cos(rot) * BALL_R * 0.3, by + Math.sin(rot) * BALL_R * 0.3, BALL_R * 0.34, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b.x, by, BALL_R, 0, 6.2832); ctx.stroke();
}

function drawTimingRing() {
  const M = RT.M, ctx = RT.ctx;
  if (!M || M.kickoffLock > 0 || M.celebrate) return;
  const aiming = M.aim && M.aim.hasBall;
  const b = M.ball;
  const cx = aiming ? b.x : (M.active ? M.active.x : null);
  const cy = aiming ? b.y : (M.active ? M.active.y : null);
  if (cx === null || cy === null) return;
  const ph = aiming ? M.ring.t : M.timing.phase;
  const maxR = 46, minR = 14, Rt = 20;
  const r = lerp(maxR, minR, ph);
  const q = tapQuality(ph);
  const hot = (q === "PERFECT" || q === "GREAT");
  ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, Rt, 0, 6.2832); ctx.stroke();
  ctx.strokeStyle = hot ? cssVar("--gold") : "rgba(255,255,255,0.8)";
  ctx.lineWidth = hot ? 3.5 : 2.5;
  if (hot) { ctx.shadowColor = cssVar("--gold"); ctx.shadowBlur = 12; }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawAim() {
  const M = RT.M, ctx = RT.ctx, am = M.aim, from = M.active;
  if (!am || !from) return;
  const b = M.ball;
  const dx = am.cx - am.sx, dy = am.cy - am.sy, lenScreen = Math.hypot(dx, dy);
  const goalY = awayGoalY();
  const gk = M.away.find(p => p.role === "GK");
  if (gk) { ctx.save(); ctx.strokeStyle = "rgba(251,113,133,0.55)"; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(gk.x, gk.y, 24, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
  if (lenScreen < 10) return;
  let dir = Math.atan2(dy, dx);
  const len = lenScreen / Math.max(RT.scale, 0.0001);
  const power = clamp(len / AIM_MAXLEN, 0.25, 1);
  const curve = computeCurve(am);
  const towardGoal = Math.sin(dir) < -0.12;
  const distGoal = dist(from.x, from.y, PITCH.cx, goalY);
  const ub = upgradeBonus();
  let type = "drive";
  const keeperRush = gk && dist(gk.x, gk.y, PITCH.cx, goalY) > 34;
  const absCurve = Math.abs(curve);
  if (!towardGoal) type = "pass";
  else if (keeperRush && power < 0.62 && distGoal < 175) type = "chip";
  else if (absCurve > 0.34) type = "finesse";
  else if (power > 0.80) type = "power";
  let speed = BALLSPD * (0.74 + from.f.sht * 0.5) * (1 + ub.shot * 0.6) * lerp(0.62, 1.06, power);
  let spin = 0;
  if (type === "finesse") spin = curve * 155; else if (type === "power") { speed *= 1.22; spin = curve * 60; }
  else if (type === "chip") speed *= 0.66; else if (type === "drive") spin = curve * 120;
  if (type === "pass") { speed = 130 * lerp(0.85, 1.1, power); spin = 0; }
  let x = b.x, y = b.y, vx = Math.cos(dir) * speed, vy = Math.sin(dir) * speed, sp = spin;
  const pts: [number, number][] = []; let outcome = "out";
  for (let i = 0; i < 48; i++) {
    if (sp) { const m = Math.hypot(vx, vy) || 1, px = -vy / m, py = vx / m; vx += px * sp * 0.03; vy += py * sp * 0.03; sp *= Math.pow(0.5, 0.03 * 1.1); }
    x += vx * 0.03; y += vy * 0.03;
    const fr = Math.pow(0.5, 0.03 * (type === "pass" ? 1.9 : 0.9)); vx *= fr; vy *= fr;
    if (x < PITCH.left + BALL_R) { x = PITCH.left + BALL_R; vx = Math.abs(vx) * 0.62; }
    if (x > PITCH.right - BALL_R) { x = PITCH.right - BALL_R; vx = -Math.abs(vx) * 0.62; }
    pts.push([x, y]);
    if (y < PITCH.top + BALL_R) { outcome = (x > GOAL_L && x < GOAL_R) ? "goal" : "miss"; break; }
    if (Math.hypot(vx, vy) < 22) { outcome = type === "pass" ? "pass" : "short"; break; }
  }
  const col = outcome === "goal" ? cssVar("--gold") : type === "pass" ? "#7df0ff" : "rgba(255,255,255,0.85)";
  ctx.save();
  for (let i = 0; i < pts.length; i += 2) { const a = 1 - i / pts.length; ctx.globalAlpha = a * 0.9; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], clamp(4 - i * 0.05, 1.4, 4), 0, 6.2832); ctx.fill(); }
  ctx.globalAlpha = 1;
  if (pts.length) {
    const e = pts[pts.length - 1]; ctx.strokeStyle = col; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(e[0], e[1], outcome === "goal" ? 11 : 7, 0, 6.2832); ctx.stroke();
    if (outcome === "goal") { ctx.fillStyle = "rgba(255,210,63,0.2)"; ctx.beginPath(); ctx.arc(e[0], e[1], 11, 0, 6.2832); ctx.fill(); }
  }
  ctx.globalAlpha = 0.9; ctx.strokeStyle = col; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.cos(dir) * 24 * power, b.y + Math.sin(dir) * 24 * power); ctx.stroke();
  ctx.restore();
  am._type = type;
}

function drawFX() {
  const M = RT.M, ctx = RT.ctx;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (const p of M.fx.parts) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.kind === "ring") {
      const rr = lerp(p.r0, p.r1, 1 - a);
      ctx.globalAlpha = a * 0.7; ctx.strokeStyle = p.col; ctx.lineWidth = 3 * a + 0.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.2832); ctx.stroke();
    } else if (p.kind === "glow") {
      ctx.globalAlpha = a;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.4);
      g.addColorStop(0, p.col); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g as any; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.4, 0, 6.2832); ctx.fill();
    }
  }
  ctx.restore(); ctx.globalAlpha = 1;
  for (const p of M.fx.parts) {
    if (p.kind === "ring" || p.kind === "glow") continue;
    const a = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = a;
    if (p.kind === "confetti") { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0); ctx.fillStyle = p.col; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6); ctx.restore(); }
    else { ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.2832); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  for (const f of M.fx.floaters) {
    const a = clamp(f.life / f.max, 0, 1);
    ctx.globalAlpha = a; ctx.fillStyle = f.col;
    ctx.font = "900 " + f.size + "px " + cssVar("--ui"); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 3; ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}
