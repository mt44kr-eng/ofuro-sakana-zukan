// おうちのかた画面: 今日の番号(親モード)+パスワード解錠
// ⚙ボタンの長押し(1.2秒)で開く(子どもの誤タップ対策)
(() => {
'use strict';
const $ = s => document.querySelector(s);

// 【仮決め】印刷前に正式決定する。全角入力・小文字もNFKC正規化で受け付ける
const PASSWORDS = { 'SAKANA21': 'take', 'HIMITSU22': 'matsu' };
const TIER_LABEL = { ume: 'おためし版(無料)', take: '通常版', matsu: 'ひみつ版' };
const HOLD_MS = 1200;

let holdTimer = null;
const gear = $('#gearBtn');

gear.addEventListener('contextmenu', e => e.preventDefault());
gear.addEventListener('pointerdown', () => {
  clearTimeout(holdTimer);
  holdTimer = setTimeout(openParent, HOLD_MS);
});
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev =>
  gear.addEventListener(ev, () => clearTimeout(holdTimer))
);
gear.addEventListener('click', () => {
  // 短押しはヒントだけ(開かない)
  gear.classList.remove('wobble');
  void gear.offsetWidth;
  gear.classList.add('wobble');
});

function openParent() {
  renderParent();
  $('#zukan').classList.add('hidden');
  $('#parent').classList.remove('hidden');
  scrollTo(0, 0);
}

$('#parentBack').onclick = () => {
  $('#parent').classList.add('hidden');
  $('#zukan').classList.remove('hidden');
};

// 進捗ベース: 未収集の最小番号が「今日」(1〜21。松は21完了後に22)
function todayCreature() {
  if (!window.App || !App.data) return null;
  const ent = Storage.get('entitlements');
  const progress = Storage.get('progress');
  const order = App.data.creatures
    .filter(c => c.no >= 1 && c.no <= 21)
    .sort((a, b) => a.no - b.no);
  for (const c of order) {
    if (!progress.collected[c.id]) return c;
  }
  if (ent.tier === 'matsu') {
    const secret = App.data.creatures.find(c => c.no === 22);
    if (secret && !progress.collected[secret.id]) return secret;
  }
  return null; // ぜんぶ みつけた
}

function renderParent() {
  const ent = Storage.get('entitlements');
  const settings = Storage.get('settings');
  const progress = Storage.get('progress');
  $('#parentTier').textContent = TIER_LABEL[ent.tier] || TIER_LABEL.ume;

  $('#bgmChk').checked = settings.bgm;
  $('#volRange').value = settings.volume;
  // リセットは全コンプリート後のみ有効(仕様書 §5-4)
  $('#resetBtn').disabled = !progress.grandDone;

  const numEl = $('#todayNum');
  if (ent.tier === 'ume') {
    numEl.textContent = '—';
    numEl.nextElementSibling.textContent = '撮影と図鑑集めは製品版の機能です。カードのパスワードで解錠できます。';
    return;
  }
  const today = todayCreature();
  if (!today) {
    numEl.textContent = '🎉 ぜんぶ みつけた！';
  } else if (today.no === 22) {
    numEl.textContent = 'ひみつの 22ばん';
  } else {
    numEl.textContent = today.no + ' ばん';
  }
}

// ---- 設定 ----
$('#bgmChk').onchange = () => {
  const s = Storage.get('settings');
  s.bgm = $('#bgmChk').checked;
  Storage.set('settings', s);
  Bgm.sync();
};
$('#volRange').oninput = () => {
  const s = Storage.get('settings');
  s.volume = Number($('#volRange').value);
  Storage.set('settings', s);
  Bgm.sync();
};

// ---- 図鑑PDF ----
$('#pdfBtn').onclick = () => { Print.run(); };

// ---- データの書き出し/読み込み ----
$('#exportBtn').onclick = () => {
  const blob = new Blob([Storage.exportAll()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mizu-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  $('#dataNote').textContent = '書き出しました。ファイルを大切に保存してください。';
};
$('#importInput').onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      Storage.importAll(reader.result);
      $('#dataNote').textContent = '読み込みました。画面を更新します…';
      setTimeout(() => location.reload(), 900);
    } catch (err) {
      $('#dataNote').textContent = '読み込めませんでした: ' + err.message;
    }
  };
  reader.readAsText(file);
  e.target.value = '';
};

// ---- リセット(収集進捗のみ初期化) ----
$('#resetBtn').onclick = () => {
  if (!confirm('本当にリセットしていいですか？\n(みつけた記録だけが消えます。プラン・設定は残ります)')) return;
  Storage.resetProgress();
  location.reload();
};

$('#pwBtn').onclick = () => {
  const raw = $('#pwInput').value || '';
  const code = raw.normalize('NFKC').trim().toUpperCase();
  const tier = PASSWORDS[code];
  if (!tier) {
    $('#pwNote').textContent = 'パスワードが確認できませんでした。カードの文字をもう一度ご確認ください。';
    return;
  }
  const ent = Storage.get('entitlements');
  if (ent.tier === 'matsu' && tier === 'take') {
    $('#pwNote').textContent = 'すでに「ひみつ版」です。';
    return;
  }
  Storage.set('entitlements', { tier });
  $('#pwNote').textContent = TIER_LABEL[tier] + 'になりました! 画面を更新します…';
  setTimeout(() => location.reload(), 900);
};

// 図鑑側から今日の生き物を参照できるように公開
window.App = window.App || {};
window.App.todayCreature = todayCreature;
})();
