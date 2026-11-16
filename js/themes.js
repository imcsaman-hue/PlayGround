// Geometry Dash 3D — all original level themes, reinvented as neon 3D worlds.
// Every palette, skin and level is unlocked from the start. No shops, no ads.

export const THEMES = [
  {
    id: 'stereo', name: 'Stereo Madness', short: 'STEREO', difficulty: 'Easy', tier: 1,
    desc: 'Where every legend begins. A cyan skyline and a heartbeat kick.',
    colors: { top: '#031137', bottom: '#0069b6', fog: '#041f45', deep: '#020a18', track: '#061b38', grid: '#21d4fd', accent: '#00e5ff', accent2: '#ff3cac', text: '#bff6ff' },
    motif: 'city', bpm: 140, root: 45, scale: [0, 3, 5, 7, 10], speed: 13.2, length: 292, seed: 7411
  },
  {
    id: 'backontrack', name: 'Back On Track', short: 'BACK ON TRACK', difficulty: 'Easy', tier: 2,
    desc: 'The sequel that taught a generation to time every jump.',
    colors: { top: '#031a18', bottom: '#00a878', fog: '#04201d', deep: '#02100d', track: '#04241f', grid: '#43ffb0', accent: '#19f7a0', accent2: '#b7ff3c', text: '#c7ffe7' },
    motif: 'rings', bpm: 142, root: 47, scale: [0, 2, 3, 7, 10], speed: 13.5, length: 312, seed: 8123
  },
  {
    id: 'polargeist', name: 'Polargeist', short: 'POLARGEIST', difficulty: 'Normal', tier: 3,
    desc: 'Frozen geometry drifts through a violet polar night.',
    colors: { top: '#12062f', bottom: '#4b22a8', fog: '#170b3a', deep: '#090319', track: '#150b31', grid: '#a78bfa', accent: '#8b5cf6', accent2: '#67e8f9', text: '#e3d8ff' },
    motif: 'crystals', bpm: 145, root: 48, scale: [0, 2, 3, 7, 10], speed: 13.9, length: 334, seed: 1739
  },
  {
    id: 'dryout', name: 'Dry Out', short: 'DRY OUT', difficulty: 'Normal', tier: 4,
    desc: 'Dust, heat and a horizon the colour of molten glass.',
    colors: { top: '#310e04', bottom: '#ee7214', fog: '#431506', deep: '#1c0702', track: '#331207', grid: '#fb923c', accent: '#ff8a00', accent2: '#ffd166', text: '#ffe6c7' },
    motif: 'dunes', bpm: 138, root: 43, scale: [0, 3, 5, 7, 10], speed: 14.2, length: 352, seed: 3917
  },
  {
    id: 'baseafterbase', name: 'Base After Base', short: 'BASE AFTER BASE', difficulty: 'Normal', tier: 5,
    desc: 'A teal machine-world of moving hexes and hard edges.',
    colors: { top: '#03141f', bottom: '#0b6d8a', fog: '#051f2b', deep: '#021018', track: '#061d29', grid: '#22d3ee', accent: '#06b6d4', accent2: '#f43f5e', text: '#c4f7ff' },
    motif: 'hex', bpm: 148, root: 45, scale: [0, 2, 5, 7, 10], speed: 14.5, length: 368, seed: 5321
  },
  {
    id: 'cantletgo', name: "Can't Let Go", short: "CAN'T LET GO", difficulty: 'Hard', tier: 6,
    desc: 'Hot pink gravity. Hold on through the narrowest gates.',
    colors: { top: '#20082d', bottom: '#c21f75', fog: '#270a38', deep: '#120318', track: '#240a31', grid: '#ff6fd8', accent: '#ff2fb9', accent2: '#7c3aed', text: '#ffd6f4' },
    motif: 'rings', bpm: 150, root: 46, scale: [0, 2, 3, 7, 10], speed: 14.8, length: 384, seed: 6999
  },
  {
    id: 'jumper', name: 'Jumper', short: 'JUMPER', difficulty: 'Hard', tier: 7,
    desc: 'A golden rush of pure jump timing. No second chances.',
    colors: { top: '#241003', bottom: '#c66e04', fog: '#2b1403', deep: '#150902', track: '#261005', grid: '#ffb703', accent: '#ffcc00', accent2: '#fb5607', text: '#fff0b8' },
    motif: 'city', bpm: 152, root: 50, scale: [0, 2, 3, 7, 10], speed: 15.1, length: 396, seed: 4413
  },
  {
    id: 'timemachine', name: 'Time Machine', short: 'TIME MACHINE', difficulty: 'Hard', tier: 8,
    desc: 'Emerald clockwork spins backwards while you run forward.',
    colors: { top: '#04221b', bottom: '#059669', fog: '#06281f', deep: '#02130e', track: '#05241b', grid: '#6ee7b7', accent: '#10b981', accent2: '#fbbf24', text: '#d0ffe9' },
    motif: 'clocks', bpm: 146, root: 47, scale: [0, 2, 3, 7, 10], speed: 15.3, length: 412, seed: 8128
  },
  {
    id: 'cycles', name: 'Cycles', short: 'CYCLES', difficulty: 'Hard', tier: 9,
    desc: 'Round and round through a furnace of crimson dunes.',
    colors: { top: '#25050e', bottom: '#92102f', fog: '#2b0611', deep: '#130208', track: '#250610', grid: '#fb7185', accent: '#ff335f', accent2: '#fbbf24', text: '#ffd4dc' },
    motif: 'dunes', bpm: 155, root: 42, scale: [0, 2, 3, 7, 10], speed: 15.5, length: 426, seed: 2251
  },
  {
    id: 'xstep', name: 'xStep', short: 'XSTEP', difficulty: 'Hard', tier: 10,
    desc: 'Indigo corridors that fold into an impossible X.',
    colors: { top: '#110430', bottom: '#3730b8', fog: '#150838', deep: '#08021a', track: '#140631', grid: '#818cf8', accent: '#a78bfa', accent2: '#22d3ee', text: '#e3e0ff' },
    motif: 'hex', bpm: 150, root: 44, scale: [0, 2, 3, 7, 10], speed: 15.7, length: 442, seed: 5151
  },
  {
    id: 'clutterfunk', name: 'Clutterfunk', short: 'CLUTTERFUNK', difficulty: 'Insane', tier: 11,
    desc: 'Order collapses. Pink noise, blue static, beautiful chaos.',
    colors: { top: '#070d20', bottom: '#0c637d', fog: '#081126', deep: '#040712', track: '#0a1020', grid: '#f472b6', accent: '#fb7185', accent2: '#38bdf8', text: '#ffe0ef' },
    motif: 'clutter', bpm: 157, root: 45, scale: [0, 1, 5, 7, 8], speed: 15.9, length: 456, seed: 9047
  },
  {
    id: 'toe', name: 'Theory of Everything', short: 'THEORY OF EVERYTHING', difficulty: 'Insane', tier: 12,
    desc: 'A cosmic theorem in magenta and electric blue.',
    colors: { top: '#160523', bottom: '#a21353', fog: '#1a062b', deep: '#0d0215', track: '#190528', grid: '#e879f9', accent: '#d946ef', accent2: '#38bdf8', text: '#f7d6ff' },
    motif: 'orbit', bpm: 152, root: 43, scale: [0, 2, 3, 7, 10], speed: 16.1, length: 470, seed: 3141
  },
  {
    id: 'electroman', name: 'Electroman Adventures', short: 'ELECTROMAN', difficulty: 'Insane', tier: 13,
    desc: 'A high-voltage yellow joyride through electric towers.',
    colors: { top: '#191702', bottom: '#ad7503', fog: '#201d03', deep: '#0f0e01', track: '#1b1904', grid: '#facc15', accent: '#fde047', accent2: '#22d3ee', text: '#fff8c7' },
    motif: 'city', bpm: 160, root: 49, scale: [0, 3, 5, 7, 10], speed: 16.3, length: 486, seed: 2718
  },
  {
    id: 'clubstep', name: 'Clubstep', short: 'CLUBSTEP', difficulty: 'Demon', tier: 14,
    desc: 'The original nightmare. A black-red corridor of bad intentions.',
    colors: { top: '#120107', bottom: '#6b1414', fog: '#18020a', deep: '#090003', track: '#170208', grid: '#ef4444', accent: '#dc2626', accent2: '#f97316', text: '#ffc9c9' },
    motif: 'void', bpm: 162, root: 41, scale: [0, 1, 5, 6, 8], speed: 16.5, length: 502, seed: 6661
  },
  {
    id: 'electrodynamix', name: 'Electrodynamix', short: 'ELECTRODYNAMIX', difficulty: 'Insane', tier: 15,
    desc: 'Light-speed neon. The impossible rainbow at the end of the wire.',
    colors: { top: '#06051a', bottom: '#1d4ed8', fog: '#080720', deep: '#030210', track: '#07061b', grid: '#22d3ee', accent: '#a855f7', accent2: '#f43f5e', text: '#dbeafe' },
    motif: 'orbit', bpm: 165, root: 48, scale: [0, 2, 3, 7, 10], speed: 16.7, length: 516, seed: 8888
  },
  {
    id: 'hexagonforce', name: 'Hexagon Force', short: 'HEXAGON FORCE', difficulty: 'Insane', tier: 16,
    desc: 'Six-sided gravity. Amber light and deep teal shadows.',
    colors: { top: '#160d02', bottom: '#9a4607', fog: '#1c1103', deep: '#0c0601', track: '#1b0f04', grid: '#fbbf24', accent: '#f59e0b', accent2: '#14b8a6', text: '#fff0c2' },
    motif: 'hex', bpm: 158, root: 46, scale: [0, 2, 5, 7, 10], speed: 16.9, length: 530, seed: 3636
  },
  {
    id: 'blast', name: 'Blast Processing', short: 'BLAST PROCESSING', difficulty: 'Harder', tier: 17,
    desc: 'Render the world at 200%. Cyan streaks, pink crashes.',
    colors: { top: '#03171d', bottom: '#05758f', fog: '#041f27', deep: '#020d12', track: '#041b22', grid: '#22d3ee', accent: '#06b6d4', accent2: '#f472b6', text: '#c9faff' },
    motif: 'city', bpm: 168, root: 47, scale: [0, 2, 3, 7, 10], speed: 17.1, length: 544, seed: 1201
  },
  {
    id: 'toe2', name: 'Theory of Everything 2', short: 'THEORY OF EVERYTHING 2', difficulty: 'Demon', tier: 18,
    desc: 'The theorem collapses into a violet singularity.',
    colors: { top: '#180228', bottom: '#6413a8', fog: '#1d0432', deep: '#0c0118', track: '#190327', grid: '#c084fc', accent: '#a855f7', accent2: '#f472b6', text: '#f3d9ff' },
    motif: 'orbit', bpm: 162, root: 44, scale: [0, 1, 5, 6, 8], speed: 17.3, length: 558, seed: 7777
  },
  {
    id: 'dominator', name: 'Geometrical Dominator', short: 'GEOMETRICAL DOMINATOR', difficulty: 'Harder', tier: 19,
    desc: 'A living jungle of green geometry. It is watching you.',
    colors: { top: '#021b12', bottom: '#0c6b34', fog: '#03231a', deep: '#011008', track: '#032016', grid: '#4ade80', accent: '#22c55e', accent2: '#facc15', text: '#d9ffe4' },
    motif: 'crystals', bpm: 160, root: 45, scale: [0, 2, 3, 7, 10], speed: 17.5, length: 572, seed: 4242
  },
  {
    id: 'deadlocked', name: 'Deadlocked', short: 'DEADLOCKED', difficulty: 'Demon', tier: 20,
    desc: 'The final lock. Scarlet rage against a black universe.',
    colors: { top: '#100106', bottom: '#3d0707', fog: '#16020a', deep: '#070002', track: '#150208', grid: '#f87171', accent: '#ef4444', accent2: '#a855f7', text: '#ffd1d1' },
    motif: 'void', bpm: 170, root: 40, scale: [0, 1, 5, 6, 8], speed: 17.7, length: 586, seed: 9999
  },
  {
    id: 'fingerdash', name: 'Fingerdash', short: 'FINGERDASH', difficulty: 'Insane', tier: 21,
    desc: 'One finger, one rhythm, one more attempt. Always one more.',
    colors: { top: '#220802', bottom: '#ad3709', fog: '#290a03', deep: '#120401', track: '#230904', grid: '#fb923c', accent: '#f97316', accent2: '#e11d48', text: '#ffe0c9' },
    motif: 'dunes', bpm: 172, root: 48, scale: [0, 3, 5, 7, 10], speed: 17.9, length: 600, seed: 1987
  },
  {
    id: 'dash', name: 'Dash', short: 'DASH', difficulty: 'Insane', tier: 22,
    desc: 'The newest classic, reimagined in three dimensions.',
    colors: { top: '#04221f', bottom: '#0e8f83', fog: '#052a26', deep: '#021310', track: '#04241f', grid: '#5eead4', accent: '#2dd4bf', accent2: '#fb7185', text: '#ccfff8' },
    motif: 'rings', bpm: 174, root: 47, scale: [0, 2, 3, 7, 10], speed: 18.1, length: 614, seed: 2022
  }
];

export const THEME_BY_ID = Object.fromEntries(THEMES.map(t => [t.id, t]));

export const DIFFICULTY_COLORS = {
  Easy: '#42f5a7', Normal: '#46c8ff', Hard: '#ffd166',
  Harder: '#ff9f43', Insane: '#ff5fa2', Demon: '#ff3d3d'
};

export const SKINS = [
  { id: 'classic', name: 'Classic', shape: 'box', icon: 'square', primary: '#2ee6ff', secondary: '#ffffff', glow: '#00d9ff', note: 'The one that started it all.' },
  { id: 'bolt', name: 'Voltage', shape: 'box', icon: 'bolt', primary: '#ffe14d', secondary: '#2b1a00', glow: '#ffd000', note: 'Pure electrical confidence.' },
  { id: 'skull', name: 'Bonehead', shape: 'box', icon: 'skull', primary: '#f2f4ff', secondary: '#1a1830', glow: '#8f9bff', note: 'Dead inside, fast outside.' },
  { id: 'ninja', name: 'Shadow', shape: 'octa', icon: 'ninja', primary: '#2d3047', secondary: '#ff3cac', glow: '#ff2fb9', note: 'Silent. Sharp. Unbothered.' },
  { id: 'orb', name: 'Plasma Orb', shape: 'sphere', icon: 'orb', primary: '#a855f7', secondary: '#e9d5ff', glow: '#c084fc', note: 'A little bit of cosmic energy.' },
  { id: 'hex', name: 'Hexcore', shape: 'hex', icon: 'hex', primary: '#22d3ee', secondary: '#072b33', glow: '#67e8f9', note: 'Six sides of pure focus.' },
  { id: 'star', name: 'Superstar', shape: 'star', icon: 'star', primary: '#ffb703', secondary: '#fff3b0', glow: '#ffd166', note: 'Main character energy.' },
  { id: 'shard', name: 'Glacier', shape: 'shard', icon: 'shard', primary: '#bdefff', secondary: '#0a3a57', glow: '#7dd3fc', note: 'Cold, clear and very sharp.' },
  { id: 'alien', name: 'Xeno', shape: 'box', icon: 'alien', primary: '#7CFF6B', secondary: '#0d2b0a', glow: '#5eff48', note: 'Not from this dimension.' },
  { id: 'heart', name: 'Pulse', shape: 'box', icon: 'heart', primary: '#ff4d8d', secondary: '#3b0717', glow: '#ff2f78', note: 'Runs on pure adrenaline.' },
  { id: 'crown', name: 'Royal', shape: 'octa', icon: 'crown', primary: '#f6d365', secondary: '#4a3200', glow: '#ffdf70', note: 'Built for the leaderboard.' },
  { id: 'void', name: 'Voidwalker', shape: 'shard', icon: 'void', primary: '#241433', secondary: '#ff335f', glow: '#ff1f4f', note: 'The space between attempts.' }
];

export const SKIN_BY_ID = Object.fromEntries(SKINS.map(s => [s.id, s]));

export const COLOR_PRESETS = [
  ['#2ee6ff', '#ffffff', '#00d9ff'], ['#ff4d8d', '#2b0614', '#ff2f78'],
  ['#ffe14d', '#2a1c00', '#ffd000'], ['#7CFF6B', '#0d2b0a', '#5eff48'],
  ['#a855f7', '#f3e8ff', '#c084fc'], ['#ff8a00', '#1e0a02', '#ffb703'],
  ['#f6d365', '#3b2900', '#ffdf70'], ['#5eead4', '#032c27', '#2dd4bf'],
  ['#f2f4ff', '#171426', '#8f9bff'], ['#ff335f', '#14030a', '#ff1f4f']
];
