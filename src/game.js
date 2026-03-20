const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const barsEl = document.getElementById("bars");
const moneyEl = document.getElementById("money");
const hotbarEl = document.getElementById("hotbar");
const inventoryEl = document.getElementById("inventory");
const craftingEl = document.getElementById("crafting");
const mapEl = document.getElementById("map");

const keys = new Set();
const mouse = { x: 0, y: 0 };

const WORLD_WIDTH = 18000;
const TILE = 32;
const GRAVITY = 1800;
const DAY_SECONDS = 360;
const MAP_SEED = 424242;
const SPRITES = {};

const SPRITE_PATHS = {
  snow: "assets/sprites/terrain/snow_base.svg",
  rock: "assets/sprites/terrain/rock_base.svg",
  bunkerWall: "assets/sprites/buildings/bunker_wall.svg",
  bunkerDoor: "assets/sprites/buildings/bunker_door_closed.svg",
  player: "assets/sprites/characters/player_body.svg",
  scav: "assets/sprites/characters/scav_body.svg",
  arm: "assets/sprites/characters/player_arm.svg",
  muzzle: "assets/sprites/effects/muzzle_flash.svg",
  impact: "assets/sprites/effects/impact.svg",
  blood: "assets/sprites/effects/blood.svg",
  crosshair: "assets/sprites/ui/crosshair.svg",
  item: {
    scrap: "assets/sprites/items/scrap.svg",
    money: "assets/sprites/items/money.svg",
    metalFragments: "assets/sprites/items/stone.svg",
    wood: "assets/sprites/items/wood.svg",
    stone: "assets/sprites/items/stone.svg",
    sulfur: "assets/sprites/items/sulfur.svg",
    cloth: "assets/sprites/items/weapon_parts.svg",
    weaponParts: "assets/sprites/items/weapon_parts.svg",
    meds: "assets/sprites/items/meds.svg",
    food: "assets/sprites/items/food.svg",
    water: "assets/sprites/items/water.svg",
    pistolAmmo: "assets/sprites/items/pistol_ammo.svg",
    smgAmmo: "assets/sprites/items/smg_ammo.svg",
    rifleAmmo: "assets/sprites/items/rifle_ammo.svg",
    shotgunAmmo: "assets/sprites/items/shotgun_ammo.svg",
    sniperAmmo: "assets/sprites/items/sniper_ammo.svg",
  },
};

function loadSprite(path) {
  const img = new Image();
  img.src = path;
  return img;
}

function bootSprites() {
  Object.entries(SPRITE_PATHS).forEach(([k, v]) => {
    if (typeof v === "string") {
      SPRITES[k] = loadSprite(v);
    } else {
      SPRITES[k] = {};
      Object.entries(v).forEach(([nk, nv]) => { SPRITES[k][nk] = loadSprite(nv); });
    }
  });
}

function drawSprite(sprite, x, y, w, h, fallback = "#fff") {
  if (sprite && sprite.complete) ctx.drawImage(sprite, x, y, w, h);
  else {
    ctx.fillStyle = fallback;
    ctx.fillRect(x, y, w, h);
  }
}

const WEAPONS = {
  rock: { label: "Rock", damage: 18, range: 58, cooldown: 0.45, ammoType: null, mag: 1, spread: 0 },
  pistol: { label: "Pistol", damage: 24, range: 650, cooldown: 0.2, ammoType: "pistolAmmo", mag: 12, spread: 0.03 },
  revolver: { label: "Revolver", damage: 37, range: 690, cooldown: 0.42, ammoType: "pistolAmmo", mag: 6, spread: 0.02 },
  smg: { label: "SMG", damage: 20, range: 620, cooldown: 0.085, ammoType: "smgAmmo", mag: 28, spread: 0.06 },
  rifle: { label: "Rifle", damage: 35, range: 980, cooldown: 0.145, ammoType: "rifleAmmo", mag: 30, spread: 0.015 },
  shotgun: { label: "Shotgun", damage: 17, range: 470, cooldown: 0.7, ammoType: "shotgunAmmo", mag: 6, spread: 0.18, pellets: 8 },
  sniper: { label: "Sniper", damage: 90, range: 1400, cooldown: 1.05, ammoType: "sniperAmmo", mag: 5, spread: 0.006 },
};

const RECIPES = [
  { id: "bandage", label: "Bandage", cost: { cloth: 8 }, out: { meds: 1 } },
  { id: "pistolAmmo", label: "Pistol Ammo x15", cost: { sulfur: 10, metalFragments: 12 }, out: { pistolAmmo: 15 } },
  { id: "rifleAmmo", label: "Rifle Ammo x12", cost: { sulfur: 15, metalFragments: 18 }, out: { rifleAmmo: 12 } },
  { id: "shotgunAmmo", label: "Shotgun Ammo x8", cost: { sulfur: 10, metalFragments: 10 }, out: { shotgunAmmo: 8 } },
  { id: "wall", label: "Build Wall Kit", cost: { wood: 120, stone: 40 }, out: { wallKit: 1 } },
  { id: "campfire", label: "Campfire Kit", cost: { wood: 80, stone: 15 }, out: { campfireKit: 1 } },
  { id: "stash", label: "Stash Kit", cost: { wood: 60, scrap: 40 }, out: { stashKit: 1 } },
  { id: "revolver", label: "Craft Revolver", cost: { scrap: 160, weaponParts: 16 }, out: { revolver: 1 } },
  { id: "smg", label: "Craft SMG", cost: { scrap: 220, weaponParts: 24 }, out: { smg: 1 } },
  { id: "rifle", label: "Craft Rifle", cost: { scrap: 330, weaponParts: 30 }, out: { rifle: 1 } },
];

function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function distSq(ax, ay, bx, by) { const dx = ax - bx; const dy = ay - by; return dx * dx + dy * dy; }
function mulberry32(a) {
  return function seeded() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Terrain {
  constructor() {
    this.heights = [];
    this.bunkers = [];
    this.buildings = [];
    this.nodes = [];
    this.safeZone = { x: 900, w: 620 };
    this.generate();
  }

  generate() {
    const seeded = mulberry32(MAP_SEED);
    const cols = Math.floor(WORLD_WIDTH / TILE);
    let h = 460;
    for (let i = 0; i <= cols; i += 1) {
      const t = i / cols;
      const mountain = Math.sin(t * 24) * 130 + Math.sin(t * 5.5) * 100;
      const noise = Math.sin(t * 120) * 20 + (seeded() * 28 - 14);
      h += seeded() * 18 - 9;
      h = clamp(h, 255, 620);
      this.heights.push(clamp(h + mountain + noise, 225, 670));
    }

    for (let i = 0; i < 22; i += 1) {
      const x = 380 + seeded() * (WORLD_WIDTH - 900);
      this.bunkers.push({ id: i, x, y: this.heightAt(x) - 8, w: 88, h: 24, depth: 3 });
    }

    for (let i = 0; i < 65; i += 1) {
      const x = 200 + seeded() * (WORLD_WIDTH - 420);
      this.buildings.push({ x, y: this.heightAt(x) - 78, w: 70 + seeded() * 70, h: 60 + seeded() * 25, lootTier: 1 + Math.floor(seeded() * 3) });
    }

    const nodeTypes = ["rock", "tree", "sulfur", "barrel"];
    for (let i = 0; i < 360; i += 1) {
      const x = 80 + seeded() * (WORLD_WIDTH - 160);
      const type = nodeTypes[Math.floor(seeded() * nodeTypes.length)];
      this.nodes.push({ x, y: this.heightAt(x) - 14, type, hp: type === "barrel" ? 40 : 65 });
    }
  }

  heightAt(x) {
    const col = clamp(Math.floor(x / TILE), 0, this.heights.length - 2);
    const local = (x - col * TILE) / TILE;
    return this.heights[col] * (1 - local) + this.heights[col + 1] * local;
  }

  drawSky(light) {
    const top = Math.floor(35 * light);
    const mid = Math.floor(55 * light + 10);
    ctx.fillStyle = `rgb(${top},${mid},${80 + Math.floor(70 * light)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  draw(cameraX, dayNorm) {
    const light = clamp(Math.sin(dayNorm * Math.PI * 2) * 0.35 + 0.65, 0.2, 1);
    const viewLeft = cameraX;
    const viewRight = cameraX + canvas.width;
    this.drawSky(light);

    // mountains
    ctx.fillStyle = `rgba(90, 106, 124, ${0.85 * light})`;
    ctx.beginPath();
    for (let x = viewLeft; x <= viewRight + TILE; x += TILE) {
      const sx = x - cameraX;
      const y = this.heightAt(x) - 95;
      if (x === viewLeft) ctx.moveTo(sx, y); else ctx.lineTo(sx, y);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.fill();

    // ground
    for (let x = viewLeft - TILE; x <= viewRight + TILE; x += TILE) {
      const sx = x - cameraX;
      const y = this.heightAt(x);
      for (let py = y; py < canvas.height; py += TILE) {
        drawSprite(SPRITES.snow, sx, py, TILE, TILE, `rgba(236, 245, 255, ${0.95 * light})`);
      }
    }

    // safe zone
    const sz = this.safeZone;
    if (sz.x < viewRight && sz.x + sz.w > viewLeft) {
      ctx.fillStyle = "rgba(90,180,220,0.2)";
      ctx.fillRect(sz.x - cameraX, this.heightAt(sz.x) - 130, sz.w, 140);
      ctx.fillStyle = "#75bfe9";
      ctx.fillText("SAFE ZONE / TRADER", sz.x - cameraX + 14, this.heightAt(sz.x) - 112);
    }

    for (const b of this.buildings) {
      if (b.x + b.w < viewLeft || b.x > viewRight) continue;
      const sx = b.x - cameraX;
      ctx.fillStyle = "#4f5357";
      ctx.fillRect(sx, b.y, b.w, b.h);
      ctx.fillStyle = "#31353a";
      ctx.fillRect(sx + b.w * 0.65, b.y + 20, 20, b.h - 20);
      ctx.fillStyle = "#7c8795";
      ctx.fillRect(sx + 8, b.y + 12, 24, 12);
    }

    for (const b of this.bunkers) {
      if (b.x + b.w < viewLeft || b.x > viewRight) continue;
      const sx = b.x - cameraX;
      drawSprite(SPRITES.bunkerWall, sx, b.y, b.w, b.h, "#5a6472");
      ctx.fillStyle = "#262c33";
      ctx.fillRect(sx + 10, b.y + 3, b.w - 20, b.h - 6);
      drawSprite(SPRITES.bunkerDoor, sx + b.w / 2 - 6, b.y + 5, 12, 13, "#8f97a5");
    }

    for (const n of this.nodes) {
      if (n.x < viewLeft - 30 || n.x > viewRight + 30 || n.hp <= 0) continue;
      const sx = n.x - cameraX;
      if (n.type === "tree") {
        ctx.fillStyle = "#576037";
        ctx.fillRect(sx - 6, n.y - 42, 12, 42);
        ctx.fillStyle = "#8ea47a";
        ctx.fillRect(sx - 18, n.y - 62, 36, 24);
      } else if (n.type === "rock") {
        ctx.fillStyle = "#6e727a";
        ctx.fillRect(sx - 13, n.y - 16, 26, 16);
      } else if (n.type === "sulfur") {
        ctx.fillStyle = "#c6b05a";
        ctx.fillRect(sx - 12, n.y - 14, 24, 14);
      } else {
        ctx.fillStyle = "#7c5b4a";
        ctx.fillRect(sx - 10, n.y - 18, 20, 18);
      }
    }
  }
}

class Actor {
  constructor(x, y, kind = "scav") {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.w = 28;
    this.h = 52;
    this.maxHp = 100;
    this.hp = 100;
    this.kind = kind;
    this.dead = false;
    this.deathRecorded = false;
    this.respawnTimer = 0;
    this.facing = 1;
    this.crouching = false;
    this.cooldown = 0;
    this.weapon = "rock";
    this.mag = 1;
    this.armor = 0;
    this.bounty = 0;
    this.coldRes = 0;
    this.lastDamageCause = "unknown";
    this.inventory = {
      wood: 0, stone: 0, sulfur: 0, cloth: 0,
      scrap: 0, metalFragments: 0, weaponParts: 0,
      money: 0, meds: 0, food: 0, water: 0,
      pistolAmmo: 0, smgAmmo: 0, rifleAmmo: 0, shotgunAmmo: 0, sniperAmmo: 0,
      wallKit: 0, campfireKit: 0, stashKit: 0,
      revolver: 0, smg: 0, rifle: 0,
    };
  }

  get centerX() { return this.x + this.w / 2; }
  get centerY() { return this.y + this.h / 2; }

  equip(weapon) {
    if (!WEAPONS[weapon]) return;
    this.weapon = weapon;
    const magSize = WEAPONS[weapon].mag;
    this.mag = clamp(this.mag, 0, magSize);
    if (weapon === "rock") this.mag = 1;
  }

  reload() {
    const def = WEAPONS[this.weapon];
    if (!def.ammoType) return;
    const needed = def.mag - this.mag;
    if (needed <= 0) return;
    const have = this.inventory[def.ammoType] || 0;
    const take = Math.min(needed, have);
    this.mag += take;
    this.inventory[def.ammoType] -= take;
  }

  hit(amount, cause = "damage") {
    if (this.dead) return;
    const dmg = Math.max(1, amount * (1 - this.armor));
    this.lastDamageCause = cause;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.respawnTimer = this.kind === "player" ? 6 : 8;
    }
  }

  draw(cameraX, angle, color, name) {
    const sx = this.x - cameraX;
    const h = this.crouching ? this.h - 16 : this.h;
    const y = this.y + (this.crouching ? 16 : 0);

    const sprite = this.kind === "player" ? SPRITES.player : SPRITES.scav;
    drawSprite(sprite, sx, y, this.w, h, this.dead ? "#8f2436" : color);

    const shoulderX = sx + this.w / 2;
    const shoulderY = y + 18;
    const handX = shoulderX + Math.cos(angle) * 9 - 11;
    const handY = shoulderY + Math.sin(angle) * 9 - 3;
    drawSprite(SPRITES.arm, handX, handY, 22, 6, "#efd8c3");

    ctx.fillStyle = "#d9e9ff";
    ctx.font = "11px monospace";
    ctx.fillText(name, sx - 4, y - 6);
  }
}

class Game {
  constructor() {
    this.terrain = new Terrain();
    this.player = new Actor(240, 190, "player");
    this.player.inventory = {
      wood: 120, stone: 70, sulfur: 35, cloth: 30,
      scrap: 220, metalFragments: 120, weaponParts: 18,
      money: 300, meds: 3, food: 5, water: 5,
      pistolAmmo: 72, smgAmmo: 0, rifleAmmo: 50, shotgunAmmo: 14, sniperAmmo: 0,
      wallKit: 0, campfireKit: 0, stashKit: 0,
      revolver: 0, smg: 0, rifle: 1,
    };
    this.player.armor = 0.12;
    this.player.coldRes = 0.22;
    this.player.equip("rifle");
    this.player.mag = 30;

    this.dayTime = 0.22;
    this.cameraX = 0;
    this.insideBunker = null;
    this.bunkerLevel = 0;
    this.interactPrompt = "";
    this.notifications = [];
    this.effects = [];
    this.loot = [];
    this.droppedBags = [];
    this.structures = [];
    this.scavs = [];
    this.cars = [];
    this.planes = [];
    this.explosions = [];
    this.deathLog = [];
    this.bunkerBlueprints = {};
    this.remotePlayers = {};
    this.netId = null;
    this.netSocket = null;
    this.netTimer = 0;

    this.stats = { hunger: 100, thirst: 100, cold: 0, radiation: 0 };
    this.selectedRecipe = 0;

    this.spawnScavs(36);
    this.spawnLoot(170);
    this.spawnCars(20);
    this.spawnPlanes(4);
    this.last = performance.now();
    this.connectNetworking();

    requestAnimationFrame(this.loop.bind(this));
  }

  spawnScavs(count) {
    for (let i = 0; i < count; i += 1) {
      const x = rand(120, WORLD_WIDTH - 120);
      const s = new Actor(x, this.terrain.heightAt(x) - 52, "scav");
      const rolls = ["pistol", "revolver", "smg", "rifle", "shotgun"];
      s.equip(rolls[Math.floor(rand(0, rolls.length))]);
      s.mag = WEAPONS[s.weapon].mag;
      s.armor = rand(0, 0.25);
      s.inventory.money = Math.floor(rand(10, 220));
      s.inventory.scrap = Math.floor(rand(20, 160));
      s.inventory.metalFragments = Math.floor(rand(10, 90));
      s.inventory.pistolAmmo = Math.floor(rand(0, 45));
      s.inventory.rifleAmmo = Math.floor(rand(0, 36));
      s.inventory.smgAmmo = Math.floor(rand(0, 60));
      s.inventory.shotgunAmmo = Math.floor(rand(0, 20));
      s.inventory.food = Math.floor(rand(0, 3));
      this.scavs.push(s);
    }
  }

  spawnLoot(count) {
    const items = ["scrap", "money", "metalFragments", "wood", "stone", "sulfur", "cloth", "weaponParts", "meds", "food", "water", "pistolAmmo", "rifleAmmo", "smgAmmo", "shotgunAmmo"];
    for (let i = 0; i < count; i += 1) {
      const x = rand(80, WORLD_WIDTH - 80);
      this.loot.push({ x, y: this.terrain.heightAt(x) - 10, type: items[Math.floor(rand(0, items.length))], amount: Math.floor(rand(6, 26)) });
    }
  }

  spawnCars(count) {
    for (let i = 0; i < count; i += 1) {
      const x = rand(200, WORLD_WIDTH - 200);
      this.cars.push({
        x,
        y: this.terrain.heightAt(x) - 18,
        vx: rand(70, 180) * (Math.random() > 0.5 ? 1 : -1),
        hp: 100,
        crashed: false,
        fireTimer: 0,
      });
    }
  }

  spawnPlanes(count) {
    for (let i = 0; i < count; i += 1) {
      const fromLeft = Math.random() > 0.5;
      this.planes.push({
        x: fromLeft ? -rand(100, 1200) : WORLD_WIDTH + rand(100, 1200),
        y: rand(90, 240),
        vx: fromLeft ? rand(210, 320) : -rand(210, 320),
        hp: 100,
        crashing: false,
        vy: 0,
        crashTargetX: rand(300, WORLD_WIDTH - 300),
      });
    }
  }

  connectNetworking() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${proto}://${location.hostname}:8081`;
    try {
      this.netSocket = new WebSocket(wsUrl);
      this.netSocket.addEventListener("message", (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.type === "welcome") this.netId = msg.id;
        if (msg.type === "snapshot") this.remotePlayers = msg.players || {};
        if (msg.type === "shot" && msg.id !== this.netId) {
          this.effects.push({ x: msg.x, y: msg.y, t: 0.08, type: "muzzle" });
          const d2 = distSq(msg.hitX, msg.hitY, this.player.centerX, this.player.centerY);
          if (d2 < 22 * 22) this.player.hit(msg.damage || 14, "multiplayer gunshot");
        }
      });
      this.netSocket.addEventListener("open", () => this.setNote("Multiplayer connected"));
      this.netSocket.addEventListener("close", () => this.setNote("Multiplayer offline (local mode)"));
    } catch {
      this.netSocket = null;
    }
  }

  sendNet(type, payload) {
    if (!this.netSocket || this.netSocket.readyState !== WebSocket.OPEN) return;
    this.netSocket.send(JSON.stringify({ type, ...payload }));
  }

  bunkerBlueprint(id, level) {
    const key = `${id}:${level}`;
    if (this.bunkerBlueprints[key]) return this.bunkerBlueprints[key];
    const rooms = 4 + ((id + level) % 3);
    const traps = [];
    const crates = [];
    for (let i = 0; i < rooms; i += 1) {
      if ((i + id + level) % 2 === 0) traps.push({ x: 210 + i * 180, w: 36, dmg: 24 + level * 6 });
      crates.push({ x: 170 + i * 185, looted: false, tier: 1 + ((i + id + level) % 3) });
    }
    const out = { rooms, traps, crates, tint: (id * 37 + level * 23) % 70 };
    this.bunkerBlueprints[key] = out;
    return out;
  }

  onGround(actor) {
    return actor.y + actor.h >= this.terrain.heightAt(actor.x + actor.w / 2) - 1;
  }

  collideGround(actor) {
    actor.x = clamp(actor.x, 0, WORLD_WIDTH - actor.w);
    const frontX = actor.x + (actor.facing > 0 ? actor.w + 8 : -8);
    const frontY = this.terrain.heightAt(clamp(frontX, 0, WORLD_WIDTH));
    const curY = this.terrain.heightAt(actor.x + actor.w / 2);

    const feet = actor.y + actor.h;
    if (frontY < feet && feet - frontY <= 26 && Math.abs(actor.vx) > 20) {
      actor.y -= feet - frontY;
      actor.vy = 0;
    }

    if (actor.y + actor.h > curY) {
      actor.y = curY - actor.h;
      actor.vy = 0;
    }
  }

  setNote(msg, time = 2.2) {
    this.notifications.push({ msg, t: time });
  }

  consumeVitals(dt) {
    const inSafe = this.inSafeZone(this.player);
    const night = Math.sin(this.dayTime * Math.PI * 2) < 0;

    this.stats.hunger = clamp(this.stats.hunger - dt * 0.9, 0, 100);
    this.stats.thirst = clamp(this.stats.thirst - dt * 1.4, 0, 100);
    this.stats.cold = clamp(this.stats.cold + (night && !inSafe ? dt * (4.8 - this.player.coldRes * 2) : -dt * 6), 0, 100);

    if (this.insideBunker != null) {
      this.stats.radiation = clamp(this.stats.radiation + dt * 1.8, 0, 100);
    } else {
      this.stats.radiation = clamp(this.stats.radiation - dt * 1.2, 0, 100);
    }

    if (this.stats.hunger <= 0) this.player.hit(7 * dt, "starvation");
    if (this.stats.thirst <= 0) this.player.hit(9 * dt, "dehydration");
    if (this.stats.cold > 80) this.player.hit(6 * dt, "hypothermia");
    if (this.stats.radiation > 92) this.player.hit(10 * dt, "radiation poisoning");

    if (keys.has("Digit8") && this.player.inventory.food > 0) {
      this.player.inventory.food -= 1;
      this.stats.hunger = clamp(this.stats.hunger + 24, 0, 100);
      this.setNote("Ate food (+hunger)");
      keys.delete("Digit8");
    }
    if (keys.has("Digit9") && this.player.inventory.water > 0) {
      this.player.inventory.water -= 1;
      this.stats.thirst = clamp(this.stats.thirst + 35, 0, 100);
      this.setNote("Drank water (+thirst)");
      keys.delete("Digit9");
    }
    if (keys.has("Digit0") && this.player.inventory.meds > 0) {
      this.player.inventory.meds -= 1;
      this.player.hp = clamp(this.player.hp + 45, 0, this.player.maxHp);
      this.stats.radiation = clamp(this.stats.radiation - 20, 0, 100);
      this.setNote("Used meds (+hp, -radiation)");
      keys.delete("Digit0");
    }
  }

  input(dt) {
    if (this.player.dead) return;

    const speed = this.player.crouching ? 130 : 240;
    if (keys.has("KeyA")) {
      this.player.vx = -speed;
      this.player.facing = -1;
    } else if (keys.has("KeyD")) {
      this.player.vx = speed;
      this.player.facing = 1;
    } else {
      this.player.vx *= 0.8;
    }

    this.player.crouching = keys.has("KeyS");
    if (keys.has("KeyE")) this.tryShoot(this.player);
    if (keys.has("KeyR")) this.player.reload();

    if (keys.has("Digit1")) this.equipFromSlot("rock");
    if (keys.has("Digit2")) this.equipFromSlot("pistol");
    if (keys.has("Digit3")) this.equipFromSlot("revolver");
    if (keys.has("Digit4")) this.equipFromSlot("smg");
    if (keys.has("Digit5")) this.equipFromSlot("rifle");
    if (keys.has("Digit6")) this.equipFromSlot("shotgun");
    if (keys.has("Digit7")) this.equipFromSlot("sniper");

    if (keys.has("KeyF")) { keys.delete("KeyF"); this.interact(); }
    if (keys.has("KeyG")) { this.gather(); }
    if (keys.has("KeyT")) { keys.delete("KeyT"); this.trade(); }

    if (keys.has("KeyB")) {
      keys.delete("KeyB");
      this.player.buildMode = !this.player.buildMode;
      this.setNote(this.player.buildMode ? "Build mode ON" : "Build mode OFF");
    }

    if (this.player.buildMode && keys.has("KeyF")) {
      this.placeStructure();
    }

    if (keys.has("BracketLeft")) { keys.delete("BracketLeft"); this.selectedRecipe = (this.selectedRecipe - 1 + RECIPES.length) % RECIPES.length; }
    if (keys.has("BracketRight")) { keys.delete("BracketRight"); this.selectedRecipe = (this.selectedRecipe + 1) % RECIPES.length; }
    if (keys.has("KeyV")) { keys.delete("KeyV"); this.tryCraft(this.selectedRecipe); }

    this.player.vy += GRAVITY * dt;
    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;
    const preCollideVy = this.player.vy;
    this.collideGround(this.player);
    if (this.onGround(this.player) && preCollideVy > 620) {
      this.player.hit((preCollideVy - 620) * 0.05, "fall impact");
    }
    this.collectLoot();
    this.collectDroppedBags();

    this.cameraX = this.insideBunker != null
      ? 0
      : clamp(this.player.centerX - canvas.width / 2, 0, WORLD_WIDTH - canvas.width);
  }

  equipFromSlot(weapon) {
    if (weapon === "rock" || this.player.inventory[weapon] > 0 || weapon === "pistol") {
      this.player.equip(weapon);
      if (this.player.mag > WEAPONS[weapon].mag) this.player.mag = WEAPONS[weapon].mag;
    }
  }

  inSafeZone(actor) {
    const s = this.terrain.safeZone;
    return actor.centerX >= s.x && actor.centerX <= s.x + s.w;
  }

  interact() {
    if (this.player.buildMode) {
      this.placeStructure();
      return;
    }

    if (this.insideBunker != null) {
      if (this.bunkerLevel > 0) {
        this.bunkerLevel -= 1;
        this.player.x = 250;
        this.player.y = 200;
        this.setNote(`Moved up to bunker level ${this.bunkerLevel + 1}`);
      } else {
        const exit = this.terrain.bunkers[this.insideBunker];
        this.player.x = exit.x + 14;
        this.player.y = exit.y - 52;
        this.insideBunker = null;
        this.setNote("Exited bunker");
      }
      return;
    }

    for (const bunker of this.terrain.bunkers) {
      if (Math.abs(this.player.centerX - (bunker.x + bunker.w / 2)) < 74 && Math.abs(this.player.y + this.player.h - bunker.y) < 32) {
        this.insideBunker = bunker.id;
        this.bunkerLevel = 0;
        this.player.x = 260;
        this.player.y = 220;
        this.setNote("Entered bunker level 1");
        return;
      }
    }

    for (const bag of this.droppedBags) {
      if (distSq(bag.x, bag.y, this.player.centerX, this.player.centerY) < 58 * 58) {
        Object.entries(bag.items).forEach(([k, v]) => { this.player.inventory[k] = (this.player.inventory[k] || 0) + v; });
        bag.collected = true;
        this.setNote("Looted death bag");
        return;
      }
    }
  }

  placeStructure() {
    const px = this.player.centerX + this.player.facing * 60;
    const py = this.terrain.heightAt(px) - 46;

    if (this.player.inventory.wallKit > 0) {
      this.player.inventory.wallKit -= 1;
      this.structures.push({ type: "wall", x: px, y: py, hp: 220 });
      this.setNote("Placed wall");
      return;
    }
    if (this.player.inventory.campfireKit > 0) {
      this.player.inventory.campfireKit -= 1;
      this.structures.push({ type: "campfire", x: px, y: py + 22, hp: 90, lit: true });
      this.setNote("Placed campfire");
      return;
    }
    if (this.player.inventory.stashKit > 0) {
      this.player.inventory.stashKit -= 1;
      this.structures.push({ type: "stash", x: px, y: py + 22, hp: 150, items: {} });
      this.setNote("Placed stash");
      return;
    }

    this.setNote("No build kits available");
  }

  gather() {
    const centerX = this.player.centerX;
    const centerY = this.player.centerY;
    const node = this.terrain.nodes.find((n) => n.hp > 0 && distSq(n.x, n.y, centerX, centerY) < 60 * 60);
    if (!node) return;

    node.hp -= this.player.weapon === "rock" ? 16 : 10;
    this.effects.push({ x: node.x, y: node.y - 12, t: 0.12, type: "impact" });

    if (node.hp <= 0) {
      if (node.type === "tree") {
        this.player.inventory.wood += Math.floor(rand(80, 150));
        this.player.inventory.cloth += Math.floor(rand(4, 12));
      } else if (node.type === "rock") {
        this.player.inventory.stone += Math.floor(rand(80, 145));
        this.player.inventory.metalFragments += Math.floor(rand(12, 28));
      } else if (node.type === "sulfur") {
        this.player.inventory.sulfur += Math.floor(rand(55, 95));
      } else {
        this.player.inventory.scrap += Math.floor(rand(25, 75));
        this.player.inventory.money += Math.floor(rand(8, 35));
      }
      this.setNote(`Harvested ${node.type}`);
      setTimeout(() => {
        node.hp = node.type === "barrel" ? 40 : 65;
      }, 16000);
    }
  }

  trade() {
    if (!this.inSafeZone(this.player)) {
      this.setNote("Trader is only in safe zone");
      return;
    }

    const inv = this.player.inventory;
    if (inv.scrap >= 60) {
      inv.scrap -= 60;
      inv.rifleAmmo += 18;
      inv.food += 1;
      this.setNote("Trader: 60 scrap -> rifle ammo + food");
    } else if (inv.money >= 100) {
      inv.money -= 100;
      inv.meds += 1;
      inv.water += 1;
      this.setNote("Trader: $100 -> meds + water");
    } else {
      this.setNote("Not enough scrap/money for trade");
    }
  }

  tryCraft(recipeIndex) {
    const recipe = RECIPES[recipeIndex];
    const inv = this.player.inventory;
    const can = Object.entries(recipe.cost).every(([k, v]) => (inv[k] || 0) >= v);

    if (!can) {
      this.setNote(`Missing resources for ${recipe.label}`);
      return;
    }

    Object.entries(recipe.cost).forEach(([k, v]) => { inv[k] -= v; });
    Object.entries(recipe.out).forEach(([k, v]) => { inv[k] = (inv[k] || 0) + v; });
    this.setNote(`Crafted ${recipe.label}`);
  }

  collectLoot() {
    this.loot = this.loot.filter((item) => {
      if (distSq(item.x, item.y, this.player.centerX, this.player.centerY) < 35 * 35) {
        this.player.inventory[item.type] = (this.player.inventory[item.type] || 0) + item.amount;
        return false;
      }
      return true;
    });
  }

  collectDroppedBags() {
    this.droppedBags = this.droppedBags.filter((b) => !b.collected);
  }

  tryShoot(shooter) {
    if (shooter.cooldown > 0 || shooter.dead) return;
    const def = WEAPONS[shooter.weapon];

    if (def.ammoType) {
      if (shooter.mag <= 0) return;
      shooter.mag -= 1;
    }

    shooter.cooldown = def.cooldown;
    const baseAngle = shooter === this.player
      ? Math.atan2(mouse.y - shooter.centerY, mouse.x + this.cameraX - shooter.centerX)
      : shooter.facing > 0 ? 0 : Math.PI;

    const pellets = def.pellets || 1;
    let firstHit = { x: shooter.centerX + Math.cos(baseAngle) * 22, y: shooter.centerY + Math.sin(baseAngle) * 22 };
    for (let i = 0; i < pellets; i += 1) {
      const ang = baseAngle + rand(-def.spread, def.spread);
      const hit = this.raycastHit(shooter, ang, def.range, def.damage);
      if (hit) firstHit = hit;
    }

    this.effects.push({ x: shooter.centerX, y: shooter.centerY - 10, t: 0.06, type: "muzzle" });
    if (shooter === this.player) {
      this.sendNet("shot", { x: shooter.centerX, y: shooter.centerY - 10, hitX: firstHit.x, hitY: firstHit.y, damage: def.damage });
    }
  }

  raycastHit(shooter, angle, range, damage) {
    const step = 7;
    for (let d = 0; d < range; d += step) {
      const x = shooter.centerX + Math.cos(angle) * d;
      const y = shooter.centerY + Math.sin(angle) * d;

      if (this.insideBunker == null && y > this.terrain.heightAt(clamp(x, 0, WORLD_WIDTH))) {
        this.effects.push({ x, y, t: 0.1, type: "impact" });
        return { x, y };
      }

      for (const s of this.structures) {
        const w = s.type === "wall" ? 36 : 24;
        const h = s.type === "wall" ? 52 : 22;
        if (x > s.x - 8 && x < s.x + w && y > s.y - h && y < s.y + 8) {
          s.hp -= damage * 0.45;
          this.effects.push({ x, y, t: 0.1, type: "impact" });
          return { x, y };
        }
      }

      const targets = this.scavs.concat([this.player]);
      for (const target of targets) {
        if (target === shooter || target.dead) continue;
        if (x > target.x && x < target.x + target.w && y > target.y && y < target.y + target.h) {
          target.hit(damage, "gunshot");
          this.effects.push({ x, y, t: 0.18, type: "blood" });
          if (target.dead) this.onKill(shooter, target);
          return { x, y };
        }
      }
    }
    return null;
  }

  onKill(killer, target) {
    const drop = {};
    ["scrap", "money", "metalFragments", "food", "water", "pistolAmmo", "rifleAmmo", "smgAmmo", "shotgunAmmo"].forEach((k) => {
      if ((target.inventory[k] || 0) > 0) drop[k] = Math.floor(target.inventory[k] * 0.7);
    });

    this.droppedBags.push({ x: target.centerX, y: target.y + target.h - 4, items: drop, collected: false });

    if (killer === this.player) {
      this.player.bounty += 1;
      this.player.inventory.money += Math.floor(rand(20, 90));
      this.setNote(`Killed ${target.kind}. Bounty ${this.player.bounty}`);
    }
  }

  updateScavs(dt) {
    for (const s of this.scavs) {
      if (s.dead) {
        s.respawnTimer -= dt;
        if (s.respawnTimer <= 0) {
          s.dead = false;
          s.hp = 100;
          s.x = rand(120, WORLD_WIDTH - 120);
          s.y = this.terrain.heightAt(s.x) - s.h;
          s.mag = WEAPONS[s.weapon].mag;
        }
        continue;
      }

      s.cooldown = Math.max(0, s.cooldown - dt);

      const playerNear = distSq(s.centerX, s.centerY, this.player.centerX, this.player.centerY) < 560 * 560;
      if (playerNear) {
        s.facing = this.player.centerX > s.centerX ? 1 : -1;
        s.vx = s.facing * 130;
        if (Math.random() < 0.06) this.tryShoot(s);
      } else {
        if (Math.random() < 0.008) s.facing *= -1;
        s.vx = s.facing * 85;
      }

      s.vy += GRAVITY * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      this.collideGround(s);

      if (s.weapon !== "rock" && s.mag <= 0) s.reload();
    }
  }

  triggerExplosion(x, y, radius, cause = "explosion") {
    this.explosions.push({ x, y, r: radius, t: 0.45 });
    const targets = this.scavs.concat([this.player]);
    for (const target of targets) {
      if (target.dead) continue;
      const d2 = distSq(x, y, target.centerX, target.centerY);
      if (d2 < radius * radius) {
        const dmg = (1 - Math.sqrt(d2) / radius) * 120;
        target.hit(Math.max(8, dmg), cause);
      }
    }
  }

  updateCars(dt) {
    for (const car of this.cars) {
      if (car.crashed) {
        car.fireTimer -= dt;
        if (car.fireTimer > 0 && distSq(car.x, car.y, this.player.centerX, this.player.centerY) < 90 * 90) {
          this.player.hit(11 * dt, "car fire");
        }
        if (car.fireTimer <= 0) {
          car.crashed = false;
          car.hp = 100;
          car.x = rand(200, WORLD_WIDTH - 200);
          car.y = this.terrain.heightAt(car.x) - 18;
          car.vx = rand(70, 180) * (Math.random() > 0.5 ? 1 : -1);
        }
        continue;
      }

      car.x += car.vx * dt;
      car.y = this.terrain.heightAt(car.x) - 18;

      if (car.x < 60 || car.x > WORLD_WIDTH - 60) {
        car.vx *= -1;
      }

      if (Math.abs(this.player.centerX - car.x) < 18 && Math.abs(this.player.centerY - car.y) < 24) {
        this.player.hit(Math.abs(car.vx) * 0.2, "car crash");
        car.crashed = true;
        car.fireTimer = 8;
        car.vx = 0;
      }
    }
  }

  updatePlanes(dt) {
    for (const plane of this.planes) {
      if (!plane.crashing && Math.random() < 0.0009) plane.crashing = true;

      if (!plane.crashing) {
        plane.x += plane.vx * dt;
        if ((plane.vx > 0 && plane.x > WORLD_WIDTH + 1200) || (plane.vx < 0 && plane.x < -1200)) {
          const fromLeft = plane.vx > 0;
          plane.x = fromLeft ? -rand(100, 800) : WORLD_WIDTH + rand(100, 800);
          plane.y = rand(90, 240);
          plane.crashTargetX = rand(300, WORLD_WIDTH - 300);
        }
      } else {
        plane.vy += 220 * dt;
        plane.x += plane.vx * 0.65 * dt;
        plane.y += plane.vy * dt;
        const ground = this.terrain.heightAt(clamp(plane.x, 0, WORLD_WIDTH));
        if (plane.y >= ground - 10) {
          this.triggerExplosion(plane.x, ground - 8, 180, "plane explosion");
          plane.crashing = false;
          plane.vy = 0;
          const fromLeft = Math.random() > 0.5;
          plane.vx = fromLeft ? rand(210, 320) : -rand(210, 320);
          plane.x = fromLeft ? -rand(100, 800) : WORLD_WIDTH + rand(100, 800);
          plane.y = rand(90, 240);
        }
      }
    }
  }

  updateExplosions(dt) {
    this.explosions = this.explosions.filter((e) => {
      e.t -= dt;
      return e.t > 0;
    });
  }

  updateNetwork(dt) {
    this.netTimer += dt;
    if (this.netTimer < 0.1) return;
    this.netTimer = 0;
    this.sendNet("state", {
      x: this.player.x,
      y: this.player.y,
      hp: this.player.hp,
      weapon: this.player.weapon,
      crouching: this.player.crouching,
      facing: this.player.facing,
      name: "survivor",
    });
  }

  updateStructures(dt) {
    this.structures = this.structures.filter((s) => {
      if (s.type === "campfire" && s.lit) {
        if (distSq(s.x, s.y, this.player.centerX, this.player.centerY) < 140 * 140) {
          this.stats.cold = clamp(this.stats.cold - dt * 18, 0, 100);
        }
      }
      s.hp -= s.type === "campfire" ? dt * 0.3 : 0;
      return s.hp > 0;
    });
  }

  updateDay(dt) {
    this.dayTime += dt / DAY_SECONDS;
    if (this.dayTime >= 1) this.dayTime -= 1;
  }

  updatePlayer(dt) {
    this.player.cooldown = Math.max(0, this.player.cooldown - dt);
    if (!this.player.dead) return;

    if (!this.player.deathRecorded) {
      const cause = this.player.lastDamageCause || "unknown";
      this.player.deathRecorded = true;
      this.deathLog.push({ cause, t: 18 });
      this.setNote(`You died from ${cause}`);
    }

    this.player.respawnTimer -= dt;
    if (this.player.respawnTimer > 0) return;

    this.player.dead = false;
    this.player.deathRecorded = false;
    this.player.hp = 100;
    const spawnX = rand(this.terrain.safeZone.x + 30, this.terrain.safeZone.x + this.terrain.safeZone.w - 30);
    this.player.x = spawnX;
    this.player.y = this.terrain.heightAt(spawnX) - this.player.h;
    this.player.inventory = {
      wood: 50, stone: 30, sulfur: 0, cloth: 12,
      scrap: 65, metalFragments: 35, weaponParts: 2,
      money: 70, meds: 1, food: 2, water: 2,
      pistolAmmo: 48, smgAmmo: 0, rifleAmmo: 0, shotgunAmmo: 0, sniperAmmo: 0,
      wallKit: 0, campfireKit: 0, stashKit: 0,
      revolver: 0, smg: 0, rifle: 0,
    };
    this.player.equip("pistol");
    this.player.mag = 12;
    this.stats.hunger = 100;
    this.stats.thirst = 100;
    this.stats.cold = 0;
    this.stats.radiation = 0;
    this.player.bounty = 0;
    this.setNote("Respawned with basic kit");
  }

  updateNotifications(dt) {
    this.notifications = this.notifications.filter((n) => {
      n.t -= dt;
      return n.t > 0;
    });
    this.effects = this.effects.filter((e) => {
      e.t -= dt;
      return e.t > 0;
    });
    this.deathLog = this.deathLog.filter((d) => {
      d.t -= dt;
      return d.t > 0;
    });
  }

  renderBunker() {
    const bp = this.bunkerBlueprint(this.insideBunker, this.bunkerLevel);
    const darkness = 0.24 + this.bunkerLevel * 0.18;
    ctx.fillStyle = `rgba(${25 + this.bunkerLevel * 10},${28 + this.bunkerLevel * 8},${34 + this.bunkerLevel * 8},1)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = `hsl(${210 + bp.tint}, 16%, 30%)`;
    for (let i = 0; i < bp.rooms + 2; i += 1) {
      ctx.fillRect(50 + i * 150, 120 + ((i + bp.tint) % 2) * 20, 72, 410);
    }

    ctx.fillStyle = "#4e5864";
    ctx.fillRect(0, 530, canvas.width, 220);
    ctx.fillStyle = "#6f7d8f";
    for (const crate of bp.crates) {
      ctx.fillRect(crate.x, 500, 28, 30);
      if (!crate.looted && Math.abs(this.player.centerX - crate.x) < 48 && Math.abs(this.player.centerY - 500) < 60 && keys.has("KeyF")) {
        keys.delete("KeyF");
        crate.looted = true;
        const gain = 20 * crate.tier;
        this.player.inventory.scrap += gain;
        this.player.inventory.weaponParts += crate.tier;
        this.setNote(`Bunker crate looted (+${gain} scrap)`);
      }
    }
    for (const trap of bp.traps) {
      ctx.fillStyle = "#992b39";
      ctx.fillRect(trap.x, 526, trap.w, 4);
      if (Math.abs(this.player.centerX - (trap.x + trap.w / 2)) < trap.w && this.player.y + this.player.h >= 520) {
        this.player.hit(trap.dmg * 0.05, "bunker trap");
      }
    }
    ctx.fillStyle = "#293039";
    ctx.fillRect(1090, 430, 96, 100);
    ctx.fillStyle = "#90a0b8";
    ctx.fillText("F: Ladder", 1080, 420);

    ctx.fillStyle = `rgba(0,0,0,${darkness})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawWorld() {
    if (this.insideBunker != null) {
      this.renderBunker();
      return;
    }

    this.terrain.draw(this.cameraX, this.dayTime);

    for (const plane of this.planes) {
      if (plane.x < this.cameraX - 100 || plane.x > this.cameraX + canvas.width + 100) continue;
      const sx = plane.x - this.cameraX;
      ctx.fillStyle = plane.crashing ? "#b6634a" : "#98a5b7";
      ctx.fillRect(sx - 26, plane.y - 8, 52, 12);
      ctx.fillRect(sx - 8, plane.y - 16, 16, 8);
    }

    for (const car of this.cars) {
      if (car.x < this.cameraX - 80 || car.x > this.cameraX + canvas.width + 80) continue;
      const sx = car.x - this.cameraX;
      ctx.fillStyle = car.crashed ? "#7a3b31" : "#5f6b7a";
      ctx.fillRect(sx - 18, car.y - 10, 36, 10);
      ctx.fillRect(sx - 12, car.y - 18, 24, 8);
      if (car.crashed) {
        ctx.fillStyle = "#ffb35a";
        ctx.fillRect(sx - 4, car.y - 26, 8, 10);
      }
    }

    for (const item of this.loot) {
      if (item.x < this.cameraX - 40 || item.x > this.cameraX + canvas.width + 40) continue;
      const sx = item.x - this.cameraX;
      const icon = SPRITES.item?.[item.type];
      drawSprite(icon, sx - 7, item.y - 10, 14, 14, item.type.includes("Ammo") ? "#edcf67" : item.type === "money" ? "#71dfa0" : "#bac7d6");
    }

    for (const bag of this.droppedBags) {
      if (bag.x < this.cameraX - 40 || bag.x > this.cameraX + canvas.width + 40) continue;
      ctx.fillStyle = "#7b4a2f";
      ctx.fillRect(bag.x - this.cameraX - 9, bag.y - 12, 18, 12);
    }

    for (const s of this.structures) {
      const sx = s.x - this.cameraX;
      if (s.type === "wall") {
        ctx.fillStyle = "#7f8894";
        ctx.fillRect(sx, s.y - 52, 32, 52);
      } else if (s.type === "campfire") {
        ctx.fillStyle = "#6b6358";
        ctx.fillRect(sx, s.y - 8, 24, 8);
        if (s.lit) {
          ctx.fillStyle = "#ffc477";
          ctx.fillRect(sx + 8, s.y - 20, 8, 12);
        }
      } else {
        ctx.fillStyle = "#4f3d2f";
        ctx.fillRect(sx, s.y - 16, 26, 16);
      }
    }

    for (const e of this.explosions) {
      const sx = e.x - this.cameraX;
      ctx.fillStyle = `rgba(255,170,90,${e.t * 2})`;
      ctx.beginPath();
      ctx.arc(sx, e.y, e.r * (1 - e.t), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawActors() {
    const pAngle = Math.atan2(mouse.y - this.player.centerY, mouse.x + this.cameraX - this.player.centerX);

    for (const s of this.scavs) {
      if (s.dead) continue;
      if (this.insideBunker != null) continue;
      if (s.x + s.w < this.cameraX || s.x > this.cameraX + canvas.width) continue;
      s.draw(this.cameraX, s.facing > 0 ? 0 : Math.PI, "#3d4856", "scav");
    }

    Object.entries(this.remotePlayers).forEach(([id, rp]) => {
      if (id === this.netId || !rp) return;
      if (this.insideBunker != null) return;
      if (rp.x + 28 < this.cameraX || rp.x > this.cameraX + canvas.width) return;
      const temp = new Actor(rp.x, rp.y, "remote");
      temp.crouching = !!rp.crouching;
      temp.draw(this.cameraX, rp.facing > 0 ? 0 : Math.PI, "#6d86a3", rp.name || "player");
    });

    this.player.draw(this.cameraX, pAngle, "#1f3148", "you");

    for (const e of this.effects) {
      const sx = e.x - this.cameraX;
      if (e.type === "muzzle") {
        drawSprite(SPRITES.muzzle, sx - 9, e.y - 9, 18, 18, "#ffd27c");
      } else if (e.type === "impact") {
        drawSprite(SPRITES.impact, sx - 4, e.y - 4, 8, 8, "#d6ebff");
      } else {
        drawSprite(SPRITES.blood, sx - 4, e.y - 4, 8, 8, "#af1a34");
      }
    }

    drawSprite(SPRITES.crosshair, mouse.x - 12, mouse.y - 12, 24, 24, "#fff");
  }

  drawUi() {
    const hpState = this.player.hp > 35 ? "good" : "bad";
    barsEl.innerHTML = `
      <div class="row"><span class="${hpState}">HP ${Math.round(this.player.hp)}/${this.player.maxHp}</span><span>Weapon ${WEAPONS[this.player.weapon].label} ${this.player.mag}/${WEAPONS[this.player.weapon].mag}</span></div>
      <div class="row"><span>Hunger ${Math.round(this.stats.hunger)}</span><span>Thirst ${Math.round(this.stats.thirst)}</span></div>
      <div class="row"><span>Cold ${Math.round(this.stats.cold)}</span><span>Radiation ${Math.round(this.stats.radiation)}</span></div>
      <div class="row"><span>Bounty ${this.player.bounty}</span><span>Day ${(this.dayTime * 24).toFixed(1)}h</span></div>
    `;

    moneyEl.textContent = `💵 ${this.player.inventory.money}`;
    hotbarEl.textContent = `[1]Rock [2]Pistol [3]Revolver [4]SMG [5]Rifle [6]Shotgun [7]Sniper | [8]Eat [9]Drink [0]Meds`;

    const invRows = Object.entries(this.player.inventory)
      .filter(([, v]) => v > 0)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `<div class="row"><span>${k}</span><strong>${v}</strong></div>`)
      .join("");
    inventoryEl.innerHTML = `<h3>Inventory</h3>${invRows || "<small>empty</small>"}`;

    const craftRows = RECIPES.map((r, i) => {
      const cost = Object.entries(r.cost).map(([k, v]) => `${k}:${v}`).join(", ");
      const out = Object.entries(r.out).map(([k, v]) => `${k}+${v}`).join(", ");
      const marker = i === this.selectedRecipe ? "👉 " : "";
      return `<div><strong>${marker}${i + 1}. ${r.label}</strong><br><small>${cost} -> ${out}</small></div>`;
    }).join("<hr>");
    craftingEl.innerHTML = `<h3>Crafting ([ / ] select, V craft)</h3>${craftRows}`;

    mapEl.innerHTML = `
      <h3>Zone Intel</h3>
      <div>World width: ${WORLD_WIDTH}m</div>
      <div>Safe Zone: x=${Math.round(this.terrain.safeZone.x)}..${Math.round(this.terrain.safeZone.x + this.terrain.safeZone.w)}</div>
      <div>Bunkers: ${this.terrain.bunkers.length} (3 levels each)</div>
      <div>Buildings: ${this.terrain.buildings.length}</div>
      <div>Resource Nodes: ${this.terrain.nodes.filter((n) => n.hp > 0).length}</div>
      <div>Hostile players alive: ${this.scavs.filter((s) => !s.dead).length}</div>
      <div>Cars active: ${this.cars.filter((c) => !c.crashed).length}</div>
      <div>Planes active: ${this.planes.length}</div>
      <div>Recent death causes: ${this.deathLog.slice(-3).map((d) => d.cause).join(", ") || "none"}</div>
      <div>Your X: ${Math.round(this.player.centerX)}</div>
    `;

    this.interactPrompt = this.insideBunker != null
      ? "F on ladder: deeper/up/exit bunker"
      : "F near bunker/bag to interact | G near nodes to gather";

    ctx.fillStyle = "rgba(10,14,21,0.55)";
    ctx.fillRect(16, 640, 520, 66);
    ctx.fillStyle = "#c7dbf3";
    ctx.font = "13px monospace";
    ctx.fillText(this.interactPrompt, 28, 664);

    this.notifications.slice(-4).forEach((n, i) => {
      ctx.fillText(n.msg, 28, 686 + i * 15);
    });
  }

  step(dt) {
    this.updateDay(dt);
    this.input(dt);
    this.consumeVitals(dt);

    if (this.insideBunker != null && keys.has("KeyF") && this.bunkerLevel < 2) {
      this.bunkerLevel += 1;
      keys.delete("KeyF");
      this.player.x = 240;
      this.player.y = 220;
      this.setNote(`Moved deeper to bunker level ${this.bunkerLevel + 1}`);
    }

    this.updatePlayer(dt);
    this.updateScavs(dt);
    this.updateCars(dt);
    this.updatePlanes(dt);
    this.updateExplosions(dt);
    this.updateNetwork(dt);
    this.updateStructures(dt);
    this.updateNotifications(dt);
  }

  render() {
    this.drawWorld();
    this.drawActors();
    this.drawUi();
  }

  loop(ts) {
    const dt = Math.min((ts - this.last) / 1000, 0.033);
    this.last = ts;
    this.step(dt);
    this.render();
    requestAnimationFrame(this.loop.bind(this));
  }
}

window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "KeyI") inventoryEl.classList.toggle("hidden");
  if (e.code === "KeyC") craftingEl.classList.toggle("hidden");
  if (e.code === "KeyM") mapEl.classList.toggle("hidden");
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  mouse.y = ((e.clientY - rect.top) / rect.height) * canvas.height;
});
window.addEventListener("mousedown", () => keys.add("KeyE"));
window.addEventListener("mouseup", () => keys.delete("KeyE"));

bootSprites();
new Game();
