// 재생 엔진.
//
// 문장에 audioUrl(원어민 녹음)이 있으면 그것을 쓰고, 없으면 브라우저 내장 TTS로
// 대체 재생한다. 어느 쪽이든 배속 조절이 가능해 연음을 느리게 뜯어들을 수 있다.
// 섀도잉을 위한 마이크 녹음도 여기서 담당한다.

const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;

// macOS/Windows에 기본 포함된 효과음·캐릭터 음성. 발음 학습에는 쓸 수 없으므로 숨긴다.
const NOVELTY_VOICES = new Set([
  'Albert', 'Bad News', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos',
  'Good News', 'Jester', 'Junior', 'Kathy', 'Organ', 'Superstar',
  'Trinoids', 'Whisper', 'Wobble', 'Zarvox', 'Fred', 'Ralph',
  'Grandma', 'Grandpa', 'Deranged', 'Hysterical', 'Pipe Organ', 'Princess',
]);

export class Player {
  constructor() {
    this.rate = 1;
    this.voice = null;
    this.voices = [];
    this._audio = null;
    this._utterance = null;
    this._onStateChange = () => {};
  }

  get supported() {
    return !!synth;
  }

  onStateChange(fn) {
    this._onStateChange = fn;
  }

  /** 음성 목록은 비동기로 채워지므로 로드될 때까지 기다린다. */
  async init() {
    if (!synth) return [];
    const load = () =>
      synth
        .getVoices()
        .filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'))
        .filter((v) => !NOVELTY_VOICES.has(v.name.replace(/\s*\(.*\)$/, '').trim()))
        .sort((a, b) => a.name.localeCompare(b.name));

    let voices = load();
    if (!voices.length) {
      voices = await new Promise((resolve) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          resolve(load());
        };
        synth.addEventListener('voiceschanged', done, { once: true });
        setTimeout(done, 1500); // voiceschanged 가 끝내 안 오는 브라우저 대비
      });
    }

    this.voices = voices;
    this.voice = pickDefaultVoice(voices);
    return voices;
  }

  setRate(rate) {
    this.rate = rate;
    if (this._audio) this._audio.playbackRate = rate;
  }

  setVoiceByURI(uri) {
    this.voice = this.voices.find((v) => v.voiceURI === uri) || this.voice;
  }

  stop() {
    if (synth) synth.cancel();
    if (this._audio) {
      this._audio.pause();
      this._audio.currentTime = 0;
    }
    this._utterance = null;
    this._onStateChange(false);
  }

  /**
   * 문장(또는 임의의 텍스트)을 재생한다.
   * @param {{text: string, audioUrl?: string}|string} sentence
   * @returns {Promise<void>} 재생이 끝나면 resolve
   */
  play(sentence) {
    const item = typeof sentence === 'string' ? { text: sentence } : sentence;
    this.stop();
    return item.audioUrl ? this._playFile(item.audioUrl) : this._speak(item.text);
  }

  _playFile(url) {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.playbackRate = this.rate;
      this._audio = audio;
      this._onStateChange(true);

      const finish = () => {
        this._audio = null;
        this._onStateChange(false);
        resolve();
      };
      audio.addEventListener('ended', finish, { once: true });
      audio.addEventListener('error', () => {
        this._audio = null;
        this._onStateChange(false);
        reject(new Error(`오디오를 불러오지 못했습니다: ${url}`));
      }, { once: true });

      audio.play().catch(reject);
    });
  }

  _speak(text) {
    if (!synth) return Promise.reject(new Error('이 브라우저는 음성 합성을 지원하지 않습니다.'));

    return new Promise((resolve, reject) => {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = this.rate;
      u.pitch = 1;
      u.lang = this.voice?.lang || 'en-US';
      if (this.voice) u.voice = this.voice;

      const finish = () => {
        if (this._utterance === u) this._utterance = null;
        this._onStateChange(false);
        resolve();
      };
      u.addEventListener('end', finish, { once: true });
      u.addEventListener('error', (e) => {
        if (this._utterance === u) this._utterance = null;
        this._onStateChange(false);
        // cancel() 호출로 인한 중단은 오류가 아니다
        if (e.error === 'interrupted' || e.error === 'canceled') resolve();
        else reject(new Error(`음성 합성 오류: ${e.error}`));
      }, { once: true });

      this._utterance = u;
      this._onStateChange(true);
      synth.speak(u);
    });
  }
}

/** 자연스러운 기본 목소리 고르기 — 로컬 합성보다 고품질 원격 음성을 선호 */
function pickDefaultVoice(voices) {
  if (!voices.length) return null;
  const preferred = [
    /Google US English/i, /Samantha/i, /Ava/i, /Allison/i,
    /Microsoft (Aria|Jenny|Guy)/i, /Alex/i, /Daniel/i,
  ];
  for (const re of preferred) {
    const hit = voices.find((v) => re.test(v.name));
    if (hit) return hit;
  }
  return voices.find((v) => v.lang === 'en-US') || voices[0];
}

// ── 섀도잉 녹음 ────────────────────────────────────────────────────────────

export class Recorder {
  constructor() {
    this._recorder = null;
    this._chunks = [];
    this._stream = null;
  }

  get supported() {
    return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  get isRecording() {
    return this._recorder?.state === 'recording';
  }

  async start() {
    if (!this.supported) throw new Error('이 브라우저는 녹음을 지원하지 않습니다.');
    this._stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this._chunks = [];
    this._recorder = new MediaRecorder(this._stream);
    this._recorder.addEventListener('dataavailable', (e) => {
      if (e.data.size > 0) this._chunks.push(e.data);
    });
    this._recorder.start();
  }

  /** @returns {Promise<string>} 재생 가능한 blob URL */
  stop() {
    return new Promise((resolve, reject) => {
      const rec = this._recorder;
      if (!rec || rec.state === 'inactive') {
        reject(new Error('녹음 중이 아닙니다.'));
        return;
      }
      rec.addEventListener('stop', () => {
        const blob = new Blob(this._chunks, { type: rec.mimeType || 'audio/webm' });
        this._releaseStream();
        this._recorder = null;
        resolve(URL.createObjectURL(blob));
      }, { once: true });
      rec.stop();
    });
  }

  cancel() {
    if (this._recorder && this._recorder.state !== 'inactive') this._recorder.stop();
    this._releaseStream();
    this._recorder = null;
    this._chunks = [];
  }

  _releaseStream() {
    this._stream?.getTracks().forEach((t) => t.stop());
    this._stream = null;
  }
}
