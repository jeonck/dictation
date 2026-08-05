// 오답 유형 분류.
//
// diff.js 가 만든 정렬 결과를 받아 각 실수를 문법/발음 카테고리로 분류한다.
// 이 분류가 누적되면 "나는 관사를 자주 놓친다" 같은 취약점 진단이 된다.

import { editDistance } from './diff.js';

export const CATEGORIES = {
  article: { label: '관사', hint: 'a / an / the 를 놓치거나 잘못 씁니다. 약하게 발음돼 거의 안 들리므로 문맥으로 예측하는 훈련이 필요합니다.' },
  preposition: { label: '전치사', hint: '전치사는 강세를 받지 않아 뭉개집니다. 동사와 짝으로 통째로 외우면 잡기 쉬워집니다.' },
  contraction: { label: '축약형', hint: "I'm / you're / would've 처럼 축약된 형태를 풀어 쓰거나 놓칩니다. 축약 자체를 하나의 소리 덩어리로 익히세요." },
  auxiliary: { label: '조동사·be동사', hint: 'is/was/have/would 같은 기능어는 약화 발음됩니다. 시제와 태를 결정하는 핵심이니 특히 주의하세요.' },
  plural: { label: '복수·3인칭 s', hint: '단어 끝 -s 는 아주 짧게 스칩니다. 문장 끝까지 소리를 놓치지 않는 연습이 필요합니다.' },
  tense: { label: '시제 어미', hint: '-ed 는 뒤 단어에 흡수되어 사라지기 쉽습니다. 과거인지 현재인지 의식하며 들으세요.' },
  pronoun: { label: '대명사', hint: 'him/them/her 은 h·th 가 탈락해 앞 단어에 붙습니다.' },
  spelling: { label: '철자·오타', hint: '소리는 맞게 들었지만 철자가 틀렸습니다. 의미 손실은 적지만 쓰기 정확도를 위해 확인하세요.' },
  vocabulary: { label: '어휘·청취', hint: '단어 자체를 다르게 들었습니다. 연음으로 뭉개진 구간일 가능성이 높으니 느린 속도로 다시 들어보세요.' },
  extra: { label: '불필요한 추가', hint: '들리지 않은 단어를 넣었습니다. 추측으로 채우기보다 다시 듣는 편이 정확합니다.' },
};

const ARTICLES = new Set(['a', 'an', 'the']);

const PREPOSITIONS = new Set([
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'from', 'by', 'about', 'into', 'onto',
  'over', 'under', 'off', 'up', 'out', 'through', 'between', 'among', 'against',
  'during', 'before', 'after', 'around', 'across', 'behind', 'toward', 'towards',
  'within', 'without', 'upon', 'since', 'until', 'till', 'near', 'past',
]);

const AUXILIARIES = new Set([
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
]);

const PRONOUNS = new Set([
  'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'me', 'him', 'her', 'us', 'them', 'em',
  'my', 'your', 'his', 'its', 'our', 'their',
  'mine', 'yours', 'hers', 'ours', 'theirs',
]);

// 축약형 ↔ 풀어쓴 형태. 사용자가 "I am"이라 썼는데 정답이 "I'm"인 경우처럼
// 여러 토큰에 걸친 차이도 잡기 위해 단어 단위 매핑을 함께 둔다.
const CONTRACTION_PARTS = new Set([
  'not', 'is', 'am', 'are', 'have', 'has', 'had', 'will', 'would', 'us',
]);

function stripContraction(word) {
  return word.replace(/'/g, '');
}

/** 두 단어가 축약/비축약 관계인지 (예: dont ↔ don't, im ↔ i'm) */
function isContractionVariant(a, b) {
  if (!a || !b) return false;
  if (a.includes("'") === b.includes("'")) return false;
  return stripContraction(a) === stripContraction(b);
}

/** 어간이 같고 접미사만 다른지 판정 */
function suffixDiff(a, b) {
  if (!a || !b) return null;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (!longer.startsWith(shorter)) {
    // 자음 중복이나 y→ie 변화 (try/tried, stop/stopped) 도 어간 동일로 본다
    const stem = shorter.replace(/y$/, 'i').replace(/(.)\1$/, '$1');
    if (!longer.startsWith(stem) || longer.length - stem.length > 3) return null;
    return longer.slice(stem.length);
  }
  const suffix = longer.slice(shorter.length);
  return suffix.length <= 3 ? suffix : null;
}

const PLURAL_SUFFIXES = new Set(['s', 'es', "'s"]);
const TENSE_SUFFIXES = new Set(['d', 'ed', 'ing']);

const IRREGULAR_PAST = new Map(
  Object.entries({
    go: 'went', see: 'saw', take: 'took', come: 'came', get: 'got', make: 'made',
    say: 'said', know: 'knew', think: 'thought', tell: 'told', find: 'found',
    give: 'gave', leave: 'left', feel: 'felt', bring: 'brought', buy: 'bought',
    catch: 'caught', teach: 'taught', run: 'ran', write: 'wrote', speak: 'spoke',
    is: 'was', are: 'were', has: 'had', have: 'had', do: 'did', does: 'did',
    can: 'could', will: 'would',
  })
);

function isIrregularPair(a, b) {
  return IRREGULAR_PAST.get(a) === b || IRREGULAR_PAST.get(b) === a;
}

/** 누락(del)/추가(ins) 된 단어 하나를 카테고리로 분류 */
function classifyLoneWord(word) {
  if (ARTICLES.has(word)) return 'article';
  if (PREPOSITIONS.has(word)) return 'preposition';
  if (word.includes("'") || CONTRACTION_PARTS.has(word)) {
    if (word.includes("'")) return 'contraction';
  }
  if (AUXILIARIES.has(word)) return 'auxiliary';
  if (PRONOUNS.has(word)) return 'pronoun';
  return null;
}

/** 치환(sub/near) 된 단어 쌍을 카테고리로 분류 */
function classifyPair(refWord, hypWord) {
  if (ARTICLES.has(refWord) || ARTICLES.has(hypWord)) return 'article';
  if (isContractionVariant(refWord, hypWord)) return 'contraction';
  if (refWord.includes("'") || hypWord.includes("'")) return 'contraction';

  if (isIrregularPair(refWord, hypWord)) return 'tense';

  const suffix = suffixDiff(refWord, hypWord);
  if (suffix) {
    if (PLURAL_SUFFIXES.has(suffix)) return 'plural';
    if (TENSE_SUFFIXES.has(suffix)) return 'tense';
  }

  if (PREPOSITIONS.has(refWord) || PREPOSITIONS.has(hypWord)) return 'preposition';
  if (AUXILIARIES.has(refWord) || AUXILIARIES.has(hypWord)) return 'auxiliary';
  if (PRONOUNS.has(refWord) || PRONOUNS.has(hypWord)) return 'pronoun';

  // 어간은 같은데 접미사만 다른 나머지 경우 + 오타 수준의 근접 단어
  const d = editDistance(refWord, hypWord);
  if (d <= 2 && Math.max(refWord.length, hypWord.length) >= 5) return 'spelling';
  if (d === 1) return 'spelling';

  return 'vocabulary';
}

/**
 * 채점 결과에서 실수 목록을 추출하고 각각 카테고리를 붙인다.
 * @param {ReturnType<import('./diff.js').grade>} result
 * @returns {Array<{category:string, type:string, expected:string|null, got:string|null}>}
 */
export function analyzeMistakes(result) {
  const mistakes = [];
  for (const op of result.ops) {
    if (op.type === 'match') continue;

    let category;
    if (op.type === 'del') {
      category = classifyLoneWord(op.ref) || 'vocabulary';
    } else if (op.type === 'ins') {
      category = classifyLoneWord(op.hyp) || 'extra';
    } else {
      category = classifyPair(op.ref, op.hyp);
    }

    mistakes.push({
      category,
      type: op.type,
      expected: op.refDisplay ?? null,
      got: op.hypDisplay ?? null,
    });
  }
  return mistakes;
}

/** 실수 목록을 카테고리별 개수로 집계 */
export function tallyByCategory(mistakes) {
  const tally = {};
  for (const m of mistakes) {
    tally[m.category] = (tally[m.category] || 0) + 1;
  }
  return tally;
}

export function categoryLabel(key) {
  return CATEGORIES[key]?.label || key;
}

export function categoryHint(key) {
  return CATEGORIES[key]?.hint || '';
}
