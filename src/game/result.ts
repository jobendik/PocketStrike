/* ============================================================
   End-of-match: rewards, result screen, chest & scout flows
   ============================================================ */
import type { Player, Achievement } from "../core/types";
import { $, clamp, rand, randInt, todayStr } from "../core/utils";
import { CFG, LEAGUES, ACHIEVEMENTS, UPGRADES, TRAITS } from "../core/config";
import {
  S, save, addClubXP, addPlayerXp, checkPromotion, canPromote, upgradeBonus,
  playerOverall, rollScoutPlayer, signPlayer, benchPlayers, upgradeCost, toast,
} from "../state/save";
import { SFX, setCrowd, initAudio } from "../audio/audio";
import { show, renderMenu, clearRivalPreview } from "../ui/ui";
import { RT } from "./runtime";
import { resetStrikeHUD } from "./loop";
import { beginMatchSetup } from "./flow";

function evalObjective(): boolean {
  const M = RT.M, o = M.obj; let done = false, text = "";
  if (o.check) { done = !!o.check(M); text = done ? "Complete" : "Missed"; }
  else if (o.prog) { const v = o.prog(M); done = v >= (o.goal as number); text = Math.min(v, o.goal as number) + "/" + o.goal; }
  M.objText = text;
  return done;
}
function applyPlayerProgress(win: boolean, draw: boolean) {
  const M = RT.M;
  for (const mp of M.home) {
    const ref = mp.ref; if (!ref) continue;
    ref.apps = (ref.apps || 0) + 1;
    ref.goals = (ref.goals || 0) + mp.mGoals;
    ref.assists = (ref.assists || 0) + mp.mAssists;
    ref.tackles = (ref.tackles || 0) + mp.mTackles;
    ref.saves = (ref.saves || 0) + mp.mSaves;
    const xp = 8 + mp.mGoals * 6 + mp.mAssists * 4 + mp.mTackles * 3 + mp.mSaves * 3 + (win ? 6 : draw ? 2 : 0);
    addPlayerXp(ref, xp);
    const contributed = mp.mGoals || mp.mAssists || mp.mTackles > 0 || mp.mSaves > 1;
    if (win || contributed) ref.form = clamp((ref.form || 0) + 1, -2, 2);
    else if (!win && !draw) ref.form = clamp((ref.form || 0) - 1, -2, 2);
  }
}
function pickMOTM(_win: boolean) {
  const M = RT.M;
  let best = null, bs = -1;
  for (const mp of M.home) {
    const sc = mp.mGoals * 4 + mp.mAssists * 2 + mp.mTackles * 1.5 + mp.mSaves * 1.5 + playerOverall(mp.ref) * 0.02;
    if (sc > bs) { bs = sc; best = mp; }
  }
  if (!best) best = M.home[0];
  const parts: string[] = [];
  if (best.mGoals) parts.push(best.mGoals + " goal" + (best.mGoals > 1 ? "s" : ""));
  if (best.mAssists) parts.push(best.mAssists + " assist" + (best.mAssists > 1 ? "s" : ""));
  if (best.mTackles) parts.push(best.mTackles + " tackle" + (best.mTackles > 1 ? "s" : ""));
  if (best.mSaves && best.role === "GK") parts.push(best.mSaves + " save" + (best.mSaves > 1 ? "s" : ""));
  const statText = parts.length ? parts.join(" · ") : "Commanding display";
  return { ref: best.ref, name: best.ref.name, ov: playerOverall(best.ref), statText };
}

function bestMomentCard(): string {
  const M = RT.M;
  let title = "", desc = "";
  if (M.bestMoment) { title = "“" + M.bestMoment.tag.replace("!", "") + "”"; desc = "by " + (M.bestMoment.name || "your striker"); }
  else if (M.stat.lateGoal) { title = "Last-second drama"; desc = "Cut it fine, but you got there"; }
  else if (M.stat.saves >= 2) { title = M.stat.saves + " big saves"; desc = "Your keeper stood tall"; }
  else if (M.stat.perfects >= 3) { title = M.stat.perfects + " perfect strikes"; desc = "Pure timing"; }
  else if (M.stat.tackles >= 2) { title = "Rock-solid defending"; desc = M.stat.tackles + " tackles won"; }
  else if (M.stat.bestPassStreak >= 4) { title = M.stat.bestPassStreak + "-pass move"; desc = "Slick build-up play"; }
  else return "";
  return `<div class="banner-card" style="margin:0 0 10px"><div class="bi">🎬</div><div><div class="bt">Match Moment: ${title}</div><div class="bd">${desc}</div></div></div>`;
}
function recommendCard(R: any): string {
  const M = RT.M;
  let icon = "🔧", title = "", desc = "";
  if (R.pending.includes("scout")) { icon = "🔍"; title = "Scout a new player"; desc = "Fresh talent is waiting to be signed"; }
  else if (R.pending.includes("chest")) { icon = "🎁"; title = "Open your Match Chest"; desc = "Claim your reward"; }
  else if (canPromote()) { icon = "⬆️"; title = "Promotion is in reach"; desc = "Win to move up to " + LEAGUES[Math.min(S.league + 1, LEAGUES.length - 1)].name; }
  else {
    const cands = UPGRADES.filter(u => u.key !== "stadium" && S.up[u.key] < CFG.upgradeMax);
    let pickU: any = null;
    if (M.homeScore < 2 && S.up.shot < CFG.upgradeMax) pickU = UPGRADES.find(u => u.key === "shot");
    if (!pickU) { cands.sort((a, b) => S.up[a.key] - S.up[b.key]); pickU = cands[0]; }
    if (pickU) { const cost = upgradeCost(pickU.key), afford = S.coins >= cost; icon = pickU.ico; title = "Upgrade " + pickU.name; desc = afford ? ("Affordable now · " + cost + " 🪙") : ("Save up · " + cost + " 🪙"); }
    else { icon = "👥"; title = "Train your squad"; desc = "Level up a key player"; }
  }
  return `<div class="banner-card green" style="margin:0 0 10px"><div class="bi">${icon}</div><div><div class="bt">Next: ${title}</div><div class="bd">${desc}</div></div><div class="go">›</div></div>`;
}

export function endMatch() {
  const M = RT.M;
  if (M.ended) return;
  M.ended = true; RT.paused = false;
  SFX.whistle(); setCrowd(0.2);
  M.aim = null; RT.pointerDown = false;
  $("clutchVig").classList.remove("on"); $("sbTimeWrap").classList.remove("clutch");
  $("strikeVig").classList.remove("on"); $("strikeLbl").classList.remove("on"); resetStrikeHUD();
  const hs = M.homeScore, as = M.awayScore;
  const win = hs > as, draw = hs === as;
  const lg = LEAGUES[S.league];
  const rk = win ? "win" : draw ? "draw" : "loss";
  const base = (CFG.reward as any)[rk];
  let coins = Math.round(base.c * lg.rewMul), fans = base.f, xp = base.x;
  coins += hs * 6; xp += hs * 2;
  const bonus = M.bonus || { c: 0, f: 0, x: 0 };
  coins += bonus.c || 0; fans += bonus.f || 0; xp += bonus.x || 0;
  let streakBonus = 0;
  if (win) { const ns = S.winStreak + 1; if (ns >= 2) { streakBonus = Math.min(ns * 5, 40); coins += streakBonus; } }
  let underdogBonus = 0;
  if (win && M.underdog) { underdogBonus = Math.round(coins * 0.3); coins += underdogBonus; fans += 4; }
  const objDone = evalObjective();
  let objReward = { c: 0, f: 0 };
  if (objDone) { objReward = (M.obj.reward as any) || { c: 0, f: 0 }; coins += objReward.c || 0; fans += objReward.f || 0; }
  let daily = false;
  if (S.lastDaily !== todayStr() && win) { daily = true; coins *= 2; fans *= 2; S.lastDaily = todayStr(); }
  fans = Math.round(fans * upgradeBonus().fansMul);

  S.coins += coins; S.fans += fans; S.lifetimeCoins += coins;
  const lvUps = addClubXP(xp);
  S.totalMatches++; S.totalGoals += hs;
  if (win) { S.wins++; S.winStreak++; S.lossStreak = 0; if (S.winStreak > S.bestWinStreak) S.bestWinStreak = S.winStreak; if (M.rival && M.rival.name) S.rivalsBeaten.push(M.rival.name); }
  else if (draw) { S.draws++; S.winStreak = 0; S.lossStreak = 0; }
  else { S.losses++; S.winStreak = 0; S.lossStreak++; }
  applyPlayerProgress(win, draw);
  S.chestProg++;
  const chestReady = (S.chestProg % CFG.chestEvery) === 0;
  S.scout += win ? 2 : 1;
  const scoutReady = S.scout >= CFG.scoutNeed;
  const promoted = checkPromotion();
  const newAch: Achievement[] = [];
  for (const a of ACHIEVEMENTS) { if (!S.ach.includes(a.id) && a.check(S)) { S.ach.push(a.id); newAch.push(a); } }
  const motm = pickMOTM(win);
  save();

  const pending: string[] = [];
  if (chestReady) pending.push("chest");
  if (scoutReady) pending.push("scout");
  M.result = { win, draw, hs, as, coins, fans, xp, objDone, objReward, daily, streakBonus, underdogBonus, motm, newAch, promoted, lvUps, pending, next: "menu" };
  if (win) SFX.win(); else if (!draw) SFX.loss();
  setTimeout(showResult, 750);
}

function showResult() {
  const M = RT.M, R = M.result!;
  $("resKind").textContent = R.win ? "VICTORY" : R.draw ? "DRAW" : "DEFEAT";
  $("resKind").className = "res-kind " + (R.win ? "win" : R.draw ? "draw" : "loss");
  $("resScore").textContent = R.hs + "–" + R.as;
  $("resLine").textContent = "vs " + M.rival.name + " · " + LEAGUES[S.league].name;
  const tags: string[] = [];
  if (R.daily) tags.push("DAILY 2×");
  if (R.streakBonus) tags.push("WIN STREAK +" + R.streakBonus);
  if (R.underdogBonus) tags.push("UNDERDOG +" + R.underdogBonus);
  if (M.stat.perfects >= 3) tags.push(M.stat.perfects + " PERFECT TAPS");
  $("resTags").innerHTML = tags.map(t => `<span class="gtag">${t}</span>`).join("");
  $("motmBadge").textContent = String(R.motm.ov);
  $("motmBadge").style.background = "linear-gradient(160deg,#ffe07a,#f5a623)";
  $("motmName").textContent = R.motm.name;
  $("motmStat").textContent = R.motm.statText;
  const od = $("objResult"); od.classList.toggle("done", R.objDone);
  $("objIcon").textContent = M.obj.icon;
  $("objTitle").textContent = M.obj.title;
  $("objDesc").textContent = M.obj.desc;
  $("objStat").textContent = R.objDone ? ("✓ +" + ((M.obj.reward && M.obj.reward.c) || 0) + "🪙") : (M.objText || "Missed");
  $("objStat").style.color = R.objDone ? "var(--green)" : "var(--faint)";
  $("resCoins").textContent = "+" + R.coins;
  $("resFans").textContent = "+" + R.fans;
  $("resXp").textContent = "+" + R.xp;
  let extra = "";
  extra += bestMomentCard();
  extra += recommendCard(R);
  if (R.promoted) extra += `<div class="banner-card" style="margin:0 0 10px;background:linear-gradient(110deg,rgba(255,210,63,.2),rgba(255,210,63,.05));border-color:rgba(255,210,63,.4)"><div class="bi">⬆️</div><div><div class="bt">PROMOTED!</div><div class="bd">Welcome to ${LEAGUES[S.league].name}</div></div></div>`;
  if (R.lvUps > 0) extra += `<div class="banner-card green" style="margin:0 0 10px"><div class="bi">⭐</div><div><div class="bt">Club Level ${S.clubLevel}!</div><div class="bd">Your club is growing</div></div></div>`;
  for (const a of R.newAch) extra += `<div class="banner-card" style="margin:0 0 10px"><div class="bi">${a.icon}</div><div><div class="bt">Achievement: ${a.title}</div><div class="bd">${a.desc}</div></div></div>`;
  if (R.pending.includes("chest")) extra += `<div class="banner-card" style="margin:0 0 10px"><div class="bi">🎁</div><div><div class="bt">Match Chest Unlocked</div><div class="bd">Open it next</div></div></div>`;
  if (R.pending.includes("scout")) extra += `<div class="banner-card" style="margin:0 0 10px"><div class="bi">🔍</div><div><div class="bt">Scout Found Talent</div><div class="bd">Pick a new player</div></div></div>`;
  $("resExtra").innerHTML = extra;
  show("result");
}

export function advancePost() {
  const R = RT.M.result!;
  if (R.pending.length) {
    const nxt = R.pending.shift();
    if (nxt === "chest") openChest();
    else if (nxt === "scout") openScout();
    else finishPost();
  } else finishPost();
}
function finishPost() {
  const next = RT.M.result ? RT.M.result.next : "menu";
  clearRivalPreview();
  if (next === "rematch") beginMatchSetup();
  else show("menu");
}

/* ---------- chest ---------- */
function openChest() {
  const stage = $("chestStage");
  stage.innerHTML = `<div class="chestbox" id="chestBox">🎁</div>`;
  $("chestTitle").textContent = "Tap to open!";
  $("chestReward").innerHTML = "";
  $("chestContinue").style.display = "none";
  show("chest");
  let opened = false;
  $("chestBox").onclick = () => {
    if (opened) return; opened = true;
    initAudio(); SFX.reveal();
    const lg = LEAGUES[S.league]; const r = Math.random(); let html = "";
    if (r < 0.5) { const c = Math.round(randInt(40, 110) * lg.rewMul); S.coins += c; S.lifetimeCoins += c; html = `<div style="font-family:var(--disp);font-weight:900;font-size:30px;color:var(--gold)">+${c} 🪙</div>`; }
    else if (r < 0.82) { const f = randInt(10, 32); S.fans += f; html = `<div style="font-family:var(--disp);font-weight:900;font-size:30px;color:#ff9ec7">+${f} 📣</div>`; }
    else { const p = rollScoutPlayer(true); signPlayer(p); html = `<div style="font-family:var(--disp);font-weight:900;font-size:20px;color:var(--home)">⭐ ${p.name}</div><div class="dimtext" style="margin-top:4px">${p.tier} ${p.pos} · OVR ${playerOverall(p)}${p.trait !== "None" ? " · " + TRAITS[p.trait].label : ""}</div>`; }
    save();
    stage.innerHTML = `<div style="font-size:64px;animation:resPop .5s">📦</div>`;
    $("chestTitle").textContent = "Nice!";
    $("chestReward").innerHTML = html;
    $("chestContinue").style.display = "";
  };
  $("chestContinue").onclick = () => { SFX.click(); advancePost(); };
}

/* ---------- scout ---------- */
function openScout() {
  S.scout -= CFG.scoutNeed; save();
  const mystery = Math.random() < 0.28;
  const wrap = $("scoutCards");
  $("scoutSkip").style.display = "none";
  if (mystery) {
    const p = rollScoutPlayer(false);
    $("scoutTitle").textContent = "Mystery Signing";
    $("scoutSub").textContent = "Tap the card to reveal your new player";
    wrap.innerHTML = `<div class="reveal-card" id="mys" style="width:170px"><div style="font-size:50px">❓</div><div class="dimtext" style="margin-top:8px">Tap to reveal</div></div>`;
    let done = false;
    $("mys").onclick = () => {
      if (done) return; done = true; initAudio(); SFX.reveal(); signPlayer(p);
      $("mys").style.borderColor = "rgba(255,210,63,.5)";
      $("mys").innerHTML = `<div class="jersey bg-${p.tier}" style="width:48px;height:48px;margin:0 auto;border-radius:13px;font-size:17px">${p.pos === "GK" ? "🧤" : playerOverall(p)}</div>
        <div style="font-weight:900;margin-top:8px">${p.name}</div>
        <div class="dimtext" style="margin-top:2px">${p.tier} ${p.pos} · OVR ${playerOverall(p)}</div>
        ${p.trait !== "None" ? `<div style="color:var(--gold);font-size:11px;font-weight:800;margin-top:3px">★ ${TRAITS[p.trait].label}</div>` : ""}`;
      toast(p.name + " joined!"); $("scoutSkip").style.display = ""; renderMenu();
    };
  } else {
    const cands = [rollScoutPlayer(false), rollScoutPlayer(true), rollScoutPlayer(false)];
    $("scoutTitle").textContent = "Three Prospects";
    $("scoutSub").textContent = "Choose one to sign for your club";
    wrap.innerHTML = cands.map((p, i) => `<div class="reveal-card" data-sc="${i}">
      <div class="jersey bg-${p.tier}" style="width:46px;height:46px;margin:0 auto;border-radius:13px;font-size:17px">${p.pos === "GK" ? "🧤" : playerOverall(p)}</div>
      <div style="font-weight:900;font-size:14px;margin-top:8px">${p.name}</div>
      <div class="dimtext" style="margin-top:2px;font-size:11px"><span class="tier-${p.tier}">${p.tier}</span> ${p.pos}</div>
      <div style="font-family:var(--disp);font-weight:900;font-size:22px;margin-top:4px" class="tier-${p.tier}">${playerOverall(p)}</div>
      ${p.trait !== "None" ? `<div style="color:var(--gold);font-size:10px;font-weight:800;margin-top:2px">★ ${TRAITS[p.trait].label}</div>` : '<div style="height:14px"></div>'}
    </div>`).join("");
    let chosen = false;
    wrap.querySelectorAll<HTMLElement>("[data-sc]").forEach(card => {
      card.onclick = () => {
        if (chosen) return; chosen = true; initAudio(); SFX.reveal();
        const p = cands[+(card.dataset.sc as string)]; signPlayer(p);
        wrap.querySelectorAll<HTMLElement>("[data-sc]").forEach(c => { if (c !== card) c.style.opacity = ".35"; else c.style.borderColor = "rgba(52,211,153,.6)"; });
        toast(p.name + " signed!"); $("scoutSkip").style.display = ""; renderMenu();
      };
    });
  }
  show("scout");
  $("scoutSkip").onclick = () => { SFX.click(); advancePost(); };
}
