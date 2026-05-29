/* ============================================================
   Shared type definitions
   ============================================================ */

export type Position = "GK" | "DEF" | "MID" | "ST";
export type Tier = "Common" | "Rare" | "Star" | "Legend";
export type Team = "home" | "away";

export interface Player {
  id: string;
  name: string;
  pos: Position;
  tier: Tier;
  trait: string;
  level: number;
  xp: number;
  pac: number;
  sht: number;
  pas: number;
  def: number;
  form: number;
  goals: number;
  assists: number;
  tackles: number;
  saves: number;
  apps: number;
}

export interface Upgrades {
  pass: number; shot: number; speed: number; defend: number; gk: number; stadium: number;
}

export interface SaveState {
  v: number;
  clubName: string;
  crestHue: number;
  coins: number; fans: number; clubXP: number; clubLevel: number; league: number;
  squad: Player[];
  xi: Record<string, string | null>;
  up: Upgrades;
  totalMatches: number; wins: number; draws: number; losses: number;
  lossStreak: number; winStreak: number; bestWinStreak: number;
  totalGoals: number; lifetimeCoins: number;
  scout: number; chestProg: number;
  lastDaily: string; ach: string[];
  rivalsBeaten: string[];
  sound: boolean; shake: boolean; slowmo: boolean;
  seenTutorial: boolean;
}

export interface League { name: string; short: string; diff: number; rewMul: number; rival: string; goal: number; }
export interface Style { label: string; press: number; line: number; shootBias: number; passBias: number; speed: number; tackle: number; }
export interface Trait { label: string; desc: string; st?: Partial<Record<"pac" | "sht" | "pas" | "def", number>>; }
export interface Reward { c?: number; f?: number; x?: number; }
export interface Objective {
  id: string; icon: string; title: string; desc: string; reward?: Reward;
  check?: (m: MatchState) => boolean; prog?: (m: MatchState) => number; goal?: number;
}
export interface Achievement { id: string; icon: string; title: string; desc: string; check: (s: SaveState) => boolean; }
export interface Upgrade { key: keyof Upgrades; name: string; ico: string; desc: string; }

/* ---- in-match entities ---- */
export interface MatchPlayer {
  ref: Player;
  team: Team;
  role: Position;
  x: number; y: number; hx: number; hy: number;
  vx: number; vy: number; face: number;
  f: { pac: number; sht: number; pas: number; def: number; };
  stun: number; cel: number; dive: number; lunge: number; boost: number;
  mGoals: number; mAssists: number; mTackles: number; mSaves: number; lastTouch: number;
  tx?: number; ty?: number; decT?: number; saveBoost?: number;
}

export interface Ball {
  x: number; y: number; vx: number; vy: number;
  owner: MatchPlayer | null; lockT: number; height: number; vz: number;
  spin: number; lastKicker: MatchPlayer | null;
  shot: boolean; chip: boolean; quality: string; shotType?: string; shotDist?: number;
  fromTeam: Team | null; trail: { x: number; y: number; a: number }[];
  rot?: number;
}

export interface AimState {
  sx: number; sy: number; cx: number; cy: number;
  path: [number, number][]; hasBall: boolean; t0: number; moved: number; _type?: string;
}

export interface MatchStat {
  tackles: number; perfects: number; shots: number; saves: number; passStreak: number; bestPassStreak: number;
  strikerGoal: boolean; concededFirst: boolean; lateGoal: boolean;
  homeShotsOnTarget: number; biggestLead: number;
}

export interface BestMoment { tag: string; name: string; rank: number; }

export interface TutState {
  active: boolean;
  step: "intro" | "tap" | "tapDone" | "strike" | "done";
  waiting: boolean;   // true while a coached prompt is open and the sim is frozen
  handT: number;      // animation timer for the ghost hand
  t: number;          // generic transition timer
  holder: MatchPlayer | null;
}

export interface MatchState {
  homeScore: number; awayScore: number;
  timeLeft: number; elapsed: number;
  players: MatchPlayer[]; home: MatchPlayer[]; away: MatchPlayer[];
  ball: Ball;
  timing: { phase: number; t: number };
  aim: AimState | null; ring: { t: number };
  forceStrike: number; forceT: number;
  tut: TutState | null;
  tutGoalWindow?: number;
  bestMoment: BestMoment | null;
  momentum: number; flow: number; passStreak: number; flowTier: number;
  poss: number;
  active: MatchPlayer | null; ctx: { type: string; label: string; cls: string } | null; lastHint: string;
  fx: { parts: any[]; floaters: any[]; ripples: any[] };
  shake: number; slow: number; slowT: number; zoom?: number; flashV?: number;
  crowd: number; crowdTarget: number;
  kickoffLock: number; ended: boolean;
  rival: { name: string; style: string; color: string; rating: number };
  obj: Objective; objDone: boolean; objText?: string;
  underdog: boolean;
  bannerT: number; bannerUntil?: number; bannerPri?: number;
  stat: MatchStat;
  diff: { awayRating: number; myRating: number };
  lastDangerBanner: number; lastChanceBanner: number;
  clutchOn: boolean;
  frame?: number; stuckT?: number;
  celebrate?: { scorer: MatchPlayer; team: Team; t: number } | null;
  counterFlag?: number;
  lastPasser?: MatchPlayer | null; lastPassT?: number;
  kickoffTo?: MatchPlayer | null;
  bonus?: Reward;
  result?: MatchResult;
}

export interface MatchResult {
  win: boolean; draw: boolean; hs: number; as: number;
  coins: number; fans: number; xp: number;
  objDone: boolean; objReward: Reward; daily: boolean;
  streakBonus: number; underdogBonus: number;
  motm: { ref: Player; name: string; ov: number; statText: string };
  newAch: Achievement[]; promoted: boolean; lvUps: number;
  pending: string[]; next: string;
}
