import * as THREE from './vendor/three.module.min.js';

/* ------------------------------------------------------------------ *
 *  SKYWAY SCRAMBLE 3D — Angry Birds + Bad Piggies                     *
 *  A self-contained Three.js game with canvas-painted textures.       *
 * ------------------------------------------------------------------ */

const $ = id => document.getElementById(id);
const ui = {
  score: $('score'), scoreLabel: $('scoreLabel'), progress: $('progressFill'), progressText: $('progressText'),
  tray: $('birdIcons'), title: $('levelTitle'), chapter: $('chapterLabel'), mission: $('missionText'),
  hint: $('controlTip'), action: $('actionHint'), build: $('buildPanel'), notice: $('notice'),
  modal: $('modal'), pause: $('pauseOverlay'), result: $('resultOverlay'), shell: document.querySelector('.game-shell')
};

const GROUND = 462, GRAVITY = 470, U = 0.018;
const WX = x => (x - 500) * U;
const WY = y => (GROUND - y) * U;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);

/* ------------------------------------------------------------------ *
 *  Renderer, camera, lights
 * ------------------------------------------------------------------ */

const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = false;

const glInfo = renderer.getContext().getExtension('WEBGL_debug_renderer_info');
const GPU_NAME = glInfo ? renderer.getContext().getParameter(glInfo.UNMASKED_RENDERER_WEBGL) : '';
const SOFTWARE_GL = /swiftshader|llvmpipe|software/i.test(GPU_NAME);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbfeef2, 26, 64);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 140);
const CAM = { y: 5.2, z: 17.6, lookY: 3.0, x: 0, shake: 0, fov: 42 };
camera.position.set(0, CAM.y, CAM.z);

scene.add(new THREE.HemisphereLight(0xe3fbff, 0x4d7f45, 0.85));
const sunLight = new THREE.DirectionalLight(0xfff0c9, 1.2);
sunLight.position.set(-5.5, 13, 11);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.left = -13;
sunLight.shadow.camera.right = 13;
sunLight.shadow.camera.top = 9;
sunLight.shadow.camera.bottom = -7;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 40;
sunLight.shadow.bias = -0.0007;
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0xdff7ff, 0.22));

/* ------------------------------------------------------------------ *
 *  Painted textures
 * ------------------------------------------------------------------ */

function makeTexture(size, paint, rx = 1, ry = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
  return t;
}

const skyTex = makeTexture(512, (g, s) => {
  const grad = g.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, '#6fc9e6');
  grad.addColorStop(0.52, '#a9e4ed');
  grad.addColorStop(0.8, '#d6efd8');
  grad.addColorStop(1, '#eaf4cf');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
});
skyTex.wrapS = skyTex.wrapT = THREE.ClampToEdgeWrapping;

const grassTex = makeTexture(256, (g, s) => {
  g.fillStyle = '#79c96a';
  g.fillRect(0, 0, s, s);
  const cols = ['#6fbd60', '#86d273', '#62b459', '#91dc7d', '#74c466'];
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = cols[i % cols.length];
    const x = Math.random() * s, y = Math.random() * s;
    g.fillRect(x, y, 1 + Math.random() * 2, 2 + Math.random() * 5);
  }
  for (let i = 0; i < 24; i++) {
    g.fillStyle = i % 2 ? '#f6e9a8' : '#ffffff';
    g.beginPath();
    g.arc(Math.random() * s, Math.random() * s, 1.7, 0, 7);
    g.fill();
  }
}, 9, 9);

const woodTex = makeTexture(128, (g, s) => {
  g.fillStyle = '#cf9554';
  g.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 18) {
    g.fillStyle = y % 36 ? '#c78c4d' : '#d69e5d';
    g.fillRect(0, y, s, 17);
    g.strokeStyle = '#a76a3e';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, y + 17);
    g.lineTo(s, y + 17);
    g.stroke();
    for (let k = 0; k < 3; k++) {
      g.strokeStyle = '#b87a47aa';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, y + 3 + k * 4);
      g.bezierCurveTo(s * 0.3, y + 1 + k * 5, s * 0.6, y + 6 + k * 3, s, y + 3 + k * 4);
      g.stroke();
    }
  }
  for (let i = 0; i < 5; i++) {
    g.strokeStyle = '#9a6035';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(Math.random() * s, Math.random() * s, 4, 2.2, 0, 0, 7);
    g.stroke();
  }
}, 2, 2);

const stoneTex = makeTexture(128, (g, s) => {
  g.fillStyle = '#a9b6ae';
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 900; i++) {
    const v = Math.random();
    g.fillStyle = v > 0.66 ? '#bcc7bd' : v > 0.33 ? '#9aa79f' : '#c8d1c6';
    g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  g.strokeStyle = '#7f8f86aa';
  for (let i = 0; i < 7; i++) {
    g.lineWidth = 1.5;
    g.beginPath();
    let x = Math.random() * s, y = Math.random() * s;
    g.moveTo(x, y);
    for (let k = 0; k < 3; k++) { x += rnd(-22, 22); y += rnd(6, 22); g.lineTo(x, y); }
    g.stroke();
  }
}, 2, 2);

const waterTex = makeTexture(256, (g, s) => {
  g.fillStyle = '#58bed4';
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = i % 3 ? '#8fe4ebbb' : '#c4f5f4cc';
    g.lineWidth = 1 + Math.random() * 2;
    const y = Math.random() * s;
    g.beginPath();
    g.moveTo(Math.random() * s, y);
    g.quadraticCurveTo(Math.random() * s, y - 4, Math.random() * s, y);
    g.stroke();
  }
}, 16, 16);

const dirtTex = makeTexture(128, (g, s) => {
  g.fillStyle = '#b98c56';
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = i % 2 ? '#a97c4a' : '#c79a62';
    g.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 4, 2 + Math.random() * 4);
  }
}, 3, 3);

const sunTex = makeTexture(256, (g, s) => {
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, '#fffbe2');
  grad.addColorStop(0.28, '#ffe9a1');
  grad.addColorStop(0.55, '#ffdc7caa');
  grad.addColorStop(1, '#ffdc7c00');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
});

/* ------------------------------------------------------------------ *
 *  Materials + shared geometry
 * ------------------------------------------------------------------ */

const M = {
  grass: new THREE.MeshLambertMaterial({ map: grassTex }),
  dirt: new THREE.MeshLambertMaterial({ map: dirtTex }),
  wood: new THREE.MeshLambertMaterial({ map: woodTex }),
  woodDark: new THREE.MeshLambertMaterial({ color: 0x9a6238 }),
  stone: new THREE.MeshLambertMaterial({ map: stoneTex }),
  leaf: new THREE.MeshLambertMaterial({ color: 0x4f9f59 }),
  leafLight: new THREE.MeshLambertMaterial({ color: 0x6cbb65 }),
  sand: new THREE.MeshLambertMaterial({ color: 0xe3d49a }),
  water: new THREE.MeshPhongMaterial({ map: waterTex, shininess: 90, specular: 0x9fe8ef }),
  pig: new THREE.MeshLambertMaterial({ color: 0x65c256 }),
  pigLight: new THREE.MeshLambertMaterial({ color: 0x8cdb71 }),
  pigDark: new THREE.MeshLambertMaterial({ color: 0x4b9a44 }),
  white: new THREE.MeshLambertMaterial({ color: 0xfffdf4 }),
  dark: new THREE.MeshLambertMaterial({ color: 0x243a35 }),
  orange: new THREE.MeshLambertMaterial({ color: 0xf5ab39 }),
  red: new THREE.MeshLambertMaterial({ color: 0xe45043 }),
  yellow: new THREE.MeshLambertMaterial({ color: 0xf4cf43 }),
  blue: new THREE.MeshLambertMaterial({ color: 0x42b9e8 }),
  band: new THREE.MeshLambertMaterial({ color: 0x7a3626 }),
  cloud: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }),
  rock: new THREE.MeshLambertMaterial({ color: 0x9eae9e }),
  gold: new THREE.MeshPhongMaterial({ color: 0xffcf45, emissive: 0x7a4c00, emissiveIntensity: 0.6, shininess: 90, specular: 0xfff2b0 }),
  pole: new THREE.MeshLambertMaterial({ color: 0x8a5b35 })
};

const unitSphere = new THREE.SphereGeometry(1, 14, 10);
const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
unitSphere.userData.shared = true;
unitCylinder.userData.shared = true;
const UP = new THREE.Vector3(0, 1, 0);
const SHARED_MATS = new Set(Object.values(M));

function shadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addEdges(mesh, color = 0x6d4526, opacity = 0.32) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
  mesh.add(edges);
  return mesh;
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    child.traverse?.(o => {
      if (o.isMesh || o.isLine || o.isPoints || o.isSprite) {
        if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mat of mats) {
          if (mat && mat.dispose && !SHARED_MATS.has(mat) && !mat.userData?.shared) mat.dispose();
        }
      }
    });
  }
}

/* ------------------------------------------------------------------ *
 *  Environment
 * ------------------------------------------------------------------ */

const env = new THREE.Group();
scene.add(env);

const sea = new THREE.Mesh(new THREE.PlaneGeometry(150, 120), M.water);
sea.rotation.x = -Math.PI / 2;
sea.position.set(0, -1.55, -30);
sea.receiveShadow = true;
env.add(sea);

const skyDome = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 70),
  new THREE.MeshBasicMaterial({ map: skyTex, depthWrite: false, fog: false })
);
skyDome.position.set(0, 12, -42);
env.add(skyDome);

const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false }));
sunSprite.scale.set(8, 8, 1);
sunSprite.position.set(9, 10.4, -34);
env.add(sunSprite);

const CLOUD_BLOBS = [
  [-1.2, -0.1, 0, 1.15], [0, 0.35, 0.1, 1.45], [1.35, 0, 0, 1.0],
  [0.55, -0.32, 0.25, 0.95], [-0.55, -0.35, 0.2, 0.85], [2.1, -0.18, 0, 0.6]
];
const clouds = [];
for (let i = 0; i < 6; i++) {
  clouds.push({
    x: rnd(-14, 14), y: rnd(7.4, 11.2), z: rnd(-19, -9),
    s: rnd(0.5, 1.05), speed: rnd(0.06, 0.2)
  });
}
const cloudMesh = new THREE.InstancedMesh(unitSphere, M.cloud, clouds.length * CLOUD_BLOBS.length);
cloudMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
cloudMesh.frustumCulled = false;
env.add(cloudMesh);
const cloudMatrix = new THREE.Matrix4();
const cloudQuat = new THREE.Quaternion();
const cloudPos = new THREE.Vector3();
const cloudScale = new THREE.Vector3();
function updateClouds() {
  let i = 0;
  for (const c of clouds) {
    for (const [x, y, z, s] of CLOUD_BLOBS) {
      cloudPos.set(c.x + x * c.s, c.y + y * c.s, c.z + z * c.s);
      cloudScale.set(s * c.s, s * c.s * 0.72, s * c.s * 0.68);
      cloudMatrix.compose(cloudPos, cloudQuat, cloudScale);
      cloudMesh.setMatrixAt(i++, cloudMatrix);
    }
  }
  cloudMesh.instanceMatrix.needsUpdate = true;
}
updateClouds();

function makeHill(x, z, sx, sy, color, opacity = 1) {
  const mat = new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity, flatShading: true });
  const hill = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), mat);
  hill.scale.set(sx, sy, sx * 0.55);
  hill.position.set(x, -0.95, z);
  hill.rotation.y = x * 0.7;
  env.add(hill);
  return hill;
}
makeHill(-19, -32, 14, 1.35, 0x8fc3ad);
makeHill(21, -35, 15, 1.5, 0x9acbb6);

function makePalm(x, y, z, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(unitCylinder, M.woodDark);
  trunk.position.y = 0.42 * s;
  trunk.scale.set(0.05 * s, 0.85 * s, 0.05 * s);
  trunk.rotation.z = 0.08;
  g.add(trunk);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    const leaf = new THREE.Mesh(unitSphere, i % 2 ? M.leaf : M.leafLight);
    leaf.position.set(Math.cos(a) * 0.34 * s, 0.9 * s, Math.sin(a) * 0.34 * s);
    leaf.scale.set(0.44 * s, 0.055 * s, 0.16 * s);
    leaf.rotation.y = -a;
    leaf.rotation.z = 0.22;
    g.add(leaf);
  }
  g.position.set(x, y, z);
  env.add(g);
  return g;
}
makePalm(-14.5, 0.28, -30.5, 1.8);
makePalm(17.5, 0.42, -33.5, 2.0);

function addGrassScatter(group, count, x0, x1, z0, z1) {
  const inst = new THREE.InstancedMesh(new THREE.ConeGeometry(0.035, 1, 4), M.leafLight, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const p = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const h = rnd(0.16, 0.32);
    p.set(rnd(x0, x1), h / 2, rnd(z0, z1));
    e.set(0, 0, rnd(-0.45, 0.45));
    q.setFromEuler(e);
    s.set(1, h, 1);
    m.compose(p, q, s);
    inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;
  group.add(inst);
}
function addFlowerScatter(group, count, x0, x1, z0, z1) {
  const make = (mat, n) => {
    const inst = new THREE.InstancedMesh(unitSphere, mat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    const p = new THREE.Vector3(), s = new THREE.Vector3(0.035, 0.035, 0.035);
    for (let i = 0; i < n; i++) {
      p.set(rnd(x0, x1), 0.05, rnd(z0, z1));
      m.compose(p, q, s);
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  };
  make(M.white, count - Math.floor(count / 4));
  make(M.yellow, Math.floor(count / 4));
}

/* A few tiny distant islands */
/* Distant low islands sit at the horizon (see makeHill above). */

/* ------------------------------------------------------------------ *
 *  Shared little models
 * ------------------------------------------------------------------ */

function makePigMesh(scale = 0.34) {
  const g = new THREE.Group();
  const body = shadow(new THREE.Mesh(unitSphere, M.pig));
  body.scale.set(1, 0.99, 0.94);
  g.add(body);

  const snout = shadow(new THREE.Mesh(unitSphere, M.pigLight));
  snout.position.set(0, -0.08, 0.83);
  snout.scale.set(0.46, 0.36, 0.38);
  g.add(snout);

  for (const sx of [-0.16, 0.16]) {
    const nostril = new THREE.Mesh(unitSphere, M.pigDark);
    nostril.position.set(sx, -0.08, 1.1);
    nostril.scale.setScalar(0.055);
    g.add(nostril);
  }

  for (const sx of [-1, 1]) {
    const ear = shadow(new THREE.Mesh(unitSphere, M.pigDark));
    ear.position.set(0.55 * sx, 0.66, 0.05);
    ear.scale.set(0.3, 0.42, 0.26);
    ear.rotation.z = 0.4 * sx;
    g.add(ear);

    const eye = new THREE.Mesh(unitSphere, M.white);
    eye.position.set(0.33 * sx, 0.27, 0.78);
    eye.scale.set(0.26, 0.32, 0.2);
    g.add(eye);

    const pupil = new THREE.Mesh(unitSphere, M.dark);
    pupil.position.set(0.31 * sx, 0.27, 0.94);
    pupil.scale.setScalar(0.095);
    g.add(pupil);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.1), M.pigDark);
    brow.position.set(0.3 * sx, 0.57, 0.83);
    brow.rotation.z = -0.24 * sx;
    g.add(brow);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 14, Math.PI), M.pigDark);
  smile.position.set(0, -0.28, 0.91);
  smile.rotation.z = Math.PI;
  g.add(smile);

  g.scale.setScalar(scale);
  return g;
}

function makeBirdMesh(type, radius = 0.36) {
  const g = new THREE.Group();
  const bodyMat = type === 'yellow' ? M.yellow : type === 'blue' ? M.blue : M.red;
  const body = shadow(new THREE.Mesh(unitSphere, bodyMat));
  body.scale.set(1, 1, 0.94);
  g.add(body);

  const belly = new THREE.Mesh(unitSphere, M.white);
  belly.position.set(-0.02, -0.28, 0.6);
  belly.scale.set(0.68, 0.54, 0.42);
  g.add(belly);

  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(unitSphere, M.white);
    eye.position.set(0.29 * sx, 0.27, 0.76);
    eye.scale.set(0.31, 0.4, 0.22);
    g.add(eye);
    const pupil = new THREE.Mesh(unitSphere, M.dark);
    pupil.position.set(0.28 * sx, 0.27, 0.94);
    pupil.scale.setScalar(0.1);
    g.add(pupil);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.12), M.dark);
    brow.position.set(0.26 * sx, 0.6, 0.83);
    brow.rotation.z = -0.34 * sx;
    g.add(brow);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.12), bodyMat);
    tail.position.set(-0.92, 0.05 + sx * 0.16, -0.05);
    tail.rotation.z = 0.35 * sx;
    g.add(tail);
  }

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.62, 4), M.orange);
  beak.position.set(0.98, -0.02, 0.58);
  beak.rotation.z = -Math.PI / 2;
  beak.rotation.x = Math.PI / 4;
  beak.castShadow = true;
  g.add(beak);

  const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 5), bodyMat);
  tuft.position.set(-0.05, 1.02, 0);
  tuft.rotation.z = -0.25;
  g.add(tuft);

  g.scale.setScalar(radius);
  return g;
}

function makeTextSprite(text, color = '#ffffff', size = 52) {
  const pad = 24;
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `900 ${size}px Nunito, sans-serif`;
  const w = Math.ceil(measure.measureText(text).width) + pad * 2;
  const h = Math.ceil(size * 1.5);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.font = `900 ${size}px Nunito, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 10;
  g.strokeStyle = '#253c4333';
  g.strokeText(text, w / 2, h / 2 + 2);
  g.fillStyle = color;
  g.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set((w / h) * 0.72, 0.72, 1);
  sprite.renderOrder = 20;
  return sprite;
}

/* ------------------------------------------------------------------ *
 *  Audio — tiny synthesized sound effects
 * ------------------------------------------------------------------ */

let audioCtx = null, soundOn = true;
function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function tone(freq, dur, type = 'sine', vol = 0.07, slideTo = null, delay = 0) {
  if (!soundOn) return;
  const ac = ensureAudio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}
function noiseBurst(dur = 0.14, vol = 0.05) {
  if (!soundOn) return;
  const ac = ensureAudio();
  if (!ac) return;
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  src.buffer = buffer;
  gain.gain.value = vol;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  src.start();
}
function sfx(name) {
  if (!soundOn) return;
  switch (name) {
    case 'stretch': tone(180, 0.12, 'triangle', 0.03, 260); break;
    case 'launch': noiseBurst(0.22, 0.06); tone(340, 0.22, 'sawtooth', 0.025, 130); break;
    case 'hit': noiseBurst(0.1, 0.055); tone(120, 0.1, 'square', 0.045, 70); break;
    case 'break': noiseBurst(0.16, 0.065); tone(180, 0.14, 'triangle', 0.05, 90); break;
    case 'pop': tone(620, 0.1, 'square', 0.05, 940); tone(980, 0.1, 'sine', 0.04, 1320, 0.06); break;
    case 'star': tone(880, 0.09, 'sine', 0.05); tone(1320, 0.12, 'sine', 0.045, null, 0.07); break;
    case 'place': tone(300, 0.07, 'square', 0.035, 200); break;
    case 'jump': tone(280, 0.16, 'triangle', 0.04, 520); break;
    case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.24, 'triangle', 0.055, null, i * 0.1)); break;
    case 'lose': [420, 340, 260].forEach((f, i) => tone(f, 0.22, 'triangle', 0.045, null, i * 0.11)); break;
    case 'drive': tone(120, 0.5, 'sawtooth', 0.022, 180); break;
  }
}

/* ------------------------------------------------------------------ *
 *  Game state
 * ------------------------------------------------------------------ */

const SLING = { x: 170, y: 372 };
const BIRD = {
  red: { radius: 20 },
  yellow: { radius: 20 },
  blue: { radius: 16 }
};
const LEVELS = [
  {
    name: 'PIGGY PEAK', mission: 'Topple the tower and pop every pig!',
    birds: ['red', 'yellow', 'red'], build() {
      const blocks = [
        box(730, GROUND, 26, 82, 'wood'), box(812, GROUND, 26, 82, 'wood'),
        box(771, 380, 108, 20, 'wood'),
        box(730, 360, 24, 57, 'wood'), box(812, 360, 24, 57, 'wood'),
        box(771, 303, 100, 18, 'stone'),
        box(812, 285, 22, 32, 'wood')
      ];
      const pigs = [pig(771, GROUND), pig(771, 360), pig(771, 285)];
      return { blocks, pigs };
    }
  },
  {
    name: 'TIMBER TROUBLE', mission: 'Send the piggies packing!',
    birds: ['yellow', 'red', 'blue', 'red'], build() {
      const blocks = [
        box(690, GROUND, 22, 72, 'wood'), box(780, GROUND, 22, 72, 'wood'), box(870, GROUND, 22, 72, 'wood'),
        box(735, 390, 96, 18, 'wood'), box(825, 390, 96, 18, 'wood'),
        box(760, 372, 20, 62, 'wood'), box(800, 372, 20, 62, 'wood'),
        box(780, 310, 112, 18, 'wood'),
        box(825, 292, 20, 34, 'stone')
      ];
      const pigs = [pig(735, GROUND), pig(825, GROUND), pig(780, 372), pig(780, 292)];
      return { blocks, pigs };
    }
  },
  {
    name: 'CLOUD NINE', mission: 'Clear the skies of swine!',
    birds: ['red', 'yellow', 'blue', 'yellow', 'red'], build() {
      const blocks = [
        box(700, GROUND, 25, 82, 'wood'), box(790, GROUND, 25, 82, 'wood'),
        box(745, 380, 118, 18, 'wood'),
        box(720, 362, 22, 46, 'wood'), box(770, 362, 22, 46, 'wood'),
        box(745, 316, 86, 16, 'stone'),
        box(850, GROUND, 52, 42, 'wood'),
        box(850, 420, 40, 26, 'stone')
      ];
      const pigs = [pig(745, GROUND), pig(745, 362), pig(745, 300), pig(850, 394)];
      return { blocks, pigs };
    }
  }
];

let mode = 'attack', level = 0, score = 0, paused = false, gameOver = false;
let blocks = [], pigs = [], birds = [], currentBird = null;
let dragging = false, dragPos = null, launched = false, shotDone = false;
let postShot = 0, winTimer = 0, loseTimer = 0, shotTime = 0, restTime = 0;
let particles = [], texts = [];

function box(x, bottom, w, h, material = 'wood') {
  return {
    x, y: bottom - h / 2, w, h, material,
    hp: material === 'stone' ? 2 : 1, alive: true, dynamic: false,
    vx: 0, vy: 0, spin: 0, angle: 0, mesh: null
  };
}
function pig(x, bottom, r = 19) {
  return {
    x, y: bottom - r, r, alive: true, grounded: true,
    vx: 0, vy: 0, angle: 0, blink: rnd(0, 3), mesh: null
  };
}

function updateScore() {
  ui.score.textContent = String(Math.max(0, Math.round(score))).padStart(6, '0');
}
function updateTray() {
  ui.tray.innerHTML = '';
  birds.forEach(b => {
    const s = document.createElement('span');
    s.className = 'bird-dot ' + b.type + (b.used ? ' used' : '');
    s.title = b.type + ' bird' + (b.used ? ' (used)' : '');
    ui.tray.appendChild(s);
  });
}
function updateProgress() {
  if (mode === 'attack') {
    const total = pigs.length || LEVELS[level].pigs || 1;
    const down = pigs.filter(p => !p.alive).length;
    ui.progress.style.width = (down / total * 100) + '%';
    ui.progressText.textContent = `${down} / ${total} PIGS`;
  } else {
    ui.progressText.textContent = `${buildStars.filter(s => s.collected).length} / 3 STARS`;
  }
}
function notify(text) {
  ui.notice.textContent = text;
  ui.notice.classList.add('show');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => ui.notice.classList.remove('show'), 2100);
}

/* ------------------------------------------------------------------ *
 *  Attack scene — island, slingshot, bird/trajectory helpers
 * ------------------------------------------------------------------ */

scene.background = new THREE.Color(0x9edfee);

const attackRoot = new THREE.Group();
const attackEnv = new THREE.Group();
const attackObjects = new THREE.Group();
const attackFx = new THREE.Group();
attackRoot.add(attackEnv, attackObjects, attackFx);
scene.add(attackRoot);

{
  const islandGeo = new THREE.CylinderGeometry(11.25, 12.1, 1.6, 72);
  const island = new THREE.Mesh(islandGeo, [M.dirt, M.grass, M.dirt]);
  island.position.y = -0.8;
  island.receiveShadow = true;
  attackEnv.add(island);

  const rim = new THREE.Mesh(new THREE.RingGeometry(10.55, 11.25, 72), M.sand);
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.008;
  rim.receiveShadow = true;
  attackEnv.add(rim);

  for (const [x, z, s] of [[-8.4, 2.2, 0.55], [-7.3, 3.2, 0.4], [8.1, 2.6, 0.6], [9.2, 1.1, 0.42], [-9.2, -1.5, 0.5], [7.3, -2.6, 0.46]]) {
    const rock = shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), M.rock));
    rock.position.set(x, s * 0.45, z);
    rock.rotation.set(x, z, s);
    attackEnv.add(rock);
  }

  for (const [x, z, s] of [[-8.2, 1.1, 0.8], [-6.9, 2.9, 0.6], [8.5, 2.1, 0.75], [3.6, 4.3, 0.5], [-2.2, 4.1, 0.45]]) {
    const bush = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const blob = shadow(new THREE.Mesh(unitSphere, i % 2 ? M.leaf : M.leafLight));
      blob.position.set(rnd(-0.4, 0.4) * s, rnd(0, 0.25) * s, rnd(-0.25, 0.25) * s);
      blob.scale.setScalar(rnd(0.3, 0.52) * s);
      bush.add(blob);
    }
    bush.position.set(x, 0.28 * s, z);
    attackEnv.add(bush);
  }

  addGrassScatter(attackEnv, 52, -9.5, 9.5, -2, 4.5);
  addFlowerScatter(attackEnv, 24, -9, 9, -1, 4.4);
}

const slingGroup = new THREE.Group();
const SLING_ORIGIN = new THREE.Vector3(WX(SLING.x), 0, 0.2);
slingGroup.position.copy(SLING_ORIGIN);
attackRoot.add(slingGroup);
{
  const trunk = shadow(new THREE.Mesh(unitCylinder, M.woodDark));
  trunk.position.set(0, 0.55, 0);
  trunk.scale.set(0.095, 1.1, 0.095);
  slingGroup.add(trunk);
  const left = shadow(new THREE.Mesh(unitCylinder, M.woodDark));
  left.position.set(-0.26, 1.5, 0);
  left.scale.set(0.075, 1.127, 0.075);
  left.rotation.z = 0.48;
  slingGroup.add(left);
  const right = shadow(new THREE.Mesh(unitCylinder, M.woodDark));
  right.position.set(0.23, 1.425, 0);
  right.scale.set(0.075, 0.966, 0.075);
  right.rotation.z = -0.496;
  slingGroup.add(right);
  const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 6, 14), M.band);
  wrap.rotation.x = Math.PI / 2;
  wrap.position.set(0, 0.12, 0);
  slingGroup.add(wrap);
  const baseRock = shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), M.rock));
  baseRock.scale.set(1, 0.5, 0.8);
  baseRock.position.set(0, 0.06, 0.15);
  slingGroup.add(baseRock);
}
const TIP_L = new THREE.Vector3(SLING_ORIGIN.x - 0.52, 2.0, 0.32);
const TIP_R = new THREE.Vector3(SLING_ORIGIN.x + 0.46, 1.85, 0.32);
const bandL = new THREE.Mesh(unitCylinder, M.band);
const bandR = new THREE.Mesh(unitCylinder, M.band);
for (const b of [bandL, bandR]) {
  b.geometry.userData.shared = true;
  b.castShadow = true;
  attackRoot.add(b);
}
const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.16), M.band);
attackRoot.add(pouch);

const trajectory = [];
for (let i = 0; i < 32; i++) {
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffae4a, transparent: true, opacity: 0.95, depthWrite: false });
  const dot = new THREE.Mesh(unitSphere, dotMat);
  dot.scale.setScalar(0.085);
  dot.visible = false;
  dot.renderOrder = 6;
  trajectory.push(dot);
  attackRoot.add(dot);
}

const starsGeoCache = [];

function makeBlockMesh(b) {
  const geo = new THREE.BoxGeometry(b.w * U, b.h * U, 0.7);
  const mesh = new THREE.Mesh(geo, b.material === 'stone' ? M.stone : M.wood);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addEdges(mesh, b.material === 'stone' ? 0x68766f : 0x74482a, 0.35);
  return mesh;
}
function makePig(p) {
  const mesh = makePigMesh(p.r * U / 1);
  mesh.position.set(WX(p.x), WY(p.y), 0.5);
  attackObjects.add(mesh);
  p.mesh = mesh;
  return p;
}
function makeBird(b) {
  const mesh = makeBirdMesh(b.type, b.r * U / 1);
  mesh.position.set(WX(b.x), WY(b.y), 0.72);
  mesh.visible = false;
  attackObjects.add(mesh);
  b.mesh = mesh;
  return b;
}

function updateBand(mesh, a, b) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.scale.set(0.062, len, 0.062);
}

function levelSetup() {
  clearGroup(attackObjects);
  clearGroup(attackFx);
  particles = [];
  texts = [];
  const data = LEVELS[level].build();
  blocks = data.blocks;
  pigs = data.pigs;
  score = 0;
  gameOver = false;
  paused = false;
  draggedReset();
  launched = false;
  shotDone = false;
  postShot = 0;
  winTimer = 0;
  loseTimer = 0;
  shotTime = 0;
  restTime = 0;

  blocks.forEach(b => {
    const mesh = makeBlockMesh(b);
    b.mesh = mesh;
    attackObjects.add(mesh);
  });
  pigs.forEach(makePig);

  birds = LEVELS[level].birds.map((type, i) => ({
    type, x: SLING.x, y: SLING.y, r: BIRD[type].radius,
    used: false, alive: true, vx: 0, vy: 0, rotation: 0, mesh: null
  }));
  birds.forEach(makeBird);
  currentBird = birds[0];
  currentBird.mesh.visible = true;
  currentBird.mesh.position.set(WX(SLING.x), WY(SLING.y), 0.72);

  ui.title.textContent = LEVELS[level].name;
  ui.chapter.textContent = `CHAPTER 0${level + 1} · 3D ISLAND`;
  ui.mission.textContent = LEVELS[level].mission;
  ui.scoreLabel.textContent = 'SCORE';
  ui.hint.textContent = 'Drag the bird back, then let it fly!';
  ui.action.classList.remove('hidden');
  ui.build.classList.add('hidden');
  ui.shell.classList.remove('build-mode');
  ui.result.classList.add('hidden');
  $('nextBtn').classList.add('hidden');
  updateScore();
  updateTray();
  updateProgress();
  syncAttack(0);
}

function syncAttack(dt) {
  for (const b of blocks) {
    if (!b.mesh) continue;
    b.mesh.visible = b.alive;
    if (!b.alive) continue;
    b.mesh.position.set(WX(b.x), WY(b.y), 0);
    b.mesh.rotation.z = -b.angle;
  }
  for (const p of pigs) {
    if (!p.mesh) continue;
    p.mesh.visible = p.alive;
    if (!p.alive) continue;
    p.mesh.position.set(WX(p.x), WY(p.y), 0.5);
    p.mesh.rotation.z = -p.angle;
    p.blink -= dt;
    if (p.blink < -0.1) p.blink = rnd(2.4, 5);
  }
  if (currentBird && currentBird.mesh) {
    currentBird.mesh.visible = currentBird.alive;
    if (currentBird.alive) {
      currentBird.mesh.position.set(WX(currentBird.x), WY(currentBird.y), 0.72);
      currentBird.mesh.rotation.z = -currentBird.rotation;
    }
  }
  const showBands = currentBird && currentBird.alive && !launched;
  bandL.visible = bandR.visible = pouch.visible = showBands;
  if (showBands) {
    const anchor = new THREE.Vector3(WX(currentBird.x), WY(currentBird.y), 0.62);
    updateBand(bandL, TIP_L, anchor);
    updateBand(bandR, TIP_R, anchor);
    pouch.position.copy(anchor);
    pouch.rotation.z = -0.2;
  }
  updateTrajectory();
}

function updateTrajectory() {
  if (!dragging || !dragPos || !currentBird) {
    trajectory.forEach(d => d.visible = false);
    return;
  }
  const dx = SLING.x - dragPos.x, dy = SLING.y - dragPos.y;
  const mag = Math.hypot(dx, dy);
  if (mag < 8) { trajectory.forEach(d => d.visible = false); return; }
  const f = Math.min(1.75, mag / 72);
  const vx = dx * 5.2 * f, vy = dy * 5.2 * f;
  trajectory.forEach((dot, i) => {
    const t = (i + 1) * 0.085;
    const x = SLING.x + vx * t;
    const y = SLING.y + vy * t + GRAVITY * t * t / 2;
    if (y > GROUND - 8 || x > 1020) { dot.visible = false; return; }
    dot.visible = true;
    dot.position.set(WX(x), WY(y), 0.9);
    const s = clamp(0.1 - i * 0.003, 0.035, 0.1);
    dot.scale.setScalar(s);
  });
}

function draggedReset() {
  dragging = false;
  dragPos = null;
}

/* ------------------------------------------------------------------ *
 *  Effects
 * ------------------------------------------------------------------ */

function spawnParticleBurst(worldX, worldY, color, count = 12, group = attackFx) {
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(unitSphere, mat);
    mesh.scale.setScalar(rnd(0.035, 0.085));
    mesh.position.set(worldX + rnd(-0.12, 0.12), worldY + rnd(-0.12, 0.12), rnd(0.5, 1.2));
    group.add(mesh);
    particles.push({
      mesh, mat,
      vx: rnd(-2.6, 2.6), vy: rnd(1.2, 4.4), vz: rnd(-0.5, 0.7),
      life: rnd(0.45, 0.9), max: 0.9
    });
  }
}
function burstGame(x, y, color, count = 14) {
  spawnParticleBurst(WX(x), WY(y), color, count, attackFx);
}
function burstWorld(x, y, color, count = 14) {
  spawnParticleBurst(x, y, color, count, buildFx);
}
function textGame(x, y, text, color = '#ffffff', scale = 1) {
  const sprite = makeTextSprite(text, color);
  sprite.scale.multiplyScalar(scale);
  sprite.position.set(WX(x), WY(y) + 0.3, 1.3);
  attackFx.add(sprite);
  texts.push({ sprite, life: 1.1, max: 1.1 });
}
function textWorld(x, y, text, color = '#ffffff', scale = 1) {
  const sprite = makeTextSprite(text, color);
  sprite.scale.multiplyScalar(scale);
  sprite.position.set(x, y + 0.3, 1.4);
  buildFx.add(sprite);
  texts.push({ sprite, life: 1.1, max: 1.1 });
}
function updateEffects(dt) {
  for (const p of particles) {
    p.vy -= 8 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.vx *= 0.985;
    p.life -= dt;
    p.mat.opacity = clamp(p.life / 0.55, 0, 1);
    p.mesh.scale.multiplyScalar(0.985);
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.life <= 0) {
      p.mesh.parent?.remove(p.mesh);
      p.mat.dispose();
      particles.splice(i, 1);
    }
  }
  for (const t of texts) {
    t.life -= dt;
    t.sprite.position.y += dt * 0.62;
    t.sprite.material.opacity = clamp(t.life / 0.55, 0, 1);
  }
  for (let i = texts.length - 1; i >= 0; i--) {
    if (texts[i].life <= 0) {
      const s = texts[i].sprite;
      s.parent?.remove(s);
      s.material.map?.dispose();
      s.material.dispose();
      texts.splice(i, 1);
    }
  }
}

/* ------------------------------------------------------------------ *
 *  Attack gameplay
 * ------------------------------------------------------------------ */

function damageBlock(b, impulseX = 0, impulseY = 0, forceSound = true) {
  if (!b.alive) return;
  b.hp--;
  b.dynamic = true;
  b.vx += clamp(impulseX, -260, 260) * 0.32;
  b.vy += clamp(impulseY, -260, 260) * 0.2;
  b.spin += rnd(-0.9, 0.9);
  if (b.hp <= 0) {
    b.alive = false;
    score += 100;
    updateScore();
    burstGame(b.x, b.y, b.material === 'wood' ? '#dca36a' : '#c6d1bc', 12);
    if (forceSound) sfx('break');
    attackShake(0.1);
  } else {
    burstGame(b.x - b.w * 0.2, b.y, '#e6c394', 4);
    if (forceSound) sfx('hit');
    attackShake(0.055);
  }
}

function killPig(p, direct = true) {
  if (!p.alive) return;
  p.alive = false;
  score += 500;
  updateScore();
  updateProgress();
  burstGame(p.x, p.y, '#79d05d', 20);
  textGame(p.x, p.y - 24, direct ? 'OINK! +500' : 'SQUISH! +500', '#ffffff', 0.92);
  sfx('pop');
  attackShake(0.16);
  winTimer = 0;
}

function attackShake(amount) {
  CAM.shake = Math.max(CAM.shake, amount);
}

function blockSupported(b) {
  const bottom = b.y + b.h / 2;
  if (bottom >= GROUND - 2.5) return true;
  for (const o of blocks) {
    if (o === b || !o.alive) continue;
    const top = o.y - o.h / 2;
    if (Math.abs(top - bottom) < 8 && Math.abs(o.x - b.x) < (o.w + b.w) / 2 - 6) return true;
  }
  return false;
}
function pigSupported(p) {
  if (p.y + p.r >= GROUND - 2.5) return true;
  for (const b of blocks) {
    if (!b.alive) continue;
    const top = b.y - b.h / 2;
    if (Math.abs((p.y + p.r) - top) < 8 && Math.abs(p.x - b.x) < b.w / 2 + p.r * 0.45) return true;
  }
  return false;
}

function circleRectDistance(px, py, b) {
  const nx = clamp(px, b.x - b.w / 2, b.x + b.w / 2);
  const ny = clamp(py, b.y - b.h / 2, b.y + b.h / 2);
  return { nx, ny, d: Math.hypot(px - nx, py - ny) };
}

function stepBird(dt) {
  const b = currentBird;
  if (!b) return;
  shotTime += dt;
  b.vy += GRAVITY * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.rotation += b.vx * dt * 0.032;
  if (shotTime > 0.55 && Math.hypot(b.vx, b.vy) < 165) restTime += dt; else restTime = 0;

  for (const p of pigs) {
    if (!p.alive) continue;
    if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r + 3) {
      killPig(p);
      b.vx *= 0.66;
      b.vy = Math.abs(b.vy) * 0.25 - 60;
      b.rotation += 2;
    }
  }

  for (const blk of blocks) {
    if (!blk.alive) continue;
    const hit = circleRectDistance(b.x, b.y, blk);
    if (hit.d < b.r + 3) {
      const impact = Math.hypot(b.vx, b.vy);
      damageBlock(blk, b.vx, b.vy);
      const dx = b.x - hit.nx, dy = b.y - hit.ny;
      const len = Math.max(1, Math.hypot(dx, dy));
      b.x = hit.nx + (dx / len) * (b.r + 5);
      b.y = hit.ny + (dy / len) * (b.r + 5);
      b.vx *= 0.46;
      b.vy *= 0.36;
      if (impact > 260) shotTime = Math.min(shotTime, 0.75);
      break;
    }
  }

  if (b.y + b.r >= GROUND) {
    b.y = GROUND - b.r;
    if (b.vy > 80) {
      b.vy *= -0.26;
      b.vx *= 0.72;
      burstGame(b.x, GROUND - 4, '#d8c79b', 5);
    } else {
      b.vy = 0;
      b.vx *= 0.9;
    }
    if (Math.abs(b.vx) < 55) finishShot();
  }

  if (b.x > 1060 || b.x < -90 || b.y < -180 || b.y > 640 || shotTime > 6 || restTime > 0.5) finishShot();
}

function updateBlocks(dt) {
  for (const b of blocks) {
    if (!b.alive || !b.dynamic) continue;
    b.vy += GRAVITY * 0.58 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.angle += b.spin * dt;
    const bottom = b.y + b.h / 2;

    if (b.vy > 0) {
      for (const o of blocks) {
        if (o === b || !o.alive || o.dynamic) continue;
        const top = o.y - o.h / 2;
        if (bottom > top && bottom < top + 18 && Math.abs(b.x - o.x) < (b.w + o.w) / 2 - 5) {
          b.y = top - b.h / 2;
          b.vy *= -0.18;
          b.vx *= 0.7;
          b.spin *= 0.55;
          if (Math.abs(b.vy) < 28) b.vy = 0;
          break;
        }
      }
    }

    if (b.y + b.h / 2 >= GROUND) {
      b.y = GROUND - b.h / 2;
      if (b.vy > 190) {
        burstGame(b.x, GROUND - 4, b.material === 'wood' ? '#dca36a' : '#c6d1bc', 7);
        sfx('hit');
      }
      b.vy *= -0.2;
      b.vx *= 0.74;
      b.spin *= 0.62;
      if (Math.abs(b.vy) < 25) b.vy = 0;
      if (Math.abs(b.vx) < 8) b.vx = 0;
    }
    if (b.x < -70 || b.x > 1080 || b.y > 680) b.alive = false;

    if (Math.abs(b.vx) + Math.abs(b.vy) > 100) {
      for (const p of pigs) {
        if (!p.alive) continue;
        const hit = circleRectDistance(p.x, p.y, b);
        if (hit.d < p.r - 1) killPig(p, false);
      }
    }
  }
}

function updatePigs(dt) {
  for (const p of pigs) {
    if (!p.alive) continue;
    if (p.grounded) {
      if (!pigSupported(p)) {
        p.grounded = false;
        p.vy = 0;
        p.vx = rnd(-14, 14);
        p.angle = 0;
      }
      continue;
    }
    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.angle += p.vx * dt * 0.005;
    if (p.y + p.r >= GROUND) {
      if (p.vy > 330) { killPig(p, false); continue; }
      p.y = GROUND - p.r;
      p.vy *= -0.18;
      p.vx *= 0.7;
      p.angle *= 0.6;
      if (Math.abs(p.vy) < 35 && Math.abs(p.vx) < 22) {
        p.vy = 0;
        p.vx = 0;
        p.grounded = true;
        p.angle = 0;
      }
    }
    if (p.y > 650) killPig(p, false);
  }
}

function updateSupport() {
  for (const b of blocks) {
    if (!b.alive || b.dynamic) continue;
    if (!blockSupported(b)) {
      b.dynamic = true;
      b.vy = 6;
      b.vx = rnd(-12, 12);
      b.spin = rnd(-0.55, 0.55);
    }
  }
}

function finishShot() {
  if (!launched || shotDone) return;
  launched = false;
  shotDone = true;
  postShot = 0.8;
}

function loadNextBird() {
  if (currentBird) {
    currentBird.alive = false;
    if (currentBird.mesh) currentBird.mesh.visible = false;
    currentBird = null;
  }
  const next = birds.find(b => !b.used);
  if (next) {
    next.x = SLING.x;
    next.y = SLING.y;
    next.vx = next.vy = 0;
    next.rotation = 0;
    next.alive = true;
    next.used = false;
    next.mesh.visible = true;
    next.mesh.position.set(WX(SLING.x), WY(SLING.y), 0.72);
    currentBird = next;
    launched = false;
    shotDone = false;
    shotTime = 0;
    restTime = 0;
    ui.hint.textContent = 'Another bird, another chance!';
    updateTray();
  }
}

function launch() {
  if (!currentBird || !dragging) return;
  const dx = SLING.x - dragPos.x;
  const dy = SLING.y - dragPos.y;
  const mag = Math.hypot(dx, dy);
  dragging = false;
  if (mag < 9) {
    currentBird.x = SLING.x;
    currentBird.y = SLING.y;
    dragPos = null;
    return;
  }
  const f = Math.min(1.75, mag / 72);
  currentBird.x = SLING.x;
  currentBird.y = SLING.y;
  currentBird.vx = dx * 5.2 * f;
  currentBird.vy = dy * 5.2 * f;
  currentBird.used = true;
  currentBird.alive = true;
  currentBird.rotation = 0;
  launched = true;
  shotDone = false;
  shotTime = 0;
  restTime = 0;
  dragPos = null;
  updateTray();
  sfx('launch');
  attackShake(0.07);
  ui.hint.textContent = 'Watch the tower tumble!';
}

function checkEnd(dt) {
  if (pigs.every(p => !p.alive)) {
    winTimer += dt;
    if (winTimer > 0.9) endGame(true);
    return;
  }
  if (!currentBird && !launched && postShot <= 0 && birds.length && birds.every(b => b.used)) {
    loseTimer += dt;
    if (loseTimer > 1.2) endGame(false);
  }
}

function updateAttack(dt) {
  if (postShot > 0) {
    postShot -= dt;
    if (postShot <= 0) loadNextBird();
  }
  if (launched && currentBird && currentBird.alive) stepBird(dt);
  updateBlocks(dt);
  updatePigs(dt);
  updateSupport();
  checkEnd(dt);
}

function endGame(won) {
  if (gameOver) return;
  gameOver = true;
  launched = false;
  shotDone = true;
  dragging = false;
  const used = birds.filter(b => b.used).length;
  if (won) {
    const spare = birds.filter(b => !b.used).length;
    score += spare * 1000;
    updateScore();
  }
  const starCount = won ? clamp(4 - used, 1, 3) : 0;
  const starRow = won ? '★'.repeat(starCount) + '☆'.repeat(3 - starCount) : '☆☆☆';
  sfx(won ? 'win' : 'lose');
  showResult({
    emoji: won ? '🏆' : '💥',
    eyebrow: won ? starRow : 'NICE TRY!',
    title: won ? 'PIGS DEFEATED' : 'THE PIGS GOT AWAY',
    copy: won
      ? `${birds.filter(b => !b.used).length} bird${birds.filter(b => !b.used).length === 1 ? '' : 's'} to spare. The flock is flying high!`
      : 'Aim for the weak supports and let gravity do the rest.',
    scoreValue: score,
    next: won && level < LEVELS.length - 1,
    button: won ? (level < LEVELS.length - 1 ? 'NEXT LEVEL →' : 'PLAY AGAIN →') : 'TRY AGAIN →',
    again: won && level >= LEVELS.length - 1
  });
}

/* Called by showResult when the player retries an attack level */
function retryAttack() {
  ui.result.classList.add('hidden');
  gameOver = false;
  levelSetup();
}

/* ------------------------------------------------------------------ *
 *  Bad Piggies workshop
 * ------------------------------------------------------------------ */

const BUILD = { startX: -5.0, startY: 0, goalX: 8.2, gapStart: 0.6, gapEnd: 5.75 };
const buildRoot = new THREE.Group();
const buildEnv = new THREE.Group();
const partsGroup = new THREE.Group();
const contraption = new THREE.Group();
const buildFx = new THREE.Group();
buildRoot.add(buildEnv, contraption, buildFx);
contraption.add(partsGroup);
scene.add(buildRoot);
buildRoot.visible = false;

let buildObjects = [], buildHistory = [], buildPart = 'wood';
let buildStars = [], driving = false, driveTime = 0, collectedStars = 0;
let vehicle = { x: BUILD.startX, y: 0, vy: 0, grounded: true, vx: 0 };
let vehicleGroup = null;

function terrainAt(x) {
  if (x <= BUILD.gapStart) return 0;
  if (x >= BUILD.gapEnd) return 0;
  return null;
}

{
  const platformMats = [M.dirt, M.dirt, M.grass, M.dirt, M.dirt, M.dirt];
  const a = new THREE.Mesh(new THREE.BoxGeometry(10.2, 1.7, 9), platformMats);
  a.position.set(-4.5, -0.85, -1.0);
  a.castShadow = a.receiveShadow = true;
  buildEnv.add(a);

  const b = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.7, 9), platformMats);
  b.position.set(9.15, -0.85, -1.0);
  b.castShadow = b.receiveShadow = true;
  buildEnv.add(b);

  const lipA = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 9), M.sand);
  lipA.position.set(0.55, -0.05, -1.0);
  buildEnv.add(lipA);
  const lipB = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 9), M.sand);
  lipB.position.set(5.8, -0.05, -1.0);
  buildEnv.add(lipB);

  /* scattered rocks and grass on the course */
  for (const [x, z, s] of [[-8.2, 2.7, 0.42], [-6.7, 3.4, 0.3], [7.0, 2.9, 0.4], [10.4, 1.7, 0.5], [3.0, -2.2, 0.35]]) {
    const rock = shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), M.rock));
    rock.position.set(x, s * 0.5, z);
    rock.rotation.set(x, z, s);
    buildEnv.add(rock);
  }
  addGrassScatter(buildEnv, 38, -9, 11.5, -3, 3.8);
  addFlowerScatter(buildEnv, 18, -9, 11, -2.5, 3.5);

  /* goal arch */
  const postGeo = new THREE.CylinderGeometry(0.09, 0.11, 3.0, 10);
  for (const x of [7.15, 9.15]) {
    const post = shadow(new THREE.Mesh(postGeo, M.woodDark));
    post.position.set(x, 1.5, 0.1);
    buildEnv.add(post);
  }
  const bar = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.16, 0.18), M.woodDark));
  bar.position.set(8.15, 2.95, 0.1);
  buildEnv.add(bar);

  const bannerCanvas = document.createElement('canvas');
  bannerCanvas.width = 512;
  bannerCanvas.height = 128;
  const bg = bannerCanvas.getContext('2d');
  bg.fillStyle = '#f47b35';
  bg.fillRect(0, 0, 512, 128);
  bg.fillStyle = '#ffe9b8';
  bg.fillRect(8, 8, 496, 112);
  bg.fillStyle = '#3c6256';
  bg.font = '900 62px Nunito, sans-serif';
  bg.textAlign = 'center';
  bg.textBaseline = 'middle';
  bg.fillText('PIGGY PEAK', 256, 70);
  const bannerTex = new THREE.CanvasTexture(bannerCanvas);
  bannerTex.colorSpace = THREE.SRGBColorSpace;
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(1.85, 0.46),
    new THREE.MeshLambertMaterial({ map: bannerTex })
  );
  banner.position.set(8.15, 2.62, 0.2);
  buildEnv.add(banner);

  /* finish line */
  for (let i = 0; i < 8; i++) {
    const tile = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.018, 0.36), i % 2 ? M.white : M.dark);
    tile.position.set(8.15, 0.02, -1.9 + i * 0.38);
    buildEnv.add(tile);
  }

  /* spectator pigs */
  const fan1 = makePigMesh(0.3);
  fan1.position.set(9.9, 0.3, 1.0);
  fan1.rotation.y = -0.4;
  buildEnv.add(fan1);
  const fan2 = makePigMesh(0.26);
  fan2.position.set(10.5, 0.26, 0.2);
  fan2.rotation.y = -0.6;
  buildEnv.add(fan2);
}

/* build zone outline */
{
  const zone = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, 3.4),
    new THREE.MeshBasicMaterial({ color: 0x8ff0c8, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide })
  );
  zone.position.set(-4.25, 1.73, 0.12);
  buildEnv.add(zone);
  const pts = [
    new THREE.Vector3(-7.5, 0.06, 0.4), new THREE.Vector3(-1.0, 0.06, 0.4),
    new THREE.Vector3(-1.0, 3.45, 0.4), new THREE.Vector3(-7.5, 3.45, 0.4),
    new THREE.Vector3(-7.5, 0.06, 0.4)
  ];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(geo, new THREE.LineDashedMaterial({
    color: 0x2f9c76, dashSize: 0.2, gapSize: 0.12, transparent: true, opacity: 1
  }));
  line.computeLineDistances();
  buildEnv.add(line);
  const label = makeTextSprite('BUILD ZONE', '#2f7f63', 44);
  label.position.set(-4.25, 3.3, 0.45);
  label.scale.multiplyScalar(0.62);
  buildEnv.add(label);
}

function makeStarMesh(x, y) {
  const group = new THREE.Group();
  const shape = new THREE.Shape();
  const spikes = 5;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? 0.18 : 0.42;
    const a = -Math.PI / 2 + i * Math.PI / spikes;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) shape.moveTo(px, py); else shape.lineTo(px, py);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.12, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 2
  });
  geo.center();
  const star = shadow(new THREE.Mesh(geo, M.gold));
  group.add(star);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunTex, color: 0xffe680, transparent: true, opacity: 0.45, depthWrite: false
  }));
  glow.scale.set(1.45, 1.45, 1);
  group.add(glow);
  group.position.set(x, y, 0.55);
  buildEnv.add(group);
  return { x, y, mesh: group, collected: false };
}

for (const [x, y] of [[-1.45, 1.3], [2.85, 2.15], [6.3, 1.45]]) {
  buildStars.push(makeStarMesh(x, y));
}

function makeVehicle() {
  const g = new THREE.Group();
  const base = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.22, 0.86), M.wood));
  base.position.y = 0.3;
  addEdges(base, 0x74482a, 0.25);
  g.add(base);
  const deck = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.14, 0.72), M.wood));
  deck.position.y = 0.48;
  g.add(deck);
  for (const sx of [-0.62, 0.62]) {
    const skid = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 1.2), M.woodDark));
    skid.position.set(sx, 0.15, 0);
    g.add(skid);
  }
  const driver = makePigMesh(0.27);
  driver.position.set(0, 0.78, 0.12);
  g.add(driver);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 12), M.dark);
  wheel.position.set(0.28, 0.62, 0.36);
  wheel.rotation.x = -0.35;
  g.add(wheel);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.42, 8), M.dark);
  pipe.position.set(-0.5, 0.7, 0.1);
  g.add(pipe);
  g.position.set(BUILD.startX, 0, 0.3);
  contraption.add(g);
  return g;
}
vehicleGroup = makeVehicle();

function makePartMesh(o) {
  const mesh = new THREE.Group();
  if (o.kind === 'wood') {
    const block = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.3, 0.58), M.wood));
    addEdges(block, 0x74482a, 0.3);
    mesh.add(block);
  } else if (o.kind === 'wheel') {
    const tire = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 18), M.dark));
    tire.rotation.x = Math.PI / 2;
    mesh.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.21, 12), M.rock);
    hub.rotation.x = Math.PI / 2;
    mesh.add(hub);
    for (let i = 0; i < 4; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.035, 0.2), M.rock);
      spoke.rotation.z = i * Math.PI / 4;
      mesh.add(spoke);
    }
  } else {
    const balloon = shadow(new THREE.Mesh(unitSphere, M.red));
    balloon.scale.set(0.32, 0.4, 0.32);
    mesh.add(balloon);
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.12, 6), M.red);
    knot.position.y = -0.38;
    knot.rotation.z = Math.PI;
    mesh.add(knot);
    const string = new THREE.Mesh(unitCylinder, M.band);
    string.position.y = -0.75;
    string.scale.set(0.012, 0.66, 0.012);
    mesh.add(string);
    const shine = new THREE.Mesh(unitSphere, M.white);
    shine.position.set(-0.1, 0.13, 0.2);
    shine.scale.setScalar(0.06);
    mesh.add(shine);
  }
  mesh.position.set(o.x, o.y, 0.3);
  return mesh;
}

function rebuildParts() {
  clearGroup(partsGroup);
  for (const o of buildObjects) {
    o.mesh = makePartMesh(o);
    partsGroup.add(o.mesh);
  }
}
function snapBuild() {
  buildHistory.push(buildObjects.map(o => ({ kind: o.kind, material: o.material, x: o.x, y: o.y })));
  if (buildHistory.length > 30) buildHistory.shift();
}

function buildSetup() {
  driving = false;
  gameOver = false;
  paused = false;
  driveTime = 0;
  collectedStars = 0;
  score = 0;
  vehicle = { x: BUILD.startX, y: 0, vy: 0, grounded: true, vx: 0 };
  buildObjects = [];
  buildHistory = [];
  buildPart = 'wood';
  contraption.position.set(0, 0, 0);
  contraption.rotation.set(0, 0, 0);
  vehicleGroup.position.set(BUILD.startX, 0, 0.3);
  clearGroup(partsGroup);
  clearGroup(buildFx);
  particles = [];
  texts = [];
  buildStars.forEach(s => {
    s.collected = false;
    s.mesh.visible = true;
    s.mesh.scale.setScalar(1);
  });
  document.querySelectorAll('.part').forEach(p => p.classList.toggle('active', p.dataset.part === 'wood'));
  $('buildHint').textContent = 'Add a wheel, a balloon and some wood. Then DRIVE!';
  $('driveBtn').textContent = '▶ DRIVE';
  $('driveBtn').classList.remove('driving');
  ui.title.textContent = 'SCRAPYARD';
  ui.chapter.textContent = 'BAD PIGGIES · WORKSHOP';
  ui.mission.textContent = 'Build a ride and cross the gap!';
  ui.scoreLabel.textContent = 'SCORE';
  ui.hint.textContent = 'Tap the workbench to bolt on parts.';
  ui.progressText.textContent = '0 / 3 STARS';
  ui.progress.style.width = '0%';
  ui.action.classList.add('hidden');
  ui.build.classList.remove('hidden');
  ui.result.classList.add('hidden');
  ui.shell.classList.add('build-mode');
  ui.score.textContent = '000000';
  $('nextBtn').classList.add('hidden');
  updateScore();
  syncBuild(0);
}

function placePart(wx, wy) {
  if (driving || gameOver) return;
  if (wx < -7.4 || wx > -1.05 || wy < 0.12 || wy > 3.3) {
    notify('Build inside the green workbench!');
    return;
  }
  if (buildObjects.length >= 12) {
    notify('The scrapyard is full!');
    return;
  }
  const snap = 0.1;
  const x = Math.round(wx / snap) * snap;
  const y = Math.round(wy / snap) * snap;
  snapBuild();
  const o = { kind: buildPart, material: buildPart, x, y, bob: rnd(0, 6.28) };
  buildObjects.push(o);
  o.mesh = makePartMesh(o);
  partsGroup.add(o.mesh);
  sfx('place');
  spawnParticleBurst(x, y, buildPart === 'wood' ? '#dca36a' : buildPart === 'wheel' ? '#8a9996' : '#f08b82', 5, buildFx);
  updateProgress();
}

function undoBuild() {
  if (driving) return;
  if (!buildHistory.length) { notify('Nothing to undo yet.'); return; }
  buildObjects = buildHistory.pop().map(o => ({ ...o }));
  rebuildParts();
  updateProgress();
  sfx('place');
}
function clearBuild() {
  if (driving) return;
  if (!buildObjects.length) { notify('The workbench is already clear.'); return; }
  snapBuild();
  buildObjects = [];
  rebuildParts();
  updateProgress();
  sfx('place');
}

function startDrive() {
  if (driving || gameOver) return;
  const wheels = buildObjects.filter(o => o.kind === 'wheel').length;
  const balloons = buildObjects.filter(o => o.kind === 'balloon').length;
  if (!wheels) {
    notify('Bolt on at least one wheel first!');
    sfx('lose');
    return;
  }
  driving = true;
  driveTime = 0;
  score = 0;
  collectedStars = 0;
  vehicle = { x: BUILD.startX, y: 0, vy: 0, grounded: true, vx: 0 };
  contraption.position.set(0, 0, 0);
  contraption.rotation.set(0, 0, 0);
  buildStars.forEach(s => { s.collected = false; s.mesh.visible = true; s.mesh.scale.setScalar(1); });
  $('driveBtn').textContent = '🚗 DRIVING…';
  $('driveBtn').classList.add('driving');
  ui.build.classList.add('hidden');
  ui.hint.textContent = balloons ? 'Hold → to boost. The balloons are lifting!' : 'The gap is wide — build with a balloon next time!';
  notify(balloons ? 'Hold → or D to boost!' : 'No balloon! You may not clear the gap…');
  sfx('drive');
  updateScore();
  updateProgress();
}

function collectStar(s) {
  if (s.collected) return;
  s.collected = true;
  s.mesh.visible = false;
  collectedStars++;
  score += 250;
  updateScore();
  updateProgress();
  burstWorld(s.x, s.y, '#ffd95e', 16);
  textWorld(s.x, s.y, 'STAR +250', '#fff4b8', 0.8);
  sfx('star');
}

function finishBuildDrive(won) {
  if (!driving) return;
  driving = false;
  gameOver = true;
  const wheels = buildObjects.filter(o => o.kind === 'wheel').length;
  const balloons = buildObjects.filter(o => o.kind === 'balloon').length;
  if (won) {
    score += 500 + wheels * 50 + balloons * 100;
    updateScore();
  }
  sfx(won ? 'win' : 'lose');
  showResult({
    emoji: won ? '🎉' : '🛠️',
    eyebrow: won ? '★'.repeat(collectedStars) + '☆'.repeat(3 - collectedStars) : 'BACK TO THE BENCH',
    title: won ? 'PIGGY PEAK REACHED' : 'THE GAP GOT YOU',
    copy: won
      ? `${collectedStars}/3 stars · ${wheels} wheel${wheels === 1 ? '' : 's'} · ${balloons} balloon${balloons === 1 ? '' : 's'}`
      : 'Add a balloon to float across the gap, then give it another go.',
    scoreValue: score,
    next: false,
    button: 'BUILD AGAIN →'
  });
  $('driveBtn').textContent = '▶ DRIVE';
  $('driveBtn').classList.remove('driving');
}

function updateBuild(dt) {
  driveTime += dt;
  for (const s of buildStars) {
    if (!s.mesh.visible) continue;
    s.mesh.rotation.y = Math.sin(driveTime * 1.3 + s.x) * 0.55;
    s.mesh.position.y = s.y + Math.sin(driveTime * 2 + s.x) * 0.08;
  }
  for (const o of buildObjects) {
    if (o.kind === 'balloon' && o.mesh) {
      o.mesh.position.y = o.y + Math.sin(driveTime * 2.2 + o.bob) * 0.055;
      o.mesh.rotation.z = Math.sin(driveTime * 1.4 + o.bob) * 0.06;
    }
  }
  if (!driving) return;

  const wheels = buildObjects.filter(o => o.kind === 'wheel').length;
  const balloons = buildObjects.filter(o => o.kind === 'balloon').length;
  const boost = (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) ? 2.0 : 0;
  const speed = 6.0 + Math.min(wheels, 3) * 0.45 + boost;
  vehicle.x += speed * dt;

  const gravity = 11 - Math.min(balloons, 2) * 10.4;
  vehicle.vy -= gravity * dt;
  vehicle.vy = clamp(vehicle.vy, -7, 4.2);
  vehicle.y += vehicle.vy * dt;

  if (vehicle.y > 3.0) {
    vehicle.y = 3.0;
    vehicle.vy = Math.min(vehicle.vy, 0);
  }

  const ground = terrainAt(vehicle.x);
  if (ground !== null) {
    if (vehicle.y <= ground + 0.45) {
      if (vehicle.y < ground - 1.1) {
        finishBuildDrive(false);
        return;
      }
      vehicle.y = ground;
      vehicle.vy = 0;
      vehicle.grounded = true;
    } else {
      vehicle.grounded = false;
    }
  } else {
    vehicle.grounded = false;
  }

  if (vehicle.y < -2.4) {
    finishBuildDrive(false);
    return;
  }

  contraption.position.set(vehicle.x - BUILD.startX, vehicle.y, 0);
  contraption.rotation.z = clamp(vehicle.vy * 0.045, -0.14, 0.14) + Math.sin(driveTime * 9) * 0.008;

  for (const o of buildObjects) {
    if (o.kind === 'wheel' && o.mesh) o.mesh.rotation.z -= speed * dt / 0.32;
  }

  for (const s of buildStars) {
    if (!s.collected && Math.abs(vehicle.x - s.x) < 0.7) collectStar(s);
  }

  ui.progress.style.width = clamp(vehicle.x / BUILD.goalX, 0, 1) * 100 + '%';
  ui.progressText.textContent = `${collectedStars} / 3 STARS`;

  if (vehicle.x >= BUILD.goalX) {
    finishBuildDrive(true);
  }
}

function syncBuild(dt) {
  if (!driving) {
    contraption.position.set(0, 0, 0);
    contraption.rotation.set(0, 0, 0);
  }
  for (const o of buildObjects) {
    if (!o.mesh) continue;
    o.mesh.position.x = o.x;
    o.mesh.position.z = 0.3;
    if (o.kind !== 'balloon') o.mesh.position.y = o.y;
  }
}

/* ------------------------------------------------------------------ *
 *  UI flow
 * ------------------------------------------------------------------ */

let resultWon = false;

function showResult({ emoji, eyebrow, title, copy, scoreValue, next = false, button = 'PLAY AGAIN →' }) {
  gameOver = true;
  paused = false;
  ui.action.classList.add('hidden');
  ui.notice.classList.remove('show');
  resultWon = !!next || title === 'PIGS DEFEATED' || title === 'PIGGY PEAK REACHED';
  $('resultEmoji').textContent = emoji;
  $('resultEyebrow').textContent = eyebrow;
  $('resultTitle').textContent = title;
  $('resultCopy').textContent = copy;
  $('resultScore').textContent = String(Math.max(0, Math.round(scoreValue))).padStart(6, '0');
  $('resultButton').textContent = button;
  $('nextBtn').classList.toggle('hidden', !next);
  ui.result.classList.remove('hidden');
}

function beginGame(nextMode) {
  ensureAudio();
  mode = nextMode;
  ui.shell.classList.remove('menu-open');
  ui.modal.classList.add('hidden');
  ui.result.classList.add('hidden');
  ui.pause.classList.add('hidden');
  paused = false;
  gameOver = false;
  $('attackTab').classList.toggle('active', mode === 'attack');
  $('buildTab').classList.toggle('active', mode === 'build');
  resize();
  if (mode === 'attack') {
    attackRoot.visible = true;
    buildRoot.visible = false;
    levelSetup();
  } else {
    attackRoot.visible = false;
    buildRoot.visible = true;
    buildSetup();
  }
}

function backToMenu() {
  ui.result.classList.add('hidden');
  ui.pause.classList.add('hidden');
  ui.modal.classList.remove('hidden');
  ui.shell.classList.add('menu-open');
  paused = false;
}

/* ------------------------------------------------------------------ *
 *  Input
 * ------------------------------------------------------------------ */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.72);

function pointerToWorld(clientX, clientY, z) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -z);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, hit)) return null;
  return hit;
}

canvas.addEventListener('pointerdown', e => {
  if (!ui.modal.classList.contains('hidden') || paused || gameOver) return;
  ensureAudio();
  canvas.setPointerCapture(e.pointerId);
  if (mode === 'attack') {
    if (launched || !currentBird) return;
    const p = pointerToWorld(e.clientX, e.clientY, 0.72);
    if (!p) return;
    const gx = p.x / U + 500, gy = GROUND - p.y / U;
    if (Math.hypot(gx - currentBird.x, gy - currentBird.y) < 62) {
      dragging = true;
      dragPos = { x: gx, y: gy };
      sfx('stretch');
    }
  } else if (!driving) {
    const p = pointerToWorld(e.clientX, e.clientY, 0.3);
    if (p) placePart(p.x, p.y);
  }
});

canvas.addEventListener('pointermove', e => {
  if (!dragging || !currentBird) return;
  const p = pointerToWorld(e.clientX, e.clientY, 0.72);
  if (!p) return;
  const gx = p.x / U + 500, gy = GROUND - p.y / U;
  let dx = gx - SLING.x, dy = gy - SLING.y;
  const len = Math.hypot(dx, dy), max = 95;
  if (len > max) { dx = dx / len * max; dy = dy / len * max; }
  dragPos = { x: clamp(SLING.x + dx, 58, 285), y: Math.min(SLING.y + dy, GROUND - 8) };
  currentBird.x = dragPos.x;
  currentBird.y = dragPos.y;
});

function releasePointer() {
  if (dragging) launch();
}
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('lostpointercapture', () => { if (dragging) launch(); });

const keys = new Set();
addEventListener('keydown', e => {
  if (['ArrowRight', 'ArrowLeft', ' ', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
  keys.add(e.key);
  if (e.key === 'Escape') togglePause();
  if ((e.key === ' ' || e.key === 'ArrowUp') && mode === 'build' && driving && !e.repeat) {
    if (vehicle.grounded) {
      vehicle.vy = 4.6;
      vehicle.grounded = false;
      sfx('jump');
      notify('HOP!');
    }
  }
});
addEventListener('keyup', e => keys.delete(e.key));
addEventListener('blur', () => keys.clear());

/* ------------------------------------------------------------------ *
 *  Buttons
 * ------------------------------------------------------------------ */

$('playAttack').addEventListener('click', () => beginGame('attack'));
$('playBuild').addEventListener('click', () => beginGame('build'));
$('attackTab').addEventListener('click', () => { if (mode !== 'attack') beginGame('attack'); });
$('buildTab').addEventListener('click', () => { if (mode !== 'build') beginGame('build'); });

document.querySelectorAll('.part').forEach(button => {
  button.addEventListener('click', () => {
    buildPart = button.dataset.part;
    document.querySelectorAll('.part').forEach(p => p.classList.toggle('active', p === button));
    const names = {
      wood: 'Wood planks add a little armour to your ride.',
      wheel: 'Wheels get your contraption rolling. Add at least one!',
      balloon: 'A balloon floats you over the gap. Two gives extra lift!'
    };
    $('buildHint').textContent = names[buildPart];
    tone(520, 0.05, 'sine', 0.025);
  });
});

$('undoBtn').addEventListener('click', undoBuild);
$('clearBtn').addEventListener('click', clearBuild);
$('driveBtn').addEventListener('click', startDrive);

$('resetBtn').addEventListener('click', () => {
  ui.result.classList.add('hidden');
  if (mode === 'attack') { gameOver = false; levelSetup(); }
  else { buildSetup(); }
});

$('nextBtn').addEventListener('click', () => {
  ui.result.classList.add('hidden');
  level = Math.min(level + 1, LEVELS.length - 1);
  gameOver = false;
  levelSetup();
});

$('resultButton').addEventListener('click', () => {
  if (mode === 'build') {
    buildSetup();
  } else if (resultWon) {
    level = (level + 1) % LEVELS.length;
    gameOver = false;
    levelSetup();
  } else {
    retryAttack();
  }
});

$('menuButton').addEventListener('click', backToMenu);
$('homeBtn').addEventListener('click', () => {
  if (!ui.modal.classList.contains('hidden')) return;
  backToMenu();
});

function togglePause() {
  if (!ui.modal.classList.contains('hidden') || gameOver) return;
  paused = !paused;
  ui.pause.classList.toggle('hidden', !paused);
}
$('pauseBtn').addEventListener('click', togglePause);
$('resumeBtn').addEventListener('click', togglePause);

$('soundBtn').addEventListener('click', () => {
  soundOn = !soundOn;
  $('soundBtn').textContent = soundOn ? '♫' : '♪';
  if (soundOn) { ensureAudio(); tone(660, 0.1, 'sine', 0.05); }
  notify(soundOn ? 'Sound on' : 'Sound off');
});

/* ------------------------------------------------------------------ *
 *  Camera, resize, environment animation
 * ------------------------------------------------------------------ */

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75) * (SOFTWARE_GL ? 0.68 : 1));
  renderer.setSize(w, h, false);
  const aspect = w / Math.max(1, h);
  const narrow = aspect < 0.95;
  CAM.fov = narrow ? 58 : 42;
  camera.fov = CAM.fov;
  const vf = THREE.MathUtils.degToRad(CAM.fov);
  const hNeed = narrow ? (mode === 'build' ? 20.6 : 16.4) : 20.8;
  const vNeed = narrow ? 12.2 : 11.2;
  const zH = vNeed / 2 / Math.tan(vf / 2);
  const zW = hNeed / 2 / (Math.tan(vf / 2) * aspect);
  CAM.z = Math.max(15.6, zH, zW);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

let envTime = 0;
function animateEnvironment(dt) {
  envTime += dt;
  for (const c of clouds) {
    c.x += c.speed * dt;
    if (c.x > 17) c.x = -17;
  }
  updateClouds();
  waterTex.offset.x += dt * 0.006;
  waterTex.offset.y += dt * 0.003;
  sunSprite.scale.setScalar(8 + Math.sin(envTime * 0.7) * 0.16);
}

function updateCamera(dt) {
  let target = 0;
  if (mode === 'attack') {
    if (launched && currentBird && camera.aspect >= 0.95) target = clamp(WX(currentBird.x) * 0.26, -1.8, 1.8);
    else target = 0;
  } else {
    const narrow = camera.aspect < 0.95;
    target = narrow ? 1.0 : 0.35;
    if (driving) target = narrow ? 1.0 : clamp((vehicle.x - 2.2) * 0.24, 0.35 - 0.6, 0.35 + 1.4);
  }
  CAM.x = lerp(CAM.x, target, 1 - Math.exp(-3.2 * dt));
  const s = CAM.shake;
  camera.position.set(
    CAM.x + (s ? rnd(-s, s) : 0),
    CAM.y + (s ? rnd(-s, s) * 0.7 : 0),
    CAM.z
  );
  camera.lookAt(CAM.x, CAM.lookY, 0);
  CAM.shake *= Math.exp(-9 * dt);
  if (CAM.shake < 0.002) CAM.shake = 0;
}

/* ------------------------------------------------------------------ *
 *  Main loop
 * ------------------------------------------------------------------ */

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.12, (now - lastTime) / 1000);
  lastTime = now;
  animateEnvironment(dt);
  if (!paused && !gameOver) {
    let remaining = dt;
    while (remaining > 0 && !gameOver) {
      const step = Math.min(remaining, 0.04);
      if (mode === 'attack') updateAttack(step);
      else updateBuild(step);
      remaining -= step;
    }
  }
  updateEffects(dt);
  if (mode === 'attack') syncAttack(dt);
  else syncBuild(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

levelSetup();
buildRoot.visible = false;
attackRoot.visible = true;

/* Small read-only hook used by automated checks. */
window.__skyway = {
  get state() {
    return {
      mode, level, score, paused, gameOver, launched, driving,
      birds: birds.map(b => ({ type: b.type, used: b.used, x: b.x, y: b.y, alive: b.alive })),
      pigs: pigs.map(p => ({ x: p.x, y: p.y, alive: p.alive, grounded: p.grounded })),
      blocks: blocks.map(b => ({ x: b.x, y: b.y, alive: b.alive, dynamic: b.dynamic, hp: b.hp })),
      drag: dragPos, build: buildObjects.map(o => ({ kind: o.kind, x: o.x, y: o.y })),
      vehicle: { ...vehicle }, stars: collectedStars, currentBird: currentBird ? { x: currentBird.x, y: currentBird.y, vx: currentBird.vx, vy: currentBird.vy } : null,
      render: { ...renderer.info.render }
    };
  },
  screenOf(gx, gy, z = 0.72) {
    const v = new THREE.Vector3(WX(gx), WY(gy), z).project(camera);
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + (v.x * 0.5 + 0.5) * rect.width, y: rect.top + (-v.y * 0.5 + 0.5) * rect.height };
  }
};

requestAnimationFrame(frame);
