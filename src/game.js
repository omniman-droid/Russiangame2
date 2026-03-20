const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const barsEl = document.getElementById("bars");
const moneyEl = document.getElementById("money");
const hotbarEl = document.getElementById("hotbar");
const inventoryEl = document.getElementById("inventory");

const keys = new Set();
const mouse = { x: 0, y: 0, down: false };

const WORLD_WIDTH = 12000;
const TILE = 32;
const GRAVITY = 1700;

const WEAPONS = {
  pistol: { label: "Pistol", damage: 23, range: 620, cooldown: 0.2, mag: 12, ammoType: "pistolAmmo", spread: 0.03 },
  rifle: { label: "Rifle", damage: 35, range: 900, cooldown: 0.15, mag: 30, ammoType: "rifleAmmo", spread: 0.015 },
  shotgun: { label: "Shotgun", damage: 18, range: 450, cooldown: 0.65, mag: 6, ammoType: "shotgunAmmo", spread: 0.16, pellets: 7 },
};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function distSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

class Terrain {
  constructor() {
    this.heights = [];
    this.bunkers = [];
    this.buildings = [];
    this.generate();
  }

  generate() {
    const cols = Math.floor(WORLD_WIDTH / TILE);
    let h = 440;
    for (let i = 0; i <= cols; i += 1) {
      const t = i / cols;
      const mountain = Math.sin(t * 22) * 120 + Math.sin(t * 4) * 90;
      const noise = Math.sin(t * 91) * 18 + rand(-12, 12);
      h += rand(-8, 8);
      h = clamp(h, 250, 610);
      this.heights.push(clamp(h + mountain + noise, 220, 650));
    }

    for (let i = 0; i < 12; i += 1) {
      const x = rand(400, WORLD_WIDTH - 500);
      const y = this.heightAt(x) - 8;
      this.bunkers.push({ x, y, w: 78, h: 24, id: i });
    }

    for (let i = 0; i < 24; i += 1) {
      const x = rand(180, WORLD_WIDTH - 220);
      const y = this.heightAt(x) - 75;
      this.buildings.push({ x, y, w: 90, h: 75 });
    }
  }

  heightAt(x) {
    const col = clamp(Math.floor(x / TILE), 0, this.heights.length - 2);
    const local = (x - col * TILE) / TILE;
    return this.heights[col] * (1 - local) + this.heights[col + 1] * local;
  }

  draw(cameraX) {
    const viewLeft = cameraX;
    const viewRight = cameraX + canvas.width;

    ctx.fillStyle = "#d7edff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#bddcf7";
    for (let i = 0; i < 9; i += 1) {
      const y = 70 + i * 36;
      ctx.fillRect(((i * 580 - cameraX * 0.2) % 1800) - 300, y, 900, 28);
    }

    ctx.fillStyle = "#8ea1b0";
    ctx.beginPath();
    for (let x = viewLeft; x <= viewRight + TILE; x += TILE) {
      const sx = x - cameraX;
      const y = this.heightAt(x) - 70;
      if (x === viewLeft) ctx.moveTo(sx, y);
      else ctx.lineTo(sx, y);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#f7fbff";
    ctx.beginPath();
    for (let x = viewLeft; x <= viewRight + TILE; x += TILE) {
      const sx = x - cameraX;
      const y = this.heightAt(x);
      if (x === viewLeft) ctx.moveTo(sx, y);
      else ctx.lineTo(sx, y);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    ctx.fill();

    for (const b of this.buildings) {
      if (b.x + b.w < viewLeft || b.x > viewRight) continue;
      const sx = b.x - cameraX;
      ctx.fillStyle = "#4a4c50";
      ctx.fillRect(sx, b.y, b.w, b.h);
      ctx.fillStyle = "#5e6268";
      ctx.fillRect(sx + 5, b.y + 6, b.w - 10, 14);
      ctx.fillStyle = "#9ea7b3";
      ctx.fillRect(sx + 12, b.y + 25, 20, 14);
      ctx.fillStyle = "#2f3338";
      ctx.fillRect(sx + b.w - 28, b.y + 24, 18, b.h - 24);
    }

    for (const b of this.bunkers) {
      if (b.x + b.w < viewLeft || b.x > viewRight) continue;
      const sx = b.x - cameraX;
      ctx.fillStyle = "#59616b";
      ctx.fillRect(sx, b.y, b.w, b.h);
      ctx.fillStyle = "#2f353d";
      ctx.fillRect(sx + 8, b.y + 2, b.w - 16, b.h - 4);
      ctx.fillStyle = "#8e97a3";
      ctx.fillRect(sx + b.w / 2 - 5, b.y + 7, 10, 10);
    }
  }
}

class Actor {
  constructor(x, y, team = "scav") {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.w = 28;
    this.h = 52;
    this.hp = 100;
    this.maxHp = 100;
    this.team = team;
    this.facing = 1;
    this.crouching = false;
    this.weapon = "pistol";
    this.mag = WEAPONS[this.weapon].mag;
    this.cooldown = 0;
    this.dead = false;
    this.respawnTimer = 0;
    this.inventory = {
      scrap: 30,
      money: 100,
      meds: 2,
      pistolAmmo: 72,
      rifleAmmo: 60,
      shotgunAmmo: 18,
      weaponParts: 3,
    };
  }

  get centerX() {
    return this.x + this.w / 2;
  }

  get centerY() {
    return this.y + this.h / 2;
  }

  equip(weapon) {
    if (!WEAPONS[weapon]) return;
    this.weapon = weapon;
    this.mag = clamp(this.mag, 0, WEAPONS[weapon].mag);
  }

  reload() {
    const def = WEAPONS[this.weapon];
    const needed = def.mag - this.mag;
    if (needed <= 0) return;
    const available = this.inventory[def.ammoType];
    const load = Math.min(available, needed);
    if (load > 0) {
      this.mag += load;
      this.inventory[def.ammoType] -= load;
    }
  }

  damage(amount) {
    if (this.dead) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.dead = true;
      this.respawnTimer = 4;
      this.hp = 0;
    }
  }

  draw(cameraX, armAngle, color = "#111") {
    const sx = this.x - cameraX;
    const h = this.crouching ? this.h - 16 : this.h;
    const y = this.y + (this.crouching ? 16 : 0);

    ctx.fillStyle = this.dead ? "#a01f2f" : color;
    ctx.fillRect(sx, y, this.w, h);

    const shoulderX = sx + this.w / 2;
    const shoulderY = y + 18;
    const armLen = 21;
    ctx.strokeStyle = "#f3d7c6";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(shoulderX + Math.cos(armAngle) * armLen, shoulderY + Math.sin(armAngle) * armLen);
    ctx.stroke();

    ctx.fillStyle = "#2f3136";
    ctx.fillRect(shoulderX + Math.cos(armAngle) * 8 - 10, shoulderY + Math.sin(armAngle) * 8 - 3, 20, 6);
  }
}

class Game {
  constructor() {
    this.terrain = new Terrain();
    this.player = new Actor(220, 150, "player");
    this.player.inventory = {
      scrap: 45,
      money: 250,
      meds: 3,
      pistolAmmo: 120,
      rifleAmmo: 90,
      shotgunAmmo: 24,
      weaponParts: 5,
    };
    this.player.equip("rifle");
    this.player.mag = 30;

    this.scavs = [];
    this.loot = [];
    this.effects = [];
    this.insideBunker = null;
    this.cameraX = 0;
    this.last = performance.now();

    this.spawnScavs(20);
    this.spawnLoot(90);

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  spawnScavs(count) {
    for (let i = 0; i < count; i += 1) {
      const x = rand(100, WORLD_WIDTH - 100);
      const y = this.terrain.heightAt(x) - 54;
      const s = new Actor(x, y, "scav");
      s.equip(Math.random() > 0.65 ? "rifle" : "pistol");
      s.mag = WEAPONS[s.weapon].mag;
      s.inventory.money = Math.floor(rand(20, 120));
      s.inventory.scrap = Math.floor(rand(10, 80));
      this.scavs.push(s);
    }
  }

  spawnLoot(count) {
    const types = ["scrap", "money", "pistolAmmo", "rifleAmmo", "shotgunAmmo", "meds", "weaponParts"];
    for (let i = 0; i < count; i += 1) {
      const x = rand(80, WORLD_WIDTH - 80);
      const y = this.terrain.heightAt(x) - 10;
      this.loot.push({ x, y, type: types[Math.floor(rand(0, types.length))], amount: Math.floor(rand(4, 25)) });
    }
  }

  input(dt) {
    if (this.player.dead) return;

    const speed = this.player.crouching ? 130 : 230;
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

    if (keys.has("KeyF")) {
      keys.delete("KeyF");
      this.toggleBunker();
    }

    this.player.vy += GRAVITY * dt;
    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;

    this.collideGround(this.player);
    this.collectLoot();
    this.cameraX = clamp(this.player.centerX - canvas.width / 2, 0, WORLD_WIDTH - canvas.width);
  }

  collideGround(actor) {
    actor.x = clamp(actor.x, 0, WORLD_WIDTH - actor.w);
    const feetXFront = actor.x + (actor.facing > 0 ? actor.w + 6 : -6);
    const frontY = this.terrain.heightAt(clamp(feetXFront, 0, WORLD_WIDTH));
    const curGround = this.terrain.heightAt(actor.x + actor.w / 2);

    const feet = actor.y + actor.h;
    const stepHeight = 24;
    if (frontY < feet && feet - frontY <= stepHeight && Math.abs(actor.vx) > 10) {
      actor.y -= feet - frontY;
      actor.vy = 0;
    }

    if (actor.y + actor.h > curGround) {
      actor.y = curGround - actor.h;
      actor.vy = 0;
    }
  }

  toggleBunker() {
    if (this.insideBunker != null) {
      const exit = this.terrain.bunkers[this.insideBunker];
      this.player.x = exit.x + 10;
      this.player.y = exit.y - 52;
      this.insideBunker = null;
      return;
    }

    const p = this.player;
    for (const bunker of this.terrain.bunkers) {
      if (Math.abs(p.centerX - (bunker.x + bunker.w / 2)) < 70 && Math.abs(p.y + p.h - bunker.y) < 30) {
        this.insideBunker = bunker.id;
        this.player.x = 300;
        this.player.y = 180;
        return;
      }
    }
  }

  collectLoot() {
    const p = this.player;
    this.loot = this.loot.filter((item) => {
      if (distSq(item.x, item.y, p.centerX, p.centerY) < 35 * 35) {
        p.inventory[item.type] = (p.inventory[item.type] || 0) + item.amount;
        return false;
      }
      return true;
    });
  }

  tryShoot(shooter) {
    if (shooter.cooldown > 0 || shooter.dead) return;
    const def = WEAPONS[shooter.weapon];
    if (shooter.mag <= 0) return;

    shooter.mag -= 1;
    shooter.cooldown = def.cooldown;

    const baseAngle = shooter === this.player
      ? Math.atan2(mouse.y - shooter.centerY, mouse.x + this.cameraX - shooter.centerX)
      : shooter.facing > 0 ? 0 : Math.PI;

    const pellets = def.pellets || 1;
    for (let i = 0; i < pellets; i += 1) {
      const angle = baseAngle + rand(-def.spread, def.spread);
      this.raycastHit(shooter, angle, def.range, def.damage);
    }

    this.effects.push({ x: shooter.centerX, y: shooter.centerY - 10, t: 0.08, type: "muzzle" });
  }

  raycastHit(shooter, angle, range, damage) {
    const step = 8;
    for (let d = 0; d < range; d += step) {
      const x = shooter.centerX + Math.cos(angle) * d;
      const y = shooter.centerY + Math.sin(angle) * d;

      if (y > this.terrain.heightAt(x)) {
        this.effects.push({ x, y, t: 0.12, type: "impact" });
        return;
      }

      for (const target of this.scavs.concat([this.player])) {
        if (target === shooter || target.dead) continue;
        if (x > target.x && x < target.x + target.w && y > target.y && y < target.y + target.h) {
          target.damage(damage);
          this.effects.push({ x, y, t: 0.2, type: "blood" });
          if (target.dead && shooter === this.player) {
            this.player.inventory.money += target.inventory.money;
            this.player.inventory.scrap += target.inventory.scrap;
          }
          return;
        }
      }
    }
  }

  updateScavs(dt) {
    for (const s of this.scavs) {
      if (s.dead) {
        s.respawnTimer -= dt;
        if (s.respawnTimer <= 0) {
          s.dead = false;
          s.hp = 100;
          s.x = rand(80, WORLD_WIDTH - 80);
          s.y = this.terrain.heightAt(s.x) - s.h;
        }
        continue;
      }

      s.cooldown = Math.max(0, s.cooldown - dt);

      if (Math.random() < 0.01) s.facing *= -1;
      s.vx = s.facing * 90;
      s.vy += GRAVITY * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      this.collideGround(s);

      if (distSq(s.centerX, s.centerY, this.player.centerX, this.player.centerY) < 440 * 440) {
        s.facing = this.player.centerX > s.centerX ? 1 : -1;
        if (Math.random() < 0.07) this.tryShoot(s);
      }
    }
  }

  updatePlayerState(dt) {
    this.player.cooldown = Math.max(0, this.player.cooldown - dt);

    if (this.player.dead) {
      this.player.respawnTimer -= dt;
      if (this.player.respawnTimer <= 0) {
        this.player.dead = false;
        this.player.hp = 100;
        const x = rand(100, WORLD_WIDTH - 100);
        this.player.x = x;
        this.player.y = this.terrain.heightAt(x) - this.player.h;
        this.player.inventory = {
          scrap: 20,
          money: 50,
          meds: 1,
          pistolAmmo: 48,
          rifleAmmo: 0,
          shotgunAmmo: 0,
          weaponParts: 0,
        };
        this.player.equip("pistol");
        this.player.mag = 12;
      }
    }
  }

  updateEffects(dt) {
    this.effects = this.effects.filter((e) => {
      e.t -= dt;
      return e.t > 0;
    });
  }

  drawBunkerInterior() {
    ctx.fillStyle = "#20252d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#30363f";
    for (let i = 0; i < 8; i += 1) {
      ctx.fillRect(120 + i * 130, 120, 70, 320);
    }
    ctx.fillStyle = "#4b535f";
    ctx.fillRect(0, 520, canvas.width, 200);
    ctx.fillStyle = "#5e6774";
    ctx.fillRect(220, 470, 120, 50);
    ctx.fillRect(780, 470, 120, 50);
  }

  drawLoot() {
    for (const item of this.loot) {
      if (item.x < this.cameraX - 40 || item.x > this.cameraX + canvas.width + 40) continue;
      const sx = item.x - this.cameraX;
      ctx.fillStyle = item.type.includes("Ammo") ? "#f7da74" : item.type === "money" ? "#72e4a0" : "#b9c4d0";
      ctx.fillRect(sx - 7, item.y - 9, 14, 14);
    }
  }

  drawEffects() {
    for (const e of this.effects) {
      const sx = e.x - this.cameraX;
      if (e.type === "muzzle") {
        ctx.fillStyle = "#ffd27d";
        ctx.beginPath();
        ctx.arc(sx, e.y, 10, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === "impact") {
        ctx.fillStyle = "#d7ecff";
        ctx.fillRect(sx - 2, e.y - 2, 4, 4);
      } else {
        ctx.fillStyle = "#b01b34";
        ctx.fillRect(sx - 3, e.y - 3, 7, 7);
      }
    }
  }

  render() {
    if (this.insideBunker != null) {
      this.drawBunkerInterior();
      this.cameraX = 0;
    } else {
      this.terrain.draw(this.cameraX);
      this.drawLoot();
    }

    const pAngle = Math.atan2(mouse.y - this.player.centerY, mouse.x + this.cameraX - this.player.centerX);

    for (const s of this.scavs) {
      if (this.insideBunker != null) continue;
      if (s.x + s.w < this.cameraX || s.x > this.cameraX + canvas.width) continue;
      s.draw(this.cameraX, s.facing > 0 ? 0 : Math.PI, "#3b444f");
    }

    this.player.draw(this.cameraX, pAngle, "#1f2f44");
    this.drawEffects();
    this.renderUi();
  }

  renderUi() {
    const p = this.player;
    const stamina = p.crouching ? 65 : 100;
    barsEl.textContent = `HP ${Math.round(p.hp)}/${p.maxHp} | Stamina ${stamina} | Mag ${p.mag}/${WEAPONS[p.weapon].mag}`;
    moneyEl.textContent = `💵 ${p.inventory.money}`;
    hotbarEl.textContent = `[1] Pistol  [2] Rifle  [3] Shotgun  | Equipped: ${WEAPONS[p.weapon].label}`;

    const invRows = Object.entries(p.inventory)
      .map(([k, v]) => `<div>${k}: <strong>${v}</strong></div>`)
      .join("");
    inventoryEl.innerHTML = `<h3>Inventory</h3>${invRows}<hr><small>Respawn gives a basic kit (pistol + starter supplies).</small>`;
  }

  step(dt) {
    if (keys.has("Digit1")) this.player.equip("pistol");
    if (keys.has("Digit2")) this.player.equip("rifle");
    if (keys.has("Digit3")) this.player.equip("shotgun");

    this.input(dt);
    this.updatePlayerState(dt);
    this.updateScavs(dt);
    this.updateEffects(dt);
  }

  loop(ts) {
    const dt = Math.min((ts - this.last) / 1000, 0.033);
    this.last = ts;
    this.step(dt);
    this.render();
    requestAnimationFrame(this.loop);
  }
}

window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "KeyI") inventoryEl.classList.toggle("hidden");
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  mouse.y = ((e.clientY - rect.top) / rect.height) * canvas.height;
});
window.addEventListener("mousedown", () => keys.add("KeyE"));
window.addEventListener("mouseup", () => keys.delete("KeyE"));

new Game();
