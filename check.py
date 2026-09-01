#!/usr/bin/env python3
"""结构自检：确保 HTML/CSS/JS 三者的关键钩子对得上，防止改一处漏一处。"""
import re, pathlib

root = pathlib.Path(__file__).parent
html = (root / "index.html").read_text()
css = (root / "style.css").read_text()
js = (root / "main.js").read_text()

# 1) wind 滤镜存在且被 CSS 引用
for fid in ("wind",):
    assert f'id="{fid}"' in html, f"缺滤镜 #{fid}"
    assert f"url(#{fid})" in css, f"CSS 未引用 #{fid}"

# 2) canopy-mask 存在且被 CSS 引用
assert 'id="canopy-mask"' in html, "缺 #canopy-mask"
assert "url(#canopy-mask)" in css, "CSS 未引用 #canopy-mask"

# 2) 风力三档：CSS 有 data-wind 1/2/3，JS 循环同三档
for lvl in ("1", "2", "3"):
    assert f'data-wind="{lvl}"' in css, f"CSS 缺风力档 {lvl}"
assert 'WIND_LEVELS' in js and "'1'" in js and "'3'" in js, "JS 风力档位不全"

# 3) 树与投影共用同一树形，根部对齐 (200,524)
assert 'id="tree-shape"' in html
assert 'href="#tree-shape"' in html and html.count('href="#tree-shape"') == 2, "树/投影应各引用一次树形"
assert "200px 524px" in css, "摇曳原点未对齐树根"

# 4) sway 关键帧存在且引用 --sway
assert "@keyframes sway" in css and "var(--sway)" in css

# 5) 昼夜切换：checkbox + :has + body.dark 三件套齐全
assert 'id="daynight"' in html and ":has(#daynight" in css and "body.dark" in css

# 6) reduced-motion 兜底
assert "prefers-reduced-motion" in css

print("OK: 结构自检全部通过")
