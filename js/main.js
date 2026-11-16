import * as THREE from '../vendor/three.module.js';
import { THEMES, THEME_BY_ID, SKINS, SKIN_BY_ID, COLOR_PRESETS, DIFFICULTY_COLORS } from './themes.js';
import {
  LEVELS, OFFICIAL_LEVELS, makeLevelRuntime, generateEvents,
  generateCustomDraft, snapZ, laneFromX, LANES, GRID, mulberry32
} from './levels.js';
import { World } from './world.js';
import { AudioEngine } from './audio.js';

/* ------------------------------------------------------------------ */
/* storage                                                             */
/* ------------------------------------------------------------------ */
const PROFILE_KEY = 'gd3d.profile.v1';
const CUSTOM_KEY = 'gd3d.customLevels.v1';
const DRAFT_KEY = 'gd3d.editorDraft.v1';
const DEFAULT_PROFILE = {
  skin: 'classic',
  primary: '#2ee6ff',
  secondary: '#ffffff',
  glow: '#00d9ff',
  muted: false,
  practice: false,
  lastPlayed: 'official-stereo',
  best: {},
  totalAttempts: 0
};

function safeParse(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function safeStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

let profile = { ...DEFAULT_PROFILE, ...safeParse(PROFILE_KEY, {}) };
profile.best = profile.best || {};
if (!SKIN_BY_ID[profile.skin]) profile.skin = 'classic';
if (typeof profile.totalAttempts !== 'number') profile.totalAttempts = 0;

let customLevels = safeParse(CUSTOM_KEY, []);
if (!Array.isArray(customLevels)) customLevels = [];
customLevels = customLevels.map(normalizeLevel).filter(Boolean);

function normalizeLevel(raw) {
  if (!raw || typeof raw.name !== 'string' || !Array.isArray(raw.events)) return null;
  const theme = THEME_BY_ID[raw.themeId] || THEMES[0];
  const allowed = new Set(['spike', 'block', 'gate', 'saw', 'hurdle', 'pad', 'coin', 'finish']);
  const events = raw.events
    .filter(e => e && allowed.has(e.type) && Number.isFinite(e.z))
    .map(e => ({
      type: e.type,
      lane: Math.max(0, Math.min(2, Math.round(Number(e.lane) || 0))),
      z: Math.max(0, Number(e.z) || 0),
      ...(e.type === 'coin' ? { y: Number(e.y) || 1.15 } : {})
    }))
    .sort((a, b) => a.z - b.z || a.lane - b.lane);
  return {
    id: raw.id || 'custom-' + Math.random().toString(36).slice(2, 9),
    name: raw.name.trim().slice(0, 28) || 'UNTITLED',
    themeId: theme.id,
    length: Math.max(220, Math.min(1200, Number(raw.length) || 430)),
    speed: Math.max(11, Math.min(20, Number(raw.speed) || 14)),
    difficulty: Number(raw.difficulty) || 0.48,
    events,
    custom: true,
    official: false,
    createdAt: raw.createdAt || Date.now()
  };
}

function saveProfile() {
  safeStore(PROFILE_KEY, profile);
  applyMuteUI();
}
function persistCustomLevels() {
  safeStore(CUSTOM_KEY, customLevels);
}

/* ------------------------------------------------------------------ */
/* dom helpers                                                         */
/* ------------------------------------------------------------------ */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad2 = n => String(n).padStart(2, '0');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const GLYPHS = {
  city: '▥', rings: '◎', crystals: '◆', dunes: '▲', hex: '⬡',
  orbit: '◉', clocks: '◷', void: '✕', clutter: '✦'
};
const TOOL_COLORS = {
  spike: '#2ee6ff', block: '#9db8d1', gate: '#ff3cac', saw: '#ff3cac',
  hurdle: '#ff3cac', pad: '#ffd166', coin: '#ffd166', finish: '#42f5a7', erase: '#ff8b9e'
};
const TOOL_LABELS = {
  spike: 'SPIKE', block: 'BLOCK', gate: 'GATE', saw: 'SAW',
  hurdle: 'HURDLE', pad: 'JUMP PAD', coin: 'COIN', finish: 'FINISH', erase: 'ERASE'
};
const ICON_GLYPHS = {
  square: '◆', bolt: 'ϟ', skull: '☠', ninja: '◐', orb: '◉', hex: '⬡',
  star: '★', shard: '◈', alien: '⌁', heart: '♥', crown: '♛', void: '✕'
};
const DEATH_QUIPS = [
  'The spikes send their regards.',
  'Gravity: 1. You: 0.',
  'That was almost art.',
  'The grid remembers everything.',
  'One more attempt. You know you want to.',
  'Your cube has filed a complaint.',
  'So close the camera could taste it.',
  'A bold strategy. It did not pay off.'
];

/* ------------------------------------------------------------------ */
/* renderer / scene                                                    */
/* ------------------------------------------------------------------ */
const canvas = $('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1800);
scene.userData.canvasRect = canvas.getBoundingClientRect();

const audio = new AudioEngine();
audio.muted = !!profile.muted;
// Browsers need a real gesture before audio can play; retry on the first one.
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
window.addEventListener('keydown', () => audio.unlock(), { once: true });

const world = new World(scene, camera);
world.onJumpSound = () => audio.sfxJump();
world.onCoinSound = () => audio.sfxCoin();
world.onDeathSound = () => audio.sfxDeath();
world.onWinSound = () => audio.sfxWin();

let state = 'menu';
let currentLevel = null;
let currentRuntime = null;
let attempt = 1;
let practice = !!profile.practice;
let lastCheckpoint = 4;
let nextCheckpoint = 94;
let checkpointNumber = 0;
let deathHandled = false;
let winHandled = false;
let pendingModal = null;
let runStartedAt = 0;
let elapsedTime = 0;
let gameElapsed = 0;
let returnToEditor = false;
let lastFrame = performance.now();
let hintTimer = null;
let toastTimer = null;
let jumpPointer = false;

const editor = {
  draft: null,
  tool: 'spike',
  viewZ: 48,
  saveTimer: null,
  hover: null,
  shift: false
};

/* ------------------------------------------------------------------ */
/* screens                                                             */
/* ------------------------------------------------------------------ */
function setScreen(name) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  const map = { menu: 'menuScreen', levels: 'levelsScreen', skins: 'skinsScreen', editor: 'editorScreen' };
  const el = $(map[name]);
  if (el) el.classList.add('active');
  document.body.classList.toggle('in-editor', name === 'editor');
  document.body.classList.toggle('in-game', name === 'playing');
  if (name !== 'editor') $('hud').classList.add('hidden');
  if (name !== 'editor' && world.cursor) world.cursor.visible = false;
  document.querySelectorAll('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
}

function hideModals() {
  document.querySelectorAll('.modal-layer').forEach(el => el.classList.add('hidden'));
}
function showModal(id) {
  hideModals();
  $(id).classList.remove('hidden');
}

function showToast(msg, ms = 2200) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function goMenu() {
  clearRunTimers();
  audio.stopMusic();
  hideModals();
  $('hud').classList.add('hidden');
  if (world.mode !== 'menu' || currentLevel) {
    world.buildShowcase(profile);
    world.setMode('menu');
  }
  state = 'menu';
  document.body.classList.remove('in-game', 'in-editor');
  setScreen('menu');
  updateMenuUI();
}

function goLevels() {
  clearRunTimers();
  audio.stopMusic();
  hideModals();
  $('hud').classList.add('hidden');
  if (world.mode !== 'menu') {
    world.buildShowcase(profile);
    world.setMode('menu');
  }
  state = 'menu';
  document.body.classList.remove('in-game', 'in-editor');
  renderLevels();
  setScreen('levels');
}

function goSkins() {
  clearRunTimers();
  audio.stopMusic();
  hideModals();
  $('hud').classList.add('hidden');
  if (world.mode !== 'menu') {
    world.buildShowcase(profile);
    world.setMode('menu');
  }
  state = 'menu';
  document.body.classList.remove('in-game', 'in-editor');
  renderSkinUI();
  setScreen('skins');
}

function clearRunTimers() {
  if (pendingModal) { clearTimeout(pendingModal); pendingModal = null; }
}

/* ------------------------------------------------------------------ */
/* menu / stats                                                        */
/* ------------------------------------------------------------------ */
function getLastLevel() {
  const official = LEVELS.find(l => l.id === profile.lastPlayed);
  if (official) return official;
  const custom = customLevels.find(l => l.id === profile.lastPlayed);
  return custom || LEVELS[0];
}

function completedCount() {
  return OFFICIAL_LEVELS.filter(l => profile.best[l.id]?.completed).length;
}

function starCount() {
  return OFFICIAL_LEVELS.reduce((n, l) => n + (profile.best[l.id]?.completed ? l.stars : 0), 0);
}

function updateMenuUI() {
  const level = getLastLevel();
  const theme = THEME_BY_ID[level.themeId] || THEMES[0];
  const best = profile.best[level.id] || { pct: 0, completed: false };
  $('heroPlayLabel').textContent = level.name.toUpperCase();
  $('nowTitle').textContent = level.name;
  $('nowDiff').textContent = (level.difficultyLabel || 'CUSTOM').toUpperCase();
  $('nowBest').textContent = `BEST ${Math.floor(best.pct || 0)}%`;
  $('nowBestBar').style.width = `${best.pct || 0}%`;
  const art = $('nowArt');
  art.style.background = `radial-gradient(circle at 54% 50%, ${hexA(theme.colors.accent, 0.3)}, transparent 48%), linear-gradient(120deg, ${theme.colors.top}, ${theme.colors.bottom} 64%, ${theme.colors.track})`;
  art.querySelector('.now-glyph').textContent = GLYPHS[theme.motif] || '◈';
  art.querySelector('.now-glyph').style.color = theme.colors.accent;
  art.querySelector('.now-ring').style.borderColor = hexA(theme.colors.accent, 0.55);
  $('statStars').textContent = starCount();
  $('statLevels').textContent = `${completedCount()}/${OFFICIAL_LEVELS.length}`;
  $('statAttempts').textContent = profile.totalAttempts || 0;
  $('worldProgress').textContent = `${Math.round((completedCount() / OFFICIAL_LEVELS.length) * 100)}%`;
}

function hexA(hex, a) {
  const c = hex.replace('#', '');
  const n = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ------------------------------------------------------------------ */
/* level select                                                        */
/* ------------------------------------------------------------------ */
function levelCard(level) {
  const theme = THEME_BY_ID[level.themeId] || THEMES[0];
  const best = profile.best[level.id] || { pct: 0, coins: 0, completed: false };
  const pct = Math.floor(best.pct || 0);
  const diff = level.difficultyLabel || 'Custom';
  const dc = DIFFICULTY_COLORS[diff] || '#ff72d2';
  const num = level.official ? pad2(level.number) : 'C';
  const stars = level.official ? level.stars : 0;
  const time = Math.round(level.length / level.speed);
  return `<button class="level-card" data-level-id="${esc(level.id)}" style="--c1:${theme.colors.top};--c2:${theme.colors.bottom};--ca:${theme.colors.accent};--dc:${dc}" title="${esc(level.desc || level.name)}">
    <div class="level-art">
      <span class="card-num">${num}</span>
      <span class="card-diff">${diff.toUpperCase()}</span>
      <span class="card-shape">${GLYPHS[theme.motif] || '◈'}</span>
      <span class="card-best ${best.completed ? 'done' : ''}">${best.completed ? '✓ COMPLETE' : `BEST ${pct}%`}</span>
    </div>
    <div class="level-info">
      <h3>${esc(level.name)}</h3>
      <p>${esc(theme.desc)}</p>
      <div class="card-progress"><i style="width:${pct}%"></i></div>
      <div class="card-stars"><span>${best.completed ? '✓ CLEARED' : `${time}s · ${theme.short}`}</span><b>★ ${stars || '—'}</b></div>
    </div>
  </button>`;
}

function renderLevels() {
  $('levelGrid').innerHTML = OFFICIAL_LEVELS.map(levelCard).join('');
  const grid = $('customGrid');
  const cards = customLevels.map(levelCard).join('');
  grid.innerHTML = cards + `<button class="level-card new-level-card" id="newLevelCard"><b>+</b><span>CREATE A NEW LEVEL</span></button>`;
  $('customSection').classList.remove('hidden');
  updateMenuUI();
}

function findLevel(id) {
  return OFFICIAL_LEVELS.find(l => l.id === id) || customLevels.find(l => l.id === id) || null;
}

/* ------------------------------------------------------------------ */
/* skins UI                                                            */
/* ------------------------------------------------------------------ */
function shade(hex, amt) {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
  const n = parseInt(full, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = clamp(Math.round(r + amt), 0, 255);
  g = clamp(Math.round(g + amt), 0, 255);
  b = clamp(Math.round(b + amt), 0, 255);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function drawSkin(cv, skinId, colors, big = false) {
  const skin = SKIN_BY_ID[skinId] || SKIN_BY_ID.classic;
  const ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h * (big ? 0.49 : 0.56);
  const s = Math.min(w, h) * (big ? 0.21 : 0.24);
  const p = colors.primary;
  const sec = colors.secondary;
  const glow = colors.glow;

  const rg = ctx.createRadialGradient(cx, cy, 2, cx, cy, s * 3.6);
  rg.addColorStop(0, hexA(glow, 0.33));
  rg.addColorStop(0.48, hexA(glow, 0.08));
  rg.addColorStop(1, hexA(glow, 0));
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);

  // floor shadow + orbit ring
  ctx.save();
  ctx.translate(cx, cy + s * 1.45);
  ctx.scale(1, 0.28);
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.35);
  sh.addColorStop(0, 'rgba(0,0,0,.6)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, s * 1.35, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.strokeStyle = hexA(sec, big ? 0.35 : 0.25);
  ctx.lineWidth = big ? 1.5 : 1;
  ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.5, s * 1.75, s * 0.42, -0.18, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = hexA(glow, 0.26);
  ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.5, s * 1.4, s * 1.45, 0.5, 0, Math.PI * 2); ctx.stroke();

  ctx.save();
  ctx.translate(cx, cy);
  const line = big ? 3 : 1.8;
  ctx.lineWidth = line;
  ctx.strokeStyle = sec;
  ctx.lineJoin = 'round';

  const poly = (pts, fill) => {
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
  };

  if (skin.shape === 'box') {
    const d = s;
    poly([[0, -d], [d * .95, -d * .5], [0, 0], [-d * .95, -d * .5]], shade(p, 45));
    poly([[-d * .95, -d * .5], [0, 0], [0, d * 1.1], [-d * .95, d * .55]], shade(p, -58));
    poly([[0, 0], [d * .95, -d * .5], [d * .95, d * .55], [0, d * 1.1]], p);
    ctx.strokeStyle = hexA(sec, .9); ctx.stroke();
  } else if (skin.shape === 'octa') {
    poly([[0, -s], [s * .86, 0], [0, 0]], shade(p, 38));
    poly([[0, -s], [-s * .86, 0], [0, 0]], shade(p, 5));
    poly([[0, 0], [s * .86, 0], [0, s]], shade(p, -45));
    poly([[0, 0], [-s * .86, 0], [0, s]], shade(p, -20));
  } else if (skin.shape === 'sphere') {
    const g = ctx.createRadialGradient(-s * .3, -s * .35, s * .05, 0, 0, s * 1.05);
    g.addColorStop(0, shade(p, 75)); g.addColorStop(.5, p); g.addColorStop(1, shade(p, -80));
    ctx.beginPath(); ctx.arc(0, 0, s * .95, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = hexA(sec, .25);
    ctx.beginPath(); ctx.ellipse(0, 0, s * .95, s * .3, -0.25, 0, Math.PI * 2); ctx.stroke();
  } else if (skin.shape === 'hex') {
    const pts = []; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; pts.push([Math.cos(a) * s, Math.sin(a) * s]); }
    poly(pts, p);
    ctx.strokeStyle = hexA(sec, .5);
    ctx.beginPath(); ctx.arc(0, 0, s * .55, 0, Math.PI * 2); ctx.stroke();
  } else if (skin.shape === 'star') {
    const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? s * .47 : s * 1.12; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    poly(pts, p);
    poly([[0, -s * .65], [s * .42, 0], [0, s * .65], [-s * .42, 0]], shade(p, 42));
  } else {
    poly([[0, -s * 1.08], [s * .82, s * .32], [0, s * .2], [-s * .82, s * .32]], p);
    poly([[0, s * .2], [s * .82, s * .32], [0, s * 1.02]], shade(p, -56));
    poly([[0, s * .2], [-s * .82, s * .32], [0, s * 1.02]], shade(p, -28));
  }

  // icon
  ctx.save();
  ctx.globalAlpha = 0.94;
  ctx.fillStyle = sec;
  ctx.strokeStyle = sec;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = sec;
  ctx.shadowBlur = big ? 16 : 8;
  ctx.font = `900 ${Math.round(s * (skin.shape === 'box' ? .8 : .68))}px Orbitron, Arial Black, sans-serif`;
  ctx.fillText(ICON_GLYPHS[skin.icon] || '◆', 0, s * .34);
  ctx.restore();
  ctx.restore();

  // sparkles
  ctx.fillStyle = hexA(sec, .55);
  const rng = mulberry32(skin.id.length * 999 + profile.primary.length);
  for (let i = 0; i < (big ? 14 : 5); i++) {
    const a = rng() * Math.PI * 2, r = s * (1.3 + rng() * 1.4);
    ctx.globalAlpha = .15 + rng() * .35;
    ctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r * .7, big ? 2 : 1, big ? 2 : 1);
  }
  ctx.globalAlpha = 1;
}

function renderSkinUI() {
  const skin = SKIN_BY_ID[profile.skin] || SKIN_BY_ID.classic;
  $('skinName').textContent = skin.name;
  $('skinNote').textContent = skin.note;
  $('primaryColor').value = profile.primary;
  $('secondaryColor').value = profile.secondary;
  $('glowColor').value = profile.glow;
  document.querySelectorAll('.color-field i').forEach((el, i) => {
    el.style.setProperty('--c', [profile.primary, profile.secondary, profile.glow][i]);
  });
  document.querySelector('.skin-preview-card')?.style.setProperty('--pv', profile.glow);
  drawSkin($('skinPreview'), profile.skin, profile, true);

  $('presetRow').innerHTML = COLOR_PRESETS.map((p, i) =>
    `<button class="preset-swatch" data-preset="${i}" style="--a:${p[0]};--b:${p[1]}" title="Preset ${i + 1}" aria-label="Color preset ${i + 1}"></button>`
  ).join('');

  $('skinGrid').innerHTML = SKINS.map(s => {
    const equipped = s.id === profile.skin;
    const colors = equipped ? profile : s;
    return `<button class="skin-card ${equipped ? 'equipped' : ''}" data-skin="${s.id}" style="--sa:${colors.primary}">
      ${equipped ? '<span class="equipped-tag">EQUIPPED</span>' : ''}
      <canvas width="190" height="150" data-skin-canvas="${s.id}"></canvas>
      <h4>${esc(s.name)}</h4><small>FREE ICON</small>
    </button>`;
  }).join('');
  document.querySelectorAll('[data-skin-canvas]').forEach(cv => {
    const s = SKIN_BY_ID[cv.dataset.skinCanvas];
    drawSkin(cv, s.id, s.id === profile.skin ? profile : s, false);
  });
}

function previewSkinColors() {
  const skin = SKIN_BY_ID[profile.skin] || SKIN_BY_ID.classic;
  $('skinName').textContent = skin.name;
  drawSkin($('skinPreview'), profile.skin, profile, true);
  document.querySelector('.skin-preview-card')?.style.setProperty('--pv', profile.glow);
  document.querySelectorAll('.color-field i').forEach((el, i) => {
    el.style.setProperty('--c', [profile.primary, profile.secondary, profile.glow][i]);
  });
}

function refreshWorldSkin() {
  if (!world.playerRoot) return;
  world.buildPlayer(profile);
  if (world.mode === 'menu') {
    if (world.trailMesh) world.trailMesh.visible = false;
    if (world.shadow) world.shadow.visible = true;
  } else if (world.mode === 'editor') {
    world.playerRoot.visible = false;
    if (world.shadow) world.shadow.visible = false;
    if (world.trailMesh) world.trailMesh.visible = false;
  }
}

function hslToHex(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  const hue = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < .5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue(p, q, h) * 255);
  const b = Math.round(hue(p, q, h - 1 / 3) * 255);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------------ */
/* start / play                                                        */
/* ------------------------------------------------------------------ */
function startLevel(level, options = {}) {
  if (!level) return;
  clearRunTimers();
  audio.unlock();
  currentLevel = level;
  currentRuntime = makeLevelRuntime(level);
  practice = options.practice ?? !!profile.practice;
  returnToEditor = !!options.returnToEditor;
  attempt = 1;
  lastCheckpoint = 4;
  nextCheckpoint = 94;
  checkpointNumber = 0;
  deathHandled = false;
  winHandled = false;
  elapsedTime = 0;
  runStartedAt = performance.now();
  jumpPointer = false;
  profile.lastPlayed = level.id;
  profile.totalAttempts = (profile.totalAttempts || 0) + 1;
  saveProfile();

  world.buildLevel(currentRuntime, profile);
  world.setMode('playing');
  state = 'playing';
  setScreen('none');
  document.body.classList.add('in-game');
  document.body.classList.remove('in-editor');
  $('hud').classList.remove('hidden');
  hideModals();
  updateHUD(true);
  $('jumpHint').style.opacity = '1';
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { $('jumpHint').style.opacity = '0'; }, 7000);
  audio.startMusic(currentRuntime.theme);
}

function setPractice(on) {
  practice = on;
  profile.practice = on;
  saveProfile();
  const t = $('practiceToggle');
  if (t) t.checked = on;
  $('hudPractice').classList.toggle('hidden', !on);
  if (on && (state === 'playing' || state === 'paused')) {
    lastCheckpoint = Math.max(4, Math.floor(world.player.z));
    checkpointNumber = Math.max(1, Math.floor((lastCheckpoint - 4) / 90));
    // Keep future checkpoints ahead of the position we just enabled practice at.
    nextCheckpoint = lastCheckpoint + 90;
    showCheckpoint();
  }
}

function retryRun(fromCheckpoint = false) {
  clearRunTimers();
  hideModals();
  if (!currentRuntime) return;
  attempt++;
  profile.totalAttempts = (profile.totalAttempts || 0) + 1;
  saveProfile();
  deathHandled = false;
  winHandled = false;
  if (fromCheckpoint && practice) {
    world.respawn(lastCheckpoint);
    world.setMode('playing');
  } else {
    world.resetRun(profile);
    world.setMode('playing');
    lastCheckpoint = 4;
    nextCheckpoint = 94;
    checkpointNumber = 0;
  }
  runStartedAt = performance.now();
  state = 'playing';
  document.body.classList.add('in-game');
  $('hud').classList.remove('hidden');
  $('hudPractice').classList.toggle('hidden', !practice);
  audio.unlock();
  audio.startMusic(currentRuntime.theme);
  updateHUD(true);
}

function quitRun(where = 'levels') {
  clearRunTimers();
  audio.stopMusic();
  hideModals();
  $('hud').classList.add('hidden');
  jumpPointer = false;
  currentRuntime = null;
  currentLevel = null;
  if (where === 'editor') {
    openEditor(false);
    return;
  }
  returnToEditor = false;
  if (where === 'menu') goMenu();
  else goLevels();
}

function elapsedString(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${pad2(s)}`;
}

function updateHUD(force = false) {
  if (!currentRuntime) return;
  const pct = clamp(world.getProgress(), 0, 100);
  $('hudProgressBar').style.width = `${pct}%`;
  $('hudProgressPct').textContent = `${Math.floor(pct)}%`;
  $('hudCoins').innerHTML = `<i></i> ${world.coins}/${world.coinsTotal}`;
  $('hudAttempts').textContent = `ATTEMPT ${attempt}`;
  if (force) {
    const theme = currentRuntime.theme;
    const dc = DIFFICULTY_COLORS[currentLevel.difficultyLabel] || theme.colors.accent;
    $('hudLevelNum').textContent = currentLevel.official ? pad2(currentLevel.number) : 'C';
    $('hudDiff').textContent = (currentLevel.difficultyLabel || 'CUSTOM').toUpperCase();
    $('hudDiff').style.color = dc;
    $('hudLevelName').textContent = currentLevel.name.toUpperCase();
    $('hudLevelName').style.color = theme.colors.text;
    $('hudProgressBar').style.background = `linear-gradient(90deg, ${theme.colors.accent}, ${theme.colors.accent2})`;
    $('hudProgressBar').style.boxShadow = `0 0 16px ${hexA(theme.colors.accent, .5)}`;
    $('hudPractice').classList.toggle('hidden', !practice);
  }
}

function showCheckpoint() {
  const el = $('checkpointToast');
  el.innerHTML = `CHECKPOINT <span>${checkpointNumber}</span>`;
  el.classList.remove('hidden');
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 1500);
}

function checkCheckpoints() {
  if (state !== 'playing' || !world.player.alive) return;
  if (world.player.z > nextCheckpoint && world.player.grounded) {
    lastCheckpoint = nextCheckpoint;
    checkpointNumber++;
    nextCheckpoint += 90;
    if (practice) showCheckpoint();
  }
}

function saveBest(pct, coins) {
  if (!currentLevel) return;
  const id = currentLevel.id;
  const prev = profile.best[id] || { pct: 0, coins: 0, completed: false, attempts: 0 };
  profile.best[id] = {
    ...prev,
    pct: Math.max(prev.pct || 0, Math.floor(pct)),
    coins: Math.max(prev.coins || 0, coins),
    completed: prev.completed || false,
    attempts: (prev.attempts || 0) + 1
  };
  saveProfile();
  updateMenuUI();
}

function handleDeath() {
  if (deathHandled) return;
  deathHandled = true;
  state = 'dead';
  world.setMode('dead');
  audio.stopMusic();
  jumpPointer = false;
  const pct = world.getProgress();
  saveBest(pct, world.coins);
  const best = profile.best[currentLevel.id] || { pct: 0 };
  $('deathAttempt').textContent = attempt;
  $('deathPct').textContent = Math.floor(pct);
  $('deathBar').style.width = `${pct}%`;
  $('deathBest').textContent = `BEST ${Math.floor(best.pct || 0)}%`;
  $('deathCoins').textContent = `${world.coins} / ${world.coinsTotal} COINS`;
  $('deathCheckpoint').textContent = practice ? `CHECKPOINT ${checkpointNumber || 1}` : 'NO CHECKPOINT';
  $('deathQuip').textContent = DEATH_QUIPS[Math.floor(Math.random() * DEATH_QUIPS.length)];
  $('retryBtn').innerHTML = practice ? 'RESPAWN AT CHECKPOINT <span>↻</span>' : 'TRY AGAIN <span>↻</span>';
  $('deathPracticeBtn').textContent = practice ? 'FULL RESTART' : 'PRACTICE MODE';
  $('deathQuitBtn').textContent = returnToEditor ? 'BACK TO EDITOR' : 'LEVEL SELECT';
  pendingModal = setTimeout(() => {
    pendingModal = null;
    if (state === 'dead') showModal('deathModal');
  }, 700);
}

function handleWin() {
  if (winHandled) return;
  winHandled = true;
  state = 'win';
  world.setMode('win');
  audio.stopMusic();
  jumpPointer = false;
  elapsedTime = (performance.now() - runStartedAt) / 1000;
  const id = currentLevel.id;
  const prev = profile.best[id] || { pct: 0, coins: 0, completed: false, attempts: 0 };
  profile.best[id] = {
    ...prev,
    pct: 100,
    coins: Math.max(prev.coins || 0, world.coins),
    completed: true,
    attempts: (prev.attempts || 0) + 1
  };
  saveProfile();
  $('winLevelName').textContent = currentLevel.name.toUpperCase();
  $('winCoins').textContent = `${world.coins}/${world.coinsTotal}`;
  $('winAttempts').textContent = attempt;
  $('winTime').textContent = elapsedString(elapsedTime);
  const stars = currentLevel.stars || 0;
  document.querySelector('.win-stars').textContent = '★'.repeat(stars) + '☆'.repeat(Math.max(0, 10 - stars));
  $('winSub').textContent = returnToEditor ? 'Your level works. Now make it meaner.' : getWinQuip();
  const next = nextOfficialLevel();
  if (returnToEditor) {
    $('nextBtn').innerHTML = 'BACK TO EDITOR <span>→</span>';
  } else if (next) {
    $('nextBtn').innerHTML = `NEXT: ${esc(next.shortName)} <span>→</span>`;
  } else {
    $('nextBtn').innerHTML = 'LEVEL SELECT <span>→</span>';
  }
  $('winLevelsBtn').textContent = returnToEditor ? 'EDIT LEVEL' : 'LEVEL SELECT';
  pendingModal = setTimeout(() => {
    pendingModal = null;
    if (state === 'win') showModal('winModal');
  }, 780);
  updateMenuUI();
}

function getWinQuip() {
  const quips = ['The grid bows. You are the geometry now.', 'Clean run. Questionable life choices, but clean.', '100%. The spikes are taking notes.', 'Another world conquered. No paywalls included.'];
  return quips[Math.floor(Math.random() * quips.length)];
}

function nextOfficialLevel() {
  if (!currentLevel || !currentLevel.official) return null;
  return OFFICIAL_LEVELS[OFFICIAL_LEVELS.findIndex(l => l.id === currentLevel.id) + 1] || null;
}

/* ------------------------------------------------------------------ */
/* editor                                                              */
/* ------------------------------------------------------------------ */
function openEditor(fresh = false) {
  clearRunTimers();
  audio.stopMusic();
  hideModals();
  $('hud').classList.add('hidden');
  returnToEditor = false;
  if (fresh) {
    editor.draft = generateCustomDraft(THEMES[Math.floor(Math.random() * THEMES.length)], Date.now() >>> 0);
    editor.viewZ = 48;
  } else if (!editor.draft) {
    const saved = safeParse(DRAFT_KEY, null);
    const normalized = saved ? normalizeLevel(saved) : null;
    editor.draft = normalized || generateCustomDraft(THEMES[0], 48271);
    if (!editor.draft || !editor.draft.events.length) editor.draft = generateCustomDraft(THEMES[0], 48271);
  }
  editor.draft.theme = THEME_BY_ID[editor.draft.themeId] || THEMES[0];
  editor.draft.events = editor.draft.events || [];
  if (!editor.draft.events.some(e => e.type === 'finish')) {
    editor.draft.events.push({ type: 'finish', lane: 0, z: editor.draft.length - 14 });
  }
  editor.draft.events.sort((a, b) => a.z - b.z || a.lane - b.lane);
  editor.viewZ = clamp(48, 12, editor.draft.length - 20);
  state = 'editor';
  document.body.classList.add('in-editor');
  document.body.classList.remove('in-game');
  setScreen('editor');
  world.buildEditor(editor.draft, profile);
  world.editorFocus = editor.viewZ;
  world.setMode('editor');
  fillEditorUI();
  selectTool(editor.tool);
  saveDraft(true);
}

function fillEditorUI() {
  const d = editor.draft;
  $('levelNameInput').value = d.name;
  $('themeSelect').innerHTML = THEMES.map(t => `<option value="${t.id}">${esc(t.name)} · ${t.difficulty}</option>`).join('');
  $('themeSelect').value = d.themeId;
  $('lengthRange').value = d.length;
  $('lengthValue').textContent = d.length;
  $('speedRange').value = d.speed;
  $('speedValue').textContent = Number(d.speed).toFixed(1);
  $('viewRange').max = Math.max(20, d.length - 10);
  $('viewRange').value = editor.viewZ;
  $('viewLabel').textContent = `Z ${Math.round(editor.viewZ)}`;
  $('finishLabel').textContent = `FINISH · ${Math.round((d.length / d.speed))}s`;
  updateThemeSwatch();
  updateEditorStats();
}

function updateThemeSwatch() {
  const t = THEME_BY_ID[editor.draft.themeId] || THEMES[0];
  const sw = $('themeSwatch').children;
  if (sw.length >= 3) {
    sw[0].style.setProperty('--sw', t.colors.accent);
    sw[1].style.setProperty('--sw', t.colors.accent2);
    sw[2].style.setProperty('--sw', t.colors.grid);
  }
  $('finishLabel').textContent = `FINISH · ${Math.round(editor.draft.length / editor.draft.speed)}s`;
}

function updateEditorStats() {
  const d = editor.draft;
  $('objectCount').textContent = d.events.filter(e => e.type !== 'finish').length;
  $('editorCoins').textContent = d.events.filter(e => e.type === 'coin').length;
}

function selectTool(tool) {
  editor.tool = tool;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  if (editor.hover) world.setCursor(editor.hover.lane, editor.hover.z, true, TOOL_COLORS[tool]);
}

function markDirty(rebuild = false) {
  $('editorSaved').textContent = 'UNSAVED CHANGES';
  $('editorSaved').classList.remove('saved');
  clearTimeout(editor.saveTimer);
  editor.saveTimer = setTimeout(() => saveDraft(), 650);
  if (rebuild) world.refreshEditor(editor.draft);
  updateEditorStats();
}

function saveDraft(immediate = false) {
  if (!editor.draft) return;
  editor.draft.theme = THEME_BY_ID[editor.draft.themeId] || THEMES[0];
  editor.draft.events.sort((a, b) => a.z - b.z || a.lane - b.lane);
  safeStore(DRAFT_KEY, editor.draft);
  if (immediate) $('editorSaved').textContent = 'SAVED LOCALLY';
  else $('editorSaved').textContent = 'SAVED LOCALLY';
  $('editorSaved').classList.add('saved');
}

function commitCustomLevel(silent = false) {
  const d = editor.draft;
  if (!d) return null;
  const cleaned = normalizeLevel(d);
  if (!cleaned) return null;
  const index = customLevels.findIndex(l => l.id === cleaned.id);
  if (index >= 0) customLevels[index] = cleaned;
  else customLevels.unshift(cleaned);
  editor.draft.id = cleaned.id;
  editor.draft.name = cleaned.name;
  persistCustomLevels();
  saveDraft(true);
  if (!silent) showToast('LEVEL SAVED TO YOUR LEVELS');
  return cleaned;
}

function pointToGrid(point) {
  if (!point) return null;
  const lane = laneFromX(point.x);
  if (lane < 0) return null;
  const z = snapZ(point.z);
  if (z < 8 || z > editor.draft.length - 2) return null;
  return { lane, z };
}

function placeObject(point, erase = false) {
  if (!editor.draft || !point) return;
  let { lane, z } = point;
  const tool = erase ? 'erase' : editor.tool;
  const events = editor.draft.events;

  if (erase) {
    const before = events.length;
    editor.draft.events = events.filter(e => {
      if (e.type === 'finish') return Math.abs(e.z - z) > 2.5;
      if (e.type === 'hurdle') return Math.abs(e.z - z) > 1.6;
      return !(Math.abs(e.z - z) < 1.5 && e.lane === lane);
    });
    if (before === editor.draft.events.length) return;
    markDirty(true);
    showToast('OBJECT REMOVED');
    return;
  }

  if (tool === 'finish') {
    lane = 0;
    editor.draft.events = events.filter(e => e.type !== 'finish');
    editor.draft.events.push({ type: 'finish', lane, z });
    if (z + 24 > editor.draft.length) {
      editor.draft.length = clamp(z + 40, 220, 1200);
      $('lengthRange').value = editor.draft.length;
      $('lengthValue').textContent = editor.draft.length;
      $('viewRange').max = Math.max(20, editor.draft.length - 10);
      world.buildEditor(editor.draft, profile);
      fillEditorUI();
    } else {
      markDirty(true);
    }
    saveDraft(true);
    commitCustomLevel(true);
    showToast('FINISH LINE MOVED');
    return;
  }

  // remove anything already in this cell
  editor.draft.events = events.filter(e => {
    if (tool === 'hurdle') return e.type !== 'hurdle' || Math.abs(e.z - z) > 1.2;
    return !(e.lane === lane && Math.abs(e.z - z) < 1.2 && e.type !== 'finish');
  });
  const newEvent = { type: tool, lane, z };
  if (tool === 'coin') {
    newEvent.y = editor.shift ? 2.35 : 1.15;
  }
  editor.draft.events.push(newEvent);
  editor.draft.events.sort((a, b) => a.z - b.z || a.lane - b.lane);
  markDirty(true);
  showToast(`${TOOL_LABELS[tool]} ADDED`);
}

function autoBuild() {
  if (!editor.draft) return;
  const theme = THEME_BY_ID[editor.draft.themeId] || THEMES[0];
  const seed = (Date.now() ^ Math.floor(Math.random() * 85000)) >>> 0;
  editor.draft.events = generateEvents({
    seed, difficulty: 0.5, length: editor.draft.length, speed: editor.draft.speed
  });
  if (!editor.draft.events.some(e => e.type === 'finish')) {
    editor.draft.events.push({ type: 'finish', lane: 0, z: editor.draft.length - 14 });
  }
  editor.draft.events.sort((a, b) => a.z - b.z || a.lane - b.lane);
  world.buildEditor(editor.draft, profile);
  world.editorFocus = editor.viewZ;
  fillEditorUI();
  saveDraft(true);
  commitCustomLevel(true);
  showToast('AUTO-BUILD COMPLETE — READY TO EDIT');
}

function exportLevel() {
  if (!editor.draft) return;
  const data = JSON.stringify({ ...editor.draft, theme: undefined }, null, 2);
  navigator.clipboard?.writeText(data).then(
    () => showToast('LEVEL JSON COPIED TO CLIPBOARD'),
    () => showToast('COPY FAILED — USE SAVE INSTEAD')
  );
}

function importLevel() {
  const raw = window.prompt('Paste a Geometry Dash 3D level JSON:');
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeLevel(parsed);
    if (!normalized) throw new Error('bad level');
    editor.draft = normalized;
    editor.draft.theme = THEME_BY_ID[normalized.themeId] || THEMES[0];
    editor.viewZ = 48;
    world.buildEditor(editor.draft, profile);
    fillEditorUI();
    selectTool(editor.tool);
    saveDraft(true);
    showToast('LEVEL IMPORTED');
  } catch {
    showToast('THAT JSON DID NOT PARSE');
  }
}

function testDraft() {
  if (!editor.draft) return;
  if (!editor.draft.events.some(e => e.type === 'finish')) {
    editor.draft.events.push({ type: 'finish', lane: 0, z: editor.draft.length - 14 });
  }
  saveDraft(true);
  const saved = commitCustomLevel(true) || normalizeLevel(editor.draft);
  if (!saved) return;
  saved.theme = THEME_BY_ID[saved.themeId];
  startLevel(saved, { returnToEditor: true, practice: false });
}

/* ------------------------------------------------------------------ */
/* input                                                               */
/* ------------------------------------------------------------------ */
function inTypingField(e) {
  return e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
}

window.addEventListener('keydown', e => {
  if (inTypingField(e)) {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  if (e.code === 'KeyM') { toggleMute(); return; }

  if (state === 'editor') {
    if (e.code === 'Escape') { e.preventDefault(); exitEditor(); return; }
    if (e.key === 'Shift') editor.shift = true;
    const map = { Digit1: 'spike', Digit2: 'block', Digit3: 'gate', Digit4: 'saw', Digit5: 'hurdle', Digit6: 'pad', Digit7: 'coin', Digit8: 'finish', KeyX: 'erase' };
    if (map[e.code]) { e.preventDefault(); selectTool(map[e.code]); return; }
    if (e.code === 'Delete' || e.code === 'Backspace') {
      e.preventDefault();
      if (editor.hover) placeObject(editor.hover, true);
      return;
    }
    return;
  }

  if (state === 'playing') {
    if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
      e.preventDefault();
      world.jump();
      return;
    }
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') { e.preventDefault(); world.moveLane(-1); return; }
    if (e.code === 'KeyD' || e.code === 'ArrowRight') { e.preventDefault(); world.moveLane(1); return; }
    if (e.code === 'Escape') { e.preventDefault(); togglePause(); return; }
    if (e.code === 'KeyR') { e.preventDefault(); retryRun(false); return; }
    return;
  }
  if (state === 'paused') {
    if (e.code === 'Escape') { e.preventDefault(); togglePause(); }
    return;
  }
  if (state === 'dead') {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); retryRun(practice); }
    if (e.code === 'Escape') { e.preventDefault(); quitRun(returnToEditor ? 'editor' : 'levels'); }
    return;
  }
  if (state === 'win') {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      if (returnToEditor) quitRun('editor');
      else if (nextOfficialLevel()) startLevel(nextOfficialLevel());
      else goLevels();
    }
    if (e.code === 'Escape') { e.preventDefault(); quitRun(returnToEditor ? 'editor' : 'levels'); }
    return;
  }
  if (state === 'menu' || state === 'levels' || state === 'skins') {
    if (e.code === 'Escape') {
      if (state !== 'menu') goMenu();
    }
    if (e.code === 'Enter' && state === 'menu') {
      startLevel(getLastLevel());
    }
  }
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
    world.releaseJump();
    jumpPointer = false;
  }
  if (e.key === 'Shift') editor.shift = false;
});

// pointer jumping / swipe
canvas.addEventListener('pointerdown', e => {
  if (state === 'playing') {
    if (jumpPointer) return;
    jumpPointer = true;
    world.jump();
    canvas.setPointerCapture?.(e.pointerId);
  }
});
canvas.addEventListener('pointerup', () => {
  if (state === 'playing') {
    jumpPointer = false;
    world.releaseJump();
  }
});
canvas.addEventListener('pointercancel', () => { jumpPointer = false; world.releaseJump(); });
canvas.addEventListener('contextmenu', e => { if (state === 'editor') e.preventDefault(); });

// touch controls (shown on narrow / coarse-pointer devices)
function bindTouchButton(id, down, up) {
  const el = $(id);
  if (!el) return;
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    if (state !== 'playing') return;
    down();
    if (up) el.setPointerCapture?.(e.pointerId);
  });
  if (up) {
    const release = e => {
      e?.preventDefault?.();
      jumpPointer = false;
      up();
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
  }
}
bindTouchButton('touchLeft', () => world.moveLane(-1));
bindTouchButton('touchRight', () => world.moveLane(1));
bindTouchButton('touchJump', () => { jumpPointer = true; world.jump(); }, () => world.releaseJump());

// editor pointer controls
canvas.addEventListener('pointermove', e => {
  if (state !== 'editor' || !editor.draft) return;
  const rect = canvas.getBoundingClientRect();
  scene.userData.canvasRect = rect;
  const point = world.pickTrack(e.clientX, e.clientY, camera);
  const g = pointToGrid(point);
  editor.hover = g;
  if (g) {
    world.setCursor(g.lane, g.z, true, TOOL_COLORS[editor.tool]);
    $('editorCursorInfo').textContent = `LANE ${g.lane + 1} · Z ${Math.round(g.z)} · ${TOOL_LABELS[editor.tool]}`;
  } else {
    world.setCursor(0, 0, false);
  }
});
canvas.addEventListener('pointerleave', () => {
  if (state === 'editor') world.setCursor(0, 0, false);
  editor.hover = null;
});
canvas.addEventListener('pointerdown', e => {
  if (state !== 'editor' || !editor.draft) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  scene.userData.canvasRect = rect;
  const point = world.pickTrack(e.clientX, e.clientY, camera);
  const g = pointToGrid(point);
  if (!g) return;
  placeObject(g, e.button === 2 || editor.tool === 'erase');
});
canvas.addEventListener('wheel', e => {
  if (state !== 'editor') return;
  e.preventDefault();
  editor.viewZ = clamp(editor.viewZ + Math.sign(e.deltaY) * 4.5, 10, editor.draft.length - 10);
  world.editorFocus = editor.viewZ;
  $('viewRange').value = editor.viewZ;
  $('viewLabel').textContent = `Z ${Math.round(editor.viewZ)}`;
}, { passive: false });

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  scene.userData.canvasRect = canvas.getBoundingClientRect();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

/* ------------------------------------------------------------------ */
/* UI bindings                                                         */
/* ------------------------------------------------------------------ */
document.addEventListener('click', e => {
  const nav = e.target.closest('[data-screen]');
  if (nav) {
    const target = nav.dataset.screen;
    if (target === 'menu') goMenu();
    else if (target === 'levels') goLevels();
    else if (target === 'skins') goSkins();
    else if (target === 'editor') openEditor();
    return;
  }
  const action = e.target.closest('[data-action]');
  if (action) {
    if (action.dataset.action === 'play') startLevel(getLastLevel());
    return;
  }
  const card = e.target.closest('[data-level-id]');
  if (card) {
    const level = findLevel(card.dataset.levelId);
    if (level) startLevel(level);
    return;
  }
  if (e.target.closest('#newLevelCard')) {
    openEditor(true);
    return;
  }
  const skinCard = e.target.closest('[data-skin]');
  if (skinCard) {
    const s = SKIN_BY_ID[skinCard.dataset.skin];
    if (s) {
      profile.skin = s.id;
      profile.primary = s.primary;
      profile.secondary = s.secondary;
      profile.glow = s.glow;
      saveProfile();
      renderSkinUI();
      refreshWorldSkin();
      showToast(`${s.name.toUpperCase()} EQUIPPED`);
    }
    return;
  }
  const preset = e.target.closest('[data-preset]');
  if (preset) {
    const p = COLOR_PRESETS[Number(preset.dataset.preset)];
    if (p) {
      [profile.primary, profile.secondary, profile.glow] = p;
      saveProfile();
      renderSkinUI();
      refreshWorldSkin();
    }
  }
});

$('soundBtn').addEventListener('click', toggleMute);
$('hudMuteBtn').addEventListener('click', toggleMute);

function toggleMute() {
  profile.muted = !profile.muted;
  audio.setMuted(profile.muted);
  saveProfile();
  if (!profile.muted && state === 'playing' && currentRuntime) {
    audio.startMusic(currentRuntime.theme);
  }
  showToast(profile.muted ? 'SOUND OFF' : 'SOUND ON');
}
function applyMuteUI() {
  document.body.classList.toggle('muted', !!profile.muted);
  $('hudMuteBtn').textContent = profile.muted ? '◖×' : '◖))';
}

$('pauseBtn').addEventListener('click', togglePause);
$('hudMuteBtn').addEventListener('click', e => e.stopPropagation());
$('resumeBtn').addEventListener('click', () => togglePause());
$('restartBtn').addEventListener('click', () => { hideModals(); retryRun(false); });
$('quitBtn').addEventListener('click', () => quitRun(returnToEditor ? 'editor' : 'levels'));
$('retryBtn').addEventListener('click', () => retryRun(practice));
$('deathPracticeBtn').addEventListener('click', () => {
  if (practice) {
    setPractice(false);
    retryRun(false);
  } else {
    setPractice(true);
    retryRun(true);
  }
});
$('deathQuitBtn').addEventListener('click', () => quitRun(returnToEditor ? 'editor' : 'levels'));
$('replayBtn').addEventListener('click', () => { hideModals(); retryRun(false); });
$('winLevelsBtn').addEventListener('click', () => quitRun(returnToEditor ? 'editor' : 'levels'));
$('nextBtn').addEventListener('click', () => {
  if (returnToEditor) { quitRun('editor'); return; }
  const next = nextOfficialLevel();
  if (next) startLevel(next);
  else goLevels();
});
$('practiceToggle').addEventListener('change', e => setPractice(e.target.checked));

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    world.setMode('paused');
    audio.stopMusic();
    world.releaseJump();
    $('pauseProgress').textContent = `${Math.floor(world.getProgress())}%`;
    $('pauseCoins').textContent = `${world.coins}/${world.coinsTotal}`;
    $('pauseAttempts').textContent = attempt;
    $('practiceToggle').checked = practice;
    showModal('pauseModal');
  } else if (state === 'paused') {
    hideModals();
    state = 'playing';
    world.setMode('playing');
    if (currentRuntime) audio.startMusic(currentRuntime.theme);
    updateHUD(true);
  }
}

/* editor buttons */
document.querySelectorAll('.tool-btn').forEach(btn => btn.addEventListener('click', () => selectTool(btn.dataset.tool)));
$('editorBackBtn').addEventListener('click', exitEditor);
$('saveBtn').addEventListener('click', () => {
  commitCustomLevel(false);
  saveDraft(true);
});
$('testBtn').addEventListener('click', testDraft);
$('generateBtn').addEventListener('click', autoBuild);
$('exportBtn').addEventListener('click', exportLevel);
$('importBtn').addEventListener('click', importLevel);
$('levelNameInput').addEventListener('input', e => {
  editor.draft.name = (e.target.value || 'UNTITLED').slice(0, 28);
  markDirty(false);
});
$('themeSelect').addEventListener('change', e => {
  editor.draft.themeId = e.target.value;
  editor.draft.theme = THEME_BY_ID[e.target.value] || THEMES[0];
  world.buildEditor(editor.draft, profile);
  world.editorFocus = editor.viewZ;
  updateThemeSwatch();
  saveDraft(true);
  commitCustomLevel(true);
});
$('lengthRange').addEventListener('input', e => {
  editor.draft.length = Number(e.target.value);
  $('lengthValue').textContent = editor.draft.length;
  $('viewRange').max = Math.max(20, editor.draft.length - 10);
  $('finishLabel').textContent = `FINISH · ${Math.round(editor.draft.length / editor.draft.speed)}s`;
});
$('lengthRange').addEventListener('change', () => {
  if (editor.draft.events.some(e => e.type === 'finish' && e.z > editor.draft.length - 6)) {
    const f = editor.draft.events.find(e => e.type === 'finish');
    f.z = editor.draft.length - 14;
  }
  world.buildEditor(editor.draft, profile);
  world.editorFocus = editor.viewZ;
  saveDraft(true);
  markDirty(false);
});
$('speedRange').addEventListener('input', e => {
  editor.draft.speed = Number(e.target.value);
  $('speedValue').textContent = editor.draft.speed.toFixed(1);
  saveDraft();
});
$('viewRange').addEventListener('input', e => {
  editor.viewZ = Number(e.target.value);
  world.editorFocus = editor.viewZ;
  $('viewLabel').textContent = `Z ${Math.round(editor.viewZ)}`;
});
$('viewBackBtn').addEventListener('click', () => { editor.viewZ = clamp(editor.viewZ - 25, 10, editor.draft.length - 10); world.editorFocus = editor.viewZ; $('viewRange').value = editor.viewZ; $('viewLabel').textContent = `Z ${Math.round(editor.viewZ)}`; });
$('viewForwardBtn').addEventListener('click', () => { editor.viewZ = clamp(editor.viewZ + 25, 10, editor.draft.length - 10); world.editorFocus = editor.viewZ; $('viewRange').value = editor.viewZ; $('viewLabel').textContent = `Z ${Math.round(editor.viewZ)}`; });

function exitEditor() {
  saveDraft(true);
  commitCustomLevel(true);
  clearTimeout(editor.saveTimer);
  audio.stopMusic();
  state = 'menu';
  currentLevel = null;
  currentRuntime = null;
  document.body.classList.remove('in-editor', 'in-game');
  world.buildShowcase(profile);
  world.setMode('menu');
  goMenu();
}

/* color input listeners */
let colorRaf = 0;
let worldSkinTimer = 0;
function onColorInput() {
  profile.primary = $('primaryColor').value;
  profile.secondary = $('secondaryColor').value;
  profile.glow = $('glowColor').value;
  saveProfile();
  cancelAnimationFrame(colorRaf);
  colorRaf = requestAnimationFrame(() => {
    previewSkinColors();
    const cv = document.querySelector(`[data-skin-canvas="${profile.skin}"]`);
    if (cv) drawSkin(cv, profile.skin, profile, false);
  });
  clearTimeout(worldSkinTimer);
  worldSkinTimer = setTimeout(refreshWorldSkin, 130);
}
['primaryColor', 'secondaryColor', 'glowColor'].forEach(id => $(id).addEventListener('input', onColorInput));

$('randomColorsBtn').addEventListener('click', () => {
  const h = Math.random() * 360;
  profile.primary = hslToHex(h, 82, 55);
  profile.secondary = Math.random() < .3 ? '#0b0b16' : hslToHex((h + 180) % 360, 35, 92);
  profile.glow = hslToHex((h + 8) % 360, 100, 62);
  saveProfile();
  renderSkinUI();
  refreshWorldSkin();
  showToast('NEW COLOR SIGNATURE GENERATED');
});

/* ------------------------------------------------------------------ */
/* loop                                                                */
/* ------------------------------------------------------------------ */
function resizeRect() { scene.userData.canvasRect = canvas.getBoundingClientRect(); }

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.045, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  gameElapsed += dt;
  world.update(dt, gameElapsed);

  if (state === 'playing') {
    updateHUD();
    checkCheckpoints();
    if (world.crashed) handleDeath();
    else if (world.finished) handleWin();
  } else if (state === 'paused' || state === 'dead' || state === 'win') {
    // environment keeps breathing while the world is frozen
  }
  renderer.render(scene, camera);
}

/* ------------------------------------------------------------------ */
/* boot                                                                */
/* ------------------------------------------------------------------ */
world.buildShowcase(profile);
world.setMode('menu');
updateMenuUI();
renderLevels();
renderSkinUI();
applyMuteUI();
resizeRect();

// query-param shortcuts are handy for sharing and testing
const params = new URLSearchParams(location.search);
if (params.get('screen') === 'levels') setTimeout(goLevels, 60);
else if (params.get('screen') === 'skins') setTimeout(goSkins, 60);
else if (params.get('screen') === 'editor') setTimeout(() => openEditor(), 60);

const requested = params.get('level');
if (requested) {
  const lv = findLevel(requested) || findLevel('official-' + requested);
  if (lv) setTimeout(() => startLevel(lv), 120);
}

setTimeout(() => $('loading').classList.add('done'), 420);
requestAnimationFrame(tick);

window.__GD3D = {
  get state() { return state; },
  get profile() { return profile; },
  get level() { return currentLevel; },
  get world() { return world; },
  startLevel,
  goMenu,
  goLevels,
  goSkins,
  openEditor,
  togglePause,
  retryRun,
  levels: OFFICIAL_LEVELS,
  customLevels: () => customLevels
};
