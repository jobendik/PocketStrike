/* ============================================================
   Momentum / flow / banners / crowd intensity / HUD meters
   ============================================================ */
import { $, clamp, lerp, dist, now } from "../core/utils";
import { PITCH, GOAL_W } from "../core/config";
import { setCrowd } from "../audio/audio";
import { RT } from "./runtime";
import { spawnBurst } from "./fx";

const awayGoalY = () => PITCH.top;

export function addMomentum(d: number) { const M = RT.M; if (!M) return; M.momentum = clamp(M.momentum + d, -100, 100); }
export function addFlow(d: number) {
  const M = RT.M;
  M.flow = clamp(M.flow + d, 0, 100);
  const t = M.flow >= 100 ? 3 : M.flow >= 67 ? 2 : M.flow >= 34 ? 1 : 0;
  if (t > M.flowTier && t >= 2) spawnBurst(M.active ? M.active.x : PITCH.cx, M.active ? M.active.y : PITCH.cy, "#ffd23f", 8, true);
  M.flowTier = t;
}
export function banner(text: string, cls: string, pri?: number) {
  const M = RT.M; if (!M) return;
  pri = pri || 0;
  if (M.bannerUntil && now() < M.bannerUntil && pri < (M.bannerPri || 0)) return;
  M.bannerPri = pri; M.bannerUntil = now() + (pri >= 9 ? 1500 : 900);
  const el = $("banner"), t = $("bannerText");
  t.textContent = text; t.className = "bg " + cls;
  el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
}
export function dramaTick(dt: number) {
  const M = RT.M, b = M.ball;
  let base = 0.22 + Math.abs(M.momentum) / 100 * 0.4;
  if (M.clutchOn) base = Math.max(base, 0.6);
  M.crowdTarget = lerp(M.crowdTarget, base, clamp(dt * 0.8, 0, 1));
  M.crowd = lerp(M.crowd, M.crowdTarget, clamp(dt * 1.5, 0, 1));
  setCrowd(M.crowd);

  const tnow = now();
  if (b.owner && b.owner.team === "away" && b.y > PITCH.bottom - 150 && Math.abs(b.x - PITCH.cx) < 150) {
    if (tnow - (M.lastDangerBanner || 0) > 3200) { M.lastDangerBanner = tnow; banner("DANGER!", "bn-danger", 4); }
  }
  if (b.owner && b.owner.team === "home" && b.y < PITCH.top + 150 && Math.abs(b.x - PITCH.cx) < 150) {
    const gk = M.away.find(p => p.role === "GK");
    const keeperFar = gk && dist(gk.x, gk.y, PITCH.cx, awayGoalY()) > 40;
    if (tnow - (M.lastChanceBanner || 0) > 3200) {
      M.lastChanceBanner = tnow;
      banner(keeperFar ? "OPEN GOAL!" : "BIG CHANCE!", "bn-chance", 4);
    }
  }
}
export function updateMeters() {
  const M = RT.M; if (!M) return;
  const m = M.momentum, el = $("momFill");
  if (m >= 0) { el.className = "mom-fill home"; el.style.left = "50%"; el.style.width = (m / 100 * 50) + "%"; }
  else { el.className = "mom-fill away"; const w = (-m / 100 * 50); el.style.width = w + "%"; el.style.left = (50 - w) + "%"; }
  $("flowFill").style.width = M.flow + "%";
  const lbl = $("flowLbl");
  lbl.textContent = M.flow >= 100 ? "ON FIRE 🔥" : M.flow >= 67 ? "IN FLOW" : "FLOW";
  lbl.classList.toggle("dim", M.flow < 34);
  $("possFill").style.width = (clamp(M.poss, 0, 1) * 100).toFixed(0) + "%";
}

/* re-export for modules that need the goal-mouth width */
export { GOAL_W };
