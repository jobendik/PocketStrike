/* ============================================================
   Main RAF loop, match update orchestration and live HUD
   ============================================================ */
import { $, clamp, lerp, fmtTime, rand } from "../core/utils";
import { CFG, PITCH, AIM_SLOW } from "../core/config";
import { SFX } from "../audio/audio";
import { RT } from "./runtime";
import { tapQuality } from "./geometry";
import { aiAutoAction, updateAITargets } from "./ai";
import { movePlayer, separatePlayers } from "./movement";
import { updateBall, gainPossession } from "./ball";
import { computeContext, strikeEligible } from "./input";
import { dramaTick, updateMeters, banner } from "./drama";
import { updateFX } from "./fx";
import { render } from "./render";
import { endMatch } from "./result";

export function startLoop() { if (RT.rafId) cancelAnimationFrame(RT.rafId); RT.lastT = performance.now(); RT.running = true; RT.paused = false; RT.rafId = requestAnimationFrame(frame); }
export function stopLoop() { RT.running = false; if (RT.rafId) cancelAnimationFrame(RT.rafId); RT.rafId = 0; }

function frame(t: number) {
  RT.rafId = requestAnimationFrame(frame);
  const M = RT.M;
  let realDt = (t - RT.lastT) / 1000; RT.lastT = t;
  if (realDt > 0.05) realDt = 0.05; if (realDt < 0) realDt = 0;
  if (M && !RT.paused && !M.ended) {
    let target = 1;
    if (M.aim && M.aim.hasBall) target = AIM_SLOW;
    if (M.slowT > 0) { M.slowT -= realDt; target = Math.min(target, 0.4); }
    M.slow = lerp(M.slow, target, clamp(realDt * 9, 0, 1));
    updateMatch(realDt * M.slow, realDt);
  }
  if (M) render(t);
}

function updateMatch(dt: number, realDt: number) {
  const M = RT.M;
  M.frame = (M.frame || 0) + 1;
  M.timing.t += dt;
  M.timing.phase = (M.timing.t / 0.9) % 1;
  if (M.aim && M.aim.hasBall) M.ring.t = (M.ring.t + realDt / 0.7) % 1;

  if (M.forceStrike === 1 && M.kickoffLock <= 0 && !M.celebrate) {
    M.forceT -= realDt;
    if (M.forceT <= 0) {
      const st = M.home.find(p => p.role === "ST");
      if (st) { st.x = clamp(PITCH.cx + rand(-26, 26), PITCH.left + 30, PITCH.right - 30); st.y = PITCH.top + 118; gainPossession(st); st.decT = 3.0; banner("STRIKE MOMENT! DRAG TO AIM", "bn-chance", 7); }
      M.forceStrike = 2;
    }
  }

  if (M.kickoffLock > 0) {
    M.kickoffLock -= realDt;
    if (M.kickoffLock <= 0) {
      const kt = M.kickoffTo || M.players.find(p => p.team === "home" && p.role === "MID");
      if (kt) { M.ball.owner = kt; M.ball.x = kt.x; M.ball.y = kt.y; M.ball.lockT = 0.05; }
      M.kickoffTo = null;
    }
  }
  if (M.celebrate) { M.celebrate.t -= realDt; if (M.celebrate.t <= 0) M.celebrate = null; }

  if (M.kickoffLock <= 0 && !M.celebrate) M.timeLeft -= dt;
  if (M.timeLeft <= 0) { M.timeLeft = 0; $("sbTime").textContent = "0:00"; endMatch(); return; }
  if (M.timeLeft <= CFG.clutchTime && !M.clutchOn) {
    M.clutchOn = true; banner("CLUTCH TIME", "bn-clutch", 6);
    $("sbTimeWrap").classList.add("clutch"); $("clutchVig").classList.add("on"); SFX.tension();
  }
  if (M.clutchOn && (M.frame as number) % 80 === 0) SFX.tension();

  aiAutoAction(dt);
  updateAITargets(dt);
  for (const p of M.players) movePlayer(p, dt);
  separatePlayers();
  updateBall(dt);
  antiStuck(realDt);

  if (M.ball.owner) { const tgt = M.ball.owner.team === "home" ? 1 : 0; M.poss = lerp(M.poss, tgt, clamp(dt * 0.5, 0, 1)); }
  if ((M.frame as number) % 30 === 0) { M.flow = clamp(M.flow - 1.2, 0, 100); M.flowTier = M.flow >= 100 ? 3 : M.flow >= 67 ? 2 : M.flow >= 34 ? 1 : 0; }

  computeContext();
  updateHint();
  updateStrikeHUD();
  dramaTick(dt);
  updateFX(dt);
  updateMeters();
  ($("flash") as HTMLElement).style.opacity = String(clamp(M.flashV || 0, 0, 0.85));
  $("sbTime").textContent = fmtTime(M.timeLeft);
}

function antiStuck(dt: number) {
  const M = RT.M, b = M.ball;
  if (!b.owner && Math.hypot(b.vx, b.vy) < 6 && b.height <= 0) {
    M.stuckT = (M.stuckT || 0) + dt;
    if (M.stuckT > 1.4) {
      let best = null, bd = 1e9;
      for (const p of M.players) { if (p.role === "GK") continue; const d = (p.x - b.x) ** 2 + (p.y - b.y) ** 2; if (d < bd) { bd = d; best = p; } }
      if (best) gainPossession(best);
      M.stuckT = 0;
    }
  } else M.stuckT = 0;
}

let _lastHintTxt = "", _lastHintCls = "", _lastTaph = "";
function updateHint() {
  const M = RT.M, chip = $("actionChip"); if (!chip) return;
  let txt = "", cls = "chip";
  if (M.kickoffLock > 0) txt = "GET READY";
  else if (M.celebrate) txt = M.celebrate.team === "home" ? "GOAL!" : "…";
  else if (M.ctx) { txt = M.ctx.label; if (M.ctx.cls) cls += " " + M.ctx.cls; }
  const q = tapQuality(M.timing.phase);
  if ((q === "PERFECT" || q === "GREAT") && M.kickoffLock <= 0 && !M.celebrate) cls += " hot";
  if (txt !== _lastHintTxt) { chip.textContent = txt; _lastHintTxt = txt; }
  if (cls !== _lastHintCls) { chip.className = cls; _lastHintCls = cls; }
  const taph = $("actionTaph"); if (taph) {
    let sub: string;
    if (M.aim && M.aim.hasBall) sub = "drag · aim · release";
    else if (M.active && strikeEligible(M.active)) sub = "drag to aim · tap to pass";
    else sub = "tap anywhere";
    if (sub !== _lastTaph) { taph.textContent = sub; _lastTaph = sub; }
  }
}

let _strikeOn = false, _strikeType = "";
function updateStrikeHUD() {
  const M = RT.M;
  const aiming = !!(M.aim && M.aim.hasBall);
  const moved = aiming && (M.aim as any).moved > 10;
  if (aiming !== _strikeOn) { _strikeOn = aiming; $("strikeVig").classList.toggle("on", aiming); }
  const lbl = $("strikeLbl");
  if (aiming && moved) {
    const t = (M.aim as any)._type || "drive";
    const map: Record<string, string> = { drive: "DRIVE", finesse: "FINESSE", power: "POWER", chip: "CHIP", pass: "PASS" };
    const name = map[t] || "DRIVE";
    if (name !== _strikeType) { _strikeType = name; $("strikeType").textContent = name; $("strikeSub").textContent = t === "pass" ? "Release to pass" : "Release to shoot"; }
    lbl.classList.add("on");
  } else if (lbl.classList.contains("on")) lbl.classList.remove("on");
}

export function resetStrikeHUD() { _strikeOn = false; _strikeType = ""; }
