// 학습 기록 저장 (localStorage).
//
// 서버가 없으므로 모든 기록은 브라우저에 남는다. 시도 로그를 원본 그대로 쌓아두고
// 통계는 읽을 때마다 계산한다 — 나중에 분류 기준이 바뀌어도 과거 기록이 살아있다.

const KEY = 'dictation.v1';
const MAX_ATTEMPTS = 1000;

const EMPTY = {
  version: 1,
  attempts: [],
  settings: { rate: 1, voiceURI: null, autoplay: true },
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(EMPTY),
      ...parsed,
      settings: { ...EMPTY.settings, ...(parsed.settings || {}) },
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

let state = load();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    // 용량 초과 시 오래된 기록을 절반 버리고 한 번 더 시도한다
    state.attempts = state.attempts.slice(-Math.floor(state.attempts.length / 2));
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      console.warn('학습 기록을 저장하지 못했습니다.', e);
    }
  }
}

export function getSettings() {
  return { ...state.settings };
}

export function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  persist();
}

/**
 * 한 문장에 대한 시도를 기록한다.
 * @param {{sentenceId:string, lessonId:string, accuracy:number, isPerfect:boolean,
 *          mistakes:Array<{category:string,type:string,expected:string|null,got:string|null}>,
 *          replays:number, revealed:boolean}} attempt
 */
export function recordAttempt(attempt) {
  state.attempts.push({ ...attempt, ts: Date.now() });
  if (state.attempts.length > MAX_ATTEMPTS) {
    state.attempts = state.attempts.slice(-MAX_ATTEMPTS);
  }
  persist();
}

export function getAttempts() {
  return state.attempts;
}

/** 문장별 요약: 시도 횟수, 최고 정확도, 통과 여부 */
export function sentenceSummary() {
  const map = new Map();
  for (const a of state.attempts) {
    const cur = map.get(a.sentenceId) || {
      sentenceId: a.sentenceId,
      lessonId: a.lessonId,
      attempts: 0,
      best: 0,
      cleared: false,
      lastTs: 0,
      lastAccuracy: 0,
    };
    cur.attempts += 1;
    cur.best = Math.max(cur.best, a.accuracy);
    // 힌트를 보고 맞힌 것은 통과로 치지 않는다
    cur.cleared = cur.cleared || (a.isPerfect && !a.revealed);
    cur.lastTs = Math.max(cur.lastTs, a.ts);
    if (a.ts >= cur.lastTs) cur.lastAccuracy = a.accuracy;
    map.set(a.sentenceId, cur);
  }
  return map;
}

/** 카테고리별 누적 실수 횟수 (최근 기록에 가중치를 두지 않은 단순 합계) */
export function categoryTally({ since = 0 } = {}) {
  const tally = {};
  for (const a of state.attempts) {
    if (a.ts < since) continue;
    for (const m of a.mistakes || []) {
      tally[m.category] = (tally[m.category] || 0) + 1;
    }
  }
  return tally;
}

/** 특정 카테고리에서 실제로 틀린 단어들 (빈도순) */
export function topMissedWords(category, limit = 8) {
  const counts = new Map();
  for (const a of state.attempts) {
    for (const m of a.mistakes || []) {
      if (m.category !== category) continue;
      const word = (m.expected || m.got || '').toLowerCase().replace(/[^a-z0-9']/g, '');
      if (!word) continue;
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

export function overallStats() {
  const attempts = state.attempts;
  if (!attempts.length) {
    return { totalAttempts: 0, sentencesTried: 0, sentencesCleared: 0, avgAccuracy: 0, recentAccuracy: 0, totalMistakes: 0 };
  }
  const summary = sentenceSummary();
  const sum = attempts.reduce((acc, a) => acc + a.accuracy, 0);
  const recent = attempts.slice(-20);
  const recentSum = recent.reduce((acc, a) => acc + a.accuracy, 0);

  return {
    totalAttempts: attempts.length,
    sentencesTried: summary.size,
    sentencesCleared: [...summary.values()].filter((s) => s.cleared).length,
    avgAccuracy: sum / attempts.length,
    recentAccuracy: recentSum / recent.length,
    totalMistakes: attempts.reduce((acc, a) => acc + (a.mistakes?.length || 0), 0),
  };
}

/** 최근 N일 일별 정확도 (학습 추이 그래프용) */
export function dailyAccuracy(days = 14) {
  const dayMs = 86400000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = today.getTime() - (days - 1) * dayMs;

  const buckets = Array.from({ length: days }, (_, i) => ({
    ts: start + i * dayMs,
    sum: 0,
    count: 0,
  }));

  for (const a of state.attempts) {
    if (a.ts < start) continue;
    const idx = Math.floor((a.ts - start) / dayMs);
    if (idx < 0 || idx >= days) continue;
    buckets[idx].sum += a.accuracy;
    buckets[idx].count += 1;
  }

  return buckets.map((b) => ({
    ts: b.ts,
    accuracy: b.count ? b.sum / b.count : null,
    count: b.count,
  }));
}

// ── 사용자가 가져온 코스 (유튜브 자막 등) ────────────────────────────
//
// 학습 기록과 별도 키에 저장한다. 기록을 초기화해도 가져온 코스는 남는다.

const LESSONS_KEY = 'dictation.lessons.v1';

export function getUserLessons() {
  try {
    const raw = localStorage.getItem(LESSONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistLessons(lessons) {
  try {
    localStorage.setItem(LESSONS_KEY, JSON.stringify(lessons));
    return true;
  } catch {
    return false;
  }
}

/** 같은 id면 덮어쓴다 */
export function saveUserLesson(lesson) {
  const lessons = getUserLessons().filter((l) => l.id !== lesson.id);
  lessons.unshift(lesson);
  if (!persistLessons(lessons)) {
    throw new Error('저장 공간이 부족합니다. 오래된 코스를 지운 뒤 다시 시도해 주세요.');
  }
  return lesson;
}

export function deleteUserLesson(id) {
  persistLessons(getUserLessons().filter((l) => l.id !== id));
}

export function resetAll() {
  const settings = state.settings;
  state = { ...structuredClone(EMPTY), settings };
  persist();
}

// ── 내보내기 / 가져오기 ───────────────────────────────────────────────
//
// 기록은 출처(origin)별 localStorage 에만 있으므로 브라우저나 기기를 바꾸면
// 통째로 사라진다. 파일로 빼고 넣을 수 있게 해 둔다.

const EXPORT_FORMAT = 'dictation-lab-backup';

export function exportAll() {
  return {
    format: EXPORT_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    origin: location.origin,
    attempts: state.attempts,
    settings: state.settings,
    lessons: getUserLessons(),
  };
}

export function exportFilename() {
  const d = new Date();
  const stamp = [d.getFullYear(), d.getMonth() + 1, d.getDate()]
    .map((n) => String(n).padStart(2, '0'))
    .join('-');
  return `dictation-backup-${stamp}.json`;
}

/**
 * 백업 파일을 현재 기록에 병합한다. 덮어쓰지 않고 없는 것만 더한다.
 * 같은 시도(문장 id + 시각)는 중복으로 보고 건너뛴다.
 *
 * @returns {{addedAttempts:number, skippedAttempts:number, addedLessons:number, updatedLessons:number}}
 */
export function importAll(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('파일을 읽을 수 없습니다.');
  }
  if (data.format !== EXPORT_FORMAT || !Array.isArray(data.attempts)) {
    throw new Error('이 앱에서 내보낸 백업 파일이 아닙니다.');
  }

  const key = (a) => `${a.sentenceId}|${a.ts}`;
  const seen = new Set(state.attempts.map(key));

  let addedAttempts = 0;
  let skippedAttempts = 0;
  for (const a of data.attempts) {
    // 통계 계산이 기대하는 최소 형태를 갖췄는지 확인한다
    if (!a || typeof a.sentenceId !== 'string' || typeof a.ts !== 'number' || typeof a.accuracy !== 'number') {
      skippedAttempts += 1;
      continue;
    }
    if (seen.has(key(a))) {
      skippedAttempts += 1;
      continue;
    }
    seen.add(key(a));
    state.attempts.push({ ...a, mistakes: Array.isArray(a.mistakes) ? a.mistakes : [] });
    addedAttempts += 1;
  }

  state.attempts.sort((a, b) => a.ts - b.ts);
  if (state.attempts.length > MAX_ATTEMPTS) {
    state.attempts = state.attempts.slice(-MAX_ATTEMPTS);
  }
  persist();

  // 가져온 코스도 함께 복원한다 — 없으면 그 문장들의 기록이 이름 없는 항목이 된다
  let addedLessons = 0;
  let updatedLessons = 0;
  if (Array.isArray(data.lessons)) {
    const existing = getUserLessons();
    const byId = new Map(existing.map((l) => [l.id, l]));

    for (const lesson of data.lessons) {
      if (!lesson?.id || !Array.isArray(lesson.sentences)) continue;
      const current = byId.get(lesson.id);
      if (!current) {
        byId.set(lesson.id, lesson);
        addedLessons += 1;
      } else if ((lesson.createdAt || 0) > (current.createdAt || 0)) {
        byId.set(lesson.id, lesson);
        updatedLessons += 1;
      }
    }
    persistLessons([...byId.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
  }

  return { addedAttempts, skippedAttempts, addedLessons, updatedLessons };
}
