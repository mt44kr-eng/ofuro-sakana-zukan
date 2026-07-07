// キャプチャフロー: 儀式(タオル)→撮影→1対1照合→「みつけた！」
// 否定語は使わない。3回スコア未達で親向け確認ボタンを出す(仕様どおり)
(() => {
'use strict';
const $ = s => document.querySelector(s);

const THRESHOLD = 0.79; // 実測(同じ魚0.91〜0.96/違う魚0.59〜0.67)の中間
const RETRY_MSGS = [
  'もっと ちかづいて みよう!',
  'あかるい ところで とって みよう!',
  'ちがう むきから とって みよう!'
];

let today = null;   // 今日の生き物(マスタデータの1件)
let refs = null;    // 基準ベクトル(data/refs/{id}.json)。無ければnull
let fails = 0;
let busy = false;

document.addEventListener('data-ready', renderHuntButton);

function screens(show) {
  for (const id of ['zukan', 'ritual', 'shoot', 'found']) {
    document.getElementById(id).classList.toggle('hidden', id !== show);
  }
  scrollTo(0, 0);
}

function renderHuntButton() {
  const ent = Storage.get('entitlements');
  const slot = $('#huntSlot');
  if (ent.tier === 'ume') { slot.innerHTML = ''; return; } // 梅は撮影機能なし
  today = App.todayCreature();
  if (!today) {
    slot.innerHTML = '<p class="allDone">🎉 ぜんぶ みつけた!</p>';
    return;
  }
  slot.innerHTML =
    '<button class="huntBtn" id="huntBtn">🔍 きょうの なかまを さがす!</button>';
  $('#huntBtn').onclick = startRitual;
}

// ---- 儀式 ----
function startRitual() {
  today = App.todayCreature();
  if (!today) { renderHuntButton(); return; }
  screens('ritual');
}
$('#ritualBack').onclick = () => screens('zukan');
$('#ritualDone').onclick = startShoot;

// ---- 撮影 ----
async function startShoot() {
  fails = 0;
  refs = null;
  $('#parentCheck').classList.add('hidden');
  $('#shootFileBtn').classList.add('hidden');
  $('#shootMsg').textContent = 'じゅんびちゅう…';
  screens('shoot');

  // 照合エンジンと基準ベクトルを並行準備
  MobileNetMatcher.load().catch(() => {});
  fetch('data/refs/' + today.id + '.json')
    .then(r => r.ok ? r.json() : null)
    .then(j => { refs = j && j.embeddings ? j.embeddings : null; })
    .catch(() => { refs = null; });

  try {
    await Camera.start($('#huntVideo'));
    $('#shootMsg').textContent = 'まんなかに いれて とってね!';
  } catch (e) {
    $('#shootMsg').textContent = 'カメラが つかえないみたい。しゃしんを えらんでね';
    $('#shootFileBtn').classList.remove('hidden');
  }
}
$('#shootBack').onclick = () => { Camera.stop(); screens('zukan'); };

$('#shootBtn').onclick = () => {
  if (!Camera.isActive()) { $('#shootFileInput').click(); return; }
  judge(Camera.capture($('#huntVideo')));
};

$('#shootFileInput').onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const size = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = 640; c.height = 640;
    c.getContext('2d').drawImage(img, (img.naturalWidth - size) / 2, (img.naturalHeight - size) / 2, size, size, 0, 0, 640, 640);
    URL.revokeObjectURL(url);
    judge(c);
  };
  img.src = url;
  e.target.value = '';
};

function cropCenter(source, ratio) {
  const w = source.width, h = source.height;
  const s = Math.min(w, h) * ratio;
  const c = document.createElement('canvas');
  c.width = 224; c.height = 224;
  c.getContext('2d').drawImage(source, (w - s) / 2, (h - s) / 2, s, s, 0, 0, 224, 224);
  return c;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

async function judge(canvas) {
  if (busy) return;
  busy = true;
  $('#shootBtn').disabled = true;
  $('#shootMsg').textContent = 'みてるよ…👀';
  try {
    if (!refs) {
      // 基準未整備の生き物: 自動判定できないので親確認へ誘導
      fails = 3;
      $('#shootMsg').textContent = 'おうちのひとに みせてね!';
      $('#parentCheck').classList.remove('hidden');
      return;
    }
    await MobileNetMatcher.load();
    const queries = [
      await MobileNetMatcher.feature(canvas),
      await MobileNetMatcher.feature(cropCenter(canvas, 0.72))
    ];
    let best = -1;
    for (const r of refs) for (const q of queries) best = Math.max(best, cosine(q, r));
    if (best >= THRESHOLD) {
      showFound();
    } else {
      fails++;
      $('#shootMsg').textContent = RETRY_MSGS[(fails - 1) % RETRY_MSGS.length];
      if (fails >= 3) $('#parentCheck').classList.remove('hidden');
    }
  } catch (e) {
    $('#shootMsg').textContent = 'もういちど とってみよう!';
  } finally {
    busy = false;
    $('#shootBtn').disabled = false;
  }
}

$('#parentOk').onclick = showFound;

// ---- みつけた！ ----
function showFound() {
  Camera.stop();
  $('#foundName').textContent = today.name;
  $('#foundFact').textContent = App.factOf(today);
  $('#foundVoiceNote').textContent = '';
  const wrap = $('#foundArtWrap');
  wrap.innerHTML = '<div class="revealPlaceholder">' + App.placeholderSVG(today) + '</div>';
  const img = new Image();
  img.onload = () => { img.className = 'revealArt'; img.alt = today.name; wrap.innerHTML = ''; wrap.appendChild(img); };
  img.src = 'img/creature/' + today.id + '.png';
  screens('found');
  App.burst(document.querySelector('#found .stage'));
  Voice.playFound(today.id, () => {
    $('#foundVoiceNote').textContent = '※こえは じゅんびちゅう';
  });
}
$('#foundVoiceBtn').onclick = () => {
  $('#foundVoiceNote').textContent = '';
  Voice.playFound(today.id, () => {
    $('#foundVoiceNote').textContent = '※こえは じゅんびちゅう';
  });
};

$('#foundDone').onclick = () => {
  const progress = Storage.get('progress');
  progress.collected[today.id] = new Date().toISOString().slice(0, 10);
  Storage.set('progress', progress);
  App.renderZukan();
  renderHuntButton();
  screens('zukan');
  // フェーズ4: ここでゾーン完了/グランド完了の判定・演出を行う
};
})();
