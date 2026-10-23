const os = require('os');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT || 3000);
const MAX_PLAYERS = 4;
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.get('/', (_req, res) => res.status(200).type('text/plain').send('STEEL SWARM online multiplayer server is running.'));
app.get('/health', (_req, res) => res.json({ ok: true, game: 'STEEL SWARM', version: '3.8-online-coop' }));
const server = http.createServer(app);
const DEFAULT_ALLOWED_ORIGINS = [
  'https://collitech.es', 'http://collitech.es',
  'https://www.collitech.es', 'http://www.collitech.es',
  'https://collitech.github.io',
  'http://localhost:3000', 'http://127.0.0.1:3000'
];
const allowedOrigins = new Set((process.env.CORS_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
  .split(',').map(origin => origin.trim()).filter(Boolean));
const io = new Server(server, {
  maxHttpBufferSize: 2e6,
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed by STEEL SWARM server'), false);
    },
    methods: ['GET', 'POST']
  }
});
const rooms = new Map();

function cleanName(raw) {
  const name = String(raw || '').replace(/[<>\u0000-\u001f\u007f]/g, '').trim().slice(0, 18);
  return name.length >= 2 ? name : 'Comandante';
}
function cleanRoomCode(raw) { return String(raw || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8); }
function number(raw, fallback = 0, min = -1e6, max = 1e6) {
  const v = Number(raw); return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
}
function uniqueName(room, wanted, ownId = null) {
  const used = new Set([...room.players.values()].filter(p => p.id !== ownId).map(p => p.name.toLowerCase()));
  if (!used.has(wanted.toLowerCase())) return wanted;
  for (let i = 2; i < 100; i++) {
    const suffix = ` (${i})`;
    const candidate = wanted.slice(0, 18 - suffix.length) + suffix;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  return `Comandante-${Math.floor(1000 + Math.random() * 9000)}`;
}
function roomSummary(room) {
  return [...room.players.values()].map(p => ({
    id: p.id, name: p.name, base: p.base, color: p.color, x: p.x, y: p.y,
    a: p.a, hullA: p.hullA, hp: p.hp, maxHp: p.maxHp, inGame: !!p.inGame,
    level: p.level || 1, wave: p.wave || 1, isHost: p.id === room.hostId,
    damage: p.damage || 15, speed: p.speed || 150, rate: p.rate || 0.65, projectileCount: p.projectileCount || 1,
    upgrades: p.upgrades || {}, inGame: !!p.inGame
  }));
}
function broadcastRoom(room) {
  if (!room) return;
  const players = roomSummary(room);
  // Send one personalized message per socket so the host flag never flickers false.
  for (const p of room.players.values()) {
    io.to(p.id).emit('room:players', {
      roomCode: room.code, hostId: room.hostId,
      players, isHost: p.id === room.hostId,
      started: !!room.started, paused: !!room.paused
    });
  }
}
function leaveRoom(socket, announce = true) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  socket.leave(code); socket.data.roomCode = null;
  if (!room) return;
  room.players.delete(socket.id);
  if (!room.players.size) { rooms.delete(code); return; }
  if (room.hostId === socket.id) room.hostId = room.players.keys().next().value;
  if (announce) io.to(code).emit('player:left', { id: socket.id, hostId: room.hostId });
  broadcastRoom(room);
}
function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { let suffix = ''; for (let i = 0; i < 4; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)]; code = `SW-${suffix}`; } while (rooms.has(code));
  return code;
}
function joinRoom(socket, room, data) {
  if (room.players.size >= MAX_PLAYERS) { socket.emit('room:error', 'La sala está llena (máximo 4 jugadores).'); return; }
  const name = uniqueName(room, cleanName(data.name));
  const profile = {
    id: socket.id, name, base: String(data.tank || 'panzer1').slice(0, 32), color: '#8c9e6d',
    x: 0, y: 0, a: 0, hullA: 0, hp: 100, maxHp: 100, inGame: false, level: 1, wave: 1,
    damage: 15, speed: 150, rate: 0.65, projectileCount: 1, upgrades: {}
  };
  const spawnIndex = room.players.size;
  room.players.set(socket.id, profile);
  socket.join(room.code); socket.data.roomCode = room.code;
  socket.emit('room:joined', { roomCode: room.code, id: socket.id, isHost: room.hostId === socket.id, spawnIndex, players: roomSummary(room), hostId: room.hostId, started: room.started, paused: room.paused });
  broadcastRoom(room);
  if (room.started) { socket.emit('game:started', { hostId: room.hostId, startedAt: room.startedAt, lateJoin: true }); if (room.worldSnapshot) socket.emit('world:update', room.worldSnapshot); if (room.paused) socket.emit('game:paused', { hostId: room.hostId }); }
  console.log(`[${room.code}] ${name} se ha unido (${room.players.size}/${MAX_PLAYERS})`);
}

io.on('connection', socket => {
  console.log(`Conectado: ${socket.id}`);
  socket.on('room:create', data => {
    leaveRoom(socket);
    const code = makeRoomCode();
    const room = { code, hostId: socket.id, players: new Map(), createdAt: Date.now(), started: false, paused: false, startedAt: 0, worldSnapshot: null, rewardedEnemies: new Set() };
    rooms.set(code, room);
    joinRoom(socket, room, data || {});
  });
  socket.on('room:join', data => {
    const code = cleanRoomCode(data && data.roomCode);
    const room = rooms.get(code);
    if (!room) { socket.emit('room:error', 'No existe esa sala. Comprueba el código y que el anfitrión siga conectado.'); return; }
    if (socket.data.roomCode && socket.data.roomCode !== code) leaveRoom(socket);
    if (socket.data.roomCode === code) { socket.emit('room:error', 'Ya estás en esa sala.'); return; }
    joinRoom(socket, room, data || {});
  });
  socket.on('profile:update', data => {
    const room = rooms.get(socket.data.roomCode); if (!room) return;
    const player = room.players.get(socket.id); if (!player) return;
    player.name = uniqueName(room, cleanName(data && data.name), socket.id);
    socket.emit('profile:updated', { name: player.name }); broadcastRoom(room);
  });
  socket.on('player:state', data => {
    const room = rooms.get(socket.data.roomCode); if (!room || !data || typeof data !== 'object') return;
    const player = room.players.get(socket.id); if (!player) return;
    if (typeof data.inGame === 'boolean') player.inGame = data.inGame;
    if (data.name !== undefined) player.name = uniqueName(room, cleanName(data.name), socket.id);
    if (data.inGame) {
      player.x = number(data.x, player.x, -1e6, 1e6); player.y = number(data.y, player.y, -1e6, 1e6);
      player.a = number(data.a, player.a, -100, 100); player.hullA = number(data.hullA, player.hullA, -100, 100);
      player.hp = number(data.hp, player.hp, 0, 1e6); player.maxHp = number(data.maxHp, player.maxHp, 1, 1e6);
      player.base = String(data.base || player.base).slice(0, 32); player.color = /^#[0-9a-f]{6}$/i.test(data.color) ? data.color : player.color;
      player.isMoving = !!data.isMoving; player.wave = Math.round(number(data.wave, player.wave, 1, 999)); player.level = Math.round(number(data.level, player.level, 1, 999));
      player.damage = number(data.damage, player.damage, 1, 10000); player.speed = number(data.speed, player.speed, 1, 3000); player.rate = number(data.rate, player.rate, .04, 10); player.projectileCount = Math.round(number(data.projectileCount, player.projectileCount, 1, 12));
      if (data.upgrades && typeof data.upgrades === 'object') { const safe = {}; for (const k of ['damage','speed','rate','armor','repair','magnet','mines','oil','airstrike','shield','gearXP','regeneration','coinMagnet','critical','radar','airburst','overclock']) safe[k] = Math.round(number(data.upgrades[k], 0, 0, 5)); player.upgrades = safe; }
    }
    const payload = { ...player };
    socket.to(room.code).volatile.emit('player:update', payload);
    // Roster needs fewer updates than movement; keeps room list / name / in-game status current.
    if (!data.inGame || Date.now() - (room.lastRosterAt || 0) > 1200) { room.lastRosterAt = Date.now(); broadcastRoom(room); }
  });
  socket.on('player:fire', data => {
    const room = rooms.get(socket.data.roomCode); if (!room || !data || typeof data !== 'object') return;
    const player = room.players.get(socket.id); if (!player || !player.inGame) return;
    const x = number(data.x, 0, -1e6, 1e6), y = number(data.y, 0, -1e6, 1e6), a = number(data.a, 0, -Math.PI * 2, Math.PI * 2);
    socket.to(room.code).volatile.emit('player:fire', { id: socket.id, name: player.name, x, y, a, color: /^#[0-9a-f]{6}$/i.test(data.color) ? data.color : '#f5d98a' });
  });
  socket.on('game:start', () => {
    const room = rooms.get(socket.data.roomCode); if (!room || room.hostId !== socket.id) return;
    room.started = true; room.paused = false; room.startedAt = Date.now(); room.worldSnapshot = null; room.rewardedEnemies.clear();
    io.to(room.code).emit('game:started', { hostId: room.hostId, startedAt: room.startedAt, by: socket.id });
  });
  socket.on('game:pause', () => {
    const room = rooms.get(socket.data.roomCode); if (!room || room.hostId !== socket.id || !room.started) return;
    room.paused = true; io.to(room.code).emit('game:paused', { hostId: room.hostId, by: socket.id });
  });
  socket.on('game:resume', () => {
    const room = rooms.get(socket.data.roomCode); if (!room || room.hostId !== socket.id || !room.started) return;
    room.paused = false; io.to(room.code).emit('game:resumed', { hostId: room.hostId, by: socket.id });
  });
  socket.on('world:snapshot', data => {
    const room = rooms.get(socket.data.roomCode); if (!room || room.hostId !== socket.id || !room.started || !data || typeof data !== 'object') return;
    const arr = (v, max) => Array.isArray(v) ? v.slice(0, max) : [];
    const clean = {
      at: Date.now(), wave: Math.round(number(data.wave, 1, 1, 999)), kills: Math.round(number(data.kills, 0, 0, 1e8)),
      waveRemaining: Math.round(number(data.waveRemaining, 0, 0, 500)), waveTransition: number(data.waveTransition, 0, 0, 20),
      spawnT: number(data.spawnT, .5, 0, 20), banner: String(data.banner || '').slice(0, 80), bannerTime: number(data.bannerTime, 0, 0, 10),
      elapsedMs: number(data.elapsedMs, 0, 0, 86400000), phase: String(data.phase || 'playing').slice(0, 20),
      enemies: arr(data.enemies, 250).map(e => ({ ...e, netId: String(e.netId || '').slice(0, 48) })),
      enemyShots: arr(data.enemyShots, 700), artilleryZones: arr(data.artilleryZones, 40), smokeGrenades: arr(data.smokeGrenades, 80), smokeClouds: arr(data.smokeClouds, 80),
      airstrikes: arr(data.airstrikes, 50), airstrikeBursts: arr(data.airstrikeBursts, 50), mines: arr(data.mines, 100), oils: arr(data.oils, 100),
      toolCrates: arr(data.toolCrates, 10), tankLootCrates: arr(data.tankLootCrates, 10)
    };
    room.worldSnapshot = clean;
    socket.to(room.code).volatile.emit('world:update', clean);
  });
  socket.on('combat:fire', data => {
    const room = rooms.get(socket.data.roomCode); if (!room || !room.started || !data || typeof data !== 'object') return;
    const p = room.players.get(socket.id); if (!p || !p.inGame) return;
    const projectiles = Array.isArray(data.projectiles) ? data.projectiles.slice(0, 12).map(s => ({
      x: number(s.x, p.x, -1e6, 1e6), y: number(s.y, p.y, -1e6, 1e6), vx: number(s.vx, 0, -2000, 2000), vy: number(s.vy, 0, -2000, 2000),
      life: number(s.life, 1, 0, 10), remaining: number(s.remaining, 400, 0, 2000), damage: number(s.damage, p.damage, 0, 1000), isCrit: !!s.isCrit,
      splashRadius: number(s.splashRadius, 0, 0, 200), splashDamage: number(s.splashDamage, 0, 0, 1000), pierceLeft: Math.round(number(s.pierceLeft, 0, 0, 8))
    })) : [];
    if (!projectiles.length) return;
    io.to(room.code).emit('combat:fire', { id: socket.id, name: p.name, base: p.base, color: p.color, projectiles });
  });
  socket.on('combat:special', data => {
    const room = rooms.get(socket.data.roomCode); if (!room || !room.started || !data || typeof data !== 'object') return;
    const p = room.players.get(socket.id); if (!p || !p.inGame) return;
    if (socket.id !== room.hostId) room.players.has(room.hostId) && io.to(room.hostId).emit('combat:specialFromPlayer', { id: socket.id, kind: String(data.kind || '').slice(0, 20), item: data.item || {} });
  });
  socket.on('combat:enemyKilled', data => {
    const room = rooms.get(socket.data.roomCode); if (!room || room.hostId !== socket.id || !data || typeof data !== 'object') return;
    const enemyId = String(data.enemyId || '').slice(0, 48); if (!enemyId || room.rewardedEnemies.has(enemyId)) return;
    room.rewardedEnemies.add(enemyId); if (room.rewardedEnemies.size > 5000) room.rewardedEnemies.clear();
    io.to(room.code).emit('combat:enemyKilled', { by: socket.id, enemyId, x: number(data.x, 0, -1e6, 1e6), y: number(data.y, 0, -1e6, 1e6), dropX: number(data.dropX, number(data.x, 0, -1e6, 1e6), -1e6, 1e6), dropY: number(data.dropY, number(data.y, 0, -1e6, 1e6), -1e6, 1e6), gearXP: number(data.gearXP, 8, 0, 10000), baseCoinValue: number(data.baseCoinValue, 4, 0, 100000), boss: !!data.boss });
  });
  socket.on('combat:playerHit', data => {
    const room = rooms.get(socket.data.roomCode); if (!room || room.hostId !== socket.id || !data || typeof data !== 'object') return;
    const targetId = String(data.targetId || ''); if (!room.players.has(targetId) || targetId === room.hostId) return;
    io.to(targetId).emit('combat:playerHit', { damage: number(data.damage, 0, 0, 10000), source: String(data.source || 'enemy').slice(0, 24), x: number(data.x, 0, -1e6, 1e6), y: number(data.y, 0, -1e6, 1e6) });
  });
  socket.on('progress:crateReward', data => {
    const room = rooms.get(socket.data.roomCode); if (!room || room.hostId !== socket.id || !room.started || !data || typeof data !== 'object') return;
    const valid = v => ['standard','improved','elite','prototype'].includes(v) ? v : null;
    const tiers = Array.isArray(data.tiers) ? data.tiers.slice(0, 4).map(valid).filter(Boolean) : [];
    if (tiers.length) io.to(room.code).emit('progress:crateReward', { by: socket.id, wave: Math.round(number(data.wave, 1, 1, 999)), tiers });
  });
  socket.on('game:ended', data => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id || !room.started) return;
    const result = data && data.result === 'victory' ? 'victory' : 'defeat';
    const endWave = Math.round(number(data && data.wave, 1, 1, 999));
    room.started = false; room.paused = false; room.worldSnapshot = null;
    io.to(room.code).emit('game:ended', { result, wave: endWave, by: socket.id });
    broadcastRoom(room);
  });
  socket.on('room:leave', () => { leaveRoom(socket); socket.emit('room:left'); });
  socket.on('disconnect', () => { leaveRoom(socket); console.log(`Desconectado: ${socket.id}`); });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n===========================================');
  console.log(' STEEL SWARM 3.8 · COOPERATIVO ONLINE');
  console.log('===========================================');
  console.log(`Este PC:  http://localhost:${PORT}`);
  for (const [iface, list] of Object.entries(os.networkInterfaces())) {
    for (const net of list || []) if (net.family === 'IPv4' && !net.internal) console.log(`Red LAN:  http://${net.address}:${PORT}  (${iface})`);
  }
  console.log('\nServidor online activo. Revisa /health para comprobar el estado. Ctrl+C para apagar el servidor.\n');
});
