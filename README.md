# 树影婆娑 · Dappled Shade

一棵程序化树，在平面上投下真实光影，随风摇曳。纯浏览器端 · 免构建 · 免打包。

![day](./docs/day.png)
![night](./docs/night.png)

## 效果

- 🌳 **程序化 3D 树** — [ez-tree](https://github.com/dgreenheck/ez-tree) 生成（Oak Medium），数千片叶 + 分枝树干
- 🌗 **真实光影** — Three.js 平行光 2048 shadow map，地面投出叶状斑驳影
- 💨 **风力三档** — 直写叶材质 `uWindStrength` uniform，叶片摇曳（W 键 / 面板）
- 🌙 **昼夜切换** — 太阳位置/色温/强度全插值，夜晚低角度冷蓝月光拉长树影（S 键 / 面板）
- 📱 **移动端适配** — 面板改底部横条，触控目标 ≥44px，默认收起

## 运行

任意静态服务器：

```bash
python3 -m http.server 8765
```

打开 `http://localhost:8765`。页面从 [esm.sh](https://esm.sh) 拉取 three 依赖（首次需要外网）。

## 在线预览

| 平台 | 地址 |
|------|------|
| GitHub Pages | https://gandli.github.io/dappled-shade/ |
| Vercel | https://dappled-shade.vercel.app |
| Cloudflare Pages | 部署中 |

## 交互

| 操作 | 效果 |
|------|------|
| 拖动 | 旋转视角 |
| `S` / 夜晚开关 | 昼夜切换 |
| `W` / 风力分段 | 风力三档 |
| 右上角「参数」 | 折叠控制面板（移动端默认收起） |

## 技术栈

- [ez-tree](https://github.com/dgreenheck/ez-tree) — 程序化树 + 内置叶风 shader
- [Three.js](https://threejs.org) — WebGL 渲染、真实阴影、ACES 色调映射
- 原生 `<details>` 折叠面板 · 无构建 · 无状态库

## 结构

```
index.html   入口 + importmap + 控制面板
main.js      场景/树/光影/风力/昼夜接线
style.css    面板样式 + 移动端媒体查询
check.py     结构自检（python3 check.py）
```

## 结构自检

```bash
python3 check.py
```

校验阴影链路、风力 shader、昼夜插值、面板接线是否齐全。
