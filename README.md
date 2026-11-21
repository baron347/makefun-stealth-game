# The Velvet Ledger

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/baron347/makefun-stealth-game/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/baron347/makefun-stealth-game/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

A top-down stealth game built for make.fun's "Make the best stealth game" bounty.

You are **Wren**, a courier-thief hired to lift the Velvet Ledger from a guarded
manor. Slip through three wings, dodge the guards' vision cones, hide in the
bushes, toss coins to pull patrols away, grab every loot coin, and reach the
glowing green exit unseen. You have three lives — one touch from a chasing
guard costs one.

## How to play

- **Move:** WASD or arrow keys
- **Sneak:** hold Shift (slower, much harder to spot)
- **Throw a coin:** click anywhere within reach (3 per wing) — guards nearby
  walk over to investigate the clink
- **Pause:** P · **Mute:** M · **Restart wing:** R · **Start:** Enter or click

Guards patrol fixed routes and pause to scan at the end of each leg. Their
vision cones are cut short by walls and crates. A detection meter fills while
you are seen — closer means faster — and drains while you stay hidden. Fill it
and the guard gives chase; break line of sight for three seconds and the hunt
cools off. Bushes hide you completely unless a guard gets very close.

## Run it

```sh
node serve.ts --port 8080
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network:
every file the game loads lives under `game/`, and all sounds are synthesized
with WebAudio — no audio files.

## Layout

- `game/index.html` — the page and canvas
- `game/src/config.js` — tuning: speeds, vision range, detection rates
- `game/src/random.js` — seeded random (mulberry32)
- `game/src/levels.js` — the three wings: maps, patrols, loot
- `game/src/world.js` — rules: movement, sight, detection, guards, coins
- `game/src/render.js` — canvas drawing, vision cones, HUD
- `game/src/shots.js` — deterministic screenshot scenes and the autopilot
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesized WebAudio blips
- `game/src/main.js` — game loop and screens
- `main.ts` — hands the game in: copies `game/` and `screenshots/` and writes
  `dossier.json` with the kit's `vendor/makefun-game.ts`
- `serve.ts` — tiny static server for local play

## License

MIT — see [LICENSE](LICENSE).
