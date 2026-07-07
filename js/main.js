// みつけた！みずのなかま - 図鑑シェル
(() => {
'use strict';
const $ = s => document.querySelector(s);

// プレースホルダーのシルエット形状(実イラストが無い生き物用)
const PLACEHOLDER_SHAPES = [
  '<ellipse cx="42" cy="52" rx="26" ry="15"/><polygon points="64,52 84,38 84,66"/><polygon points="36,38 48,24 52,40"/>',
  '<ellipse cx="45" cy="52" rx="34" ry="10"/><polygon points="74,52 90,42 90,62"/><polygon points="40,43 52,32 56,44"/>',
  '<circle cx="46" cy="52" r="22"/><polygon points="64,52 80,42 80,62"/><polygon points="40,32 48,20 54,32"/>',
  '<ellipse cx="46" cy="56" rx="32" ry="14"/><polygon points="74,56 88,48 88,64"/>',
  '<path d="M14,54 Q44,32 78,50 Q60,64 30,62 Z"/><polygon points="74,50 92,36 88,58"/><polygon points="42,42 50,22 58,44"/>',
  '<path d="M12,44 Q34,30 50,46 Q66,62 84,50 L86,60 Q64,74 46,56 Q30,42 16,54 Z"/>',
  '<polygon points="46,30 80,54 46,72 12,54"/><path d="M46,70 L50,92 L42,92 Z"/>'
];

const TIER_LABEL = { ume: 'おためし版', take: '通常版', matsu: 'ひみつ版' };
const ZONE_EMOJI = { river: '🏞', ocean: '🌊', deepsea: '🌑', secret: '🗝' };

let DATA = null;
const silhouetteCache = new Map();

// セリフから「みつけた！＋名前！」を除いた後半=説明文(仕様書 §3)
function factOf(c) {
  return c.line.replace(/^みつけた！\s*[^！]+！\s*/, '');
}

function placeholderSVG(c) {
  const shape = PLACEHOLDER_SHAPES[(c.no + 3) % PLACEHOLDER_SHAPES.length];
  const flip = c.no % 2 ? ' transform="translate(100,0) scale(-1,1)"' : '';
  return '<svg viewBox="0 0 100 100"><g fill="currentColor"' + flip + '>' + shape + '</g></svg>';
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// イラスト(白背景PNG)から黒塗りシルエットを実行時生成(仕様書 §5-3)
async function silhouetteFrom(id) {
  if (silhouetteCache.has(id)) return silhouetteCache.get(id);
  const img = await loadImage('img/creature/' + id + '.png');
  const S = 200;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const scale = Math.min(S / img.naturalWidth, S / img.naturalHeight);
  const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
  ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
  const d = ctx.getImageData(0, 0, S, S);
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
    // 白背景・透明部分は消し、それ以外を濃紺に
    if (a < 40 || (r > 235 && g > 235 && b > 235)) {
      px[i + 3] = 0;
    } else {
      px[i] = 0x35; px[i + 1] = 0x50; px[i + 2] = 0x6b; px[i + 3] = 255;
    }
  }
  ctx.putImageData(d, 0, 0);
  const url = c.toDataURL('image/png');
  silhouetteCache.set(id, url);
  return url;
}

// カードのアート部分: 実イラストがあれば使い、無ければプレースホルダー
function setArt(el, c, collected) {
  el.innerHTML = placeholderSVG(c);
  if (collected) {
    loadImage('img/creature/' + c.id + '.png')
      .then(img => { el.innerHTML = ''; img.className = 'illust'; el.appendChild(img); })
      .catch(() => {});
  } else {
    silhouetteFrom(c.id)
      .then(url => { el.innerHTML = '<img class="illust" src="' + url + '" alt="">'; })
      .catch(() => {});
  }
}

function renderZukan() {
  const ent = Storage.get('entitlements');
  const progress = Storage.get('progress');
  $('#tierBadge').textContent = TIER_LABEL[ent.tier] || TIER_LABEL.ume;

  const zonesEl = $('#zones');
  zonesEl.innerHTML = '';
  const zoneOrder = ['river', 'ocean', 'deepsea'];
  if (ent.tier === 'matsu') zoneOrder.push('secret'); // 梅/竹には22体目の枠を出さない(仕様書 §0)

  for (const zoneId of zoneOrder) {
    const zone = DATA.zones.find(z => z.id === zoneId);
    const creatures = DATA.creatures.filter(c => c.zone === zoneId);
    if (!creatures.length) continue;

    const sec = document.createElement('section');
    sec.className = 'week ' + zoneId;
    const h = document.createElement('h2');
    h.textContent = (ZONE_EMOJI[zoneId] || '') + ' ' + zone.name;
    const grid = document.createElement('div');
    grid.className = 'grid';

    for (const c of creatures) {
      const collected = !!progress.collected[c.id];
      const card = document.createElement('div');
      card.className = 'card' + (collected ? ' collected' : '');
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = c.no;
      const art = document.createElement('div');
      art.className = 'art';
      setArt(art, c, collected);
      const label = document.createElement('span');
      label.className = collected ? 'name' : 'qmark';
      label.textContent = collected ? c.name : '？？？';
      card.append(num, art, label);
      grid.appendChild(card);
    }
    sec.append(h, grid);
    zonesEl.appendChild(sec);
  }
}

async function init() {
  try {
    DATA = await (await fetch('data/creatures.json')).json();
  } catch (e) {
    $('#zones').innerHTML = '<p class="hint">データを よみこめませんでした。つうしんかんきょうを かくにんしてね</p>';
    return;
  }
  window.App.data = DATA;
  renderZukan();
  document.dispatchEvent(new CustomEvent('data-ready'));
}

// 水玉バースト演出(デモ・みつけた！画面で共用)
function burst(stage) {
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

// 他モジュール(デモ・キャプチャ等)から参照できるように公開
// (App.data は init() でデータ読み込み後に代入される)
window.App = Object.assign(window.App || {}, {
  data: null,
  factOf,
  renderZukan,
  placeholderSVG,
  silhouetteFrom,
  burst
});

init();
})();
