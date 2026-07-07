// 図鑑PDFダウンロード(印刷用CSS方式・依存ゼロ)
// 収集済み=イラスト+名前+説明文 / 未収集=シルエット+「？」
// 竹/梅=21枠、松のみ22枠(仕様書 §5-3)
const Print = (() => {

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(src));
      img.src = src;
    });
  }

  async function cellArt(c, collected) {
    const src = 'img/creature/' + c.id + '.png';
    try {
      if (collected) {
        await loadImage(src); // 存在確認
        return '<img src="' + src + '" alt="">';
      }
      const url = await App.silhouetteFrom(c.id);
      return '<img src="' + url + '" alt="">';
    } catch (e) {
      // イラスト未配置: プレースホルダー形状
      return '<div class="pPh">' + App.placeholderSVG(c) + '</div>';
    }
  }

  async function run() {
    const ent = Storage.get('entitlements');
    const progress = Storage.get('progress');
    const maxNo = ent.tier === 'matsu' ? 22 : 21;
    const creatures = App.data.creatures
      .filter(c => c.no >= 1 && c.no <= maxNo)
      .sort((a, b) => a.no - b.no);

    const collectedCount = creatures.filter(c => progress.collected[c.id]).length;
    const cells = [];
    for (const c of creatures) {
      const collected = !!progress.collected[c.id];
      const art = await cellArt(c, collected);
      cells.push(
        '<div class="pCell">' +
        '<span class="pNum">' + c.no + '</span>' +
        art +
        '<b class="pName">' + (collected ? c.name : '？？？') + '</b>' +
        '<p class="pDesc">' + (collected ? App.factOf(c) : '？') + '</p>' +
        '</div>'
      );
    }

    const today = new Date();
    const dateStr = today.getFullYear() + '年' + (today.getMonth() + 1) + '月' + today.getDate() + '日';
    document.getElementById('printSheet').innerHTML =
      '<h1 class="pTitle">みつけた！みずのなかま ずかん</h1>' +
      '<p class="pMeta">' + dateStr + ' ・ みつけた かず: ' + collectedCount + ' / ' + creatures.length + '</p>' +
      '<div class="pGrid">' + cells.join('') + '</div>';

    window.print();
  }

  return { run };
})();
