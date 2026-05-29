/* ============================================================
   Constants, balance config and static data tables
   ============================================================ */
import type { League, Style, Trait, Objective, Achievement, Upgrade, MatchState } from "./types";

/* ---------- virtual coords ---------- */
export const VW = 400, VH = 720;
export const PITCH = { left: 20, right: 380, top: 74, bottom: 646, cx: 200, cy: 360, w: 360, h: 572 };
export const GOAL_W = 104, GOAL_DEPTH = 20;
export const PLAYER_R = 14, BALL_R = 7;
export const GOAL_L = PITCH.cx - GOAL_W / 2, GOAL_R = PITCH.cx + GOAL_W / 2;

/* ---------- match tuning ---------- */
export const SP = 64;          // base player speed (units/s)
export const BALLSPD = 190;    // base shot speed
export const SWEET = 0.82;     // timing sweet-spot phase
export const AIM_SLOW = 0.20;  // bullet-time scale while aiming a strike
export const AIM_MAXLEN = 150; // drag length (world units) mapping to full power

export const SAVE_KEY = "pocketFootballClub_v2";

export const CFG = {
  matchSeconds: 60,
  reward: { win: { c: 60, f: 10, x: 14 }, draw: { c: 35, f: 5, x: 8 }, loss: { c: 20, f: 2, x: 5 } },
  upgradeBase: 50, upgradeMul: 1.42, upgradeMax: 8,
  trainBase: 40, trainMul: 1.5,
  mergeCost: 120,
  scoutNeed: 5,
  chestEvery: 3,
  clutchTime: 10,
};

export const LEAGUES: League[] = [
  { name: "Street League", short: "STREET", diff: 0.80, rewMul: 1.0, rival: "#fb7185", goal: 0 },
  { name: "Local League", short: "LOCAL", diff: 0.96, rewMul: 1.25, rival: "#fbbf24", goal: 6 },
  { name: "City League", short: "CITY", diff: 1.10, rewMul: 1.55, rival: "#a78bfa", goal: 7 },
  { name: "National League", short: "NAT'L", diff: 1.24, rewMul: 1.95, rival: "#f472b6", goal: 8 },
  { name: "World Stars", short: "WORLD", diff: 1.40, rewMul: 2.5, rival: "#34d399", goal: 9 },
];

export const STYLES: Record<string, Style> = {
  balanced: { label: "Balanced", press: 1.0, line: 0.5, shootBias: 0.55, passBias: 0.5, speed: 1.0, tackle: 1.0 },
  pressHigh: { label: "High Press", press: 1.5, line: 0.66, shootBias: 0.5, passBias: 0.45, speed: 1.06, tackle: 1.15 },
  lowBlock: { label: "Low Block", press: 0.7, line: 0.30, shootBias: 0.5, passBias: 0.5, speed: 0.97, tackle: 1.1 },
  counter: { label: "Counter Attack", press: 0.85, line: 0.40, shootBias: 0.62, passBias: 0.6, speed: 1.1, tackle: 1.0 },
  passing: { label: "Tiki-Taka", press: 1.05, line: 0.55, shootBias: 0.42, passBias: 0.78, speed: 1.0, tackle: 0.95 },
  longShots: { label: "Long Shooters", press: 1.0, line: 0.55, shootBias: 0.85, passBias: 0.4, speed: 1.0, tackle: 1.0 },
  physical: { label: "Hard Tackling", press: 1.2, line: 0.5, shootBias: 0.5, passBias: 0.45, speed: 0.98, tackle: 1.35 },
};
export const STYLE_KEYS = Object.keys(STYLES);

export const TRAITS: Record<string, Trait> = {
  None: { label: "—", desc: "No special trait." },
  Finisher: { label: "Finisher", desc: "+ Shooting & better finishing.", st: { sht: 8 } },
  Playmaker: { label: "Playmaker", desc: "+ Passing, sharper through balls.", st: { pas: 8 } },
  Wall: { label: "Wall", desc: "+ Defending, blocks more shots.", st: { def: 8 } },
  Speedster: { label: "Speedster", desc: "+ Pace, wins loose balls.", st: { pac: 9 } },
  Clutch: { label: "Clutch", desc: "Stronger in the final 15s.", st: {} },
  LongShot: { label: "Long Shot", desc: "Dangerous from distance.", st: { sht: 5 } },
  Interceptor: { label: "Interceptor", desc: "Reads passing lanes.", st: { def: 5, pac: 4 } },
  SweeperGK: { label: "Sweeper Keeper", desc: "Keeper rushes & saves more.", st: { def: 6 } },
  Captain: { label: "Captain", desc: "Lifts the whole team's pace.", st: { pas: 3, def: 3 } },
  SuperSub: { label: "Super Sub", desc: "Boost when coming off the bench.", st: { pac: 5 } },
};
export const TRAIT_POOL = ["Finisher", "Playmaker", "Wall", "Speedster", "Clutch", "LongShot", "Interceptor", "Captain"];

export const OBJECTIVES: Objective[] = [
  { id: "win", icon: "🏆", title: "Win the match", desc: "Finish with more goals.", reward: { c: 30, f: 6 }, check: (m: MatchState) => m.homeScore > m.awayScore },
  { id: "score2", icon: "⚽", title: "Score 2 goals", desc: "Find the net twice.", reward: { c: 25, f: 5 }, prog: (m: MatchState) => m.homeScore, goal: 2 },
  { id: "win2", icon: "💪", title: "Win by 2+", desc: "Win with a 2 goal cushion.", reward: { c: 40, f: 8 }, check: (m: MatchState) => m.homeScore - m.awayScore >= 2 },
  { id: "clean", icon: "🧤", title: "Keep a clean sheet", desc: "Concede no goals.", reward: { c: 40, f: 7 }, check: (m: MatchState) => m.awayScore === 0 && m.homeScore > 0 },
  { id: "tackles2", icon: "🦵", title: "Win 2 tackles", desc: "Steal the ball twice.", reward: { c: 22, f: 4 }, prog: (m: MatchState) => m.stat.tackles, goal: 2 },
  { id: "perfect3", icon: "✨", title: "3 perfect taps", desc: "Nail the timing 3 times.", reward: { c: 28, f: 5 }, prog: (m: MatchState) => m.stat.perfects, goal: 3 },
  { id: "strikergoal", icon: "🎯", title: "Score with striker", desc: "Your ST gets on the scoresheet.", reward: { c: 26, f: 6 }, check: (m: MatchState) => m.stat.strikerGoal },
  { id: "comeback", icon: "🔥", title: "Win after conceding", desc: "Concede first, win anyway.", reward: { c: 50, f: 10 }, check: (m: MatchState) => m.stat.concededFirst && m.homeScore > m.awayScore },
  { id: "lastgoal", icon: "⏱️", title: "Score in last 10s", desc: "A late strike.", reward: { c: 35, f: 7 }, check: (m: MatchState) => m.stat.lateGoal },
  { id: "streak4", icon: "🔗", title: "4 pass streak", desc: "String 4 passes together.", reward: { c: 24, f: 5 }, prog: (m: MatchState) => m.stat.bestPassStreak, goal: 4 },
];

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first", icon: "👟", title: "First Kick", desc: "Play your first match.", check: s => s.totalMatches >= 1 },
  { id: "win1", icon: "🥅", title: "On the Board", desc: "Win a match.", check: s => s.wins >= 1 },
  { id: "win10", icon: "🏅", title: "Contender", desc: "Win 10 matches.", check: s => s.wins >= 10 },
  { id: "goals25", icon: "⚽", title: "Goal Machine", desc: "Score 25 total goals.", check: s => s.totalGoals >= 25 },
  { id: "promote", icon: "⬆️", title: "Moving Up", desc: "Earn a promotion.", check: s => s.league >= 1 },
  { id: "world", icon: "🌍", title: "World Stars", desc: "Reach the top league.", check: s => s.league >= 4 },
  { id: "legend", icon: "👑", title: "Legend Signing", desc: "Own a Legend player.", check: s => s.squad.some(p => p.tier === "Legend") },
  { id: "streak5", icon: "🔥", title: "On Fire", desc: "Win 5 in a row.", check: s => s.bestWinStreak >= 5 },
  { id: "rich", icon: "💰", title: "Big Spender", desc: "Bank 1000 coins.", check: s => s.lifetimeCoins >= 1000 },
  { id: "squad8", icon: "📋", title: "Deep Squad", desc: "Hold 8 players.", check: s => s.squad.length >= 8 },
];

export const UPGRADES: Upgrade[] = [
  { key: "pass", name: "Passing", ico: "🎯", desc: "Sharper, faster passing" },
  { key: "shot", name: "Shooting", ico: "⚽", desc: "More shot power & accuracy" },
  { key: "speed", name: "Team Pace", ico: "⚡", desc: "Players move quicker" },
  { key: "defend", name: "Defending", ico: "🛡️", desc: "Win more tackles & blocks" },
  { key: "gk", name: "Goalkeeper", ico: "🧤", desc: "Better saves & reach" },
  { key: "stadium", name: "Stadium", ico: "🏟️", desc: "+50% fans from matches" },
];

/* ---------- fictional name pools ---------- */
export const FIRST = ["Leo", "Marco", "Kai", "Diego", "Ravi", "Tariq", "Niko", "Sami", "Bruno", "Yuki", "Andre", "Felix", "Omar", "Theo", "Luca", "Mateo", "Ivan", "Pablo", "Hugo", "Dani", "Soren", "Milo", "Enzo", "Cyrus", "Joao", "Remy", "Axel", "Noah", "Vito", "Reza", "Ezra", "Kofi", "Jin", "Aron", "Pedro", "Nael", "Tom", "Vik", "Sasha", "Bo"];
export const LAST = ["Vega", "Stone", "Marsh", "Cruz", "Okoye", "Haas", "Lund", "Costa", "Adeyemi", "Ferro", "Wolf", "Nakamura", "Silva", "Park", "Ortiz", "Bauer", "Reyes", "Novak", "Sane", "Falk", "Iqbal", "Mendez", "Krol", "Dahl", "Bianchi", "Rossi", "Libre", "Tan", "Diaz", "Holt", "Berg", "Frost", "Rios", "Vidal", "Lima", "Roca", "Sol", "Mraz", "Dorn"];
export const CLUBPREFIX = ["Neon", "Iron", "Royal", "Wild", "Crimson", "Atlas", "Phoenix", "Storm", "Vortex", "Golden", "Shadow", "Cosmic", "Thunder", "Velvet", "Rapid"];
export const CLUBSUFFIX = ["United", "Rovers", "City", "FC", "Athletic", "Stars", "Wanderers", "Galaxy", "Dynamo", "Lions", "Wolves", "Rangers", "Hotspur", "Sporting"];
export const RIVAL_NAMES = ["Iron Foxes", "Crimson Bulls", "Azure Sharks", "Golden Hawks", "Shadow Wolves", "Neon Tigers", "Storm Eagles", "Vortex Lions", "Rapid Cobras", "Steel Rhinos", "Phantom Owls", "Solar Pumas", "Frost Bears", "Jade Dragons", "Volt Vipers", "Ember Stags", "Cobalt Rays", "Granite Apes", "Mystic Stallions", "Turbo Panthers"];
