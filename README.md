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
