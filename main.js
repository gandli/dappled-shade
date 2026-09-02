import * as THREE from 'three';
import { SparkRenderer, SplatMesh, SparkControls, dyno } from '@sparkjsdev/spark';

const WIND_STRENGTH = [0, 0.3, 0.8, 1.5, 2.5];
let windIdx = 2;
let dark = false;

// ---- Dyno uniforms ----
const dynoTime = dyno.dynoFloat(0);
const dynoStrength = dyno.dynoFloat(WIND_STRENGTH[windIdx]);
const dynoFreq = dyno.dynoFloat(1.0);

// ---- Wind modifier ----
function createWindModifier() {
  return dyno.dynoBlock(
    { gsplat: dyno.Gsplat },
    { gsplat: dyno.Gsplat },
    ({ gsplat }) => {
      const shader = new dyno.Dyno({
        inTypes: { gsplat: dyno.Gsplat, time: 'float', strength: 'float', freq: 'float' },
        outTypes: { gsplat: dyno.Gsplat },
        statements: ({ inputs, outputs }) => dyno.unindentLines(`
          ${outputs.gsplat} = ${inputs.gsplat};
          vec3 pos = ${inputs.gsplat}.center;
          float t = ${inputs.time} * ${inputs.freq};
          // 相位按高度共享（树干整体弯曲），逐点仅小抖动（叶沙沙）
          float seed = dot(floor(pos * 10.0), vec3(12.9898, 78.233, 45.164));
          float rnd = fract(sin(seed) * 43758.5453);
          float phase = pos.y * 0.5 + rnd * 0.5;
          float sway = sin(t + phase);
          float sway2 = cos(t * 0.7 + phase * 0.6);
          // 高度渐进加权：根部不动、冠部全动
          float height = smoothstep(0.5, 5.0, pos.y);
          // 位移上限钳制为 0.5 × 树冠半径（~2 单位）
          float maxOffset = 2.0;
          float dx = sway * height * ${inputs.strength};
          float dz = sway2 * height * ${inputs.strength} * 0.4;
          float dy = sway2 * height * ${inputs.strength} * 0.1;
          pos.x += clamp(dx, -maxOffset, maxOffset);
          pos.z += clamp(dz, -maxOffset * 0.5, maxOffset * 0.5);
          pos.y += dy;
          ${outputs.gsplat}.center = pos;
        `),
      });
      return {
        gsplat: shader.apply({ gsplat, time: dynoTime, strength: dynoStrength, freq: dynoFreq }).gsplat,
      };
    },
  );
}

// ---- 程序化树生成（Sierpinski 分形 + 叶团）----
function generateTree(splats) {
  const TRUNK_SPLATS = 120000;
  const LEAF_SPLATS = 350000;

  const center = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const color = new THREE.Color();

  // 树干/树枝（分形 L-system 近似）
  const BRANCH_DIRS = [
    [0, 1, 0],
    [0.4, 0.85, 0.1],
    [-0.35, 0.88, -0.15],
    [0.15, 0.9, 0.3],
    [-0.2, 0.87, 0.25],
  ];
  const BRANCH_COUNTS = [30000, 25000, 25000, 20000, 20000];
  let splatIdx = 0;

  BRANCH_DIRS.forEach((dir, di) => {
    const [bx, by, bz] = dir;
    const cnt = BRANCH_COUNTS[di];
    const branchWidth = 0.05 + di * 0.02;
    for (let i = 0; i < cnt; i++) {
      const t = i / cnt;
      // 沿分支走
      center.set(
        bx * t * 5.0 + (Math.random() - 0.5) * branchWidth * (1 + t * 2),
        by * t * 6.0 - 1.5 + (Math.random() - 0.5) * branchWidth,
        bz * t * 4.0 + (Math.random() - 0.5) * branchWidth * (1 + t),
      );
      scale.setScalar(0.02 + t * 0.015);
      // 树皮色：暗棕 + 变化
      color.setRGB(0.25 + Math.random() * 0.1, 0.15 + Math.random() * 0.05, 0.05 + Math.random() * 0.03);
      splats.pushSplat(center, scale, quat, 1.0, color);
    }
  });

  // 叶团（椭球分布，绿色调）
  const LEAF_REGIONS = [
    { cx: 0.5, cy: 7, cz: 0.5, rx: 3, ry: 2.5, rz: 3, color: [0.35, 0.55, 0.15] },
    { cx: -1.5, cy: 6, cz: 1.5, rx: 2.5, ry: 2, rz: 2.5, color: [0.4, 0.6, 0.18] },
    { cx: 1, cy: 5, cz: -1, rx: 2, ry: 1.8, rz: 2, color: [0.38, 0.58, 0.16] },
    { cx: 0, cy: 8.5, cz: 0, rx: 2, ry: 1.5, rz: 2, color: [0.42, 0.62, 0.2] },
    { cx: -0.5, cy: 9.5, cz: 0.5, rx: 1.5, ry: 1, rz: 1.5, color: [0.45, 0.65, 0.25] },
  ];

  LEAF_REGIONS.forEach((r) => {
    const cnt = Math.round(LEAF_SPLATS / LEAF_REGIONS.length);
    for (let i = 0; i < cnt; i++) {
      // 球面均匀 → 椭球
      const u = Math.random() * 2 - 1;
      const v = Math.random() * Math.PI * 2;
      const r2 = Math.cbrt(Math.random());
      center.set(
        r.cx + r2 * Math.sqrt(1 - u * u) * Math.cos(v) * r.rx + (Math.random() - 0.5) * 0.3,
        r.cy + r2 * u * r.ry + (Math.random() - 0.5) * 0.2,
        r.cz + r2 * Math.sqrt(1 - u * u) * Math.sin(v) * r.rz + (Math.random() - 0.5) * 0.3,
      );
      scale.setScalar(0.03 + Math.random() * 0.04);
      const shade = 0.85 + Math.random() * 0.3;
      color.setRGB(r.color[0] * shade, r.color[1] * shade, r.color[2] * shade);
      splats.pushSplat(center, scale, quat, 1.0, color);
    }
  });
}

// ---- 场景 ----
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3, 22);

const spark = new SparkRenderer({ renderer });
scene.add(spark);

// ---- 地面 ----
const groundMat = new THREE.MeshStandardMaterial({ color: 0x6f8a4f, roughness: 0.95 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.8;
scene.add(ground);

// ---- 光照 ----
const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
sun.position.set(60, 100, 45);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xdfeeff, 0x6a5a44, 0.6);
scene.add(hemi);

// ---- 树 splat（程序化生成）----
let splatMesh = null;

async function loadTree() {
  splatMesh = new SplatMesh({
    constructSplats: (s) => generateTree(s),
  });
  scene.add(splatMesh);
  await splatMesh.initialized;
  splatMesh.worldModifier = createWindModifier();
  splatMesh.updateGenerator();
  console.log('✅ tree ready, splats:', splatMesh.packedSplats?.numSplats);
}
loadTree().catch((e) => console.error('loadTree:', e));

// ---- 控制 ----
const controls = new SparkControls({ canvas });
controls.update(camera);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- 动画 ----
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  controls.update(camera);
  dynoTime.value = clock.getElapsedTime();
  dynoStrength.value = WIND_STRENGTH[windIdx];
  if (splatMesh?.isInitialized) splatMesh.updateVersion();

  // 昼夜 lerp
  const t = dark ? 0.03 : 0.05;
  scene.background.lerp(new THREE.Color(dark ? 0x0c0c1a : 0x87ceeb), t);
  groundMat.color.lerp(new THREE.Color(dark ? 0x152015 : 0x6f8a4f), t);
  sun.intensity += ((dark ? 0.15 : 2.2) - sun.intensity) * t;
  hemi.intensity += ((dark ? 0.12 : 0.6) - hemi.intensity) * t;

  renderer.render(scene, camera);
}
animate();

// ---- 面板 ----
document.querySelectorAll('input[name="wind"]').forEach((r) => {
  r.addEventListener('change', (e) => {
    windIdx = parseInt(e.target.value);
  });
});
document.getElementById('daynight-toggle').addEventListener('change', (e) => { dark = e.target.checked; });
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toUpperCase();
  if (k === 'W') {
    windIdx = (windIdx + 1) % WIND_STRENGTH.length;
    document.querySelector(`input[name="wind"][value="${windIdx}"]`).checked = true;
  } else if (k === 'S') {
    dark = !dark;
    document.getElementById('daynight-toggle').checked = dark;
  }
});
