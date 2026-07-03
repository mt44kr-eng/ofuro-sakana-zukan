(() => {
'use strict';
const $ = s => document.querySelector(s);
const video = $('#video');
const camStatus = $('#camStatus');
const resultBox = $('#result');
const historyBox = $('#history');
const refList = $('#refList');
const modelStatus = $('#modelStatus');

const store = {
  get(k, d) { try { const v = localStorage.getItem('spike-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('spike-' + k, JSON.stringify(v)); } catch (e) {} }
};

// 基準写真はサムネイル(dataURL)だけ保存し、特徴量は必要時に計算してメモリにキャッシュ
let refs = store.get('refs', []);
const embCache = new Map();

// ホーム画面起動かどうかの表示(ステップ1の検証ポイント)
const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
$('#standaloneBadge').textContent = standalone ? 'ホーム画面起動: ✅' : 'ブラウザ表示中';

// しきい値: 実測(同一物0.70〜0.74 / 別物0.51〜0.57)の中間
const th = $('#th');
th.value = store.get('th', 0.64);
function syncTh() {
  $('#thVal').textContent = Number(th.value).toFixed(2);
  store.set('th', Number(th.value));
}
th.oninput = syncTh;
syncTh();

async function ensureModel() {
  if (MobileNetMatcher.isLoaded()) { modelStatus.textContent = '(準備OK)'; return true; }
  modelStatus.textContent = '(読み込み中… 初回は約3MB)';
  try {
    await MobileNetMatcher.load();
    modelStatus.textContent = '(準備OK)';
    return true;
  } catch (e) {
    modelStatus.textContent = '(読み込み失敗。通信環境を確認してください)';
    return false;
  }
}
ensureModel();

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    camStatus.textContent = 'この環境ではカメラAPIが使えません。「ファイルから選ぶ」で撮影してください。';
    return;
  }
  try {
    await Camera.start(video);
    camStatus.textContent = '';
  } catch (err) {
    camStatus.textContent = 'カメラを起動できませんでした(' + err.name + ')。「ファイルから選ぶ」でもテストできます。';
  }
}
startCamera();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !Camera.isActive()) startCamera();
});

const mode = () => document.querySelector('input[name=mode]:checked').value;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像を読み込めませんでした'));
    img.src = src;
  });
}

function toThumb(canvas) {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 320;
  c.getContext('2d').drawImage(canvas, 0, 0, 320, 320);
  return c.toDataURL('image/jpeg', 0.85);
}

async function refEmb(thumb) {
  let e = embCache.get(thumb);
  if (!e) {
    const img = await loadImage(thumb);
    e = await MobileNetMatcher.feature(img);
    embCache.set(thumb, e);
  }
  return e;
}

function cropCenter(img, ratio) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const s = Math.min(w, h) * ratio;
  const c = document.createElement('canvas');
  c.width = 224; c.height = 224;
  c.getContext('2d').drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, 224, 224);
  return c;
}

function renderRefs() {
  refList.innerHTML = '';
  if (!refs.length) {
    refList.innerHTML = '<p class="hint">まだ登録がありません。「基準を登録」モードで今日の魚(代わりの物)を撮影してください。</p>';
    return;
  }
  refs.forEach((r, i) => {
    const d = document.createElement('div');
    d.className = 'thumb';
    const img = document.createElement('img');
    img.src = r.thumb;
    img.alt = '基準' + (i + 1);
    const del = document.createElement('button');
    del.textContent = '✕';
    del.setAttribute('aria-label', '削除');
    del.onclick = () => { refs.splice(i, 1); store.set('refs', refs); renderRefs(); };
    d.append(img, del);
    refList.appendChild(d);
  });
}
renderRefs();

$('#clearRefs').onclick = () => {
  if (refs.length && confirm('基準写真を全部消しますか?')) {
    refs = [];
    store.set('refs', refs);
    renderRefs();
  }
};

let busy = false;
async function handleCanvas(canvas) {
  if (busy) return;
  busy = true;
  $('#captureBtn').disabled = true;
  try {
    const thumb = toThumb(canvas);
    if (mode() === 'register') {
      refs.push({ thumb });
      store.set('refs', refs);
      renderRefs();
      flash('基準に登録しました(' + refs.length + '枚)');
    } else {
      await judge(thumb);
    }
  } catch (e) {
    flash('エラー: ' + (e && e.message ? e.message : e));
  } finally {
    busy = false;
    $('#captureBtn').disabled = false;
  }
}

async function judge(thumb) {
  if (!refs.length) {
    flash('先に「基準を登録」で写真を1枚以上登録してください');
    return;
  }
  if (!await ensureModel()) {
    flash('照合エンジンを読み込めませんでした');
    return;
  }
  resultBox.innerHTML = '<p class="hint">計算中…</p>';
  const img = await loadImage(thumb);
  // 子どもの写真は距離・フレーミングが揺れるので、全体と中央寄りの2通りで照合し高い方を採用
  const queries = [
    await MobileNetMatcher.feature(img),
    await MobileNetMatcher.feature(cropCenter(img, 0.72))
  ];
  let best = -1;
  for (const r of refs) {
    const e = await refEmb(r.thumb);
    for (const q of queries) best = Math.max(best, MobileNetMatcher.similarity(q, e));
  }
  showResult(thumb, best);
}

function showResult(thumb, score) {
  const ok = score >= Number(th.value);
  const pct = Math.max(0, Math.min(100, Math.round(score * 100)));
  resultBox.innerHTML =
    '<div class="judgeCard"><img src="' + thumb + '" alt="判定画像">' +
    '<div class="scores"><div class="scoreRow"><span>MobileNet</span>' +
    '<div class="bar"><i class="' + (ok ? 'ok' : 'ng') + '" style="width:' + pct + '%"></i></div>' +
    '<b>' + score.toFixed(2) + '</b>' +
    '<span class="verdict ' + (ok ? 'ok' : 'ng') + '">' + (ok ? '○' : '△') + '</span></div></div></div>';
  const item = document.createElement('div');
  item.className = 'histItem';
  item.innerHTML = '<img src="' + thumb + '"><span>スコア: ' + score.toFixed(2) + (ok ? ' ○' : ' △') + '</span>';
  historyBox.prepend(item);
  while (historyBox.children.length > 12) historyBox.lastChild.remove();
}

function flash(msg) {
  camStatus.textContent = msg;
  setTimeout(() => { if (camStatus.textContent === msg) camStatus.textContent = ''; }, 3000);
}

$('#captureBtn').onclick = () => {
  if (!Camera.isActive()) {
    $('#fileInput').click();
    return;
  }
  handleCanvas(Camera.capture(video));
};

$('#fileInput').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const size = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = 640; c.height = 640;
    c.getContext('2d').drawImage(img, (img.naturalWidth - size) / 2, (img.naturalHeight - size) / 2, size, size, 0, 0, 640, 640);
    await handleCanvas(c);
  } catch (err) {
    flash('エラー: ' + err.message);
  } finally {
    URL.revokeObjectURL(url);
    e.target.value = '';
  }
};
})();
