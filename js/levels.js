import { THEMES, THEME_BY_ID } from './themes.js';

// The run camera looks down +Z, which mirrors world X on screen. Order the
// lanes so lane 0 is visually left and lane 2 is visually right.
export const LANES = [2.75, 0, -2.75];
export const TRACK_WIDTH = 9.2;
export const GRID = 2.4;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickLanes(n, rng) {
  return shuffle([0, 1, 2], rng).slice(0, n);
}

export const OFFICIAL_LEVELS = THEMES.map((theme, i) => {
  const difficulty = 0.07 + (i / (THEMES.length - 1)) * 0.93;
  return {
    id: 'official-' + theme.id,
    number: i + 1,
    name: theme.name,
    shortName: theme.short,
    themeId: theme.id,
    difficulty,
    difficultyLabel: theme.difficulty,
    tier: theme.tier,
    stars: Math.min(10, i + 1),
    speed: theme.speed,
    length: theme.length,
    seed: theme.seed,
    desc: theme.desc,
    official: true
  };
});

export const LEVELS = OFFICIAL_LEVELS;

/**
 * Procedural-but-seeded level architect. It only emits patterns that are
 * solvable with jump + three-lane movement. Every row containing a tall gate
 * leaves at least one lane open.
 */
export function generateEvents(level) {
  const rng = mulberry32(level.seed || 123456);
  const diff = Math.max(0, Math.min(1, level.difficulty ?? 0.35));
  const speed = level.speed || 14;
  const finishZ = level.length - 14;
  const events = [];
  const occupied = new Map();
  // Minimum distance between two unavoidable rows. A jump takes ~0.76s and
  // covers 0.76 * speed units; leaving less than this creates a dead zone
  // where the player can neither clear both rows nor land and jump again.
  const safeGap = speed * 0.92 + 2.5;
  let lastForcedZ = -Infinity;

  const key = z => Math.round(z * 10) / 10;
  function add(type, lane, z, extra = {}) {
    const k = key(z);
    if (!occupied.has(k)) occupied.set(k, []);
    const row = occupied.get(k);
    if (row.includes(lane) && type !== 'coin') return false;
    row.push(lane);
    events.push({ type, lane, z: Math.round(z * 100) / 100, ...extra });
    return true;
  }
  function coin(lane, z, y = 1.15) { add('coin', lane, z, { y }); }
  function safeLane(blocked, rng) {
    const open = [0, 1, 2].filter(l => !blocked.includes(l));
    return open.length ? open[Math.floor(rng() * open.length)] : Math.floor(rng() * 3);
  }

  // A friendly coin line in the opening runway.
  coin(1, 12, 0.9);
  coin(1, 15.2, 0.9);
  coin(1, 18.4, 0.9);

  let z = 28;
  let guard = 0;
  let lastPattern = '';

  while (z < finishZ - 20 && guard++ < 120) {
    const gapBase = 13.4 - diff * 4.8;
    const gap = Math.max(7.2, gapBase * (0.86 + rng() * 0.38));
    let roll = rng();
    let pattern;
    if (diff < 0.3) {
      pattern = roll < 0.3 ? 'single' : roll < 0.5 ? 'block' : roll < 0.66 ? 'gate' :
        roll < 0.8 ? 'hurdle' : roll < 0.9 ? 'saw' : 'coinArc';
    } else if (diff < 0.62) {
      pattern = roll < 0.22 ? 'single' : roll < 0.4 ? 'block' : roll < 0.56 ? 'gate' :
        roll < 0.69 ? 'hurdle' : roll < 0.79 ? 'saw' : roll < 0.9 ? 'pad' : 'coinArc';
    } else {
      pattern = roll < 0.16 ? 'single' : roll < 0.3 ? 'block' : roll < 0.46 ? 'gate' :
        roll < 0.57 ? 'hurdle' : roll < 0.67 ? 'saw' : roll < 0.78 ? 'triple' :
        roll < 0.88 ? 'pad' : roll < 0.94 ? 'slalom' : 'coinArc';
    }
    if (pattern === lastPattern && pattern !== 'single' && rng() < 0.28) pattern = 'single';
    lastPattern = pattern;

    if (pattern === 'single') {
      const n = diff < 0.22 ? 1 : diff < 0.58 ? (rng() < 0.58 ? 1 : 2) : (rng() < 0.42 ? 2 : 3);
      // A full three-lane spike row is a forced jump, exactly like a triple.
      // Reserve the same breathing room so two walls can never land inside the
      // narrow slice of a jump arc where neither bounce can clear them.
      if (n === 3) {
        z = Math.max(z, lastForcedZ + safeGap);
        if (z > finishZ - 18) break;
        lastForcedZ = z;
      }
      const lanes = pickLanes(n, rng);
      lanes.forEach(l => add('spike', l, z));
      if (n < 3) coin(safeLane(lanes, rng), z, 0.95);
      else coin(1, z, 2.35);
      z += gap;
    } else if (pattern === 'block') {
      const n = diff < 0.45 ? 1 : (rng() < 0.55 ? 1 : 2);
      const lanes = pickLanes(n, rng);
      lanes.forEach(l => add('block', l, z));
      if (rng() < 0.55) coin(lanes[0], z, 2.65);
      else coin(safeLane(lanes, rng), z, 0.95);
      z += gap;
    } else if (pattern === 'gate') {
      const n = diff < 0.55 ? 1 : (rng() < 0.55 ? 1 : 2);
      const lanes = pickLanes(n, rng);
      lanes.forEach(l => add('gate', l, z));
      coin(safeLane(lanes, rng), z, 1.05);
      z += gap + 1.2;
    } else if (pattern === 'hurdle') {
      z = Math.max(z, lastForcedZ + safeGap);
      if (z > finishZ - 18) break;
      add('hurdle', 0, z);
      coin(1, z, 2.3);
      lastForcedZ = z;
      z += gap + 1.5;
    } else if (pattern === 'saw') {
      const n = diff < 0.55 ? 1 : (rng() < 0.65 ? 1 : 2);
      const lanes = pickLanes(n, rng);
      lanes.forEach(l => add('saw', l, z));
      if (n < 3) coin(safeLane(lanes, rng), z, 0.95);
      z += gap;
    } else if (pattern === 'triple') {
      z = Math.max(z, lastForcedZ + safeGap);
      if (z > finishZ - 18) break;
      [0, 1, 2].forEach(l => add('spike', l, z));
      coin(1, z, 2.45);
      coin(1, z + 4, 2.45);
      lastForcedZ = z;
      z += gap + 2.2;
    } else if (pattern === 'pad') {
      z = Math.max(z, lastForcedZ + safeGap);
      if (z > finishZ - 22) break;
      const lane = Math.floor(rng() * 3);
      add('pad', lane, z);
      [0, 1, 2].forEach(l => add('spike', l, z + 12));
      for (let i = 0; i < 3; i++) coin(lane, z + 8.5 + i * 3.4, 2.4);
      lastForcedZ = z + 12;
      z += 31;
    } else if (pattern === 'slalom') {
      const openA = Math.floor(rng() * 3);
      const blockedA = [0, 1, 2].filter(l => l !== openA);
      blockedA.forEach(l => add('gate', l, z));
      const openB = (openA + (rng() < 0.5 ? 1 : 2)) % 3;
      const blockedB = [0, 1, 2].filter(l => l !== openB);
      blockedB.forEach(l => add('gate', l, z + gap + 2));
      coin(openA, z, 1.05);
      coin(openB, z + gap + 2, 1.05);
      z += gap * 2 + 8;
    } else {
      // Coin arc in an otherwise empty stretch.
      const lane = Math.floor(rng() * 3);
      for (let i = 0; i < 4; i++) coin(lane, z + i * 3.4, 1.15 + Math.sin(i / 3 * Math.PI) * 1.1);
      z += 20;
    }
  }

  // Some patterns (notably slalom and the pad spike wall) can project hazards
  // past the point where the loop's entrance check stopped. Clear a generous
  // run-in so nothing can ambush the player on the finish portal.
  const clearFinishZ = finishZ - 12;
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (ev.type === 'coin' || ev.type === 'finish') continue;
    if (ev.z > clearFinishZ) events.splice(i, 1);
  }

  // Guaranteed breather and a last reward before the portal.
  const rewardZ = finishZ - 26;
  coin(1, rewardZ, 1.1);
  coin(0, rewardZ + 3.5, 1.6);
  coin(2, rewardZ + 7, 1.1);
  // Push directly: the occupancy map may still hold a culled hazard row.
  events.push({ type: 'finish', lane: 0, z: finishZ });

  events.sort((a, b) => a.z - b.z || a.lane - b.lane);
  return events;
}

export function makeLevelRuntime(level) {
  const events = level.events || generateEvents(level);
  const finish = events.find(e => e.type === 'finish');
  return {
    ...level,
    events,
    finishZ: finish ? finish.z : level.length - 14,
    coinsTotal: events.filter(e => e.type === 'coin').length,
    theme: THEME_BY_ID[level.themeId] || THEMES[0]
  };
}

export function snapZ(z) {
  return Math.max(0, Math.round(z / GRID) * GRID);
}

export function laneFromX(x) {
  let best = 0;
  let bestD = Infinity;
  LANES.forEach((lx, i) => {
    const d = Math.abs(x - lx);
    if (d < bestD) { bestD = d; best = i; }
  });
  return bestD < 3.1 ? best : -1;
}

export function generateCustomDraft(theme, seed = Date.now()) {
  const length = 430;
  const events = generateEvents({
    seed: seed >>> 0,
    difficulty: 0.48,
    length,
    speed: theme.speed || 15
  });
  return {
    id: 'draft-' + (seed >>> 0),
    name: 'My Level',
    themeId: theme.id,
    length,
    speed: theme.speed || 15,
    difficulty: 0.48,
    events,
    official: false,
    custom: true
  };
}
