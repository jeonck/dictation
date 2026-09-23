// 자막 파싱 및 문장 분할.
//
// 유튜브 자막은 브라우저에서 직접 받아올 수 없다(CORS). 대신 사용자가 붙여넣거나
// 올린 자막 텍스트를 여기서 해석한다. 지원 형식:
//   · WebVTT (.vtt)         — 유튜브 자동/수동 자막 다운로드 형식
//   · SubRip (.srt)
//   · 유튜브 '스크립트 표시' 패널에서 복사한 텍스트
//
// 자막은 문장이 아니라 2~5단어짜리 조각으로 끊겨 있으므로, 받아쓰기에 쓰려면
// 다시 문장 단위로 합쳐야 한다. 그게 이 파일의 핵심 작업이다.

/** "1:23.456", "01:02:03,400", "83" 등을 초 단위로 */
function parseTimestamp(raw) {
  const parts = String(raw).trim().replace(',', '.').split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** 유튜브 URL 또는 ID 문자열에서 11자리 영상 ID 추출 */
export function extractVideoId(input) {
  const text = String(input || '').trim();
  if (!text) return null;
  if (/^[\w-]{11}$/.test(text)) return text;

  const patterns = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /\/embed\/([\w-]{11})/,
    /\/shorts\/([\w-]{11})/,
    /\/live\/([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return null;
}

// ── 자막 정리 ─────────────────────────────────────────────────────────

const NOISE = /\[[^\]]*\]|\([^)]*\)|♪|&gt;&gt;|>>/g;

function cleanText(raw) {
  return raw
    .replace(/<\d{1,2}:\d{2}:\d{2}[.,]\d{3}>/g, '') // VTT 인라인 워드 타이밍
    .replace(/<\/?c[^>]*>/g, '') // VTT 색상 태그
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(NOISE, ' ') // [Music], (laughs), >> 화자 표시
    .replace(/^\s*-\s+/gm, ' ') // 대사 앞 하이픈
    .replace(/\s+/g, ' ')
    .trim();
}

// ── 형식별 파서 ───────────────────────────────────────────────────────

const VTT_SRT_CUE = /(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->\s*(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}/;

/** WebVTT / SubRip 공통 파서 — 둘 다 "시작 --> 끝" 줄 뒤에 본문이 온다 */
function parseCueFormat(raw) {
  const cues = [];
  const lines = raw.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    if (!VTT_SRT_CUE.test(lines[i])) continue;

    const [from, to] = lines[i].split('-->');
    const start = parseTimestamp(from.trim().split(/\s+/)[0]);
    const end = parseTimestamp(to.trim().split(/\s+/)[0]);
    if (start === null || end === null) continue;

    const body = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (!line.trim() || VTT_SRT_CUE.test(line)) break;
      if (/^\d+$/.test(line.trim()) && j + 1 < lines.length && VTT_SRT_CUE.test(lines[j + 1])) break;
      body.push(line);
      i = j;
    }

    const text = cleanText(body.join(' '));
    if (text) cues.push({ start, end, text });
  }
  return cues;
}

/**
 * 유튜브 '스크립트 표시' 패널에서 복사한 텍스트.
 * 타임스탬프가 별도 줄에 오거나(0:12 \n 본문) 같은 줄에 올 수 있다.
 * 끝 시각 정보가 없으므로 다음 큐의 시작 시각으로 채운다.
 */
function parseTranscriptPanel(raw) {
  const cues = [];
  const lines = raw.split(/\r?\n/);
  const LEADING_TS = /^\s*((?:\d{1,2}:)?\d{1,2}:\d{2})\s*(.*)$/;

  let pending = null;
  const push = (start, text) => {
    const clean = cleanText(text);
    if (!clean) return;
    cues.push({ start, end: start, text: clean });
  };

  for (const line of lines) {
    const m = line.match(LEADING_TS);
    if (m) {
      const start = parseTimestamp(m[1]);
      if (start === null) continue;
      if (pending !== null) push(pending.start, pending.text);
      pending = { start, text: m[2] || '' };
    } else if (pending && line.trim()) {
      pending.text += ` ${line}`;
    }
  }
  if (pending !== null) push(pending.start, pending.text);

  // 끝 시각을 다음 큐 시작으로 보정 (마지막은 단어 수로 추정)
  for (let i = 0; i < cues.length; i++) {
    const next = cues[i + 1];
    cues[i].end = next ? next.start : cues[i].start + Math.max(2, cues[i].text.split(/\s+/).length * 0.4);
  }
  return cues;
}

/**
 * 유튜브 자동 생성 자막은 같은 줄이 스크롤되며 반복된다.
 * 앞 큐와 겹치는 부분을 잘라내 중복을 없앤다.
 */
function dedupeRolling(cues) {
  const out = [];

  for (const cue of cues) {
    const prev = out[out.length - 1];
    let words = cue.text.split(/\s+/).filter(Boolean);

    if (prev) {
      const prevWords = prev.text.split(/\s+/).filter(Boolean);
      const lower = (a) => a.map((w) => w.toLowerCase().replace(/[^\w']/g, ''));
      const p = lower(prevWords);
      const c = lower(words);

      // 큐 전체가 앞 큐에 그대로 포함되면 통째로 버린다
      if (c.length && p.join(' ').includes(c.join(' '))) {
        prev.end = Math.max(prev.end, cue.end);
        continue;
      }

      // 앞 큐의 꼬리와 현재 큐의 머리가 2단어 이상 겹치면 겹친 만큼 잘라낸다
      const maxOverlap = Math.min(p.length, c.length);
      for (let k = maxOverlap; k >= 2; k--) {
        if (p.slice(p.length - k).join(' ') === c.slice(0, k).join(' ')) {
          words = words.slice(k);
          break;
        }
      }
    }

    const text = words.join(' ').trim();
    if (!text) {
      if (prev) prev.end = Math.max(prev.end, cue.end);
      continue;
    }
    out.push({ start: cue.start, end: Math.max(cue.end, cue.start + 0.2), text });
  }
  return out;
}

/**
 * 자막 텍스트를 형식 자동 판별해 큐 목록으로 만든다.
 * @returns {{cues: Array<{start:number,end:number,text:string}>, format: string}}
 */
export function parseCaptions(raw) {
  const text = String(raw || '');
  if (!text.trim()) return { cues: [], format: 'empty' };

  let cues;
  let format;
  if (VTT_SRT_CUE.test(text)) {
    cues = parseCueFormat(text);
    format = /^﻿?WEBVTT/m.test(text) ? 'vtt' : 'srt';
  } else {
    cues = parseTranscriptPanel(text);
    format = 'transcript';
  }

  return { cues: dedupeRolling(cues), format };
}

// ── 문장 분할 ─────────────────────────────────────────────────────────

/** 큐를 단어 단위로 펼치고 각 단어의 시각을 선형 보간한다 */
function toTimedWords(cues) {
  const words = [];
  for (const cue of cues) {
    const parts = cue.text.split(/\s+/).filter(Boolean);
    if (!parts.length) continue;
    const span = Math.max(0.05, cue.end - cue.start);
    parts.forEach((word, i) => {
      words.push({
        word,
        start: cue.start + (span * i) / parts.length,
        end: cue.start + (span * (i + 1)) / parts.length,
        // 큐 경계 = 화자가 숨 쉰 지점일 가능성이 높다. 분할 후보로 쓴다.
        cueBreak: i === parts.length - 1,
      });
    });
  }
  return words;
}

const SENTENCE_END = /[.!?]["')\]]?$/;

/**
 * 자막 큐를 받아쓰기용 문장으로 합친다.
 *
 * 정식 자막은 문장부호로 자르면 되지만, 유튜브 자동 생성 자막에는 문장부호가
 * 아예 없다. 그럴 때는 목표 길이만큼 모으되 큐 경계(≒ 호흡 지점)에서 끊는다.
 *
 * @param {Array} cues
 * @param {{targetWords?: number, minWords?: number, maxWords?: number}} opts
 * @returns {Array<{text:string, start:number, end:number}>}
 */
export function segmentIntoSentences(cues, opts = {}) {
  const { targetWords = 11, minWords = 4, maxWords = 20 } = opts;
  const words = toTimedWords(cues);
  if (!words.length) return [];

  const punctuated = words.filter((w) => SENTENCE_END.test(w.word)).length >= words.length / 40;

  const sentences = [];
  let buffer = [];

  const flush = () => {
    if (!buffer.length) return;
    sentences.push({
      text: buffer.map((w) => w.word).join(' '),
      start: buffer[0].start,
      end: buffer[buffer.length - 1].end,
    });
    buffer = [];
  };

  for (const w of words) {
    buffer.push(w);

    if (punctuated) {
      if (SENTENCE_END.test(w.word) && buffer.length >= minWords) flush();
      else if (buffer.length >= maxWords) flush();
    } else {
      // 문장부호가 없으면 목표 길이를 넘긴 뒤 첫 큐 경계에서 끊는다
      if (buffer.length >= targetWords && w.cueBreak) flush();
      else if (buffer.length >= maxWords) flush();
    }
  }
  flush();

  // 너무 짧게 남은 조각은 앞 문장에 붙인다
  const merged = [];
  for (const s of sentences) {
    const prev = merged[merged.length - 1];
    if (prev && s.text.split(/\s+/).length < minWords) {
      prev.text = `${prev.text} ${s.text}`;
      prev.end = s.end;
    } else {
      merged.push({ ...s });
    }
  }

  // 자막 타이밍은 실제 발화보다 조금 늦거나 이르게 찍히므로 앞뒤에 여유를 준다.
  // 스크립트 패널 자막엔 끝 시각이 없어 end=다음 줄 시작이라, 그 사이 침묵·피드백까지
  // 딸려 재생된다. 받아쓰기는 한 문장만 들려야 하므로 말 길이에 맞춰 상한을 둔다.
  // ponytail: 0.7s/word 휴리스틱 — 실제 발화는 보통 이보다 빠르다. 너무 짧게 잘리면 상향.
  return merged.map((s) => {
    const text = s.text.trim();
    const start = Math.max(0, s.start - 0.25);
    const cap = start + text.split(/\s+/).length * 0.7 + 1.0;
    return { text, start, end: Math.min(s.end + 0.35, cap) };
  });
}

/** 붙여넣은 자막 → 바로 학습 가능한 문장 목록 */
export function buildSentences(raw, opts) {
  const { cues, format } = parseCaptions(raw);
  return { sentences: segmentIntoSentences(cues, opts), cueCount: cues.length, format };
}
