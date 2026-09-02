// 光：太阳 + 环境，低强度冷光作暗部
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

// 让树影随叶子一起摆动：阴影走 depth material，须注入同款 wind 位移
// ponytail: 仅复制 ez-tree 的 wind GLSL，共享 uniform 引用
const windUniforms = {
  uTime: { value: 0 },
  uWindStrength: { value: new THREE.Vector3(0.5, 0, 0.5) },
  uWindFrequency: { value: 0.5 },
  uWindScale: { value: 70 },
};
const WIND_GLSL = `
uniform float uTime; uniform vec3 uWindStrength; uniform float uWindFrequency; uniform float uWindScale;
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
vec3 fade(vec3 t){return t*t*t*(t*(t*6.0-15.0)+10.0);}
float simplex3(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i); vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 g0=vec3(a0.xy,h.x); vec3 g1=vec3(a0.zw,h.y); vec3 g2=vec3(a1.xy,h.z); vec3 g3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(g0,g0),dot(g1,g1),dot(g2,g2),dot(g3,g3)));
  g0*=norm.x; g1*=norm.y; g2*=norm.z; g3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(g0,x0),dot(g1,x1),dot(g2,x2),dot(g3,x3)));
}
vec3 windDisplace(vec3 pos, vec2 uv){
  float windOffset = 6.2831853 * simplex3(pos / uWindScale);
  vec3 windSway = uv.y * uWindStrength * (
    0.5*sin(uTime*uWindFrequency + windOffset) +
    0.3*sin(2.0*uTime*uWindFrequency + 1.3*windOffset) +
    0.2*sin(5.0*uTime*uWindFrequency + 1.5*windOffset));
  return pos + windSway;
}
`;
tree.leavesMesh.customDepthMaterial = new THREE.MeshDepthMaterial({
  depthPacking: THREE.RGBADepthPacking,
  alphaTest: tree.leavesMesh.material.alphaTest,
  map: tree.leavesMesh.material.map,
  side: THREE.DoubleSide,
});
tree.leavesMesh.customDepthMaterial.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, windUniforms);
  shader.vertexShader = WIND_GLSL + shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\n transformed = windDisplace(transformed, uv);'
  );
};

const WIND_STRENGTH = [0, 0.4, 1.0, 2.0, 3.0]; // 微风→疾风 5 档（位移=strength×uv.y×sin，放大才可见）
let windIdx = 2;

function applyWind() {
  const v = WIND_STRENGTH[windIdx];
  windUniforms.uWindStrength.value.set(v, 0, v);
  const sh = tree.leavesMesh?.material?.userData?.shader;
  if (sh) sh.uniforms.uWindStrength.value.set(v, 0, v);
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

// 移动端：面板默认收起，避免盖住画面
const panel = document.getElementById('controls');
if (matchMedia('(max-width: 640px)').matches) panel.open = false;

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
  windUniforms.uTime.value = t; // 阴影 depth material 的 uTime 独立，须手动喂
  applyWind();
  if (SKY.t < 1) {
    SKY.t = Math.min(1, SKY.t + dt / 1.2); // 1.2s 过渡，时间驱动
    lerpSky(SKY.t);
  }
  controls.update();
  renderer.render(scene, camera);
}
animate();
