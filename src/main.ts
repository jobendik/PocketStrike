/* ============================================================
   POCKET FOOTBALL CLUB — Strike Moments Edition
   Boot + global event wiring. Single entry module.
   ============================================================ */
import "./styles/main.css";
import { $, clearVarCache } from "./core/utils";
import { CFG, UPGRADES } from "./core/config";
import type { Upgrades } from "./core/types";
import { load, save, resetState, byId, upgradeCost, S, toast } from "./state/save";
import {
  show, paintNavs, renderMenu, renderUpgrades, renderTopbar, renderSquad,
  openPlayerSheet, getCurScreen,
} from "./ui/ui";
import { initAudio, SFX, setMasterVolume } from "./audio/audio";
import { RT, bindCanvas } from "./game/runtime";
import { resizeCanvas, render } from "./game/render";
import { onDown, onMove, onUp } from "./game/input";
import { beginMatchSetup, kickOff, quitMatch } from "./game/flow";
import { advancePost } from "./game/result";

function boot() {
  bindCanvas($("gameCanvas") as HTMLCanvasElement);

  // inject player detail modal
  const modal = document.createElement("div");
  modal.className = "modal"; modal.id = "playerModal";
  modal.innerHTML = `<div class="sheet"></div>`;
  $("stage").appendChild(modal);

  load();
  paintNavs("menu");
  show("menu");
  resizeCanvas();

  // generic routing / actions
  document.addEventListener("click", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const go = target.closest<HTMLElement>("[data-go]");
    if (go) { initAudio(); SFX.click(); show(go.dataset.go as string); return; }
    const up = target.closest<HTMLElement>("[data-up]");
    if (up) {
      const key = up.dataset.up as keyof Upgrades; const cost = upgradeCost(key);
      if (S.up[key] >= CFG.upgradeMax) return;
      if (S.coins >= cost) { S.coins -= cost; S.up[key]++; SFX.upgrade(); save(); renderUpgrades(); renderTopbar(); renderMenu(); toast((UPGRADES.find(u => u.key === key) as any).name + " upgraded!"); }
      else toast("Not enough coins");
      return;
    }
    const pc = target.closest<HTMLElement>("[data-pid]");
    if (pc) { const p = byId(pc.dataset.pid as string); if (p) { initAudio(); SFX.click(); openPlayerSheet(p); } return; }
  });

  // play / kickoff / tutorial
  $("btnPlay").onclick = () => { initAudio(); SFX.click(); beginMatchSetup(); };
  $("koStart").onclick = kickOff;
  $("koQuit").onclick = () => { SFX.click(); quitMatch(); };
  $("tutGo").onclick = () => { initAudio(); SFX.click(); S.seenTutorial = true; save(); $("tutOverlay").classList.remove("show"); $("kickoffOverlay").classList.add("show"); };

  // pause
  $("pauseBtn").onclick = () => { if (!RT.running || RT.M.ended) return; RT.paused = true; $("pauseOverlay").classList.add("show"); SFX.click(); };
  $("pResume").onclick = () => { RT.paused = false; $("pauseOverlay").classList.remove("show"); RT.lastT = performance.now(); SFX.click(); };
  $("pQuit").onclick = () => { SFX.click(); quitMatch(); };

  // result
  $("resHome").onclick = () => { SFX.click(); RT.M.result!.next = "menu"; advancePost(); };
  $("resAgain").onclick = () => { SFX.click(); RT.M.result!.next = "rematch"; advancePost(); };

  // settings
  $("swSound").onclick = () => { S.sound = !S.sound; $("swSound").classList.toggle("on", S.sound); setMasterVolume(); save(); if (S.sound) SFX.click(); };
  $("swShake").onclick = () => { S.shake = !S.shake; $("swShake").classList.toggle("on", S.shake); save(); SFX.click(); };
  $("swSlowmo").onclick = () => { S.slowmo = !S.slowmo; $("swSlowmo").classList.toggle("on", S.slowmo); save(); SFX.click(); };
  $("btnRename").onclick = () => { const v = ($("clubNameInput") as HTMLInputElement).value.trim(); if (v) { S.clubName = v; save(); toast("Club renamed"); SFX.upgrade(); } };
  const btnReset = $("btnReset");
  btnReset.onclick = () => {
    if (btnReset.dataset.confirm === "1") {
      resetState(); clearVarCache(); document.documentElement.style.setProperty("--away", "#fb7185");
      show("menu"); toast("Progress reset"); btnReset.dataset.confirm = "0"; btnReset.textContent = "Reset All Progress";
    } else {
      btnReset.dataset.confirm = "1"; btnReset.textContent = "Tap again to confirm";
      setTimeout(() => { if ($("btnReset")) { btnReset.dataset.confirm = "0"; btnReset.textContent = "Reset All Progress"; } }, 2600);
    }
  };

  // match input: quick tap + drag-to-aim
  const canvas = RT.canvas;
  canvas.addEventListener("pointerdown", (e: PointerEvent) => { e.preventDefault(); onDown(e.clientX, e.clientY); }, { passive: false });
  window.addEventListener("pointermove", (e: PointerEvent) => { if (RT.M && RT.M.aim) { e.preventDefault(); onMove(e.clientX, e.clientY); } }, { passive: false });
  window.addEventListener("pointerup", () => { onUp(); });
  window.addEventListener("pointercancel", () => { RT.pointerDown = false; if (RT.M) RT.M.aim = null; });
  canvas.addEventListener("touchstart", (e: TouchEvent) => { e.preventDefault(); }, { passive: false });
  canvas.addEventListener("touchmove", (e: TouchEvent) => { e.preventDefault(); }, { passive: false });

  // resize + visibility
  window.addEventListener("resize", () => { resizeCanvas(); if (RT.M && getCurScreen() === "match" && !RT.running) render(performance.now()); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && RT.running && !RT.M.ended) { RT.paused = true; $("pauseOverlay").classList.add("show"); } });
  window.addEventListener("contextmenu", (e: Event) => { if (getCurScreen() === "match") e.preventDefault(); });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
