import * as THREE from '../vendor/three.module.js';
import { LANES, TRACK_WIDTH, GRID, mulberry32 } from './levels.js';
import { SKIN_BY_ID } from './themes.js';

const GROUND_Y = 0.58;
const GRAVITY = 37;
const JUMP_V = 14.1;
const PAD_V = 20.5;
const PLAYER_HALF = 0.55;

/* ------------------------------------------------------------------ */
/* textures & shared geometry                                          */
/* ------------------------------------------------------------------ */

const iconCache = new Map();
function iconTexture(name) {
  if (iconCache.has(name)) return iconCache.get(name);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.translate(128, 128);
  x.fillStyle = '#fff';
  x.strokeStyle = '#fff';
  x.lineWidth = 14;
  x.lineJoin = 'round';
  x.lineCap = 'round';
  const poly = pts => {
    x.beginPath();
    pts.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py));
    x.closePath(); x.fill();
  };
  if (name === 'square') {
    x.lineWidth = 12; x.strokeRect(-64, -64, 128, 128);
    x.fillRect(-28, -28, 56, 56);
  } else if (name === 'bolt') {
    poly([[18, -96], [-44, 6], [-4, 6], [-22, 96], [48, -18], [8, -18]]);
  } else if (name === 'skull') {
    x.beginPath(); x.arc(0, -18, 62, 0, Math.PI * 2); x.fill();
    x.fillRect(-38, 22, 76, 54);
    x.globalCompositeOperation = 'destination-out';
    x.beginPath(); x.arc(-23, -22, 18, 0, Math.PI * 2); x.arc(23, -22, 18, 0, Math.PI * 2); x.fill();
    x.fillRect(-24, 34, 10, 30); x.fillRect(-6, 34, 12, 26); x.fillRect(14, 34, 10, 30);
    x.globalCompositeOperation = 'source-over';
  } else if (name === 'ninja') {
    x.beginPath(); x.arc(0, 0, 68, 0, Math.PI * 2); x.fill();
    x.globalCompositeOperation = 'destination-out';
    x.fillRect(-78, -34, 156, 20);
    x.beginPath(); x.ellipse(-26, 10, 15, 9, 0.1, 0, Math.PI * 2); x.ellipse(26, 10, 15, 9, -0.1, 0, Math.PI * 2); x.fill();
    x.globalCompositeOperation = 'source-over';
  } else if (name === 'orb') {
    x.lineWidth = 10;
    for (let r = 22; r <= 84; r += 20) { x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.stroke(); }
    x.beginPath(); x.arc(0, 0, 15, 0, Math.PI * 2); x.fill();
  } else if (name === 'hex') {
    const pts = []; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; pts.push([Math.cos(a) * 82, Math.sin(a) * 82]); }
    poly(pts);
    x.globalCompositeOperation = 'destination-out';
    x.beginPath(); x.arc(0, 0, 44, 0, Math.PI * 2); x.fill();
    x.globalCompositeOperation = 'source-over';
    x.beginPath(); x.arc(0, 0, 26, 0, Math.PI * 2); x.fill();
  } else if (name === 'star') {
    const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? 38 : 92; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    poly(pts);
  } else if (name === 'shard') {
    poly([[0, -100], [62, -4], [0, 100], [-62, -4]]);
    x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.moveTo(0, -42); x.lineTo(24, -4); x.lineTo(0, 34); x.lineTo(-24, -4); x.closePath(); x.fill(); x.globalCompositeOperation = 'source-over';
  } else if (name === 'alien') {
    x.beginPath(); x.ellipse(0, 10, 66, 82, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.moveTo(-34, -58); x.lineTo(-52, -100); x.lineTo(-12, -72); x.fill();
    x.beginPath(); x.moveTo(34, -58); x.lineTo(52, -100); x.lineTo(12, -72); x.fill();
    x.globalCompositeOperation = 'destination-out';
    x.beginPath(); x.ellipse(-25, 18, 15, 27, 0.35, 0, Math.PI * 2); x.ellipse(25, 18, 15, 27, -0.35, 0, Math.PI * 2); x.fill();
    x.globalCompositeOperation = 'source-over';
  } else if (name === 'heart') {
    x.beginPath();
    x.moveTo(0, 82);
    x.bezierCurveTo(-36, 44, -92, 6, -78, -42);
    x.bezierCurveTo(-66, -84, -12, -86, 0, -42);
    x.bezierCurveTo(12, -86, 66, -84, 78, -42);
    x.bezierCurveTo(92, 6, 36, 44, 0, 82);
    x.fill();
  } else if (name === 'crown') {
    poly([[-86, 54], [-86, -48], [-40, -4], [0, -72], [40, -4], [86, -48], [86, 54]]);
    x.fillRect(-86, 60, 172, 22);
  } else {
    x.lineWidth = 12;
    x.beginPath(); x.arc(0, 0, 68, 0, Math.PI * 1.65); x.stroke();
    x.beginPath(); x.moveTo(54, 58); x.lineTo(92, 92); x.stroke();
    x.beginPath(); x.arc(0, 0, 20, 0, Math.PI * 2); x.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  iconCache.set(name, tex);
  return tex;
}

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.28, 'rgba(255,255,255,.62)');
  g.addColorStop(0.65, 'rgba(255,255,255,.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

let portalTex = null;
function portalTexture() {
  if (portalTex) return portalTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,.95)');
  g.addColorStop(.18, 'rgba(255,255,255,.32)');
  g.addColorStop(.5, 'rgba(255,255,255,.10)');
  g.addColorStop(.9, 'rgba(255,255,255,.06)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(255,255,255,.6)';
  for (let i = 0; i < 4; i++) { x.lineWidth = 2 + i; x.beginPath(); x.arc(128, 128, 48 + i * 22, 0, Math.PI * 2); x.stroke(); }
  portalTex = new THREE.CanvasTexture(c);
  portalTex.colorSpace = THREE.SRGBColorSpace;
  return portalTex;
}

let finishTex = null;
function finishTexture() {
  if (finishTex) return finishTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    x.fillStyle = (i + j) % 2 ? '#fff' : '#111';
    x.fillRect(i * 16, j * 16, 16, 16);
  }
  finishTex = new THREE.CanvasTexture(c);
  finishTex.colorSpace = THREE.SRGBColorSpace;
  finishTex.wrapS = finishTex.wrapT = THREE.RepeatWrapping;
  finishTex.repeat.set(5, 1);
  return finishTex;
}

const spikesGeo = new THREE.ConeGeometry(0.72, 1.45, 4);
const blockGeo = new THREE.BoxGeometry(1.7, 1.7, 1.7);
const gateGeo = new THREE.BoxGeometry(1.78, 3.5, 0.55);
const coinGeo = new THREE.TorusGeometry(0.4, 0.105, 9, 24);
const padGeo = new THREE.CylinderGeometry(0.78, 0.94, 0.15, 24);
const hurdleGeo = new THREE.BoxGeometry(TRACK_WIDTH - 0.3, 0.2, 0.34);
const starGeo = (() => {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const r = i % 2 ? 0.5 : 0.82;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) s.moveTo(px, py); else s.lineTo(px, py);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.46, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1 });
  g.center();
  return g;
})();
const sawGeo = (() => {
  const s = new THREE.Shape();
  const teeth = 16;
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const r = i % 2 ? 0.72 : 0.98;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) s.moveTo(px, py); else s.lineTo(px, py);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: false });
  g.center();
  return g;
})();

const edgeCache = new Map();
function edgesFor(geo) {
  if (!edgeCache.has(geo)) edgeCache.set(geo, new THREE.EdgesGeometry(geo));
  return edgeCache.get(geo);
}

const SKIN_SHAPES = {
  box: new THREE.BoxGeometry(1.08, 1.08, 1.08),
  octa: new THREE.OctahedronGeometry(0.8),
  sphere: new THREE.IcosahedronGeometry(0.72, 1),
  hex: new THREE.CylinderGeometry(0.68, 0.68, 1.08, 6),
  star: starGeo,
  shard: new THREE.TetrahedronGeometry(0.9)
};

/* ------------------------------------------------------------------ */
/* particles                                                           */
/* ------------------------------------------------------------------ */
class Particles {
  constructor(scene) {
    this.max = 260;
    this.pos = new Float32Array(this.max * 3);
    this.col = new Float32Array(this.max * 3);
    this.vel = new Float32Array(this.max * 3);
    this.life = new Float32Array(this.max);
    this.cursor = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const m = new THREE.PointsMaterial({
      size: 0.23, vertexColors: true, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (let i = 0; i < this.max; i++) this.pos[i * 3 + 1] = -100;
  }

  burst(origin, color, count = 70, force = 8, upward = 3) {
    const c = new THREE.Color(color);
    for (let n = 0; n < count; n++) {
      const i = this.cursor++ % this.max;
      this.pos[i * 3] = origin.x + (Math.random() - 0.5) * 0.5;
      this.pos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.5;
      this.pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.5;
      this.vel[i * 3] = (Math.random() - 0.5) * force;
      this.vel[i * 3 + 1] = Math.random() * force * 0.75 + upward;
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * force;
      this.life[i] = 0.7 + Math.random() * 0.8;
      this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  trail(origin, color) {
    const i = this.cursor++ % this.max;
    this.pos[i * 3] = origin.x;
    this.pos[i * 3 + 1] = origin.y;
    this.pos[i * 3 + 2] = origin.z;
    this.vel[i * 3] = (Math.random() - 0.5) * 0.35;
    this.vel[i * 3 + 1] = Math.random() * 0.5;
    this.vel[i * 3 + 2] = -1 - Math.random();
    this.life[i] = 0.26 + Math.random() * 0.2;
    const c = new THREE.Color(color);
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -100;
        this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0;
        continue;
      }
      this.vel[i * 3 + 1] -= 9 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const f = Math.min(1, this.life[i] * 1.8);
      const base = this.col[i * 3];
      this.col[i * 3] = base * 0.985; this.col[i * 3 + 1] *= 0.985; this.col[i * 3 + 2] *= 0.985;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    for (let i = 0; i < this.max; i++) this.pos[i * 3 + 1] = -100;
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ */
/* world                                                               */
/* ------------------------------------------------------------------ */
export class World {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.environment = new THREE.Group();
    this.objects = new THREE.Group();
    this.playerRoot = new THREE.Group();
    this.root.add(this.environment, this.objects, this.playerRoot);
    this.animated = [];
    this.eventObjects = [];
    this.materials = [];
    this.elapsed = 0;
    this.mode = 'menu';
    this.profile = null;
    this.theme = null;
    this.runtime = null;
    this.coins = 0;
    this.coinsTotal = 0;
    this.crashed = false;
    this.finished = false;
    this.shake = 0;
    this.editorFocus = 40;
    this.trailHistory = [];
    this.trailSample = 0;
    this.camLook = new THREE.Vector3(0, 1.5, 10);
    this.camPos = new THREE.Vector3(2.5, 5, -4);
    this.raycaster = new THREE.Raycaster();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.02);
    this.particles = new Particles(scene);
    this.player = this.makePlayerState();
    this.lights = this.makeLights();
    this.buildPlayer(null);
    this.finishGroup = null;
    this.setupSky();
    this.showcase = false;
  }

  makeLights() {
    const hemi = new THREE.HemisphereLight(0x88bbff, 0x111122, 1.1);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(-20, 35, -20);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(18, 12, 40);
    this.scene.add(rim);
    const ambient = new THREE.AmbientLight(0x334466, 0.65);
    this.scene.add(ambient);
    return { hemi, key, rim, ambient };
  }

  makePlayerState() {
    return {
      x: 0, y: GROUND_Y, z: 4, lane: 1, targetX: 0, vy: 0,
      grounded: true, angle: 0, spin: 0, jumpHeld: false,
      tilt: 0, squash: 1, alive: true, startZ: 4
    };
  }

  setupSky() {
    this.skyUniforms = {
      topColor: { value: new THREE.Color('#031137') },
      bottomColor: { value: new THREE.Color('#0069b6') },
      offset: { value: 40 },
      exponent: { value: 0.9 },
      time: { value: 0 }
    };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: this.skyUniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: `varying vec3 vWorldPosition;
          void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vWorldPosition = wp.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; uniform float time; varying vec3 vWorldPosition;
          void main(){
            float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
            float t = pow(max(h, 0.0), exponent);
            vec3 col = mix(bottomColor, topColor, t);
            float band = smoothstep(0.55, 0.58, fract(vWorldPosition.y * 0.006 + time * 0.004)) - smoothstep(0.6, 0.63, fract(vWorldPosition.y * 0.006 + time * 0.004));
            col += band * 0.025;
            gl_FragColor = vec4(col, 1.0);
          }`
      })
    );
    this.scene.add(this.sky);
    this.stars = null;
    this.sun = null;
  }

  material(key, color, emissive = color, intensity = 0.7, opts = {}) {
    if (this.matCache && this.matCache.has(key)) return this.matCache.get(key);
    const m = new THREE.MeshStandardMaterial({
      color, emissive, emissiveIntensity: intensity,
      metalness: opts.metalness ?? 0.35, roughness: opts.roughness ?? 0.42,
      flatShading: !!opts.flat, transparent: !!opts.transparent,
      opacity: opts.opacity ?? 1, side: opts.side || THREE.FrontSide
    });
    if (opts.noCache) { this.materials.push(m); return m; }
    if (!this.matCache) this.matCache = new Map();
    this.matCache.set(key, m);
    this.materials.push(m);
    return m;
  }

  clear() {
    this.root.remove(this.environment, this.objects, this.playerRoot);
    this.environment = new THREE.Group();
    this.objects = new THREE.Group();
    this.playerRoot = new THREE.Group();
    this.root.add(this.environment, this.objects, this.playerRoot);
    if (this.finishGroup) this.environment.remove(this.finishGroup);
    this.finishGroup = null;
    this.animated = [];
    this.eventObjects = [];
    for (const m of this.materials) { try { m.dispose(); } catch {} }
    this.materials = [];
    this.matCache = new Map();
    if (this.stars) { this.scene.remove(this.stars); this.stars = null; }
    if (this.sun) { this.scene.remove(this.sun); this.sun = null; }
    this.particles.clear();
    this.trailHistory = [];
    this.trailSample = 0;
    this.crashed = false;
    this.finished = false;
    this.coins = 0;
    this.coinsTotal = 0;
    this.shake = 0;
    if (this.trailMesh) { this.root.remove(this.trailMesh); this.trailMesh = null; }
    if (this.shadow) { this.root.remove(this.shadow); this.shadow = null; }
    if (this.cursor) { this.root.remove(this.cursor); this.cursor = null; }
    this.finishTorus = null;
    this.finishInner = null;
    this.decorGroup = null;
  }

  /* ------------------------- environment ------------------------- */
  applyTheme(theme, length) {
    this.theme = theme;
    this.scene.background = new THREE.Color(theme.colors.top);
    this.scene.fog = new THREE.Fog(theme.colors.fog, 58, 225);
    this.skyUniforms.topColor.value.set(theme.colors.top);
    this.skyUniforms.bottomColor.value.set(theme.colors.bottom);
    this.lights.hemi.color.set(theme.colors.grid);
    this.lights.hemi.groundColor.set(theme.colors.deep);
    this.lights.key.color.set(theme.colors.text);
    this.lights.rim.color.set(theme.colors.accent2);
    this.lights.ambient.color.set(theme.colors.fog);
    this.matCache = new Map();
    this.makeStars(length, theme);
  }

  makeStars(length, theme) {
    const count = 1100;
    const pos = new Float32Array(count * 3);
    const rng = mulberry32(8701 + length);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rng() - 0.5) * 380;
      pos[i * 3 + 1] = 3 + rng() * 160;
      pos[i * 3 + 2] = -80 + rng() * (length + 300);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: theme.colors.text, size: 0.55, transparent: true, opacity: 0.68, fog: false, depthWrite: false });
    this.stars = new THREE.Points(g, m);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  buildEnvironment(theme, length, options = {}) {
    this.applyTheme(theme, length);
    const env = this.environment;
    const c = theme.colors;

    // giant sun / halo
    const sunMat = new THREE.SpriteMaterial({ map: glowTexture(), color: c.accent, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.sun = new THREE.Sprite(sunMat);
    this.sun.position.set(-55, 36 + Math.sin(length) * 8, length * 0.52);
    this.sun.scale.set(92, 92, 1);
    this.scene.add(this.sun);

    // side ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(420, length + 260),
      new THREE.MeshStandardMaterial({ color: c.deep, roughness: 0.9, metalness: 0.1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -1.0, length / 2 - 40);
    env.add(ground);
    this.materials.push(ground.material);

    const grid = new THREE.GridHelper(420, 105, c.grid, c.fog);
    grid.position.set(0, -0.96, length / 2 - 40);
    grid.material.transparent = true;
    grid.material.opacity = 0.16;
    grid.material.depthWrite = false;
    env.add(grid);
    this.materials.push(grid.material);

    // track base
    const trackMat = this.material('track', c.track, c.fog, 0.35, { metalness: 0.5, roughness: 0.55 });
    const track = new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH, 0.75, length + 130), trackMat);
    track.position.set(0, -0.38, length / 2 - 30);
    env.add(track);

    // lane dividers
    const lineMat = this.material('lane', c.grid, c.grid, 1.2, { transparent: true, opacity: 0.4, noCache: true });
    lineMat.transparent = true; lineMat.opacity = 0.42;
    for (const x of [-1.38, 1.38]) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.03, length + 120), lineMat);
      line.position.set(x, 0.012, length / 2 - 30);
      env.add(line);
    }
    // outer rails
    const railMat = this.material('rail', c.accent, c.accent, 1.05, { metalness: 0.7, roughness: 0.2, noCache: true });
    for (const x of [-TRACK_WIDTH / 2, TRACK_WIDTH / 2]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, length + 120), railMat);
      rail.position.set(x, 0.08, length / 2 - 30);
      env.add(rail);
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, length + 120), this.material('side', c.accent2, c.accent2, 0.7, { transparent: true, opacity: 0.24, noCache: true }));
      side.position.set(x + Math.sign(x) * 0.14, -0.8, length / 2 - 30);
      env.add(side);
    }

    // track panels
    const panelMat = this.material('panel', c.grid, c.grid, 0.6, { transparent: true, opacity: 0.14, noCache: true });
    panelMat.transparent = true; panelMat.opacity = 0.13;
    const panelGeo = new THREE.BoxGeometry(TRACK_WIDTH - 0.25, 0.02, 0.06);
    const count = Math.ceil((length + 100) / 12);
    const panels = new THREE.InstancedMesh(panelGeo, panelMat, count);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      m4.setPosition(0, 0.018, -30 + i * 12);
      panels.setMatrixAt(i, m4);
    }
    env.add(panels);

    // start marker
    const startMat = this.material('start', c.accent2, c.accent2, 1.5, { noCache: true });
    const start = new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH, 0.035, 0.18), startMat);
    start.position.set(0, 0.02, 7);
    env.add(start);

    this.buildDecor(theme, length);
    this.buildFinishPortal(theme, options.finishZ ?? (length - 14));
    if (options.editor) {
      if (this.decorGroup) this.decorGroup.visible = false;
      if (this.sun) this.sun.visible = false;
      this.buildEditorGrid(length);
    }

    // outer beacons
    const beaconMat = this.material('beacon', c.accent, c.accent, 1.8, { noCache: true });
    for (let z = 18; z < length; z += 42) {
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 0.1), beaconMat);
        post.position.set(side * 5.4, 1.25, z);
        env.add(post);
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), beaconMat);
        orb.position.set(side * 5.4, 2.55, z);
        env.add(orb);
      }
    }
  }

  buildDecor(theme, length) {
    const env = this.environment;
    const decor = new THREE.Group();
    env.add(decor);
    this.decorGroup = decor;
    const c = theme.colors;
    const rng = mulberry32(theme.seed + 99);
    const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, spin = 0.1) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.scale.set(sx, sy, sz);
      decor.add(m);
      if (spin) this.animated.push({ obj: m, spin, baseY: y, bob: rng() * 2, amp: 0.2 + rng() * 0.5 });
      return m;
    };
    const dark = this.material('decorDark', c.deep, c.fog, 0.3, { roughness: 0.6, metalness: 0.45 });
    const accent = this.material('decorAccent', c.accent, c.accent, 1.35, { roughness: 0.25, metalness: 0.65 });
    const accent2 = this.material('decorAccent2', c.accent2, c.accent2, 1.35, { roughness: 0.25, metalness: 0.65 });
    const glass = this.material('decorGlass', c.grid, c.grid, 0.8, { transparent: true, opacity: 0.18, roughness: 0.1, metalness: 0.9 });

    const ring = (x, y, z, radius, tube, mat, rx = 0, ry = 0, rz = 0, spin = 0.05) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 64), mat);
      m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
      decor.add(m);
      this.animated.push({ obj: m, spin, baseY: y, bob: rng() * 3, amp: 0.5 });
      return m;
    };

    if (theme.motif === 'city') {
      for (let i = 0; i < 36; i++) {
        const side = i % 2 ? 1 : -1;
        const z = 8 + rng() * (length + 40);
        const h = 3 + rng() * 19;
        const w = 1.2 + rng() * 4.4;
        const x = side * (9 + rng() * 25);
        add(new THREE.BoxGeometry(w, h, w), dark, x, h / 2 - 1.1, z, 1, 1, 1, 0.02);
        const strip = add(new THREE.BoxGeometry(w * 0.72, 0.07, 0.04), accent, x, h * 0.62 - 1.1, z - side * w / 2 - 0.02, 1, 1, 1, 0);
        if (rng() < 0.5) add(new THREE.BoxGeometry(0.07, h * 0.32, 0.04), accent2, x + w * 0.22, h * 0.34 - 1.1, z - side * w / 2 - 0.03, 1, 1, 1, 0);
      }
      for (let i = 0; i < 10; i++) {
        const side = i % 2 ? 1 : -1;
        ring(side * (13 + rng() * 30), 7 + rng() * 25, 20 + rng() * length, 2.5 + rng() * 6, 0.06, accent2, 0, rng() * 3, 0, 0.15);
      }
    } else if (theme.motif === 'rings') {
      for (let i = 0; i < 12; i++) {
        const side = i % 2 ? 1 : -1;
        ring(side * (19 + rng() * 28), 9 + rng() * 18, 15 + (i / 12) * (length + 60) + rng() * 20,
          5 + rng() * 11, 0.10 + rng() * 0.16, i % 3 ? accent : accent2, rng() * 1.2, rng() * 2, rng() * 1.5, 0.12 + rng() * 0.1);
      }
      for (let i = 0; i < 20; i++) {
        const side = i % 2 ? 1 : -1;
        add(new THREE.OctahedronGeometry(0.6 + rng() * 2.2), glass, side * (9 + rng() * 30), 3 + rng() * 22, 5 + rng() * length, 1, 1, 1, 0.4 + rng() * 0.4);
      }
    } else if (theme.motif === 'crystals') {
      const shardMat = this.material('crystal', c.accent, c.accent, 0.85, { transparent: true, opacity: 0.72, roughness: 0.1, metalness: 0.5 });
      for (let i = 0; i < 34; i++) {
        const side = i % 2 ? 1 : -1;
        const h = 2 + rng() * 16;
        const z = 8 + rng() * (length + 30);
        add(new THREE.ConeGeometry(0.8 + rng() * 2.5, h, 5), i % 3 ? shardMat : glass,
          side * (8.5 + rng() * 22), h / 2 - 1, z, 1, 1, 1, 0.02);
      }
      for (let i = 0; i < 18; i++) {
        add(new THREE.OctahedronGeometry(0.5 + rng() * 1.6), accent2, (rng() - 0.5) * 70, 4 + rng() * 25, 5 + rng() * length, 1, 1, 1, 0.5);
      }
    } else if (theme.motif === 'dunes') {
      for (let i = 0; i < 26; i++) {
        const side = i % 2 ? 1 : -1;
        const h = 2 + rng() * 9;
        const w = 5 + rng() * 12;
        add(new THREE.ConeGeometry(w, h, 3), dark, side * (15 + rng() * 30), h / 2 - 1.2, rng() * (length + 60), 1, 1, 1, 0);
        if (i % 3 === 0) add(new THREE.BoxGeometry(w * 0.9, 0.06, 0.08), accent, side * (15 + rng() * 30), h * 0.6, rng() * (length + 60), 1, 1, 1, 0);
      }
      for (let i = 0; i < 8; i++) {
        ring((i % 2 ? 30 : -30) + (rng() - .5) * 10, 12 + rng() * 16, 20 + rng() * length, 3 + rng() * 5, 0.07, accent2, 1.2, 0, 0, 0.1);
      }
    } else if (theme.motif === 'hex') {
      for (let i = 0; i < 24; i++) {
        const side = i % 2 ? 1 : -1;
        const h = 5 + rng() * 24;
        const r = 1.2 + rng() * 4.5;
        add(new THREE.CylinderGeometry(r, r, h, 6), i % 4 ? dark : glass,
          side * (11 + rng() * 24), h / 2 - 1.2, 8 + rng() * (length + 30), 1, 1, 1, 0.02);
        if (i % 3 === 0) add(new THREE.TorusGeometry(r * 0.85, 0.06, 5, 6), accent, side * (11 + rng() * 24), h * 0.7, 8 + rng() * length, 1, 1, 1, 0.15);
      }
      for (let i = 0; i < 16; i++) {
        add(new THREE.CylinderGeometry(1 + rng() * 2.8, 1 + rng() * 2.8, 0.15, 6), accent2,
          (rng() - 0.5) * 66, 5 + rng() * 24, 5 + rng() * length, 1, 1, 1, 0.2 + rng() * 0.3);
      }
    } else if (theme.motif === 'orbit') {
      for (let i = 0; i < 9; i++) {
        const side = i % 2 ? 1 : -1;
        const x = side * (20 + rng() * 26);
        const y = 9 + rng() * 21;
        const z = 12 + rng() * (length + 30);
        const r = 1.8 + rng() * 4.2;
        add(new THREE.IcosahedronGeometry(r, 1), i % 3 ? dark : accent, x, y, z, 1, 1, 1, 0.07);
        ring(x, y, z, r * 2.0, 0.06, i % 2 ? accent2 : accent, 0.9 + rng(), rng(), 0, 0.12);
        add(new THREE.SphereGeometry(r * 0.18, 10, 10), accent2, x + r * 1.9, y + r * 0.2, z, 1, 1, 1, 0.5);
      }
      for (let i = 0; i < 22; i++) {
        add(new THREE.OctahedronGeometry(0.25 + rng() * 0.7), accent, (rng() - 0.5) * 50, 2 + rng() * 30, rng() * length, 1, 1, 1, 0.4);
      }
    } else if (theme.motif === 'clocks') {
      for (let i = 0; i < 3; i++) {
        const side = i % 2 ? 1 : -1;
        const z = 30 + i * (length / 3);
        const x = side * 22;
        const y = 16;
        ring(x, y, z, 9, 0.13, accent, 0, Math.PI / 2, 0, 0.03);
        for (let t = 0; t < 12; t++) {
          const a = t / 12 * Math.PI * 2;
          const tick = add(new THREE.BoxGeometry(0.18, 1.1, 0.18), accent2,
            x + Math.cos(a) * 7.4, y + Math.sin(a) * 7.4, z, 1, 1, 1, 0);
          tick.rotation.z = a;
        }
      }
      for (let i = 0; i < 20; i++) {
        add(new THREE.BoxGeometry(0.8 + rng() * 2, 0.12, 0.8 + rng() * 2), glass, (rng() - 0.5) * 80, 4 + rng() * 22, rng() * length, 1, 1, 1, 0.02);
      }
    } else if (theme.motif === 'void') {
      for (let i = 0; i < 28; i++) {
        const side = i % 2 ? 1 : -1;
        const h = 6 + rng() * 32;
        const z = 8 + rng() * (length + 40);
        const x = side * (9 + rng() * 25);
        add(new THREE.BoxGeometry(1.2 + rng() * 4, h, 1.2 + rng() * 4), dark, x, h / 2 - 1.2, z, 1, 1, 1, 0.01);
        add(new THREE.BoxGeometry(0.09, h * 0.8, 0.09), accent, x + (rng() - .5) * 3, h * 0.5, z + 0.5, 1, 1, 1, 0);
      }
      ring(0, 24, length * 0.55, 30, 0.16, accent, 0, 0, 0, 0.02);
      for (let i = 0; i < 24; i++) {
        add(new THREE.BoxGeometry(1 + rng() * 2.2, 1 + rng() * 2.2, 0.3), accent2, (rng() - 0.5) * 82, 3 + rng() * 33, 5 + rng() * length, 1, 1, 1, 0.08 + rng() * 0.2);
      }
    } else {
      // clutter — intentionally ordered chaos
      const colors = [accent, accent2, glass, dark];
      for (let i = 0; i < 60; i++) {
        const geo = i % 3 === 0 ? new THREE.BoxGeometry(1 + rng() * 4, 1 + rng() * 4, 1 + rng() * 4) :
          i % 3 === 1 ? new THREE.TetrahedronGeometry(0.8 + rng() * 2.6) : new THREE.TorusGeometry(1 + rng() * 3, 0.12, 6, 18);
        add(geo, colors[i % 4], (rng() - 0.5) * 88, 3 + rng() * 34, 5 + rng() * length, 1, 1, 1, 0.1 + rng() * 0.35);
      }
    }

    // ambient dust cubes flanking every track
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1;
      add(new THREE.BoxGeometry(0.35, 0.35, 0.35), accent2, side * (6.4 + rng() * 6), 1 + rng() * 9, 10 + rng() * length, 1, 1, 1, 0.5);
    }
  }

  buildFinishPortal(theme, finishZ) {
    const c = theme.colors;
    const g = new THREE.Group();
    g.position.set(0, 0, finishZ);
    const torus = new THREE.Mesh(new THREE.TorusGeometry(4.55, 0.14, 10, 80),
      this.material('finishRing', c.accent2, c.accent2, 2.2, { metalness: 0.6, roughness: 0.2 }));
    torus.position.y = 4.0;
    g.add(torus);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(4.4, 64),
      new THREE.MeshBasicMaterial({ map: portalTexture(), color: c.accent, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    inner.position.y = 4.0;
    g.add(inner);
    this.materials.push(inner.material);
    for (const side of [-1, 1]) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.26, 4.0, 0.45), this.material('pylon', c.accent, c.accent, 1.8, {}));
      pylon.position.set(side * 4.6, 2.0, 0);
      g.add(pylon);
    }
    const line = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_WIDTH, 2.4), new THREE.MeshBasicMaterial({ map: finishTexture(), transparent: true, opacity: 0.92 }));
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.03;
    g.add(line);
    this.materials.push(line.material);
    // label pillars
    this.environment.add(g);
    this.finishGroup = g;
    this.finishTorus = torus;
    this.finishInner = inner;
  }

  /* ------------------------- obstacles ------------------------- */
  makeEventVisual(ev) {
    const theme = this.theme;
    const c = theme.colors;
    const group = new THREE.Group();
    const laneX = LANES[ev.lane] ?? 0;
    group.position.set(laneX, 0, ev.z);
    const edgeMat = this.material('edge', c.accent, c.accent, 1.5, { noCache: false });
    const edge2Mat = this.material('edge2', c.accent2, c.accent2, 1.7, { noCache: false });
    const darkMat = this.material('obstacleDark', '#070911', c.fog, 0.25, { metalness: 0.55, roughness: 0.36 });
    let obj = null;

    if (ev.type === 'spike') {
      const m = new THREE.Mesh(spikesGeo, this.material('spike', c.accent, c.accent, 1.1, { roughness: 0.28, metalness: 0.5 }));
      m.position.y = 0.725;
      group.add(m);
      const e = new THREE.LineSegments(edgesFor(spikesGeo), this.material('spikeEdge', c.text, c.text, 1.8, { noCache: true }));
      e.position.y = 0.725;
      group.add(e);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: c.accent, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.set(2.3, 2.3, 1); glow.position.y = 0.55;
      group.add(glow);
      this.materials.push(glow.material);
      obj = group;
    } else if (ev.type === 'block') {
      const m = new THREE.Mesh(blockGeo, darkMat);
      m.position.y = 0.85;
      group.add(m);
      const e = new THREE.LineSegments(edgesFor(blockGeo), edgeMat);
      e.position.y = 0.85;
      group.add(e);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.04), edge2Mat);
      plate.position.set(0, 0.85, -0.87);
      group.add(plate);
      obj = group;
    } else if (ev.type === 'gate') {
      const m = new THREE.Mesh(gateGeo, darkMat);
      m.position.y = 1.75;
      group.add(m);
      const e = new THREE.LineSegments(edgesFor(gateGeo), edge2Mat);
      e.position.y = 1.75;
      group.add(e);
      for (let i = 0; i < 3; i++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.06), edge2Mat);
        bar.position.set(0, 0.6 + i * 1.1, -0.3);
        group.add(bar);
      }
      obj = group;
    } else if (ev.type === 'saw') {
      const m = new THREE.Mesh(sawGeo, this.material('saw', c.accent2, c.accent2, 1.2, { metalness: 0.8, roughness: 0.22 }));
      m.position.y = 1.18;
      group.add(m);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 12), this.material('hub', '#ffffff', c.text, 1.2, { noCache: true }));
      hub.rotation.x = Math.PI / 2; hub.position.y = 1.18;
      group.add(hub);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: c.accent2, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.set(3.4, 3.4, 1); glow.position.y = 1.18;
      group.add(glow); this.materials.push(glow.material);
      this.animated.push({ obj: m, spin: 9, baseY: 1.18, bob: 0, amp: 0, axis: 'z' });
      obj = group;
    } else if (ev.type === 'hurdle') {
      group.position.x = 0;
      const m = new THREE.Mesh(hurdleGeo, this.material('hurdle', c.accent2, c.accent2, 1.9, { noCache: true }));
      m.position.y = 1.12;
      group.add(m);
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 0.16), darkMat);
        post.position.set(side * (TRACK_WIDTH / 2 - 0.22), 0.55, 0);
        group.add(post);
      }
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: c.accent2, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.set(TRACK_WIDTH, 2.8, 1); glow.position.y = 1.12;
      group.add(glow); this.materials.push(glow.material);
      obj = group;
    } else if (ev.type === 'pad') {
      const base = new THREE.Mesh(padGeo, this.material('pad', c.accent2, c.accent2, 1.8, { metalness: 0.4, roughness: 0.25 }));
      base.position.y = 0.09;
      group.add(base);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.34, 4), this.material('padArrow', c.text, c.text, 1.5, { noCache: true }));
      arrow.position.y = 0.3;
      group.add(arrow);
      obj = group;
      this.animated.push({ obj: base, spin: 1.4, baseY: 0.09, bob: 0, amp: 0, axis: 'y' });
    } else if (ev.type === 'coin') {
      group.position.set(laneX, ev.y, ev.z);
      const m = new THREE.Mesh(coinGeo, this.material('coin', '#ffd166', '#ffb703', 1.6, { metalness: 0.9, roughness: 0.15 }));
      group.add(m);
      const e = new THREE.LineSegments(edgesFor(coinGeo), this.material('coinEdge', '#fff5cc', '#fff5cc', 2, { noCache: true }));
      group.add(e);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffd166', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.set(2.1, 2.1, 1);
      group.add(glow); this.materials.push(glow.material);
      this.animated.push({ obj: group, spin: 3, baseY: ev.y, bob: 1, amp: 0.15, axis: 'y' });
      obj = group;
    } else if (ev.type === 'finish') {
      return null;
    }
    if (!obj) return null;
    this.objects.add(group);
    return group;
  }

  spawnEvents(events) {
    this.eventObjects = [];
    for (const ev of events) {
      if (ev.type === 'finish') continue;
      const group = this.makeEventVisual(ev);
      if (group) {
        this.eventObjects.push({ ...ev, group, baseY: group.position.y, collected: false, taken: false });
      }
    }
  }

  /* ------------------------- player ------------------------- */
  buildPlayer(profile) {
    if (profile) this.profile = profile;
    const p = this.profile || {
      skin: 'classic', primary: '#2ee6ff', secondary: '#ffffff', glow: '#00d9ff'
    };
    // remove old
    while (this.playerRoot.children.length) this.playerRoot.remove(this.playerRoot.children[0]);
    const skin = SKIN_BY_ID[p.skin] || SKIN_BY_ID.classic;
    const geo = SKIN_SHAPES[skin.shape] || SKIN_SHAPES.box;
    const primaryMat = new THREE.MeshStandardMaterial({
      color: p.primary, emissive: p.primary, emissiveIntensity: 0.55,
      metalness: 0.62, roughness: 0.2, flatShading: skin.shape !== 'sphere'
    });
    const glowMat = new THREE.LineBasicMaterial({ color: p.secondary, transparent: true, opacity: 0.95 });
    const iconMat = new THREE.MeshBasicMaterial({
      map: iconTexture(skin.icon), color: p.secondary, transparent: true,
      side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2
    });
    this.playerMats = [primaryMat, glowMat, iconMat];

    const bodyGroup = new THREE.Group();
    const body = new THREE.Mesh(geo, primaryMat);
    bodyGroup.add(body);
    const edges = new THREE.LineSegments(edgesFor(geo), glowMat);
    bodyGroup.add(edges);

    if (skin.shape === 'box' || skin.shape === 'star') {
      const zoff = skin.shape === 'star' ? 0.25 : 0.545;
      for (const side of [-1, 1]) {
        const icon = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.64), iconMat);
        icon.position.z = side * zoff;
        icon.rotation.y = side < 0 ? Math.PI : 0;
        bodyGroup.add(icon);
      }
    } else {
      const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(skin.icon), color: p.secondary, transparent: true, depthWrite: false }));
      icon.scale.set(0.55, 0.55, 1);
      icon.position.z = -0.74;
      bodyGroup.add(icon);
      this.materials.push(icon.material);
    }

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: p.glow, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glow.scale.set(3.6, 3.6, 1);
    this.materials.push(glow.material);

    const light = new THREE.PointLight(new THREE.Color(p.glow), 5, 9, 1.6);
    light.position.y = 0.1;
    this.playerRoot.add(bodyGroup, glow, light);
    this.playerBody = bodyGroup;
    this.playerGlow = glow;

    if (!this.shadow) {
      const mat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#000000', transparent: true, opacity: 0.42, depthWrite: false });
      this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.0), mat);
      this.shadow.rotation.x = -Math.PI / 2;
      this.root.add(this.shadow);
      this.materials.push(mat);
    }

    // trail ribbon
    if (this.trailMesh) this.root.remove(this.trailMesh);
    const SEG = 28;
    const positions = new Float32Array(SEG * 2 * 3);
    const colors = new Float32Array(SEG * 2 * 3);
    const indices = [];
    for (let i = 0; i < SEG - 1; i++) {
      const a = i * 2, b = i * 2 + 1, c2 = i * 2 + 2, d = i * 2 + 3;
      indices.push(a, b, c2, b, d, c2);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    tg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    tg.setIndex(indices);
    const tm = new THREE.MeshBasicMaterial({
      color: new THREE.Color(p.glow), vertexColors: true, transparent: true,
      opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    this.trailMesh = new THREE.Mesh(tg, tm);
    this.trailMesh.frustumCulled = false;
    this.root.add(this.trailMesh);
    this.materials.push(tm);
    this.trailSegments = SEG;
    this.trailHistory = Array.from({ length: SEG }, () => new THREE.Vector3(0, 0.6, this.player.z));
    this.trailUpdate();
    this.setSkinVisual(this.player);
  }

  setSkinVisual(pos) {
    if (!this.playerBody) return;
    this.playerBody.position.set(0, 0, 0);
  }

  placePlayer(z, lane = 1) {
    const p = this.player;
    const x = LANES[lane] ?? 0;
    p.x = x; p.targetX = x; p.lane = lane;
    p.y = GROUND_Y; p.vy = 0; p.grounded = true;
    p.angle = 0; p.tilt = 0; p.squash = 1;
    p.z = z; p.startZ = z; p.alive = true; p.jumpHeld = false;
    this.playerRoot.visible = true;
    this.playerRoot.position.set(x, GROUND_Y, z);
    this.playerRoot.scale.set(1, 1, 1);
    if (this.playerBody) this.playerBody.rotation.set(0, 0, 0);
    if (this.shadow) this.shadow.visible = true;
    if (this.trailMesh) this.trailMesh.visible = true;
    this.trailHistory = Array.from({ length: this.trailSegments || 28 }, () => new THREE.Vector3(x, GROUND_Y, z));
    this.crashed = false;
    this.finished = false;
  }

  /* ------------------------- build levels ------------------------- */
  buildLevel(runtime, profile) {
    this.clear();
    this.runtime = runtime;
    this.showcase = false;
    this.mode = 'playing';
    this.profile = profile;
    this.buildEnvironment(runtime.theme, runtime.length, { finishZ: runtime.finishZ });
    this.spawnEvents(runtime.events);
    this.coinsTotal = runtime.coinsTotal;
    this.coins = 0;
    this.buildPlayer(profile);
    this.placePlayer(4);
    this.trailHistory = Array.from({ length: this.trailSegments || 28 }, () => new THREE.Vector3(0, GROUND_Y, 4));
    this.snapCamera();
  }

  buildShowcase(profile) {
    this.clear();
    this.profile = profile;
    this.showcase = true;
    this.mode = 'menu';
    const theme = {
      ...HERO_THEME,
      colors: { ...HERO_THEME.colors, accent: profile?.glow || HERO_THEME.colors.accent }
    };
    this.buildEnvironment(theme, 250, { finishZ: 235 });
    // curated props around the attract loop
    const props = [
      { type: 'spike', lane: 0, z: 38 },
      { type: 'coin', lane: 2, z: 37, y: 1.1 },
      { type: 'coin', lane: 2, z: 40.2, y: 1.65 },
      { type: 'coin', lane: 2, z: 43.4, y: 2.1 },
      { type: 'block', lane: 1, z: 50 },
      { type: 'coin', lane: 0, z: 49, y: 1.1 },
      { type: 'gate', lane: 0, z: 60 },
      { type: 'saw', lane: 2, z: 68 }
    ];
    this.spawnEvents(props);
    this.buildPlayer(profile);
    this.placePlayer(29);
    this.player.x = 1.3;
    this.playerRoot.position.x = 1.3;
    this.playerRoot.position.y = 2.4;
    this.player.y = 2.4;
    this.player.grounded = false;
    this.player.vy = 0;
    this.player.spin = 0;
    this.coinsTotal = 0;
    this.buildHeroRing();
    if (this.trailMesh) this.trailMesh.visible = false;
    if (this.shadow) this.shadow.visible = false;
    this.snapCamera();
  }

  buildHeroRing() {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.08, 8, 80),
      new THREE.MeshBasicMaterial({ color: this.profile?.secondary || '#ffffff', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.position.set(1.3, 2.2, 29.2);
    ring.rotation.x = 0.2;
    this.environment.add(ring);
    this.materials.push(ring.material);
    this.animated.push({ obj: ring, spin: 0.35, baseY: 2.2, bob: 1, amp: 0.12 });
    this.heroRing = ring;
  }

  buildEditor(draft, profile) {
    this.clear();
    this.profile = profile;
    this.mode = 'editor';
    this.showcase = false;
    this.runtime = null;
    this.editorFocus = Math.min(draft.length - 20, 48);
    const theme = this.themeForDraft(draft);
    const finish = draft.events.find(e => e.type === 'finish');
    const finishZ = finish ? finish.z : draft.length - 14;
    this.buildEnvironment(theme, draft.length, { finishZ, editor: true });
    this.spawnEvents(draft.events);
    this.coinsTotal = draft.events.filter(e => e.type === 'coin').length;
    this.coins = 0;
    this.buildPlayer(profile);
    this.placePlayer(4);
    this.playerRoot.visible = false;
    if (this.shadow) this.shadow.visible = false;
    if (this.trailMesh) this.trailMesh.visible = false;
    this.buildCursor();
    this.updateEditorCamera(1);
  }

  refreshEditor(draft) {
    if (this.mode !== 'editor') return;
    this.objects.clear();
    this.spawnEvents(draft.events);
    const finish = draft.events.find(e => e.type === 'finish');
    const finishZ = finish ? finish.z : draft.length - 14;
    if (this.finishGroup) {
      this.environment.remove(this.finishGroup);
      this.finishGroup = null;
    }
    this.buildFinishPortal(this.theme, finishZ);
    this.coinsTotal = draft.events.filter(e => e.type === 'coin').length;
    this.playerRoot.visible = false;
    if (this.shadow) this.shadow.visible = false;
    if (this.trailMesh) this.trailMesh.visible = false;
  }

  themeForDraft(draft) {
    return draft.theme || { ...HERO_THEME, id: draft.themeId };
  }

  buildEditorGrid(length) {
    const positions = [];
    const major = [];
    for (let z = 0; z <= length + 40; z += GRID) {
      const arr = (z % 12 === 0) ? major : positions;
      arr.push(-TRACK_WIDTH / 2 + 0.2, 0.028, z, TRACK_WIDTH / 2 - 0.2, 0.028, z);
    }
    const mk = (arr, opacity) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      const m = new THREE.LineBasicMaterial({ color: '#7ef9ff', transparent: true, opacity, depthWrite: false });
      const lines = new THREE.LineSegments(g, m);
      this.environment.add(lines);
      this.materials.push(m);
    };
    mk(positions, 0.13);
    mk(major, 0.33);
    // brighter edge strip to frame the editable area
    const edgeMat = new THREE.MeshBasicMaterial({ color: '#7ef9ff', transparent: true, opacity: 0.42, depthWrite: false });
    for (const x of [-TRACK_WIDTH / 2, TRACK_WIDTH / 2]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, length + 20), edgeMat);
      strip.position.set(x, 0.04, length / 2);
      this.environment.add(strip);
    }
    this.materials.push(edgeMat);
  }

  buildCursor() {    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: '#7CFF6B', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.9, 32), mat);
    ring.rotation.x = -Math.PI / 2;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2, 0.05), mat);
    beam.position.y = 1;
    const top = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), mat);
    top.position.y = 2;
    g.add(ring, beam, top);
    g.visible = false;
    g.userData.mat = mat;
    this.root.add(g);
    this.cursor = g;
    this.materials.push(mat);
  }

  setCursor(lane, z, visible, color) {
    if (!this.cursor) return;
    this.cursor.visible = visible;
    if (!visible) return;
    this.cursor.position.set(LANES[lane] ?? 0, 0, z);
    if (color) this.cursor.userData.mat.color.set(color);
  }

  pickTrack(clientX, clientY, camera) {
    const rect = this.scene.userData.canvasRect || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, camera);
    const out = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.floorPlane, out)) return null;
    if (Math.abs(out.x) > TRACK_WIDTH / 2 + 0.5) return null;
    return out;
  }

  /* ------------------------- runtime ------------------------- */
  startRun(profile) {
    this.buildLevel(this.runtime, profile);
    this.mode = 'playing';
  }

  resetRun(profile) {
    const runtime = this.runtime;
    this.buildLevel(runtime, profile);
    this.mode = 'playing';
  }

  // Practice checkpoints are fixed distances apart, so one can land on top of
  // a hazard. Walk backwards until we find a lane with a clear runway, then
  // respawn there instead of dropping the player straight into a spike.
  findSafeRespawn(z) {
    const events = this.runtime?.events || [];
    const hazards = events.filter(ev => ev.type !== 'coin' && ev.type !== 'finish' && ev.type !== 'pad');
    const startZ = Math.max(4, z);
    let fallback = { z: startZ, lane: 1, clear: -1 };
    for (let back = 0; back <= 16; back += 1) {
      const zz = startZ - back;
      if (zz < 4) break;
      let best = { z: zz, lane: 1, clear: -1 };
      for (let lane = 0; lane < 3; lane++) {
        let next = Infinity;
        let overlap = false;
        for (const ev of hazards) {
          const blocks = ev.type === 'hurdle' || ev.lane === lane;
          if (!blocks) continue;
          const d = ev.z - zz;
          if (Math.abs(d) < 2.6) overlap = true;
          if (d >= -0.4 && d < next) next = d;
        }
        const clear = overlap ? -1 : next;
        if (clear > best.clear) best = { z: zz, lane, clear };
      }
      if (best.clear > fallback.clear) fallback = best;
      if (best.clear > 7) return best;
    }
    return fallback;
  }

  respawn(z) {
    const spawn = this.findSafeRespawn(z);
    this.particles.clear();
    this.placePlayer(spawn.z, spawn.lane);
    this.coins = 0;
    for (const ev of this.eventObjects) {
      if (ev.type === 'coin') { ev.collected = false; ev.group.visible = true; }
      if (ev.type === 'pad') ev.taken = false;
    }
    this.crashed = false;
    this.finished = false;
    this.mode = 'playing';
    this.snapCamera();
  }

  onCoin() { this.particles.burst(this.playerRoot.position.clone(), '#ffd166', 16, 4, 1.5); }
  onPad() { this.shake = Math.max(this.shake, 0.16); this.particles.burst(this.playerRoot.position.clone(), this.theme.colors.accent2, 26, 5, 2); }
  onLand() { this.particles.burst(this.playerRoot.position.clone(), this.profile?.glow || '#fff', 8, 2.5, 0.3); }

  jump() {
    const p = this.player;
    p.jumpHeld = true;
    if (!p.alive || (this.mode !== 'playing')) return false;
    if (p.grounded) {
      p.vy = JUMP_V; p.grounded = false;
      p.spin = 7.4;
      p.squash = 1.12;
      this.onJumpSound?.();
      return true;
    }
    return false;
  }

  releaseJump() { this.player.jumpHeld = false; }

  moveLane(dir) {
    const p = this.player;
    if (!p.alive || this.mode !== 'playing') return;
    const next = Math.max(0, Math.min(2, p.lane + dir));
    if (next !== p.lane) {
      p.lane = next;
      p.targetX = LANES[next];
    }
  }

  die() {
    if (this.crashed || this.finished) return;
    this.crashed = true;
    this.player.alive = false;
    this.shake = 0.5;
    const pos = this.playerRoot.position.clone();
    const primary = this.profile?.primary || '#2ee6ff';
    this.particles.burst(pos, primary, 110, 11, 3.5);
    this.particles.burst(pos, this.profile?.secondary || '#ffffff', 50, 7, 2);
    this.playerRoot.visible = false;
    this.shadow.visible = false;
    this.trailMesh.visible = false;
    this.onDeathSound?.();
  }

  finish() {
    if (this.finished || this.crashed) return;
    this.finished = true;
    this.player.alive = false;
    this.shake = 0.12;
    const pos = this.playerRoot.position.clone();
    this.particles.burst(pos, this.theme.colors.accent, 90, 9, 4);
    this.particles.burst(pos, this.theme.colors.accent2, 70, 7, 5);
    this.onWinSound?.();
  }

  updatePlayer(dt) {
    const p = this.player;
    if (!p.alive) return;
    const speed = this.runtime.speed;
    p.z += speed * dt;
    p.x += (p.targetX - p.x) * Math.min(1, dt * 15);
    p.tilt += ((p.targetX - p.x) * 0.38 - p.tilt) * Math.min(1, dt * 9);

    if (!p.grounded) {
      p.vy -= GRAVITY * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      if (p.y <= GROUND_Y) {
        p.y = GROUND_Y; p.vy = 0; p.grounded = true;
        p.angle = Math.round(p.angle / (Math.PI / 2)) * (Math.PI / 2);
        p.squash = 0.82;
        this.onLand();
        if (p.jumpHeld) {
          p.vy = JUMP_V; p.grounded = false; p.spin = 7.4; p.squash = 1.12;
          this.onJumpSound?.();
        }
      }
    } else if (p.jumpHeld && p.grounded) {
      p.vy = JUMP_V; p.grounded = false; p.spin = 7.4; p.squash = 1.12;
      this.onJumpSound?.();
    }

    p.squash += (1 - p.squash) * Math.min(1, dt * 12);
    this.playerRoot.position.set(p.x, p.y, p.z);
    this.playerRoot.rotation.y = p.tilt;
    if (this.playerBody) {
      this.playerBody.rotation.z = p.angle;
      this.playerBody.scale.set(1 / Math.sqrt(p.squash), p.squash, 1 / Math.sqrt(p.squash));
    }
    if (this.playerGlow) this.playerGlow.position.set(0, 0, 0);
    if (this.shadow) {
      const air = Math.max(0, p.y - GROUND_Y);
      this.shadow.position.set(p.x, 0.03, p.z - 0.15);
      const s = Math.max(0.4, 1.1 - air * 0.11);
      this.shadow.scale.set(s, s, 1);
      this.shadow.material.opacity = Math.max(0.08, 0.42 - air * 0.045);
    }
    this.trailSample += dt;
    if (this.trailSample > 0.012) { this.trailSample = 0; this.updateTrailHistory(); }
    this.checkCollisions();
  }

  updateTrailHistory() {
    const h = this.trailHistory;
    if (!h.length) return;
    for (let i = h.length - 1; i > 0; i--) h[i].copy(h[i - 1]);
    h[0].set(this.player.x, this.player.y, this.player.z - 0.5);
  }

  trailUpdate() {
    if (!this.trailMesh) return;
    const h = this.trailHistory;
    const pos = this.trailMesh.geometry.attributes.position.array;
    const col = this.trailMesh.geometry.attributes.color.array;
    const c = new THREE.Color(this.profile?.glow || '#00d9ff');
    const n = this.trailSegments || 28;
    for (let i = 0; i < n; i++) {
      const p = h[i] || new THREE.Vector3();
      const fade = Math.pow(1 - i / n, 1.5);
      const j = i * 6;
      pos[j] = p.x - 0.07; pos[j + 1] = p.y; pos[j + 2] = p.z;
      pos[j + 3] = p.x + 0.07; pos[j + 4] = p.y; pos[j + 5] = p.z;
      col[j] = c.r * fade; col[j + 1] = c.g * fade; col[j + 2] = c.b * fade;
      col[j + 3] = c.r * fade; col[j + 4] = c.g * fade; col[j + 5] = c.b * fade;
    }
    this.trailMesh.geometry.attributes.position.needsUpdate = true;
    this.trailMesh.geometry.attributes.color.needsUpdate = true;
  }

  checkCollisions() {
    const p = this.player;
    const pz = p.z;
    for (const ev of this.eventObjects) {
      const dz = Math.abs(ev.z - pz);
      if (dz > 4.5) continue;
      const laneX = LANES[ev.lane] ?? 0;
      const dx = Math.abs(p.x - laneX);
      if (ev.type === 'coin') {
        if (!ev.collected && dz < 0.95 && dx < 1.05 && Math.abs(p.y - ev.y) < 0.95) {
          ev.collected = true; ev.group.visible = false;
          this.coins++;
          this.onCoin();
          this.onCoinSound?.();
        }
        continue;
      }
      if (ev.type === 'pad') {
        if (!ev.taken && dz < 1.05 && dx < 1.15 && p.y < 2.3) {
          ev.taken = true;
          p.vy = PAD_V; p.grounded = false; p.spin = 9.2;
          this.onPad();
          this.onJumpSound?.();
        }
        continue;
      }
      if (ev.type === 'hurdle') {
        if (dz < 0.72 && p.y - PLAYER_HALF < 1.25) { this.die(); return; }
        continue;
      }
      if (dx > 0.92) continue;
      if (dz > 0.8) continue;
      if (ev.type === 'gate') { this.die(); return; }
      if (ev.type === 'spike' && p.y - PLAYER_HALF < 1.4) { this.die(); return; }
      if (ev.type === 'block' && p.y - PLAYER_HALF < 1.7) { this.die(); return; }
      if (ev.type === 'saw' && dz < 0.72 && p.y - PLAYER_HALF < 1.95) { this.die(); return; }
    }
    if (pz >= this.runtime.finishZ) this.finish();
  }

  /* ------------------------- cameras ------------------------- */
  get cameraMode() { return this.mode; }
  setMode(mode) { this.mode = mode; }

  snapCamera() {
    if (this.mode === 'editor') { this.updateEditorCamera(1); return; }
    if (this.mode === 'menu') {
      this.camPos.set(2.6, 4.9, 15.5);
      this.camLook.set(-1.4, 2.0, 29.5);
    } else {
      const p = this.player;
      this.camPos.set(p.x * 0.24 + 0.35, 5.0 + p.y * 0.15, p.z - 10.0);
      this.camLook.set(p.x * 0.15, 1.35 + p.y * 0.24, p.z + 8.4);
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  updateCamera(dt) {
    const p = this.player;
    if (this.mode === 'menu') {
      if (this.camera.fov !== 62) { this.camera.fov = 62; this.camera.updateProjectionMatrix(); }
      const t = this.elapsed;
      this.camPos.lerp(new THREE.Vector3(
        2.6 + Math.sin(t * 0.12) * 0.9,
        4.9 + Math.sin(t * 0.2) * 0.2,
        15.5 + Math.sin(t * 0.08) * 0.7
      ), Math.min(1, dt * 1.5));
      this.camLook.lerp(new THREE.Vector3(-1.4 + Math.sin(t * 0.11) * 0.5, 2.0, 29.5), Math.min(1, dt * 1.5));
    } else if (this.mode === 'editor') {
      this.updateEditorCamera(Math.min(1, dt * 8));
      return;
    } else if (this.mode === 'playing' || this.mode === 'dead' || this.mode === 'win' || this.mode === 'paused') {
      if (this.camera.fov !== 62) { this.camera.fov = 62; this.camera.updateProjectionMatrix(); }
      const target = new THREE.Vector3(p.x * 0.24 + 0.35, 5.0 + p.y * 0.13, p.z - 10.0);
      const look = new THREE.Vector3(p.x * 0.15, 1.35 + p.y * 0.22, p.z + 8.4);
      this.camPos.lerp(target, Math.min(1, dt * 6));
      this.camLook.lerp(look, Math.min(1, dt * 6));
    }
    let sx = 0, sy = 0, sz = 0;
    if (this.shake > 0.001) {
      sx = (Math.random() - 0.5) * this.shake * 1.4;
      sy = (Math.random() - 0.5) * this.shake * 1.2;
      sz = (Math.random() - 0.5) * this.shake * 0.8;
      this.shake *= Math.pow(0.002, dt);
    }
    this.camera.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z + sz);
    this.camera.lookAt(this.camLook);
    this.camera.rotation.z += (this.player.tilt * -0.06);
  }

  updateEditorCamera(t = 1) {
    if (this.camera.fov !== 52) { this.camera.fov = 52; this.camera.updateProjectionMatrix(); }
    const z = this.editorFocus;
    const targetPos = new THREE.Vector3(0, 20.5, z - 11);
    const targetLook = new THREE.Vector3(0, 0.2, z + 10);
    if (!this._editorCamInit) {
      this.camPos.copy(targetPos);
      this.camLook.copy(targetLook);
      this._editorCamInit = true;
    } else {
      this.camPos.lerp(targetPos, t);
      this.camLook.lerp(targetLook, t);
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  /* ------------------------- loop ------------------------- */
  update(dt, elapsed) {
    this.elapsed = elapsed;
    this.skyUniforms.time.value = elapsed;
    if (this.stars) this.stars.rotation.y = elapsed * 0.002;
    if (this.sun) this.sun.material.opacity = 0.45 + Math.sin(elapsed * 0.8) * 0.06;
    for (const a of this.animated) {
      const o = a.obj;
      if (!o) continue;
      if (a.axis === 'z') o.rotation.z += a.spin * dt;
      else if (a.axis === 'y') o.rotation.y += a.spin * dt;
      else if (a.axis === 'x') o.rotation.x += a.spin * dt;
      else { o.rotation.x += a.spin * dt * 0.7; o.rotation.y += a.spin * dt; }
      if (a.amp) o.position.y = a.baseY + Math.sin(elapsed * 1.1 + a.bob) * a.amp;
    }
    if (this.mode === 'menu' && this.playerRoot.visible) {
      this.playerRoot.position.y = 2.4 + Math.sin(elapsed * 1.3) * 0.18;
      this.playerRoot.rotation.y = Math.sin(elapsed * 0.45) * 0.28;
      if (this.playerBody) this.playerBody.rotation.z = elapsed * 0.55;
    }
    if (this.mode === 'playing') {
      this.updatePlayer(dt);
      this.trailUpdate();
    }
    this.particles.update(dt);
    if (this.finishTorus) this.finishTorus.rotation.z = elapsed * 0.4;
    if (this.finishInner) this.finishInner.material.opacity = 0.38 + Math.sin(elapsed * 2.2) * 0.12;
    this.updateCamera(dt);
  }

  getProgress() {
    if (!this.runtime) return 0;
    return Math.max(0, Math.min(100, ((this.player.z - 4) / (this.runtime.finishZ - 4)) * 100));
  }

  getPlayerWorldPos() {
    return this.playerRoot.position.clone();
  }
}

// The menu backdrop always uses the Stereo Madness skyline, with the player's
// glow folded into the accent colour.
const HERO_THEME = {
  id: 'hero', name: 'Hero', short: 'HERO', difficulty: 'Easy', tier: 1,
  desc: '', motif: 'city', bpm: 140, root: 45, scale: [0, 3, 5, 7, 10], speed: 14,
  length: 250, seed: 7411,
  colors: {
    top: '#031137', bottom: '#0069b6', fog: '#041f45', deep: '#020a18',
    track: '#061b38', grid: '#21d4fd', accent: '#00e5ff', accent2: '#ff3cac', text: '#bff6ff'
  }
};
