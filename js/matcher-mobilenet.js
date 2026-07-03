// 方式3: MobileNet特徴ベクトル照合
// TensorFlow.js + MobileNet v2 (alpha 0.5) をCDNから遅延読み込みし、
// 画像の特徴ベクトル同士のコサイン類似度(おおむね0〜1)を返す。学習は不要。
const MobileNetMatcher = (() => {
  const SCRIPTS = [
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',
    'https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js'
  ];
  let model = null;
  let loading = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('スクリプト読み込み失敗: ' + src));
      document.head.appendChild(s);
    });
  }

  function load() {
    if (model) return Promise.resolve(model);
    if (!loading) {
      loading = (async () => {
        for (const src of SCRIPTS) await loadScript(src);
        model = await mobilenet.load({ version: 2, alpha: 0.5 });
        return model;
      })();
      loading.catch(() => { loading = null; });
    }
    return loading;
  }

  async function feature(source) {
    const m = await load();
    const t = m.infer(source, true); // 分類ではなく埋め込みベクトルを取得
    const arr = Array.from(await t.data());
    t.dispose();
    return arr;
  }

  function similarity(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
  }

  return { load, feature, similarity, isLoaded: () => !!model };
})();
