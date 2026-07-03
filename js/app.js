(() => {
'use strict';
const $ = s => document.querySelector(s);
const video = $('#video');
const camStatus = $('#camStatus');
const resultBox = $('#result');
const historyBox = $('#history');
const refList = $('#refList');
const mnetChk = $('#mnetChk');
const mnetStatus = $('#mnetStatus');

const store = {
  get(k, d) { try { const v = localStorage.getItem('spike-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('spike-' + k, JSON.stringify(v)); } catch (e) {} }
};

// 基準写真はサムネイル(dataURL)だけ保存し、特徴量は必要時に再計算してメモリにキャッシュ
let refs = store.get('refs', []);
const featCache = new Map();

// ホーム画面起動かどうかの表示(ステップ1の検証ポイント)
const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
$('#standaloneBadge').textContent = standalone ? 'ホーム画面起動: ✅' : 'ブラウザ表示中';

// しきい値スライダー
const histTh = $('#histTh'), mnetTh = $('#mnetTh');
histTh.value = store.get('histTh', 0.6);
mnetTh.value = store.get('mnetTh', 0.75);
function syncTh() {
  $('#histThVal').textContent = Number(histTh.value).toFixed(2);
  $('#mnetThVal').textContent = Number(mnetTh.value).toFixed(2);
  store.set('histTh', Number(histTh.value));
  store.set('mnetTh', Number(mnetTh.value));
}
histTh.oninput = syncTh;
mnetTh.oninput = syncTh;
syncTh();

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

async function getFeatures(thumb, wantEmb) {
  let f = featCache.get(thumb);
  if (!f) { f = {}; featCache.set(thumb, f); }
  if (!f.hist || (wantEmb && !f.emb)) {
    const img = await loadImage(thumb);
    if (!f.hist) f.hist = HistMatcher.feature(img);
    if (wantEmb && !f.emb) f.emb = await MobileNetMatcher.feature(img);
  }
  return f;
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

// MobileNetの有効化(初回はCDNからダウンロード)
mnetChk.checked = store.get('useMnet', false);
async function ensureMnet() {
  if (MobileNetMatcher.isLoaded()) { mnetStatus.textContent = '(準備OK)'; return true; }
  mnetStatus.textContent = '(読み込み中…)';
  try {
    await MobileNetMatcher.load();
    mnetStatus.textContent = '(準備OK)';
    return true;
  } catch (e) {
    mnetStatus.textContent = '(読み込み失敗。通信環境を確認してください)';
    return false;
  }
}
mnetChk.onchange = () => {
  store.set('useMnet', mnetChk.checked);
  if (mnetChk.checked) ensureMnet();
  else mnetStatus.textContent = '';
};
if (mnetChk.checked) ensureMnet();

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
  const useM = mnetChk.checked && await ensureMnet();
  resultBox.innerHTML = '<p class="hint">計算中…</p>';
  const q = await getFeatures(thumb, useM);
  let histBest = 0;
  let mnetBest = useM ? -1 : null;
  for (const r of refs) {
    const f = await getFeatures(r.thumb, useM);
    histBest = Math.max(histBest, HistMatcher.similarity(q.hist, f.hist));
    if (useM) mnetBest = Math.max(mnetBest, MobileNetMatcher.similarity(q.emb, f.emb));
  }
  showResult(thumb, histBest, mnetBest);
}

function scoreRow(label, score, th) {
  if (score === null) {
    return '<div class="scoreRow off"><span>' + label + '</span><span class="hint">未使用</span></div>';
  }
  const ok = score >= th;
  const pct = Math.max(0, Math.min(100, Math.round(score * 100)));
  return '<div class="scoreRow"><span>' + label + '</span>' +
    '<div class="bar"><i class="' + (ok ? 'ok' : 'ng') + '" style="width:' + pct + '%"></i></div>' +
    '<b>' + score.toFixed(2) + '</b>' +
    '<span class="verdict ' + (ok ? 'ok' : 'ng') + '">' + (ok ? '○' : '△') + '</span></div>';
}

function showResult(thumb, hist, mnet) {
  resultBox.innerHTML =
    '<div class="judgeCard"><img src="' + thumb + '" alt="判定画像">' +
    '<div class="scores">' +
    scoreRow('色ヒストグラム', hist, Number(histTh.value)) +
    scoreRow('MobileNet', mnet, Number(mnetTh.value)) +
    '</div></div>';
  const item = document.createElement('div');
  item.className = 'histItem';
  item.innerHTML = '<img src="' + thumb + '"><span>色: ' + hist.toFixed(2) +
    (mnet !== null ? ' / MobileNet: ' + mnet.toFixed(2) : '') + '</span>';
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
