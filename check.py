#!/usr/bin/env python3
"""结构自检：高斯泼溅版关键接线是否对齐。"""
import pathlib

root = pathlib.Path(__file__).parent
html = (root / "index.html").read_text()
js = (root / "main.js").read_text()

# 1) importmap：Spark + three 入口，且 three 版本一致
assert '"@sparkjsdev/spark"' in html, "Spark 未注入 importmap"
assert 'three@0.180.0' in html, "three 版本未对齐"
assert 'deps=three@0.180.0' in html, "Spark 未 pin three 防双实例"

# 2) 树 splat：程序化生成 + SparkRenderer 接管
assert "SparkRenderer" in js and "scene.add(spark)" in js
assert "constructSplats" in js, "树未程序化生成（避免外部 26MB 资产）"
assert "SplatMesh" in js

# 3) 风动：modifier 在 initialized 后挂 + updateGenerator（时序修复）
assert "await splatMesh.initialized" in js
assert "splatMesh.worldModifier = createWindModifier()" in js
assert "splatMesh.updateGenerator()" in js
assert "dyno.dynoBlock" in js or "dynoBlock" in js, "wind 位移未用 dyno 计算图"

# 4) 风力五档 + W/S 键
assert "WIND_STRENGTH" in js and "[0," in js
assert 'name="wind"' in html
assert "key.toUpperCase()" in js and "'W'" in js and "'S'" in js

# 5) 昼夜：背景/光强 lerp
assert "dark ?" in js and "background.lerp" in js

# 6) tree.splat 不能进仓库（纯程序化生成，26MB 二进制）
assert not (root / "tree.splat").exists(), "tree.splat 误入仓库"

print("OK: 高斯泼溅版结构自检全部通过")
