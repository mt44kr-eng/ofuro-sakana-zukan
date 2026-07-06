// 0番デモ(ドクターフィッシュの氷割り)と梅向けセクション
// 音声パイプラインの検証も兼ねる: audio/creature/{id}.m4a → .mp3 → 「じゅんびちゅう」
(() => {
'use strict';
const $ = s => document.querySelector(s);
const DEMO_ID = 'doctor_fish';

// ドクターフィッシュのイラストが未配置の間のプレースホルダー
const FALLBACK_ART =
  '<svg class="fishArt" viewBox="0 0 220 130" aria-label="ドクターフィッシュ">' +
  '<ellipse cx="95" cy="65" rx="62" ry="28" fill="#b08a5a"/>' +
  '<ellipse cx="95" cy="58" rx="58" ry="20" fill="#caa574"/>' +
  '<polygon points="150,65 190,42 190,88" fill="#b08a5a"/>' +
  '<polygon points="80,40 100,22 108,40" fill="#b08a5a"/>' +
  '<circle cx="52" cy="58" r="6" fill="#222"/>' +
  '<circle cx="54" cy="56" r="2" fill="#fff"/>' +
  '<path d="M36,70 q8,6 16,2" stroke="#7a5c38" stroke-width="3" fill="none" stroke-linecap="round"/>' +
  '<circle cx="24" cy="40" r="5" fill="#bfe6f7"/>' +
  '<circle cx="16" cy="26" r="3.5" fill="#bfe6f7"/></svg>';

let creature = null;
let taps = 0;
let voiceAudio = null;

document.addEventListener('data-ready', setup);

function setup() {
  creature = App.data.creatures.find(c => c.id === DEMO_ID);
  const ent = Storage.get('entitlements');

  // デモカード(全ティア共通: 0番目の体験)
  $('#demoSlot').innerHTML =
    '<button class="demoCard" id="openDemo">' +
    '<span class="iceMini">🧊</span>' +
    '<span class="demoTxt"><b>0ばんめの なかま</b>' +
    '<small>タップして こおりを わってみよう!</small></span>' +
    '<span class="sparkle" aria-hidden="true"><i></i><i></i><i></i></span></button>';
  $('#openDemo').onclick = openDemo;

  // 品質証明+LINE導線(梅のみ)
  if (ent.tier === 'ume') {
    $('#extraSlot').innerHTML =
      '<section class="quality"><h2>おうちのかたへ</h2>' +
      '<p>3Dプリント製の生き物フィギュア21体を、氷にとじこめてお届けします。毎晩1体、湯船で氷から救出してあげてください。</p>' +
      '<div class="ph">📷 21体の集合写真<br><small>(実物写真に後日差し替え)</small></div>' +
      '<div class="ph">🖐 手のひらサイズ比較<br><small>(実物写真に後日差し替え)</small></div>' +
      '<a class="lineBtn" id="lineBtn" role="button">LINEで発売情報をうけとる</a>' +
      '<p class="hint" id="lineNote"></p></section>';
    $('#lineBtn').onclick = () => {
      $('#lineNote').textContent = '※公式LINEのURLは後日設定します';
    };
  }

  // 正体明かしの中身
  $('#revealName').textContent = creature.name;
  $('#revealFact').textContent = App.factOf(creature);
  $('#revealArtWrap').innerHTML = FALLBACK_ART;
  const img = new Image();
  img.onload = () => {
    img.className = 'revealArt';
    img.alt = creature.name;
    $('#revealArtWrap').innerHTML = '';
    $('#revealArtWrap').appendChild(img);
  };
  img.src = 'img/creature/' + DEMO_ID + '.png';
}

function openDemo() {
  $('#zukan').classList.add('hidden');
  $('#demo').classList.remove('hidden');
  resetDemo();
  scrollTo(0, 0);
}

$('#backBtn').onclick = () => {
  $('#demo').classList.add('hidden');
  $('#zukan').classList.remove('hidden');
};

const cracks = () => Array.from(document.querySelectorAll('.crack'));

function resetDemo() {
  taps = 0;
  cracks().forEach(c => c.classList.add('hidden'));
  $('#iceWrap').classList.remove('hidden');
  $('#reveal').classList.add('hidden');
  $('#tapHint').textContent = 'こおりを タップ!';
}

$('#iceSvg').addEventListener('click', () => {
  const cs = cracks();
  if (taps >= cs.length) return;
  cs[taps].classList.remove('hidden');
  taps++;
  const svg = $('#iceSvg');
  svg.classList.remove('shake');
  void svg.offsetWidth;
  svg.classList.add('shake');
  if (taps < cs.length) {
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

// 水玉バースト
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

// 収録音声(子どもの声)のみ再生。m4a→mp3の順で探し、無ければ準備中表示
function speak() {
  if (voiceAudio) {
    voiceAudio.currentTime = 0;
    voiceAudio.play().catch(() => {});
    return;
  }
  tryPlay(['audio/creature/' + DEMO_ID + '.m4a', 'audio/creature/' + DEMO_ID + '.mp3'], 0);
}

function tryPlay(sources, i) {
  if (i >= sources.length) {
    $('#voiceNote').textContent = '※こえは じゅんびちゅう';
    return;
  }
  const a = new Audio(sources[i]);
  a.volume = Storage.get('settings').volume;
  a.play()
    .then(() => { voiceAudio = a; $('#voiceNote').textContent = ''; })
    .catch(() => tryPlay(sources, i + 1));
}
$('#voiceBtn').onclick = speak;
})();
