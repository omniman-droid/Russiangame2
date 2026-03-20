# SnowWasteland 2D (Rust-style survival sandbox prototype)

A browser-playable 2D snow wasteland survival game built as static HTML/CSS/JS for GitHub + Netlify.

## Included art pack (generated)
- The repo now includes a full starter texture pack under `assets/sprites/**` (terrain, buildings, items, characters, weapons, UI, effects).
- The game loads these textures directly at runtime (SVG-based for easy editing/replacement).

## Gameplay features
- Snow plains + mountain terrain across a wide map
- Surface compounds + many bunker entrances
- Multi-level bunker traversal (deeper underground)
- Varied bunker layouts/traps/loot by bunker+level seed
- PvP-style combat loop with hostile survivor actors
- Invisible hitscan bullets (fast/real-feeling gunplay)
- Roaming cars + flyover planes with crash/explosion events
- Weapons set: rock, pistol, revolver, SMG, rifle, shotgun, sniper
- Player vitals: health, hunger, thirst, cold, radiation
- Loot economy: scrap, money, ammo types, meds, food/water, weapon parts
- Resource gathering (trees/rock/sulfur/barrels)
- Crafting system + build kits (wall, campfire, stash)
- Build mode structure placement
- Death bags on kill + respawn with basic kit
- Safe zone + trader loop

## Controls
- `A / D` move
- `S` crouch
- `E` shoot (hold mouse)
- `R` reload
- `F` interact (bunker/loot/depth/exit)
- `G` gather nearby node
- `C` toggle crafting panel
- `[` / `]` select recipe
- `V` craft selected recipe
- `B` build mode toggle
- `T` trade in safe zone
- `I` inventory panel
- `M` map/intel panel
- `1-7` weapon slots
- `8/9/0` consume food/water/meds

## Run locally
```bash
python3 -m http.server 8080
```
Open `http://localhost:8080`.
> Do not open `index.html` directly via `file://`; the game is designed to run over HTTP.

## Multiplayer (recommended)
Run the websocket relay and static server in two terminals:

```bash
npm install
npm run multiplayer
python3 -m http.server 8080
```

Open multiple browser windows to `http://localhost:8080` and they will sync players/shots over `ws://localhost:8081`.

## Netlify
- Build command: *(none)*
- Publish directory: `.`
