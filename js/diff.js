// 단어 단위 정렬(alignment) 및 채점.
//
// 정답 문장과 사용자 입력을 각각 토큰으로 쪼갠 뒤 Needleman-Wunsch DP로 정렬해
// match / sub(오답) / del(누락) / ins(추가) 연산 목록을 만든다.
// 표시용 원본 토큰과 비교용 정규화 토큰을 같은 인덱스로 유지해, 채점은 정규화된
// 형태로 하되 화면에는 원문 그대로(대소문자·문장부호 포함) 보여준다.

/** 비교용 정규화: 소문자, 유니코드 따옴표 통일, 문장부호 제거(아포스트로피는 유지) */
export function normalizeWord(raw) {
  return raw
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9']/g, '')
    .replace(/^'+|'+$/g, '');
}

/**
 * 문장을 토큰화한다.
 * @returns {{display: string[], norm: string[]}} 인덱스가 1:1 대응된다.
 */
export function tokenize(text) {
  const display = [];
  const norm = [];
  for (const raw of String(text).trim().split(/\s+/)) {
    if (!raw) continue;
    const n = normalizeWord(raw);
    if (!n) continue; // 문장부호만으로 이루어진 토큰은 채점에서 제외
    display.push(raw);
    norm.push(n);
  }
  return { display, norm };
}

/** 문자 단위 Levenshtein 거리 (오타/철자 판정을 위한 근접도 측정) */
export function editDistance(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** 두 단어가 "거의 같은지" (오타 수준의 차이인지) 판정 */
export function isNearMatch(a, b) {
  if (!a || !b) return false;
  const d = editDistance(a, b);
  if (d === 0) return true;
  const len = Math.max(a.length, b.length);
  if (len <= 3) return false; // 짧은 기능어는 한 글자만 달라도 완전히 다른 단어다
  if (len <= 6) return d === 1;
  return d <= 2;
}

// ── 축약형 정렬 보정 ──────────────────────────────────────────────────
//
// "I'm" 을 "I am" 으로, "going to" 를 "gonna" 로 쓰면 토큰 개수가 어긋나
// 단어 단위 정렬이 통째로 밀린다. 정렬 전에 사용자 입력 쪽을 정답의 표기에
// 맞춰 쪼개거나 합쳐 두면 나머지 문장이 제자리를 찾는다.
//
// 소리를 제대로 들은 것이므로 감점하지 않고, "표기만 다름" 안내로만 남긴다.

const CONTRACTION_MAP = new Map(
  Object.entries({
    "i'm": ['i', 'am'], "i've": ['i', 'have'], "i'll": ['i', 'will'], "i'd": ['i', 'would'],
    "you're": ['you', 'are'], "you've": ['you', 'have'], "you'll": ['you', 'will'], "you'd": ['you', 'would'],
    "he's": ['he', 'is'], "he'll": ['he', 'will'], "he'd": ['he', 'would'],
    "she's": ['she', 'is'], "she'll": ['she', 'will'], "she'd": ['she', 'would'],
    "it's": ['it', 'is'], "it'll": ['it', 'will'],
    "we're": ['we', 'are'], "we've": ['we', 'have'], "we'll": ['we', 'will'], "we'd": ['we', 'would'],
    "they're": ['they', 'are'], "they've": ['they', 'have'], "they'll": ['they', 'will'], "they'd": ['they', 'would'],
    "that's": ['that', 'is'], "there's": ['there', 'is'], "here's": ['here', 'is'],
    "what's": ['what', 'is'], "who's": ['who', 'is'], "let's": ['let', 'us'],
    "don't": ['do', 'not'], "doesn't": ['does', 'not'], "didn't": ['did', 'not'],
    "isn't": ['is', 'not'], "aren't": ['are', 'not'], "wasn't": ['was', 'not'], "weren't": ['were', 'not'],
    "haven't": ['have', 'not'], "hasn't": ['has', 'not'], "hadn't": ['had', 'not'],
    "won't": ['will', 'not'], "wouldn't": ['would', 'not'], "can't": ['can', 'not'],
    "couldn't": ['could', 'not'], "shouldn't": ['should', 'not'],
    "should've": ['should', 'have'], "would've": ['would', 'have'], "could've": ['could', 'have'],
    // 회화체 축약 표기
    gonna: ['going', 'to'], wanna: ['want', 'to'], gotta: ['got', 'to'],
    gimme: ['give', 'me'], lemme: ['let', 'me'],
    kinda: ['kind', 'of'], sorta: ['sort', 'of'], outta: ['out', 'of'],
    shoulda: ['should', 'have'], woulda: ['would', 'have'], coulda: ['could', 'have'],
  })
);

const BIGRAM_TO_CONTRACTION = new Map(
  [...CONTRACTION_MAP].map(([contraction, [a, b]]) => [`${a} ${b}`, contraction])
);

/** ref 안에서 특정 bigram 이 시작하는 위치 (없으면 -1) */
function findBigram(norm, a, b) {
  for (let i = 0; i < norm.length - 1; i++) {
    if (norm[i] === a && norm[i + 1] === b) return i;
  }
  return -1;
}

/**
 * 정답 표기에 맞춰 사용자 입력의 축약형을 쪼개거나 합친다.
 * @returns {{display:string[], norm:string[], notes:Array<{got:string, expected:string}>}}
 */
export function reconcileContractions(ref, hyp) {
  const refSet = new Set(ref.norm);
  const display = [];
  const norm = [];
  const notes = [];

  for (let i = 0; i < hyp.norm.length; i++) {
    const token = hyp.norm[i];

    // ① 입력은 축약형인데 정답은 풀어 쓴 경우 → 두 토큰으로 쪼갠다
    const expansion = CONTRACTION_MAP.get(token);
    if (expansion && !refSet.has(token)) {
      const at = findBigram(ref.norm, expansion[0], expansion[1]);
      if (at !== -1) {
        display.push(hyp.display[i], '');
        norm.push(expansion[0], expansion[1]);
        notes.push({
          got: hyp.display[i],
          expected: `${ref.display[at]} ${ref.display[at + 1]}`,
        });
        continue;
      }
    }

    // ② 입력은 풀어 썼는데 정답이 축약형인 경우 → 한 토큰으로 합친다
    if (i < hyp.norm.length - 1) {
      const contraction = BIGRAM_TO_CONTRACTION.get(`${token} ${hyp.norm[i + 1]}`);
      if (contraction && refSet.has(contraction) && findBigram(ref.norm, token, hyp.norm[i + 1]) === -1) {
        const joined = `${hyp.display[i]} ${hyp.display[i + 1]}`;
        display.push(joined);
        norm.push(contraction);
        notes.push({ got: joined, expected: ref.display[ref.norm.indexOf(contraction)] });
        i++;
        continue;
      }
    }

    display.push(hyp.display[i]);
    norm.push(token);
  }

  return { display, norm, notes };
}

// 정렬 비용. 완전 일치는 0, 오타 수준의 치환은 저비용으로 두어 서로 짝지어지게 하고,
// 무관한 단어 치환은 삽입+삭제(2)보다 아주 살짝만 싸게 해서 억지 매칭을 막는다.
const COST_SUB_NEAR = 0.4;
const COST_SUB_FAR = 1.6;
const COST_GAP = 1;

/**
 * 정답(ref)과 입력(hyp)을 정렬한다.
 * @returns {Array<{type:'match'|'near'|'sub'|'del'|'ins', ref?:string, hyp?:string,
 *                  refDisplay?:string, hypDisplay?:string, refIndex?:number, hypIndex?:number}>}
 *   del = 사용자가 빠뜨린 단어, ins = 사용자가 더 쓴 단어.
 */
export function align(ref, hyp) {
  const R = ref.norm.length;
  const H = hyp.norm.length;

  // dp[i][j] = ref 앞 i개와 hyp 앞 j개를 정렬한 최소 비용
  const dp = Array.from({ length: R + 1 }, () => new Float64Array(H + 1));
  const back = Array.from({ length: R + 1 }, () => new Uint8Array(H + 1)); // 1=diag 2=up(del) 3=left(ins)

  for (let i = 1; i <= R; i++) {
    dp[i][0] = i * COST_GAP;
    back[i][0] = 2;
  }
  for (let j = 1; j <= H; j++) {
    dp[0][j] = j * COST_GAP;
    back[0][j] = 3;
  }

  for (let i = 1; i <= R; i++) {
    for (let j = 1; j <= H; j++) {
      const a = ref.norm[i - 1];
      const b = hyp.norm[j - 1];
      let subCost;
      if (a === b) subCost = 0;
      else if (isNearMatch(a, b)) subCost = COST_SUB_NEAR;
      else subCost = COST_SUB_FAR;

      const diag = dp[i - 1][j - 1] + subCost;
      const up = dp[i - 1][j] + COST_GAP;
      const left = dp[i][j - 1] + COST_GAP;

      let best = diag;
      let dir = 1;
      if (up < best) {
        best = up;
        dir = 2;
      }
      if (left < best) {
        best = left;
        dir = 3;
      }
      dp[i][j] = best;
      back[i][j] = dir;
    }
  }

  const ops = [];
  let i = R;
  let j = H;
  while (i > 0 || j > 0) {
    const dir = i === 0 ? 3 : j === 0 ? 2 : back[i][j];
    if (dir === 1) {
      const a = ref.norm[i - 1];
      const b = hyp.norm[j - 1];
      ops.push({
        type: a === b ? 'match' : isNearMatch(a, b) ? 'near' : 'sub',
        ref: a,
        hyp: b,
        refDisplay: ref.display[i - 1],
        hypDisplay: hyp.display[j - 1],
        refIndex: i - 1,
        hypIndex: j - 1,
      });
      i--;
      j--;
    } else if (dir === 2) {
      ops.push({ type: 'del', ref: ref.norm[i - 1], refDisplay: ref.display[i - 1], refIndex: i - 1 });
      i--;
    } else {
      ops.push({ type: 'ins', hyp: hyp.norm[j - 1], hypDisplay: hyp.display[j - 1], hypIndex: j - 1 });
      j--;
    }
  }
  ops.reverse();
  return ops;
}

/**
 * 정답 문장과 사용자 입력을 채점한다.
 * near(오타 수준)는 0.5점으로 부분 인정한다.
 */
export function grade(refText, hypText) {
  const ref = tokenize(refText);
  const raw = tokenize(hypText);
  const { display, norm, notes } = reconcileContractions(ref, raw);
  const hyp = { display, norm };
  const ops = align(ref, hyp);

  let earned = 0;
  let matched = 0;
  let mistakes = 0;
  for (const op of ops) {
    if (op.type === 'match') {
      earned += 1;
      matched += 1;
    } else if (op.type === 'near') {
      earned += 0.5;
      mistakes += 1;
    } else {
      mistakes += 1;
    }
  }

  const total = ref.norm.length;
  const accuracy = total === 0 ? 0 : Math.max(0, Math.min(1, earned / total));

  return {
    ops,
    total,
    matched,
    mistakes,
    accuracy,
    // 축약 표기 차이(formNotes)는 소리를 맞게 들은 것이므로 통과로 인정한다
    formNotes: notes,
    isPerfect: mistakes === 0 && hyp.norm.length === ref.norm.length,
  };
}
