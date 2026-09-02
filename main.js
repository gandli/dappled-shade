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

// ---- 程序化树生成：递归分叉 + 各向异性 splat ----
function generateTree(splats) {
  const center = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const color = new THREE.Color();
  const UP = new THREE.Vector3(0, 1, 0);
  const _v = new THREE.Vector3();
  const randVec = () => _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();

  // 叶簇：扁平叶盘 splat，内深外浅（伪 AO）
  function leafCluster(pos, r) {
    for (let i = 0; i < 7000; i++) {
      const u = Math.random() * 2 - 1;
      const v = Math.random() * Math.PI * 2;
      const rr = r * (0.45 + 0.55 * Math.cbrt(Math.random())); // 中空壳状 → 簇间透空
      center.set(
        pos.x + rr * Math.sqrt(1 - u * u) * Math.cos(v),
        pos.y + rr * u * 0.8,
        pos.z + rr * Math.sqrt(1 - u * u) * Math.sin(v),
      );
      // 薄盘叶 splat，随机朝向
      scale.set(0.09 + Math.random() * 0.07, 0.01, 0.06 + Math.random() * 0.05);
      euler.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      quat.setFromEuler(euler);
      const d = center.distanceTo(pos) / r;
      const bright = 0.55 + (1 - d) * 0.45 + Math.random() * 0.3;
      color.setRGB(0.22 * bright + 0.04, 0.48 * bright + 0.06, 0.12 * bright);
      splats.pushSplat(center, scale, quat, 1.0, color);
    }
  }

  // 递归树枝：cigar splat 沿枝向连成连续管道，末梢长叶簇
  function branch(pos, direction, len, radius, depth) {
    const end = pos.clone().addScaledVector(direction, len);
    const mid = pos.clone().lerp(end, 0.5).addScaledVector(randVec(), len * 0.18); // 随机弯曲
    const steps = Math.max(4, Math.round(len * 14));
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      a.copy(pos).lerp(mid, t);
      b.copy(mid).lerp(end, t);
      center.copy(a).lerp(b, t);
      const r = radius * (1 - t * 0.35);
      scale.set(r, (len / steps) * 1.3, r); // 沿枝向拉长 → 连续管
      quat.setFromUnitVectors(UP, direction);
      const shade = 0.85 + Math.random() * 0.3;
      color.setRGB(0.26 * shade, 0.17 * shade, 0.10 * shade);
      splats.pushSplat(center, scale, quat, 1.0, color);
    }
    if (depth <= 0) {
      leafCluster(end, 0.6 + Math.random() * (radius * 3.5));
      return;
    }
    if (depth === 1 && Math.random() < 0.4) leafCluster(end, 0.5 + Math.random() * 0.8); // 冠内小簇破实心
    const n = depth >= 2 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const nd = direction.clone().addScaledVector(randVec(), 0.35).addScaledVector(UP, 0.35).normalize();
      branch(end, nd, len * 0.72, radius * 0.62, depth - 1);
    }
  }

  // 主干：1→3→9→~25→~60 枝，末梢 ~60 叶簇
  branch(new THREE.Vector3(0, -1.5, 0), new THREE.Vector3(0.03, 1, 0.02).normalize(), 3.4, 0.24, 3);
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
