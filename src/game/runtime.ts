/* ============================================================
   Shared match runtime: the active MatchState + loop/canvas refs.
   A single mutable object keeps cross-module match state simple.
   ============================================================ */
import type { MatchState } from "../core/types";

export const RT = {
  M: null as unknown as MatchState,   // active match (set in setupMatch)
  running: false,
  paused: false,
  rafId: 0,
  lastT: 0,
  canvas: null as unknown as HTMLCanvasElement,
  ctx: null as unknown as CanvasRenderingContext2D,
  DPR: 1, scale: 1, offX: 0, offY: 0,
  pointerDown: false, pStartX: 0, pStartY: 0, pStartT: 0,
};

export function bindCanvas(canvas: HTMLCanvasElement) {
  RT.canvas = canvas;
  RT.ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
}
