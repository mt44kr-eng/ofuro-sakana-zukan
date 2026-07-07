// 収録音声の再生モジュール(子どもの声のみ・TTS不使用)
// 「みつけた！」共通クリップ(audio/common/mitsuketa)→ 生き物クリップ(audio/creature/{id})を連続再生。
// 各クリップは m4a → mp3 の順で探し、無いものはスキップ。両方無ければ onMissing を呼ぶ。
const Voice = (() => {
  const foundSrc = new Map(); // 論理名 -> 再生に成功したsrc(2回目以降の探索を省略)

  function candidates(base) {
    if (foundSrc.has(base)) return [foundSrc.get(base)];
    return [base + '.m4a', base + '.mp3'];
  }

  function playSrc(src, volume) {
    return new Promise((resolve, reject) => {
      const a = new Audio(src);
      a.volume = volume;
      a.play().then(() => resolve(a), reject);
    });
  }

  // baseの候補を順に試し、再生できたAudioを返す(できなければnull)
  async function playClip(base, volume) {
    for (const src of candidates(base)) {
      try {
        const a = await playSrc(src, volume);
        foundSrc.set(base, src);
        return a;
      } catch (e) { /* 次の候補へ */ }
    }
    return null;
  }

  function whenEnded(a) {
    return new Promise(resolve => {
      a.onended = resolve;
      a.onerror = resolve;
    });
  }

  // 「みつけた！」→ 生き物のセリフ を連続再生
  async function playFound(creatureId, onMissing) {
    const volume = Storage.get('settings').volume;
    const common = await playClip('audio/common/mitsuketa', volume);
    if (common) await whenEnded(common);
    const creature = await playClip('audio/creature/' + creatureId, volume);
    if (!common && !creature && onMissing) onMissing();
    return !!(common || creature);
  }

  // 単発クリップ再生(ゾーン完了「コンプリート！」等で使用予定)
  async function play(base, onMissing) {
    const a = await playClip(base, Storage.get('settings').volume);
    if (!a && onMissing) onMissing();
    return !!a;
  }

  return { playFound, play };
})();
