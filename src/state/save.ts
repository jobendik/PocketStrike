/* ============================================================
   Save state, progression, economy, squad & player helpers
   ============================================================ */
import type { Player, Position, Tier, SaveState } from "../core/types";
import { clamp, rand, randInt, pick, uid } from "../core/utils";
import {
  CFG, LEAGUES, TRAITS, TRAIT_POOL, UPGRADES, SAVE_KEY,
  FIRST, LAST, CLUBPREFIX, CLUBSUFFIX,
} from "../core/config";
import { SFX } from "../audio/audio";

/* live, mutable save state (live binding for importers) */
export let S: SaveState = null as unknown as SaveState;

/* ---------- player creation ---------- */
export function makePlayer(pos: Position, tier?: Tier, levelBias?: number): Player {
  const t: Tier = tier || pick<Tier>(["Common", "Common", "Common", "Rare"]);
  const base = { Common: [34, 52], Rare: [50, 66], Star: [64, 78], Legend: [78, 90] }[t];
  const s = () => randInt(base[0], base[1]);
  let pac = s(), sht = s(), pas = s(), def = s();
  if (pos === "ST") { sht += 10; pac += 5; def -= 12; }
  else if (pos === "MID") { pas += 10; }
  else if (pos === "DEF") { def += 12; sht -= 10; }
  else if (pos === "GK") { def += 14; sht -= 18; pac -= 4; }
  const clampS = (v: number) => clamp(v, 20, 99);
  let trait = "None";
  const tc = t === "Legend" ? 0.95 : t === "Star" ? 0.7 : t === "Rare" ? 0.4 : 0.18;
  if (Math.random() < tc) trait = pick(TRAIT_POOL);
  if (pos === "GK" && Math.random() < 0.5) trait = "SweeperGK";
  if (pos === "ST" && trait === "Wall") trait = "Finisher";
  if (pos === "DEF" && trait === "Finisher") trait = "Wall";
  return {
    id: uid(), name: pick(FIRST) + " " + pick(LAST), pos, tier: t, trait,
    level: 1 + (levelBias || 0), xp: 0,
    pac: clampS(pac), sht: clampS(sht), pas: clampS(pas), def: clampS(def),
    form: 1, goals: 0, assists: 0, tackles: 0, saves: 0, apps: 0,
  };
}

export function playerOverall(p: Player): number {
  const w = {
    GK: { pac: .1, sht: 0, pas: .2, def: .7 },
    DEF: { pac: .2, sht: .05, pas: .2, def: .55 },
    MID: { pac: .22, sht: .2, pas: .4, def: .18 },
    ST: { pac: .28, sht: .5, pas: .17, def: .05 },
  }[p.pos] as Record<string, number>;
  let base = p.pac * w.pac + p.sht * w.sht + p.pas * w.pas + p.def * w.def;
  base += (p.level - 1) * 1.4;
  const tb = TRAITS[p.trait] && TRAITS[p.trait].st;
  if (tb) { for (const k in tb) { if (w[k] !== undefined) base += (tb as any)[k] * w[k] * 0.6; } }
  return Math.round(clamp(base, 1, 99));
}
export function effStat(p: Player, key: "pac" | "sht" | "pas" | "def"): number {
  let v = p[key];
  const tb = TRAITS[p.trait] && TRAITS[p.trait].st;
  if (tb && (tb as any)[key]) v += (tb as any)[key];
  v += (p.level - 1) * 0.6;
  v += (p.form || 0) * 2.5;
  return clamp(v, 15, 99);
}
export function playerXpNeed(p: Player): number { return 30 + (p.level - 1) * 22; }
export function addPlayerXp(p: Player, amt: number): boolean {
  p.xp += amt;
  let leveled = false;
  while (p.xp >= playerXpNeed(p) && p.level < 30) { p.xp -= playerXpNeed(p); p.level++; leveled = true; }
  return leveled;
}

/* ---------- default / load / save ---------- */
export function defaultState(): SaveState {
  const squad = [
    makePlayer("GK", "Common"), makePlayer("DEF", "Common"),
    makePlayer("MID", "Rare"), makePlayer("ST", "Rare"),
    makePlayer("MID", "Common"),
  ];
  return {
    v: 2,
    clubName: pick(CLUBPREFIX) + " " + pick(CLUBSUFFIX),
    crestHue: randInt(0, 360),
    coins: 120, fans: 0, clubXP: 0, clubLevel: 1, league: 0,
    squad,
    xi: { GK: squad[0].id, DEF: squad[1].id, MID: squad[2].id, ST: squad[3].id },
    up: { pass: 0, shot: 0, speed: 0, defend: 0, gk: 0, stadium: 0 },
    totalMatches: 0, wins: 0, draws: 0, losses: 0,
    lossStreak: 0, winStreak: 0, bestWinStreak: 0,
    totalGoals: 0, lifetimeCoins: 0,
    scout: 0, chestProg: 0,
    lastDaily: "", ach: [],
    rivalsBeaten: [],
    sound: true, shake: true, slowmo: true,
    seenTutorial: false,
  };
}
export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { S = defaultState(); save(); return; }
    const data = JSON.parse(raw);
    S = Object.assign(defaultState(), data);
    if (!S.squad || !S.squad.length) S = defaultState();
    ensureXI();
  } catch (e) { S = defaultState(); }
}
export function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
export function resetState() { S = defaultState(); save(); }

/* ---------- squad helpers ---------- */
export function byId(id: string | null): Player | undefined { return S.squad.find(p => p.id === id); }
export function ensureXI() {
  const slots: Position[] = ["GK", "DEF", "MID", "ST"];
  for (const slot of slots) {
    const cur = byId(S.xi[slot]);
    if (!cur || cur.pos !== slot) { const best = bestForSlot(slot); S.xi[slot] = best ? best.id : null; }
  }
}
export function bestForSlot(slot: Position): Player | null {
  let best: Player | null = null, bo = -1;
  for (const p of S.squad) { if (p.pos !== slot) continue; const o = playerOverall(p); if (o > bo) { bo = o; best = p; } }
  if (!best) { for (const p of S.squad) { const o = playerOverall(p); if (o > bo) { bo = o; best = p; } } }
  return best;
}
export function startingXI(): Player[] {
  ensureXI();
  return (["GK", "DEF", "MID", "ST"] as Position[]).map(s => byId(S.xi[s])).filter(Boolean) as Player[];
}
export function benchPlayers(): Player[] {
  const ids = new Set(Object.values(S.xi));
  return S.squad.filter(p => !ids.has(p.id));
}

/* ---------- economy ---------- */
export function upgradeCost(key: keyof SaveState["up"]): number { return Math.round(CFG.upgradeBase * Math.pow(CFG.upgradeMul, S.up[key])); }
export function upgradeBonus() {
  return {
    pass: S.up.pass * 0.05,
    shot: S.up.shot * 0.05,
    speed: S.up.speed * 0.035,
    defend: S.up.defend * 0.05,
    gk: S.up.gk * 5,
    fansMul: 1 + S.up.stadium * 0.5,
  };
}
export function teamRating(): number {
  const xi = startingXI();
  if (!xi.length) return 50;
  let sum = 0; for (const p of xi) sum += playerOverall(p);
  let r = sum / xi.length;
  const ub = upgradeBonus();
  r *= (1 + ub.pass * 0.5 + ub.shot * 0.5 + ub.speed * 0.4 + ub.defend * 0.5);
  return Math.round(clamp(r, 1, 99));
}
export function clubXpNeed(): number { return 100 + (S.clubLevel - 1) * 60; }
export function addClubXP(amt: number): number {
  S.clubXP += amt;
  let ups = 0;
  while (S.clubXP >= clubXpNeed()) { S.clubXP -= clubXpNeed(); S.clubLevel++; ups++; }
  return ups;
}
export function nextLeagueRatingReq(): number | null {
  if (S.league >= LEAGUES.length - 1) return null;
  return 48 + (S.league + 1) * 8;
}
export function canPromote(): boolean {
  if (S.league >= LEAGUES.length - 1) return false;
  return teamRating() >= (nextLeagueRatingReq() as number) && S.wins >= (S.league + 1) * 3;
}
export function checkPromotion(): boolean {
  if (canPromote()) { S.league++; return true; }
  return false;
}

/* ---------- train / merge / scout ---------- */
export function trainCost(p: Player): number { return Math.round(CFG.trainBase * Math.pow(CFG.trainMul, Math.min(p.level - 1, 8))); }
export function doTrain(p: Player): boolean {
  const c = trainCost(p);
  if (S.coins < c) { toast("Not enough coins"); return false; }
  S.coins -= c;
  addPlayerXp(p, playerXpNeed(p));
  p.level = Math.min(p.level, 30);
  SFX.upgrade(); save(); return true;
}
export function tierUp(t: Tier): Tier { return t === "Common" ? "Rare" : t === "Rare" ? "Star" : t === "Star" ? "Legend" : "Legend"; }
export function doMerge(p: Player): boolean {
  if (S.coins < CFG.mergeCost) { toast("Need " + CFG.mergeCost + " coins"); return false; }
  const fodder = S.squad.find(q => q.tier === p.tier && q.id !== p.id && !Object.values(S.xi).includes(q.id))
    || S.squad.find(q => q.tier === p.tier && q.id !== p.id);
  if (!fodder) { toast("Need another " + p.tier + " player"); return false; }
  if (p.tier === "Legend") { toast("Already top tier"); return false; }
  S.coins -= CFG.mergeCost;
  S.squad = S.squad.filter(q => q.id !== fodder.id);
  p.tier = tierUp(p.tier);
  p.pac = clamp(p.pac + 6, 20, 99); p.sht = clamp(p.sht + 6, 20, 99); p.pas = clamp(p.pas + 6, 20, 99); p.def = clamp(p.def + 6, 20, 99);
  ensureXI(); SFX.promote(); save(); return true;
}
export function rollScoutPlayer(tierBoost?: boolean): Player {
  const positions: Position[] = ["GK", "DEF", "MID", "ST"];
  const need = positions.map(pos => { const b = bestForSlot(pos); return { pos, ov: b && b.pos === pos ? playerOverall(b) : 0 }; });
  need.sort((a, b) => a.ov - b.ov);
  const pos = Math.random() < 0.6 ? need[0].pos : pick(positions);
  let tier = pick<Tier>(["Common", "Common", "Rare", "Rare", "Star"]);
  if (tierBoost && Math.random() < 0.4) tier = tierUp(tier);
  if (S.league >= 3 && Math.random() < 0.3) tier = tierUp(tier);
  return makePlayer(pos, tier);
}
export function signPlayer(p: Player) {
  if (S.squad.length >= 12) {
    const bench = benchPlayers().sort((a, b) => playerOverall(a) - playerOverall(b));
    if (bench.length) S.squad = S.squad.filter(q => q.id !== bench[0].id);
  }
  S.squad.push(p);
  ensureXI(); save();
}

/* ---------- toast ---------- */
let toastT: any = null;
export function toast(msg: string) {
  const el = document.getElementById("toast"); if (!el) return;
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 1500);
}

/* convenience used by achievement-check & previews */
export { UPGRADES };
