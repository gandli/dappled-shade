// 昼夜 + 风力切换（checkbox 走 CSS :has，JS 只补 class 与按钮）

const body = document.body;
const daynight = document.getElementById('daynight');
const windToggle = document.getElementById('wind-toggle');

// 昼夜: 点击开关区触发 checkbox, CSS :has 处理场景; 这里同步 body.dark 给文本变量
daynight.addEventListener('change', () => body.classList.toggle('dark', daynight.checked));

// 风力三档循环
const WIND_LEVELS = ['1', '2', '3'];
windToggle.addEventListener('click', () => {
  const cur = body.dataset.wind || '2';
  const next = WIND_LEVELS[(WIND_LEVELS.indexOf(cur) + 1) % WIND_LEVELS.length];
  body.dataset.wind = next;
  windToggle.textContent = `风力 · ${next === '1' ? '一级' : next === '2' ? '二级' : '三级'}`;
});

// S 键切换昼夜, W 键切换风力
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 's') {
    daynight.checked = !daynight.checked;
    daynight.dispatchEvent(new Event('change'));
  } else if (e.key.toLowerCase() === 'w') {
    windToggle.click();
  }
});
