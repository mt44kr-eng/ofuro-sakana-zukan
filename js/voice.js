// 収録音声の再生モジュール(子どもの声のみ・TTS不使用)
// 「みつけた！」共通クリップ(audio/common/mitsuketa)→ 生き物クリップ(audio/creature/{id})を連続再生。
// - 2つ目のクリップは1つ目の再生中に先読みし、終わった瞬間に再生(間を最小化)
// - 新しい再生を始める前に前回の再生を停止(二重再生防止)
const Voice = (() => {
  const srcCache = new Map(); // base -> 存在するsrc(無ければnull)
  let current = null; // 再生中のAudio配列(世代管理)

  // m4a→mp3の順で存在確認(fetchはSW経由でキャッシュされるためオフラインでも動く)
  async function resolveSrc(base) {
    if (srcCache.has(base)) return srcCache.get(base);
    for (const src of [base + '.m4a', base + '.mp3']) {
      try {
        const r = await fetch(src);
        if (r.ok) { srcCache.set(base, src); return src; }
      } catch (e) { /* 次の候補へ */ }
    }
    srcCache.set(base, null);
    return null;
  }

  function stopAll() {
    if (current) {
      for (const a of current) { try { a.pause(); a.onended = null; } catch (e) {} }
    }
    current = null;
  }

  function whenEnded(a) {
    return new Promise(resolve => {
      a.onended = resolve;
      a.onerror = resolve;
    });
  }

  async function playList(bases, onMissing) {
    const volume = Storage.get('settings').volume;
    const srcs = (await Promise.all(bases.map(resolveSrc))).filter(Boolean);
    if (!srcs.length) {
      if (onMissing) onMissing();
      return false;
    }
    stopAll();
    // 全クリップを先に生成して読み込み開始(連続再生の間を最小化)
    const clips = srcs.map(src => {
      const a = new Audio(src);
      a.preload = 'auto';
      a.volume = volume;
      a.load();
      return a;
    });
    current = clips;
    for (const a of clips) {
      if (current !== clips) return true; // 新しい再生に割り込まれたら中断
      try { await a.play(); } catch (e) { continue; }
      await whenEnded(a);
    }
    return true;
  }

  // 「みつけた！」→ 生き物のセリフ
  function playFound(creatureId, onMissing) {
    return playList(['audio/common/mitsuketa', 'audio/creature/' + creatureId], onMissing);
  }

  // 単発クリップ(ゾーン完了「コンプリート！」等)
  function play(base, onMissing) {
    return playList([base], onMissing);
  }

  return { playFound, play };
})();
