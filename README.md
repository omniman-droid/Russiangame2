# SnowWasteland 2D (Rust-style survival sandbox prototype)

A browser-playable 2D snow wasteland survival game built as static HTML/CSS/JS for GitHub + Netlify.

## Gameplay features
- Snow plains + mountain terrain across a wide map
- Surface compounds + many bunker entrances
- Multi-level bunker traversal (deeper underground)
- PvP-style combat loop with hostile survivor actors
- Invisible hitscan bullets (fast/real-feeling gunplay)
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
- `C` toggle crafting panel (+ crafts from recipe list)
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

## Netlify
- Build command: *(none)*
- Publish directory: `.`
# SnowWasteland 2D (Rusty-STALKER style prototype)

A complete browser-playable 2D snow wasteland survival shooter you can push to GitHub and deploy to Netlify as static files.

## Features included
- Snow + rock side-scrolling world with mountains/plains
- Surface buildings + many bunker entrances
- Enter/exit bunkers (`F`)
- Player controls: `A/D` move, `S` crouch, `E` shoot, mouse aim arm, `R` reload
- Auto-step climbing when moving into short obstacles
- Fast invisible hitscan bullets
- PvP-style combat loop against armed survivor actors
- Loot drops + inventory (scrap, money, ammo, meds, parts)
- Death + respawn with a basic kit
- Sprite drop folder ready at `assets/sprites/`

## Run locally
Open `index.html` directly, or use a static server:

```bash
python3 -m http.server 8080
```

Then browse `http://localhost:8080`.

## Netlify deploy
- Push this repo to GitHub.
- In Netlify, create a new site from that repo.
- Build command: *(none)*
- Publish directory: `.`

Because this is static HTML/CSS/JS, Netlify can host it directly.

## Notes
This is an intentionally simple “crappy but playable” foundation with placeholder rendering until you drop in your art.
