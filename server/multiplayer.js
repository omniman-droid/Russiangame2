const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ port: 8081 });
const players = new Map();

function snapshot() {
  const out = {};
  for (const [id, p] of players.entries()) {
    out[id] = {
      x: p.x,
      y: p.y,
      hp: p.hp,
      weapon: p.weapon,
      crouching: p.crouching,
      facing: p.facing,
      name: p.name || 'survivor',
    };
  }
  return out;
}

function broadcast(data, exceptId = null) {
  const raw = JSON.stringify(data);
  for (const [id, p] of players.entries()) {
    if (exceptId && id === exceptId) continue;
    if (p.ws.readyState === 1) p.ws.send(raw);
  }
}

wss.on('connection', (ws) => {
  const id = Math.random().toString(36).slice(2, 10);
  players.set(id, { ws, x: 0, y: 0, hp: 100, weapon: 'pistol', crouching: false, facing: 1, name: 'survivor' });
  ws.send(JSON.stringify({ type: 'welcome', id }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const p = players.get(id);
    if (!p) return;

    if (msg.type === 'state') {
      p.x = Number(msg.x || 0);
      p.y = Number(msg.y || 0);
      p.hp = Number(msg.hp || 0);
      p.weapon = msg.weapon || 'pistol';
      p.crouching = !!msg.crouching;
      p.facing = msg.facing || 1;
      p.name = String(msg.name || 'survivor').slice(0, 16);
    }

    if (msg.type === 'shot') {
      broadcast({
        type: 'shot',
        id,
        x: Number(msg.x || 0),
        y: Number(msg.y || 0),
        hitX: Number(msg.hitX || 0),
        hitY: Number(msg.hitY || 0),
        damage: Number(msg.damage || 10),
      }, id);
    }
  });

  ws.on('close', () => players.delete(id));
});

setInterval(() => {
  broadcast({ type: 'snapshot', players: snapshot() });
}, 100);

console.log('Multiplayer relay listening on ws://localhost:8081');
