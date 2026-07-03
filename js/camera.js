// カメラ制御: 背面カメラのプレビューと正方形キャプチャ
const Camera = (() => {
  let stream = null;

  async function start(video) {
    stop();
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 1280 }
      },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
  }

  function stop() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
  }

  // プレビュー中央の正方形を640pxで切り出す
  function capture(video) {
    const vw = video.videoWidth, vh = video.videoHeight;
    const size = Math.min(vw, vh);
    const c = document.createElement('canvas');
    c.width = 640; c.height = 640;
    c.getContext('2d').drawImage(video, (vw - size) / 2, (vh - size) / 2, size, size, 0, 0, 640, 640);
    return c;
  }

  return { start, stop, capture, isActive: () => !!stream };
})();
