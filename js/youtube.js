// 유튜브 IFrame 플레이어 래퍼.
//
// 자막에서 뽑은 [start, end] 구간만 반복 재생한다. 브라우저 TTS와 달리 실제
// 원어민 발화라서 연음·리듬이 그대로 살아 있다.
//
// 영상 파일을 내려받지 않고 공식 임베드 플레이어로 재생하므로 유튜브 약관에
// 어긋나지 않는다.

const API_SRC = 'https://www.youtube.com/iframe_api';

let apiPromise = null;

/** IFrame API 스크립트를 한 번만 로드한다 */
function loadApi() {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };

    const script = document.createElement('script');
    script.src = API_SRC;
    script.async = true;
    script.onerror = () => reject(new Error('유튜브 플레이어를 불러오지 못했습니다. 네트워크를 확인해 주세요.'));
    document.head.appendChild(script);

    setTimeout(() => reject(new Error('유튜브 플레이어 로딩이 지연되고 있습니다.')), 15000);
  });

  return apiPromise;
}

export class YouTubePlayer {
  /** @param {HTMLElement} mount 플레이어가 들어갈 컨테이너 */
  constructor(mount) {
    this.mount = mount;
    this.rate = 1;
    this._player = null;
    this._ready = null;
    this._token = 0; // 이전 구간 재생을 무효화하기 위한 토큰
    this._timer = null;
    this._onStateChange = () => {};
  }

  onStateChange(fn) {
    this._onStateChange = fn;
  }

  async load(videoId) {
    const YT = await loadApi();

    if (this._player) {
      this._player.loadVideoById(videoId);
      // 로드 직후 자동 재생되지 않도록 곧바로 멈춘다
      this._player.pauseVideo();
      return;
    }

    const host = document.createElement('div');
    this.mount.replaceChildren(host);

    this._ready = new Promise((resolve) => {
      this._player = new YT.Player(host, {
        videoId,
        playerVars: {
          controls: 0,
          disablekb: 1,
          cc_load_policy: 0, // 자막 표시 끄기 — 정답이 보이면 안 된다
          iv_load_policy: 3,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: () => resolve(),
          onStateChange: (e) => {
            this._onStateChange(e.data === YT.PlayerState.PLAYING);
          },
          onError: () => {
            this._onStateChange(false);
          },
        },
      });
    });

    await this._ready;
  }

  setRate(rate) {
    this.rate = rate;
    this._player?.setPlaybackRate?.(rate);
  }

  stop() {
    this._token += 1;
    clearInterval(this._timer);
    this._timer = null;
    try {
      this._player?.pauseVideo?.();
    } catch {
      /* 플레이어가 아직 준비되지 않은 경우 무시 */
    }
    this._onStateChange(false);
  }

  /**
   * [start, end] 구간만 재생하고 끝나면 멈춘다.
   * @returns {Promise<void>} 구간 재생이 끝나면 resolve
   */
  async playSegment(start, end) {
    if (!this._player) throw new Error('플레이어가 아직 준비되지 않았습니다.');
    await this._ready;

    this.stop();
    const token = this._token;

    this._player.setPlaybackRate(this.rate);
    this._player.seekTo(Math.max(0, start), true);
    this._player.playVideo();

    return new Promise((resolve) => {
      // seekTo 는 정확히 멈추지 않으므로 현재 시각을 폴링해 끝 지점에서 정지시킨다
      this._timer = setInterval(() => {
        if (token !== this._token) {
          resolve();
          return;
        }
        let now;
        try {
          now = this._player.getCurrentTime();
        } catch {
          return;
        }
        if (now >= end) {
          clearInterval(this._timer);
          this._timer = null;
          this._player.pauseVideo();
          this._onStateChange(false);
          resolve();
        }
      }, 60);
    });
  }

  destroy() {
    this.stop();
    try {
      this._player?.destroy?.();
    } catch {
      /* 이미 제거된 경우 무시 */
    }
    this._player = null;
    this._ready = null;
  }
}
