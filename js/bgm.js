// BGM再生(設定でon/off・音量)。曲ファイルは audio/bgm.m4a または .mp3。
// 無ければ静かに何もしない。声の邪魔をしないよう音量は控えめに掛ける。
const Bgm = (() => {
  const SOURCES = ['audio/bgm.m4a', 'audio/bgm.mp3'];
  let audio = null;
  let srcIndex = 0;

  function ensureAudio() {
    if (audio) return;
    audio = new Audio(SOURCES[0]);
    audio.loop = true;
    audio.addEventListener('error', () => {
      srcIndex++;
      if (srcIndex < SOURCES.length) {
        audio.src = SOURCES[srcIndex];
        sync();
      }
    });
  }

  function sync() {
    const s = Storage.get('settings');
    if (!s.bgm) {
      if (audio) audio.pause();
      return;
    }
    ensureAudio();
    audio.volume = Math.min(1, s.volume * 0.5);
    audio.play().catch(() => {}); // ファイル未配置・自動再生制限時は静かに諦める
  }

  // 自動再生制限対策: 最初のタップで開始を試みる
  document.addEventListener('pointerdown', sync, { once: true });

  return { sync };
})();
