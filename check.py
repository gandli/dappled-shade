#!/usr/bin/env python3
"""结构自检：3D 版关键接线是否对齐，防止改一处漏一处。"""
import pathlib

root = pathlib.Path(__file__).parent
html = (root / "index.html").read_text()
css = (root / "style.css").read_text()
js = (root / "main.js").read_text()

# 1) importmap 三个入口齐全且版本一致
assert '"three":' in html and '"three/addons/":' in html and '@dgreenheck/ez-tree' in html
assert html.count("three@0.180.0") >= 2, "three 版本未对齐"
assert "deps=three@0.180.0" in html, "ez-tree 未 pin three"

# 2) 阴影链路：renderer 开 shadowMap + sun.castShadow + 树投影 + 地面接收
assert "shadowMap.enabled = true" in js
assert "castShadow = true" in js and "receiveShadow = true" in js
assert "shadow.camera" in js, "平行光阴影视锥未配置（默认视锥装不下树）"

# 3) 风动：tree.update(t) 每帧驱动 + uWindStrength 可调
assert "tree.update(t)" in js
assert "uWindStrength" in js, "风力档位未接 shader"

# 4) 昼夜：dayness 方向修正存在（night 时 a 增大应趋向夜）
assert "dayness" in js and "1 - a" in js

# 5) #app 必须有显式高度，否则 canvas 0 高（历史 bug）
assert "#app" in css and "inset: 0" in css

# 6) 风力三档 + 按键
assert js.count("一级") + js.count("二级") + js.count("三级") >= 3
assert "'w'" in js and "'s'" in js

print("OK: 结构自检全部通过")
