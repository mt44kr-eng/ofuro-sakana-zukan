// 方式1: 色ヒストグラム照合(依存ゼロ)
// 画像中央部のHSV色分布を取り、ヒストグラム交差で類似度(0〜1)を返す。
// 彩度・明度が低い画素は「グレー系」として明度ビンに分ける(白背景や影に対応)。
const HistMatcher = (() => {
  const SIZE = 96;          // 解析用の縮小サイズ
  const MARGIN = 0.18;      // 周囲18%は背景とみなして無視(中央の被写体に集中)
  const HUE_BINS = 16;
  const GRAY_BINS = 4;

  function feature(source) {
    const c = document.createElement('canvas');
    c.width = SIZE; c.height = SIZE;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, SIZE, SIZE);
    const m = Math.round(SIZE * MARGIN);
    const w = SIZE - m * 2;
    const data = ctx.getImageData(m, m, w, w).data;

    const hist = new Array(HUE_BINS + GRAY_BINS).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const v = max;
      const s = max === 0 ? 0 : (max - min) / max;
      if (s < 0.18 || v < 0.12) {
        hist[HUE_BINS + Math.min(GRAY_BINS - 1, Math.floor(v * GRAY_BINS))]++;
      } else {
        const d = max - min;
        let h;
        if (max === r) h = ((g - b) / d + 6) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        hist[Math.floor(h / 6 * HUE_BINS) % HUE_BINS]++;
      }
    }
    const total = hist.reduce((a, x) => a + x, 0) || 1;
    return hist.map(x => x / total);
  }

  // ヒストグラム交差: 完全一致で1.0
  function similarity(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.min(a[i], b[i]);
    return s;
  }

  return { feature, similarity };
})();
