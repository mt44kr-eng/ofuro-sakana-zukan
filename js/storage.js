// ストレージ3系統分離(仕様書 §2)
// 1) progress: 収集進捗(collected・取得日・ゾーン完了・グランド完了) → リセットで消えるのはここだけ
// 2) settings: BGM on/off・音量
// 3) entitlements: ティア(ume/take/matsu)
const Storage = (() => {
  const KEYS = {
    progress: 'mizu-progress',
    settings: 'mizu-settings',
    entitlements: 'mizu-entitlements'
  };
  const DEFAULTS = {
    progress: { collected: {}, zonesDone: [], grandDone: false },
    settings: { bgm: true, volume: 0.8 },
    entitlements: { tier: 'ume' }
  };

  function get(kind) {
    try {
      const raw = localStorage.getItem(KEYS[kind]);
      if (!raw) return structuredClone(DEFAULTS[kind]);
      return Object.assign(structuredClone(DEFAULTS[kind]), JSON.parse(raw));
    } catch (e) {
      return structuredClone(DEFAULTS[kind]);
    }
  }

  function set(kind, value) {
    try { localStorage.setItem(KEYS[kind], JSON.stringify(value)); } catch (e) {}
  }

  // 収集進捗のみ初期化(設定・ティアは保持)
  function resetProgress() {
    try { localStorage.removeItem(KEYS.progress); } catch (e) {}
  }

  // 機種変更・iOSデータ消去対策のエクスポート/インポート(全3系統)
  function exportAll() {
    return JSON.stringify({
      app: 'mitsuketa-mizu-no-nakama',
      version: 1,
      exportedAt: new Date().toISOString(),
      progress: get('progress'),
      settings: get('settings'),
      entitlements: get('entitlements')
    }, null, 2);
  }

  function importAll(json) {
    const d = JSON.parse(json);
    if (d.app !== 'mitsuketa-mizu-no-nakama') throw new Error('このアプリのデータではありません');
    if (d.progress) set('progress', d.progress);
    if (d.settings) set('settings', d.settings);
    if (d.entitlements) set('entitlements', d.entitlements);
  }

  return { get, set, resetProgress, exportAll, importAll };
})();
