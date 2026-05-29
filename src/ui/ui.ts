/* ============================================================
   Menu UI: screen routing + menu/squad/upgrades/club/settings
   ============================================================ */
import type { Player } from "../core/types";
import { $, clamp, fmt, pick } from "../core/utils";
import { CFG, LEAGUES, TRAITS, UPGRADES, RIVAL_NAMES, ACHIEVEMENTS } from "../core/config";
import {
  S, save, byId, startingXI, benchPlayers, playerOverall, effStat,
  teamRating, clubXpNeed, upgradeCost, nextLeagueRatingReq,
  trainCost, doTrain, doMerge,
} from "../state/save";
import { SFX, initAudio } from "../audio/audio";

export const SCREENS = ["menu", "squad", "upgrades", "club", "settings", "match", "result", "scout", "chest"];
export let curScreen = "menu";

export function show(id: string) {
  for (const s of SCREENS) { const el = $("screen-" + s); if (el) el.classList.toggle("active", s === id); }
  curScreen = id;
  if (id === "menu") renderMenu();
  if (id === "squad") renderSquad();
  if (id === "upgrades") renderUpgrades();
  if (id === "club") renderClub();
  if (id === "settings") renderSettings();
  renderTopbar();
}
export function getCurScreen() { return curScreen; }

export function renderTopbar() {
  $("tbCoins").textContent = fmt(S.coins);
  $("tbFans").textContent = fmt(S.fans);
  $("tbLvl").textContent = String(S.clubLevel);
}

function navHTML(active: string) {
  const items: [string, string, string][] = [["menu", "🏠", "Home"], ["squad", "👥", "Squad"], ["upgrades", "🔧", "Upgrade"], ["club", "🏆", "Club"]];
  return items.map(([id, ic, lbl]) => `<button class="nav-btn ${active === id ? "active" : ""}" data-go="${id}"><span class="ni">${ic}</span>${lbl}</button>`).join("");
}
export function paintNavs(active: string) {
  ["nav", "nav2", "nav3", "nav4"].forEach(n => { const el = $(n); if (el) el.innerHTML = navHTML(active); });
}

export function crestSVG() {
  return `<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="26" fill="#06121a" opacity=".25"/>
  <path d="M32 8l7 5-3 9h-8l-3-9z" fill="#06121a" opacity=".9"/>
  <path d="M14 26l9-3 5 8-5 7-9-2z" fill="#06121a" opacity=".9"/>
  <path d="M50 26l-9-3-5 8 5 7 9-2z" fill="#06121a" opacity=".9"/>
  <path d="M24 48l3-7h10l3 7-6 4z" fill="#06121a" opacity=".9"/>
  <circle cx="32" cy="32" r="6" fill="#06121a"/></svg>`;
}

/* shared rival preview (used by menu + match setup) */
let _rivalPreview: string | null = null;
export function previewRival(): string { if (!_rivalPreview) _rivalPreview = pick(RIVAL_NAMES); return _rivalPreview; }
export function getRivalPreview() { return _rivalPreview; }
export function clearRivalPreview() { _rivalPreview = null; }

/* ---------- MENU ---------- */
export function renderMenu() {
  $("menuCrest").innerHTML = crestSVG();
  $("menuClubName").textContent = S.clubName;
  $("menuLeague").textContent = LEAGUES[S.league].name;
  $("menuRating").textContent = String(teamRating());
  $("menuRecord").textContent = `${S.wins}-${S.draws}-${S.losses}`;
  const streak = S.winStreak > 0 ? "🔥" + S.winStreak : (S.lossStreak > 0 ? "❄️" + S.lossStreak : "–");
  $("menuStreak").textContent = streak;
  $("playSub").textContent = "vs " + previewRival();

  const dailyDone = S.lastDaily === (new Date().getFullYear() + "-" + (new Date().getMonth() + 1) + "-" + new Date().getDate());
  $("dailyCard").innerHTML = dailyDone
    ? `<div class="banner-card green"><div class="bi">✅</div><div><div class="bt">Daily Bonus Claimed</div><div class="bd">Come back tomorrow for more</div></div></div>`
    : `<div class="banner-card"><div class="bi">🎁</div><div><div class="bt">Daily Bonus Ready</div><div class="bd">Win your next match for 2× rewards</div></div><div class="go">2×</div></div>`;

  const need = CFG.chestEvery - (S.chestProg % CFG.chestEvery);
  $("chestDesc").textContent = need === CFG.chestEvery ? "Ready after this match!" : `${need} match${need > 1 ? "es" : ""} to next chest`;
  $("chestGo").textContent = `${S.chestProg % CFG.chestEvery}/${CFG.chestEvery}`;

  const req = nextLeagueRatingReq();
  if (req === null) {
    $("leagueProgLbl").textContent = "Top League Reached";
    $("leagueProgVal").textContent = "👑";
    ($("leagueProgBar").querySelector("i") as HTMLElement).style.width = "100%";
  } else {
    const winsNeed = (S.league + 1) * 3;
    const ratingP = clamp(teamRating() / req, 0, 1);
    const winP = clamp(S.wins / winsNeed, 0, 1);
    const p = Math.min(ratingP, winP);
    $("leagueProgLbl").textContent = "Promotion: " + LEAGUES[S.league + 1].name;
    $("leagueProgVal").textContent = `OVR ${teamRating()}/${req} · W ${S.wins}/${winsNeed}`;
    const bar = $("leagueProgBar"); (bar.querySelector("i") as HTMLElement).style.width = (p * 100).toFixed(0) + "%";
    bar.classList.toggle("near", p >= 1);
  }
  paintNavs("menu");
}

/* ---------- SQUAD ---------- */
function pcardHTML(p: Player, isXI: boolean) {
  const ov = playerOverall(p);
  const traitTxt = p.trait !== "None" ? `<div class="trait">${TRAITS[p.trait].label}</div>` : "";
  return `<div class="pcard ${isXI ? "xi" : ""}" data-pid="${p.id}">
    <div class="jersey bg-${p.tier}">${p.pos === "GK" ? "🧤" : ov}</div>
    <div class="meta">
      <div class="pn">${p.name}<span class="pos">${p.pos}</span><span class="tier-dot bg-${p.tier}" style="margin-left:2px"></span></div>
      ${traitTxt || `<div class="trait" style="color:var(--faint)">Lvl ${p.level} · ${p.tier}</div>`}
    </div>
    <div class="ov"><div class="ovn tier-${p.tier}">${ov}</div><div class="ovl">OVR</div></div>
  </div>`;
}
export function renderSquad() {
  $("squadSub").textContent = `${S.squad.length} players · Team rating ${teamRating()}`;
  $("xiList").innerHTML = startingXI().map(p => pcardHTML(p, true)).join("");
  const bench = benchPlayers();
  $("benchList").innerHTML = bench.length ? bench.map(p => pcardHTML(p, false)).join("")
    : `<div class="dimtext" style="text-align:center;padding:16px 0">No bench players yet.<br>Win matches to scout more talent.</div>`;
  paintNavs("squad");
}

/* ---------- player sheet (modal) ---------- */
function statBox(label: string, val: number, plain?: boolean) {
  const pct = plain ? null : clamp(val, 0, 99);
  return `<div class="stat"><div class="sv">${Math.round(val)}</div><div class="sl">${label}</div>${pct !== null ? `<div class="bar-mini"><i style="width:${pct}%"></i></div>` : ""}</div>`;
}
export function openPlayerSheet(p: Player) {
  const m = $("playerModal"); if (!m) return;
  const ov = playerOverall(p);
  const inXI = Object.values(S.xi).includes(p.id);
  const xpN = (30 + (p.level - 1) * 22);
  const sheet = `
    <div class="sheet-handle"></div>
    <div style="display:flex;align-items:center;gap:14px">
      <div class="jersey bg-${p.tier}" style="width:60px;height:60px;border-radius:16px;font-size:22px">${p.pos === "GK" ? "🧤" : ov}</div>
      <div style="flex:1">
        <div style="font-family:var(--disp);font-weight:900;font-size:21px">${p.name}</div>
        <div style="font-size:12px;color:var(--muted);font-weight:700;margin-top:2px">
          <span class="tier-${p.tier}">${p.tier}</span> · ${p.pos} · Lvl ${p.level} ${inXI ? '· <span style="color:var(--home)">Starting</span>' : ""}
        </div>
        <div style="font-size:12px;color:var(--gold);font-weight:800;margin-top:3px">${p.trait !== "None" ? "★ " + TRAITS[p.trait].label : ""}</div>
      </div>
    </div>
    ${p.trait !== "None" ? `<div class="dimtext" style="margin-top:10px;font-size:12px">${TRAITS[p.trait].desc}</div>` : ""}
    <div class="statgrid">
      ${statBox("PAC", effStat(p, "pac"))}${statBox("SHO", effStat(p, "sht"))}${statBox("PAS", effStat(p, "pas"))}
      ${statBox("DEF", effStat(p, "def"))}${statBox("GLS", p.goals, true)}${statBox("AST", p.assists, true)}
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:800;color:var(--muted);margin:14px 2px 5px;text-transform:uppercase;letter-spacing:.6px">
      <span>Level ${p.level}</span><span>${p.xp}/${xpN} XP</span></div>
    <div class="prog"><i style="width:${clamp(p.xp / xpN * 100, 0, 100)}%"></i></div>
    <div style="height:14px"></div>
    ${!inXI ? `<button class="btn sm" id="psStart">Put in Starting Four</button><div style="height:9px"></div>` : ""}
    <div class="row2">
      <button class="btn ghost sm" id="psTrain" style="flex:1">⬆ Train · ${trainCost(p)}🪙</button>
      <button class="btn gold sm" id="psMerge" style="flex:1" ${p.tier === "Legend" ? "disabled" : ""}>✨ Upgrade · ${CFG.mergeCost}🪙</button>
    </div>
    <div class="dimtext" style="font-size:10.5px;margin-top:9px;text-align:center">
      ${p.tier === "Legend" ? "Maximum tier reached" : "Upgrade fuses another " + p.tier + " player to raise tier"}
    </div>
    <div style="height:8px"></div>
    <button class="btn ghost sm" id="psClose">Close</button>
  `;
  (m.querySelector(".sheet") as HTMLElement).innerHTML = sheet;
  m.classList.add("show");
  const close = () => { m.classList.remove("show"); };
  $("psClose").onclick = close;
  if ($("psStart")) $("psStart").onclick = () => { S.xi[p.pos] = p.id; save(); SFX.click(); close(); renderSquad(); renderMenu(); };
  $("psTrain").onclick = () => { if (doTrain(p)) { openPlayerSheet(p); renderSquad(); renderMenu(); } };
  $("psMerge").onclick = () => { if (doMerge(p)) { openPlayerSheet(p); renderSquad(); renderMenu(); } };
  m.onclick = (e: Event) => { if (e.target === m) close(); };
}

/* ---------- UPGRADES ---------- */
export function renderUpgrades() {
  let reco: string | null = null, lo = 99;
  for (const u of UPGRADES) { if (u.key === "stadium") continue; if (S.up[u.key] < lo && S.up[u.key] < CFG.upgradeMax) { lo = S.up[u.key]; reco = u.key; } }
  $("upgradeList").innerHTML = UPGRADES.map(u => {
    const lv = S.up[u.key], maxed = lv >= CFG.upgradeMax, cost = upgradeCost(u.key), afford = S.coins >= cost;
    const dots = Array.from({ length: CFG.upgradeMax }, (_, i) => `<i class="${i < lv ? "on" : ""}"></i>`).join("");
    const btn = maxed
      ? `<button class="buybtn max" disabled>MAX LEVEL</button>`
      : `<button class="buybtn ${afford ? "" : "locked"}" data-up="${u.key}">${afford ? `Upgrade · ${cost} 🪙` : `Need ${cost} 🪙`}</button>`;
    return `<div class="ucard ${u.key === reco ? "reco" : ""}" style="position:relative">
      ${u.key === reco ? '<div class="reco-tag">PICK</div>' : ""}
      <div class="top"><div class="ico">${u.ico}</div>
        <div><div class="nm">${u.name}</div><div class="ds">${u.desc}</div></div>
        <div class="lv"><div class="lvn">Lv ${lv}</div></div></div>
      <div class="dots">${dots}</div>
      ${btn}
    </div>`;
  }).join("");
  paintNavs("upgrades");
}

/* ---------- CLUB ---------- */
export function renderClub() {
  $("clubLvlNum").textContent = String(S.clubLevel);
  $("clubXpText").textContent = `${S.clubXP} / ${clubXpNeed()} XP`;
  ($("clubXpBar").querySelector("i") as HTMLElement).style.width = clamp(S.clubXP / clubXpNeed() * 100, 0, 100) + "%";
  $("clubSub").textContent = `${S.totalMatches} matches · ${S.totalGoals} goals scored`;
  $("leagueLadder").innerHTML = LEAGUES.map((lg, i) => {
    const done = i < S.league, cur = i === S.league;
    return `<div class="ach ${done || cur ? "done" : ""}" style="${cur ? "border-color:rgba(34,211,238,.5)" : ""}">
      <div class="ai">${done ? "✅" : cur ? "⚽" : "🔒"}</div>
      <div><div class="at">${lg.name}</div><div class="ad">Rewards ×${lg.rewMul}${cur ? " · You are here" : ""}</div></div>
      ${cur ? '<div class="chk" style="color:var(--home)">▶</div>' : done ? '<div class="chk">✓</div>' : ""}
    </div>`;
  }).join("");
  $("achList").innerHTML = ACHIEVEMENTS.map(a => {
    const done = S.ach.includes(a.id) || a.check(S);
    return `<div class="ach ${done ? "done" : ""}"><div class="ai">${a.icon}</div>
      <div><div class="at">${a.title}</div><div class="ad">${a.desc}</div></div>
      ${done ? '<div class="chk">✓</div>' : ""}</div>`;
  }).join("");
  $("rivalList").innerHTML = S.rivalsBeaten.length
    ? [...new Set(S.rivalsBeaten)].map(r => `<span class="gtag" style="text-transform:none">${r}</span>`).join("")
    : `<div class="dimtext" style="font-size:12px">Beat rivals to collect them here.</div>`;
  paintNavs("club");
}

/* ---------- SETTINGS ---------- */
export function renderSettings() {
  $("swSound").classList.toggle("on", S.sound);
  $("swShake").classList.toggle("on", S.shake);
  $("swSlowmo").classList.toggle("on", S.slowmo);
  ($("clubNameInput") as HTMLInputElement).value = S.clubName;
}

export { initAudio };
