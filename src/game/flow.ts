/* ============================================================
   Match flow: pre-match card, kickoff and quitting
   ============================================================ */
import { $ } from "../core/utils";
import { initAudio, SFX, setCrowd } from "../audio/audio";
import { show, previewRival, clearRivalPreview } from "../ui/ui";
import { RT } from "./runtime";
import { setupMatch } from "./setup";
import { resizeCanvas, render } from "./render";
import { startLoop, stopLoop, resetStrikeHUD } from "./loop";

export function beginMatchSetup() {
  previewRival();
  setupMatch();
  show("match");
  $("pauseOverlay").classList.remove("show");
  // No text wall — the controls are taught on-canvas during the first match.
  $("tutOverlay").classList.remove("show");
  $("kickoffOverlay").classList.add("show");
  RT.paused = false; RT.running = false;
  resizeCanvas(); render(performance.now());
}
export function kickOff() {
  initAudio();
  $("kickoffOverlay").classList.remove("show");
  SFX.whistleShort();
  RT.M.ended = false;
  startLoop();
}
export function quitMatch() {
  stopLoop(); setCrowd(0);
  if (RT.M) RT.M.aim = null; RT.pointerDown = false;
  $("kickoffOverlay").classList.remove("show");
  $("pauseOverlay").classList.remove("show");
  $("tutOverlay").classList.remove("show");
  $("strikeVig").classList.remove("on"); $("strikeLbl").classList.remove("on"); resetStrikeHUD();
  clearRivalPreview();
  show("menu");
}
