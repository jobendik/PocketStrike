# Pocket Football Club — Strike Moments Edition

A one-thumb, portrait-first **arcade football club** game for mobile browser
portals such as CrazyGames. Your team plays automatically — you control the
**decisive moments**: quick taps for passes and tackles, and a bullet-time
**drag-to-aim Strike** for shots (curve it, chip it, smash it).

Build a squad, collect players, upgrade your club and climb from the Street
League to World Stars. Everything is original — no real clubs, players or
branding — and everything is **code-drawn** (no image or audio assets).

## Play

- **Quick tap** — pass, through-ball, tackle, press, chase, keeper save, or a one-touch finish.
- **Drag & release** — when you have the ball near goal, time slows into a *Strike Moment*.
  Drag from the ball to aim, swipe an arc to bend it, release to shoot.
  - Straight medium drag → **Drive**
  - Curved swipe → **Finesse / Curler**
  - Long straight drag → **Power**
  - Short drag vs a rushing keeper → **Chip**

## Tech stack

- **Vite** + **TypeScript**, no runtime frameworks or external assets.
- Canvas-rendered match engine; HTML/CSS menus.
- LocalStorage save.

## Project structure

```
index.html              Vite entry (game markup)
src/
  main.ts               Boot + global event wiring
  styles/main.css        All UI styling
  core/                 Pure data & helpers
    types.ts            Shared interfaces
    utils.ts            Math / DOM / formatting helpers
    config.ts           Constants, balance, leagues, traits, data tables
  audio/audio.ts        Generated Web Audio engine + SFX
  state/save.ts         Save state, progression, economy, squad helpers
  ui/ui.ts              Menu / squad / upgrades / club / settings + routing
  game/
    runtime.ts          Shared match runtime (active MatchState + canvas refs)
    geometry.ts         Pitch geometry + nearest-entity + timing helpers
    setup.ts            Build teams, opponent, objective, kickoff card
    input.ts            Quick tap + drag-to-aim Strike Moments + context
    actions.ts          Pass / shoot / strike-aim / tackle / keeper
    ai.ts               Role-based off-ball movement + on-ball decisions
    movement.ts         Steering, ball-carrier driving, separation
    ball.ts             Ball physics, possession, saves, goals
    drama.ts            Momentum / flow / banners / crowd / meters
    fx.ts               Particles, confetti, ripples, shake, flash, zoom
    render.ts           All canvas drawing
    loop.ts             RAF loop, match update, live HUD
    result.ts           Rewards, result screen, chest & scout flows
    flow.ts             Pre-match / kickoff / quit
```

## Development

```bash
npm install       # install dev dependencies
npm run dev       # start the Vite dev server (http://localhost:5173)
npm run build     # production build to dist/
npm run preview   # preview the production build locally
npm run typecheck # tsc --noEmit
```

## Deploying to GitHub Pages

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds the project
and publishes `dist/` to GitHub Pages on every push to `main` (and via manual
**Run workflow**).

One-time setup: in the repository, go to **Settings → Pages → Build and
deployment → Source** and select **GitHub Actions**. The site then publishes to
`https://<user>.github.io/<repo>/`.

The build uses a relative base (`base: "./"`), so the same `dist/` bundle also
works when self-hosted or embedded on portals such as CrazyGames or itch.io —
just upload the contents of `dist/`.
