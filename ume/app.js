(() => {
'use strict';
const $ = s => document.querySelector(s);

// ---- シルエット図鑑(21体・プレースホルダー形状) ----
// 本実装ではマスタデータJSONの実フィギュア形状に差し替える
const SHAPES = [
  // ふつうの魚
  '<ellipse cx="42" cy="52" rx="26" ry="15"/><polygon points="64,52 84,38 84,66"/><polygon points="36,38 48,24 52,40"/>',
  // ほそながい魚
  '<ellipse cx="45" cy="52" rx="34" ry="10"/><polygon points="74,52 90,42 90,62"/><polygon points="40,43 52,32 56,44"/>',
  // まるい魚(フグ系)
  '<circle cx="46" cy="52" r="22"/><polygon points="64,52 80,42 80,62"/><polygon points="40,32 48,20 54,32"/>',
  // ひらたい魚(ヒラメ系)
  '<ellipse cx="46" cy="56" rx="32" ry="14"/><polygon points="74,56 88,48 88,64"/>',
  // サメ系
  '<path d="M14,54 Q44,32 78,50 Q60,64 30,62 Z"/><polygon points="74,50 92,36 88,58"/><polygon points="42,42 50,22 58,44"/>',
  // ウナギ系
  '<path d="M12,44 Q34,30 50,46 Q66,62 84,50 L86,60 Q64,74 46,56 Q30,42 16,54 Z"/>',
  // エイ系
  '<polygon points="46,30 80,54 46,72 12,54"/><path d="M46,70 L50,92 L42,92 Z"/>'
];
const WEEKS = [
  { title: '1しゅうめ 🏞 かわ', cls: 'river' },
  { title: '2しゅうめ 🌊 うみ', cls: 'sea' },
  { title: '3しゅうめ 🌑 しんかい', cls: 'deep' }
];

const weeksEl = $('#weeks');
WEEKS.forEach((w, wi) => {
  const sec = document.createElement('section');
  sec.className = 'week ' + w.cls;
  const cards = [];
  for (let i = 0; i < 7; i++) {
    const no = wi * 7 + i + 1;
    // 週ごとに形を反転・拡縮して変化をつける(プレースホルダー)
    const flip = (wi + i) % 2 ? ' transform="translate(100,0) scale(-1,1)"' : '';
    cards.push(
      '<div class="card"><span class="num">' + no + '</span>' +
      '<svg viewBox="0 0 100 100"><g fill="currentColor"' + flip + '>' + SHAPES[i % SHAPES.length] + '</g></svg>' +
      '<span class="qmark">???</span></div>'
    );
  }
  sec.innerHTML = '<h2>' + w.title + '</h2><div class="grid">' + cards.join('') + '</div>';
  weeksEl.appendChild(sec);
});

// ---- 画面遷移 ----
const zukan = $('#zukan'), demo = $('#demo');
$('#openDemo').onclick = () => {
  zukan.classList.add('hidden');
  demo.classList.remove('hidden');
  resetDemo();
  scrollTo(0, 0);
};
$('#backBtn').onclick = () => {
  demo.classList.add('hidden');
  zukan.classList.remove('hidden');
};

// ---- 氷割りデモ ----
const iceSvg = $('#iceSvg');
const cracks = Array.from(document.querySelectorAll('.crack'));
let taps = 0;

function resetDemo() {
  taps = 0;
  cracks.forEach(c => c.classList.add('hidden'));
  $('#iceWrap').classList.remove('hidden');
  $('#reveal').classList.add('hidden');
  $('#tapHint').textContent = 'こおりを タップ!';
}

iceSvg.addEventListener('click', () => {
  if (taps >= cracks.length) return;
  cracks[taps].classList.remove('hidden');
  taps++;
  iceSvg.classList.remove('shake');
  void iceSvg.offsetWidth; // アニメーション再発火
  iceSvg.classList.add('shake');
  if (taps < cracks.length) {
    $('#tapHint').textContent = 'いいぞ! もっと タップ!';
  } else {
    setTimeout(reveal, 400);
  }
});

function reveal() {
  $('#iceWrap').classList.add('hidden');
  $('#reveal').classList.remove('hidden');
  burst();
  speak();
}

// 正体明かしの水玉バースト演出
function burst() {
  const stage = document.querySelector('.stage');
  const colors = ['#ffffff', '#ffe082', '#ffab91', '#81d4fa', '#a5d6a7', '#f8bbd0'];
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('span');
    s.className = 'spark';
    const size = 8 + Math.round(Math.random() * 12);
    s.style.width = s.style.height = size + 'px';
    s.style.background = colors[i % colors.length];
    const a = i / 14 * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const d = 90 + Math.random() * 70;
    s.style.setProperty('--dx', Math.round(Math.cos(a) * d) + 'px');
    s.style.setProperty('--dy', Math.round(Math.sin(a) * d) + 'px');
    s.style.animationDelay = (i * 0.02) + 's';
    stage.appendChild(s);
    setTimeout(() => s.remove(), 1300);
  }
}

// ---- 音声: 収録した子どもの声のみを使う(合成音声は使わない方針・2026-07-04確定) ----
// iPhoneボイスメモのm4aをそのまま置けるよう、m4a→mp3の順で探す
const VOICE_SOURCES = ['audio/reveal-0.m4a', 'audio/reveal-0.mp3'];
let revealAudio = null;

function speak() {
  if (revealAudio) {
    revealAudio.currentTime = 0;
    revealAudio.play().catch(() => {});
    return;
  }
  tryPlay(0);
}

function tryPlay(i) {
  if (i >= VOICE_SOURCES.length) {
    $('#voiceNote').textContent = '※こえは じゅんびちゅう';
    return;
  }
  const a = new Audio(VOICE_SOURCES[i]);
  a.play()
    .then(() => { revealAudio = a; $('#voiceNote').textContent = ''; })
    .catch(() => tryPlay(i + 1));
}
$('#voiceBtn').onclick = speak;

// ---- LINE導線(URLは後日設定) ----
$('#lineBtn').onclick = () => {
  $('#lineNote').textContent = '※公式LINEのURLは後日設定します(モック)';
};
})();
