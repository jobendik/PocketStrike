/* ============================================================
   Match setup: build teams, opponent, objective and kickoff card
   ============================================================ */
import type { Player, Position, Team, MatchPlayer } from "../core/types";
import { $, clamp, rand, pick, lerp, clip, fmtTime, shade, uid } from "../core/utils";
import {
  CFG, LEAGUES, STYLES, STYLE_KEYS, OBJECTIVES, PITCH, FIRST, LAST,
} from "../core/config";
import { S, effStat, teamRating, upgradeBonus, startingXI } from "../state/save";
import { getRivalPreview } from "../ui/ui";
import { RT } from "./runtime";
import { formationPos } from "./geometry";
import { resizeCanvas } from "./render";
import { updateMeters } from "./drama";

function genOpponent(role: Position, rating: number): Player {
  const base = clamp(rating, 25, 95);
  const s = (spread: number) => clamp(Math.round(base + rand(-spread, spread)), 20, 99);
  let pac = s(8), sht = s(10), pas = s(9), def = s(9);
  if (role === "ST") { sht += 8; def -= 10; } else if (role === "DEF") { def += 10; sht -= 8; }
  else if (role === "GK") { def += 10; sht -= 16; }
  return {
    id: "opp_" + uid(), name: pick(FIRST) + " " + pick(LAST), pos: role, tier: "Common", trait: "None",
    level: 1, xp: 0, pac: clamp(pac, 20, 99), sht: clamp(sht, 20, 99), pas: clamp(pas, 20, 99), def: clamp(def, 20, 99),
    form: 0, goals: 0, assists: 0, tackles: 0, saves: 0, apps: 0,
  };
}

function makeMatchPlayer(ref: Player, team: Team, role: Position, mult: { spd: number; def: number }): MatchPlayer {
  const f = {
    pac: (effStat(ref, "pac") / 99) * mult.spd,
    sht: (effStat(ref, "sht") / 99),
    pas: (effStat(ref, "pas") / 99),
    def: (effStat(ref, "def") / 99) * mult.def,
  };
  const a = formationPos(role, team);
  return {
    ref, team, role,
    x: a.x, y: a.y, hx: a.x, hy: a.y,
    vx: 0, vy: 0, face: team === "home" ? -1 : 1,
    f, stun: 0, cel: 0, dive: 0, lunge: 0, boost: 0,
    mGoals: 0, mAssists: 0, mTackles: 0, mSaves: 0, lastTouch: 0,
  };
}

export function setupMatch() {
  resizeCanvas();
  const lg = LEAGUES[S.league];
  const styleKey = S.totalMatches === 0 ? "balanced" : pick(STYLE_KEYS);
  const style = STYLES[styleKey];
  const rivalName = getRivalPreview() || "Rival";
  const rivalColor = lg.rival;
  document.documentElement.style.setProperty("--away", rivalColor);
  document.documentElement.style.setProperty("--away2", rivalColor);

  const myRating = teamRating();
  let awayRating = clamp(Math.round(myRating * lg.diff + rand(-4, 4)), 30, 99);
  if (S.totalMatches === 0) awayRating = Math.round(awayRating * 0.82);
  if (S.lossStreak >= 2) awayRating = Math.round(awayRating * (1 - Math.min(S.lossStreak * 0.05, 0.2)));
  if (S.winStreak >= 3) awayRating = Math.round(awayRating * (1 + Math.min((S.winStreak - 2) * 0.03, 0.12)));
  awayRating = clamp(awayRating, 30, 99);

  const ub = upgradeBonus();
  const homeMult = { spd: 1 + ub.speed, def: 1 + ub.defend };
  const awScale = clamp(awayRating / Math.max(myRating, 40), 0.7, 1.3);
  const awayMult = { spd: style.speed * lerp(0.92, 1.12, awScale - 0.7), def: style.tackle * lerp(0.9, 1.15, awScale - 0.7) };

  const xi = startingXI();
  const homeP = xi.map(p => makeMatchPlayer(p, "home", p.pos, homeMult));
  const awayRoles: Position[] = ["GK", "DEF", "MID", "ST"];
  const awayP = awayRoles.map(role => makeMatchPlayer(genOpponent(role, awayRating), "away", role, awayMult));

  const obj = pick(OBJECTIVES);
  const underdog = myRating < awayRating - 3;

  RT.M = {
    homeScore: 0, awayScore: 0,
    timeLeft: CFG.matchSeconds, elapsed: 0,
    players: [...homeP, ...awayP], home: homeP, away: awayP,
    ball: { x: PITCH.cx, y: PITCH.cy, vx: 0, vy: 0, owner: null, lockT: 0.4, height: 0, vz: 0, spin: 0, lastKicker: null, shot: false, chip: false, quality: "", shotType: "", shotDist: 0, fromTeam: null, trail: [], rot: 0 },
    timing: { phase: 0, t: 0 },
    aim: null, ring: { t: 0 },
    forceStrike: S.totalMatches === 0 ? 1 : 0, forceT: 3.2,
    bestMoment: null,
    momentum: 0, flow: 0, passStreak: 0, flowTier: 0,
    poss: 0.5,
    active: null, ctx: null, lastHint: "",
    fx: { parts: [], floaters: [], ripples: [] },
    shake: 0, slow: 1, slowT: 0, zoom: 0, flashV: 0,
    crowd: 0.25, crowdTarget: 0.25,
    kickoffLock: 1.2, ended: false,
    rival: { name: rivalName, style: styleKey, color: rivalColor, rating: awayRating },
    obj, objDone: false, underdog,
    bannerT: 0,
    stat: {
      tackles: 0, perfects: 0, shots: 0, saves: 0, passStreak: 0, bestPassStreak: 0,
      strikerGoal: false, concededFirst: false, lateGoal: false, homeShotsOnTarget: 0, biggestLead: 0,
    },
    diff: { awayRating, myRating },
    lastDangerBanner: 0, lastChanceBanner: 0,
    clutchOn: false,
  };

  $("koLeague").textContent = lg.name;
  $("koHomeBadge").textContent = (S.clubName[0] || "Y").toUpperCase();
  $("koHomeName").textContent = S.clubName;
  $("koHomeRating").textContent = "OVR " + myRating;
  $("koAwayBadge").textContent = (rivalName[0] || "R").toUpperCase();
  $("koAwayBadge").style.background = "linear-gradient(160deg," + rivalColor + "," + shade(rivalColor, -20) + ")";
  $("koAwayName").textContent = rivalName;
  $("koAwayRating").textContent = "OVR " + awayRating;
  $("koStyle").textContent = style.label + (underdog ? " · You're the underdog 💪" : "");
  $("koObjective").innerHTML = "🎯 <b>" + obj.title + "</b> — " + obj.desc + (obj.reward ? ` (+${obj.reward.c || 0}🪙)` : "");

  $("sbHomeName").textContent = clip(S.clubName, 9);
  $("sbAwayName").textContent = clip(rivalName, 9);
  $("sbHome").textContent = "0"; $("sbAway").textContent = "0";
  $("sbTime").textContent = fmtTime(CFG.matchSeconds);
  $("sbTimeWrap").classList.remove("clutch");
  $("clutchVig").classList.remove("on");
  $("strikeVig").classList.remove("on"); $("strikeLbl").classList.remove("on");
  ($("flash") as HTMLElement).style.opacity = "0";
  RT.pointerDown = false;
  updateMeters();
  $("possFill").style.width = "50%";
}
