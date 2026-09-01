import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Tree } from '@dgreenheck/ez-tree';

const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(app.clientWidth, app.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const SKY_DAY = new THREE.Color(0x8fb6e8);
const SKY_NIGHT = new THREE.Color(0x0a1020);
scene.background = SKY_DAY.clone();
scene.fog = new THREE.FogExp2(SKY_DAY.clone(), 0.0009);

const camera = new THREE.PerspectiveCamera(55, app.clientWidth / app.clientHeight, 0.1, 2000);
camera.position.set(70, 34, 100);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 26, 0);
controls.minDistance = 40;
controls.maxDistance = 260;
controls.maxPolarAngle = Math.PI / 2 + 0.05;

// 光：太阳 + 环境，低强度冷光作暗部
const sun = new THREE.DirectionalLight(0xfff2d8, 2.4);
sun.position.set(80, 140, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 400;
const s = 120;
sun.shadow.camera.left = -s;
sun.shadow.camera.right = s;
sun.shadow.camera.top = s;
sun.shadow.camera.bottom = -s;
sun.shadow.bias = -0.0008;
scene.add(sun);

const ambient = new THREE.HemisphereLight(0xdfeeff, 0x6a5a44, 1.1);
scene.add(ambient);

// 地面：接收树影的平面
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(400, 64),
  new THREE.MeshStandardMaterial({ color: 0x6f8a4f, roughness: 1.0, metalness: 0.0 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// 树：程序化生成，自带叶风 shader
const tree = new Tree();
tree.loadPreset('Oak Medium');
tree.leavesMesh.material.color.setHex(0x9cc47a); // 提亮叶色
tree.castShadow = true;
tree.receiveShadow = true;
tree.position.y = 0;
scene.add(tree);

const WIND_STRENGTH = [0.18, 0.5, 1.1]; // 对应面板一级/二级/三级
let windIdx = 1;

function applyWind() {
  const v = WIND_STRENGTH[windIdx];
  const mat = tree.leavesMesh?.material;
  // shader 在首帧 onBeforeCompile 后才挂上，故每帧调用
  if (mat?.userData?.shader) {
    mat.userData.shader.uniforms.uWindStrength.value.set(v, 0, v);
  }
}

// 昼夜：太阳位置/色温/强度全插值。夜=低角度冷蓝月光 → 长影婆娑
const SUN_DAY = { pos: new THREE.Vector3(80, 140, 60), col: new THREE.Color(0xfff2d8), i: 2.4 };
const SUN_NIGHT = { pos: new THREE.Vector3(-90, 45, -40), col: new THREE.Color(0xbfd0ff), i: 0.9 };
let dark = false;
const SKY = { cur: SKY_DAY.clone(), from: SKY_DAY.clone(), to: SKY_DAY.clone(), t: 1 };
function toggleDayNight() {
  dark = !dark;
  document.body.classList.toggle('dark', dark);
  SKY.from.copy(SKY.cur);
  SKY.to.copy(dark ? SKY_NIGHT : SKY_DAY);
  SKY.t = 0;
}
const _c = new THREE.Color();
const GROUND_DAY = new THREE.Color(0x6f8a4f);
const GROUND_NIGHT = new THREE.Color(0x2a3a2a);
function lerpSky(a) {
  // a: 过渡进度 0→1。dayness: 1=白天 0=夜晚
  const dayness = dark ? 1 - a : a;
  SKY.cur.copy(SKY.from).lerp(SKY.to, a);
  scene.background = SKY.cur;
  scene.fog.color = SKY.cur;
  sun.position.lerpVectors(SUN_NIGHT.pos, SUN_DAY.pos, dayness);
  sun.color.copy(_c.copy(SUN_NIGHT.col).lerp(SUN_DAY.col, dayness));
  sun.intensity = THREE.MathUtils.lerp(SUN_NIGHT.i, SUN_DAY.i, dayness);
  ambient.intensity = THREE.MathUtils.lerp(0.55, 1.1, dayness);
  ground.material.color.copy(_c.copy(GROUND_NIGHT).lerp(GROUND_DAY, dayness));
}

// 风力：面板 radio 直驱 shader；W 键仍循环
const windRadios = document.querySelectorAll('input[name="wind"]');
function setWind(i) {
  windIdx = i;
  applyWind();
  windRadios[windIdx].checked = true;
}
windRadios.forEach((r) => r.addEventListener('change', () => setWind(+r.value)));
document.getElementById('daynight-toggle').addEventListener('change', (e) => {
  if (e.target.checked !== dark) toggleDayNight();
});

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 's') {
    toggleDayNight();
    document.getElementById('daynight-toggle').checked = dark;
  } else if (k === 'w') {
    setWind((windIdx + 1) % WIND_STRENGTH.length);
  }
});

window.addEventListener('resize', () => {
  camera.aspect = app.clientWidth / app.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(app.clientWidth, app.clientHeight);
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.elapsedTime;
  tree.update(t);
  applyWind();
  if (SKY.t < 1) {
    SKY.t = Math.min(1, SKY.t + dt / 1.2); // 1.2s 过渡，时间驱动
    lerpSky(SKY.t);
  }
  controls.update();
  renderer.render(scene, camera);
}
animate();
