// 앱 진입점 — 라우팅과 화면 렌더링.

import { LESSONS, allSentences as builtinSentences, findLesson as findBuiltinLesson } from './data/lessons.js';
import { grade } from './diff.js';
import { analyzeMistakes, tallyByCategory, categoryLabel, categoryHint, CATEGORIES } from './analyze.js';
import { Player, Recorder } from './audio.js';
import { YouTubePlayer } from './youtube.js';
import { buildSentences, extractVideoId, formatTime } from './captions.js';
import * as store from './store.js';

// 예전 github.io 주소로 들어오면 운영 도메인으로 넘긴다.
// 학습 기록은 출처(origin) 단위로 저장되므로 두 주소를 섞어 쓰면 기록이 갈라진다.
// 호스트명을 정확히 대조하므로 이 저장소를 포크해도 남의 도메인으로 튀지 않는다.
const CANONICAL_HOST = 'dictation.metacog.co.kr';
if (location.hostname === 'jeonck.github.io' && location.pathname.startsWith('/dictation')) {
  location.replace(`https://${CANONICAL_HOST}/${location.hash}`);
}

const view = document.getElementById('view');
const player = new Player();
const recorder = new Recorder();

/** 기본 제공 코스 + 사용자가 가져온 코스 */
function allLessons() {
  return [...store.getUserLessons(), ...LESSONS];
}

function findLesson(id) {
  return findBuiltinLesson(id) || store.getUserLessons().find((l) => l.id === id) || null;
}

function allSentences() {
  const userSentences = store
    .getUserLessons()
    .flatMap((l) => l.sentences.map((s) => ({ ...s, lessonId: l.id, lessonTitle: l.title })));
  return [...builtinSentences(), ...userSentences];
}

// 브라우저 자동재생 정책상 사용자 제스처 전에는 소리를 낼 수 없다.
// 한 번이라도 재생 버튼을 누른 뒤부터 다음 문장을 자동 재생한다.
let hasInteracted = false;

// ── 유틸 ──────────────────────────────────────────────────────────────

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const pct = (n) => `${Math.round(n * 100)}%`;

function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 250);
  }, 2600);
}

function useTemplate(id) {
  const tpl = document.getElementById(id);
  return tpl.content.cloneNode(true);
}

/** 정확도에 따른 색 */
function scoreColor(accuracy) {
  if (accuracy >= 0.95) return 'var(--ok)';
  if (accuracy >= 0.75) return 'var(--accent)';
  if (accuracy >= 0.5) return 'var(--warn)';
  return 'var(--danger)';
}

/** 첫 글자만 남기고 가리기 — 힌트용 */
function maskWord(word) {
  let seenLetter = false;
  return [...word]
    .map((ch) => {
      if (!/[A-Za-z]/.test(ch)) return ch;
      if (!seenLetter) {
        seenLetter = true;
        return ch;
      }
      return '_';
    })
    .join('');
}

/** 연음 해설 구간을 <mark>로 감싼 문장 HTML */
function sentenceWithLinks(text, linking) {
  const ranges = [];
  for (const l of linking || []) {
    const idx = text.indexOf(l.span);
    if (idx >= 0) ranges.push([idx, idx + l.span.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);

  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }

  let out = '';
  let pos = 0;
  for (const [s, e] of merged) {
    out += esc(text.slice(pos, s)) + '<mark>' + esc(text.slice(s, e)) + '</mark>';
    pos = e;
  }
  return out + esc(text.slice(pos));
}

// ── 라우터 ────────────────────────────────────────────────────────────

function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (!hash) return { name: 'home' };
  const [head, param] = hash.split('/');
  if (head === 'lesson' && param) return { name: 'practice', lessonId: param };
  if (head === 'stats') return { name: 'stats' };
  if (head === 'import') return { name: 'import' };
  return { name: 'home' };
}

let teardown = null;

function render() {
  if (teardown) {
    teardown();
    teardown = null;
  }
  player.stop();
  recorder.cancel();
  view.replaceChildren();

  const route = parseRoute();
  for (const a of document.querySelectorAll('.topnav a')) {
    const isCurrent =
      (a.dataset.nav === 'home' && route.name !== 'stats') ||
      (a.dataset.nav === 'stats' && route.name === 'stats');
    if (isCurrent) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }

  if (route.name === 'practice') {
    const lesson = findLesson(route.lessonId);
    if (!lesson) {
      location.hash = '#/';
      return;
    }
    teardown = renderPractice(lesson);
  } else if (route.name === 'stats') {
    renderStats();
  } else if (route.name === 'import') {
    renderImport();
  } else {
    renderHome();
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);

// ── 홈 ────────────────────────────────────────────────────────────────

function renderHome() {
  view.appendChild(useTemplate('tpl-home'));

  const stats = store.overallStats();
  const strip = document.getElementById('home-stats');
  if (!stats.totalAttempts) {
    strip.innerHTML = `<p class="empty-note">아직 기록이 없습니다. 아래 코스에서 첫 문장을 받아써 보세요.</p>`;
  } else {
    strip.innerHTML = [
      ['받아쓴 문장', `${stats.sentencesTried}<small> / ${allSentences().length}</small>`],
      ['완벽 통과', `${stats.sentencesCleared}`],
      ['최근 정확도', pct(stats.recentAccuracy)],
      ['누적 실수', `${stats.totalMistakes}`],
    ]
      .map(([label, value]) => `<dl class="stat-tile"><dt>${label}</dt><dd>${value}</dd></dl>`)
      .join('');
  }

  const summary = store.sentenceSummary();

  const card = (lesson) => {
    const total = lesson.sentences.length;
    const cleared = lesson.sentences.filter((s) => summary.get(s.id)?.cleared).length;
    return `
      <a class="lesson-card" href="#/lesson/${esc(lesson.id)}">
        <div class="lesson-top">
          <h3>${esc(lesson.title)}</h3>
          <span class="lesson-level">${esc(lesson.level || '가져온 코스')}</span>
        </div>
        <p>${esc(lesson.desc || '')}</p>
        <div class="lesson-foot">
          ${lesson.videoId ? '<span class="yt-tag">YouTube</span>' : ''}
          <span>${cleared} / ${total}</span>
          <span class="mini-bar"><i style="width:${total ? (cleared / total) * 100 : 0}%"></i></span>
          ${lesson.videoId ? `<button class="icon-btn" type="button" data-delete="${esc(lesson.id)}" title="코스 삭제">✕</button>` : ''}
        </div>
      </a>`;
  };

  const userLessons = store.getUserLessons();
  const grid = document.getElementById('lesson-grid');
  grid.innerHTML = LESSONS.map(card).join('');

  const userGrid = document.getElementById('user-lesson-grid');
  userGrid.innerHTML = userLessons.length
    ? userLessons.map(card).join('')
    : `<p class="empty-note">유튜브 영상의 자막을 붙여넣으면 그 영상으로 받아쓰기 코스를 만들 수 있습니다.
       실제 원어민 음성이라 연음 연습에는 이쪽이 훨씬 좋습니다.</p>`;

  // 카드 전체가 링크이므로 삭제 버튼은 이동을 막아야 한다
  for (const btn of userGrid.querySelectorAll('[data-delete]')) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const lesson = userLessons.find((l) => l.id === btn.dataset.delete);
      if (!confirm(`"${lesson?.title}" 코스를 삭제할까요? 학습 기록은 남습니다.`)) return;
      store.deleteUserLesson(btn.dataset.delete);
      toast('코스를 삭제했습니다.');
      renderHome();
    });
  }
}

// ── 연습 ──────────────────────────────────────────────────────────────

function renderPractice(lesson) {
  view.appendChild(useTemplate('tpl-practice'));

  const el = {
    title: document.getElementById('practice-title'),
    progressLabel: document.getElementById('progress-label'),
    progressFill: document.getElementById('progress-fill'),
    play: document.getElementById('btn-play'),
    replayCount: document.getElementById('replay-count'),
    speeds: [...document.querySelectorAll('.speed-group button')],
    answer: document.getElementById('answer'),
    hintRow: document.getElementById('hint-row'),
    check: document.getElementById('btn-check'),
    hint: document.getElementById('btn-hint'),
    reveal: document.getElementById('btn-reveal'),
    result: document.getElementById('result'),
    videoWrap: document.getElementById('video-wrap'),
    videoMount: document.getElementById('video-mount'),
    videoCover: document.getElementById('video-cover'),
    coverToggle: document.getElementById('btn-cover'),
  };

  el.title.textContent = lesson.title;

  // 유튜브에서 가져온 코스는 임베드 플레이어로 해당 구간만 재생한다
  const yt = lesson.videoId ? new YouTubePlayer(el.videoMount) : null;
  let ytReady = null;

  if (yt) {
    el.videoWrap.hidden = false;
    el.play.disabled = true;
    ytReady = yt
      .load(lesson.videoId)
      .then(() => {
        el.play.disabled = false;
        yt.setRate(player.rate);
      })
      .catch((err) => {
        el.play.disabled = false;
        toast(err.message);
      });

    yt.onStateChange((playing) => el.play.classList.toggle('is-playing', playing));

    el.coverToggle.addEventListener('click', () => {
      const covered = el.videoCover.hidden;
      el.videoCover.hidden = !covered;
      el.coverToggle.setAttribute('aria-pressed', String(covered));
      el.coverToggle.textContent = covered ? '영상 보기' : '영상 가리기';
    });
  }

  const session = { index: 0, replays: 0, revealed: false, checked: false };

  // 이미 통과한 문장은 건너뛰고 아직 못 맞힌 첫 문장에서 시작한다
  const summary = store.sentenceSummary();
  const firstUncleared = lesson.sentences.findIndex((s) => !summary.get(s.id)?.cleared);
  session.index = firstUncleared === -1 ? 0 : firstUncleared;

  const current = () => lesson.sentences[session.index];

  // ── 재생 ──

  player.onStateChange((playing) => {
    el.play.classList.toggle('is-playing', playing);
  });

  const allowedRates = el.speeds.map((b) => Number(b.dataset.rate));
  const saved = store.getSettings().rate;
  const rate = allowedRates.includes(saved) ? saved : 1;
  player.setRate(rate);
  for (const b of el.speeds) b.classList.toggle('is-active', Number(b.dataset.rate) === rate);

  async function playCurrent({ countsAsReplay = true } = {}) {
    hasInteracted = true;
    if (countsAsReplay) {
      session.replays += 1;
      el.replayCount.textContent = String(session.replays);
    }
    try {
      if (yt) {
        await ytReady;
        const s = current();
        await yt.playSegment(s.start, s.end);
      } else {
        await player.play(current());
      }
    } catch (err) {
      toast(err.message || '재생에 실패했습니다.');
    }
  }

  el.play.addEventListener('click', () => playCurrent());

  for (const btn of el.speeds) {
    btn.addEventListener('click', () => {
      const next = Number(btn.dataset.rate);
      player.setRate(next);
      yt?.setRate(next);
      store.saveSettings({ rate: next });
      for (const b of el.speeds) b.classList.toggle('is-active', b === btn);
      playCurrent({ countsAsReplay: false });
    });
  }

  // 목소리 선택 — TTS로 재생하는 코스에서만 의미가 있다
  if (!yt) player.init().then((voices) => {
    if (voices.length > 1) {
      const saved = store.getSettings().voiceURI;
      if (saved) player.setVoiceByURI(saved);

      const wrap = document.createElement('label');
      wrap.className = 'voice-pick';
      wrap.innerHTML = `<select aria-label="목소리 선택">${voices
        .map(
          (v) =>
            `<option value="${esc(v.voiceURI)}"${v === player.voice ? ' selected' : ''}>${esc(v.name)}</option>`
        )
        .join('')}</select>`;
      const select = wrap.querySelector('select');
      select.addEventListener('change', () => {
        player.setVoiceByURI(select.value);
        store.saveSettings({ voiceURI: select.value });
        playCurrent({ countsAsReplay: false });
      });
      document.querySelector('.player-meta')?.appendChild(wrap);
    }
  });

  // ── 문장 전환 ──

  function loadSentence() {
    session.replays = 0;
    session.revealed = false;
    session.checked = false;

    el.replayCount.textContent = '0';
    el.answer.value = '';
    el.answer.disabled = false;
    el.hintRow.hidden = true;
    el.hintRow.textContent = '';
    el.result.hidden = true;
    el.result.replaceChildren();
    el.check.disabled = false;
    el.hint.disabled = false;
    el.reveal.disabled = false;

    const total = lesson.sentences.length;
    el.progressLabel.textContent = `${session.index + 1} / ${total}`;
    el.progressFill.style.width = `${((session.index) / total) * 100}%`;

    el.answer.focus();
    if (hasInteracted) playCurrent();
  }

  function nextSentence() {
    if (session.index >= lesson.sentences.length - 1) {
      showFinish();
      return;
    }
    session.index += 1;
    loadSentence();
  }

  // ── 채점 ──

  function check({ revealed = false } = {}) {
    if (session.checked) return;
    const typed = el.answer.value.trim();
    if (!typed && !revealed) {
      toast('먼저 들은 문장을 입력해 주세요.');
      el.answer.focus();
      return;
    }

    const sentence = current();
    const result = grade(sentence.text, typed);
    const mistakes = analyzeMistakes(result);

    session.checked = true;
    session.revealed = session.revealed || revealed;

    store.recordAttempt({
      sentenceId: sentence.id,
      lessonId: lesson.id,
      accuracy: result.accuracy,
      isPerfect: result.isPerfect,
      mistakes,
      replays: session.replays,
      revealed: session.revealed,
    });

    el.answer.disabled = true;
    el.check.disabled = true;
    el.hint.disabled = true;
    el.reveal.disabled = true;

    const total = lesson.sentences.length;
    el.progressFill.style.width = `${((session.index + 1) / total) * 100}%`;

    showResult(sentence, result, mistakes);
  }

  function showResult(sentence, result, mistakes) {
    const tally = tallyByCategory(mistakes);
    const perfect = result.isPerfect;

    const headline = perfect
      ? session.revealed
        ? '정답을 확인했습니다'
        : session.replays <= 1
          ? '완벽합니다. 한 번에 잡았네요.'
          : '완벽합니다!'
      : result.accuracy >= 0.8
        ? '거의 다 왔습니다. 놓친 부분을 확인하세요.'
        : '뭉쳐서 들린 구간이 있습니다. 아래 해설을 보고 다시 들어보세요.';

    el.result.innerHTML = `
      <div class="score-head${perfect && !session.revealed ? ' is-perfect' : ''}">
        <div class="score-ring" style="background: conic-gradient(${scoreColor(result.accuracy)} ${result.accuracy * 360}deg, var(--bg-elev-2) 0deg);">
          <span style="display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:var(--bg-elev);">${pct(result.accuracy)}</span>
        </div>
        <div class="score-copy">
          <h3>${esc(headline)}</h3>
          <p>${result.total}개 단어 중 ${result.matched}개 정확 · ${session.replays}번 청취</p>
        </div>
      </div>

      ${renderDiffBlock(result)}
      ${renderFormNotes(result.formNotes)}
      ${mistakes.length ? renderMistakeBlock(mistakes, tally) : ''}
      ${renderAnswerBlock(sentence)}
      ${renderShadowBlock()}

      <div class="next-row">
        ${perfect ? '' : '<button class="btn btn-ghost" data-act="retry">다시 풀기</button>'}
        <button class="btn btn-primary" data-act="next">
          ${session.index >= lesson.sentences.length - 1 ? '코스 마치기' : '다음 문장'} <kbd>Enter</kbd>
        </button>
      </div>`;
    el.result.hidden = false;

    el.result.querySelector('[data-act="next"]')?.addEventListener('click', nextSentence);
    el.result.querySelector('[data-act="retry"]')?.addEventListener('click', () => {
      session.checked = false;
      session.revealed = false;
      el.answer.disabled = false;
      el.answer.value = '';
      el.check.disabled = false;
      el.hint.disabled = false;
      el.reveal.disabled = false;
      el.result.hidden = true;
      el.result.replaceChildren();
      el.answer.focus();
      playCurrent();
    });

    bindShadowing(el.result, current());
    el.result.querySelector('[data-act="replay"]')?.addEventListener('click', () => playCurrent());
    el.result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showFinish() {
    const ids = new Set(lesson.sentences.map((s) => s.id));
    const attempts = store.getAttempts().filter((a) => ids.has(a.sentenceId));
    const cleared = [...store.sentenceSummary().values()].filter((s) => ids.has(s.sentenceId) && s.cleared).length;
    const tally = {};
    for (const a of attempts) for (const m of a.mistakes || []) tally[m.category] = (tally[m.category] || 0) + 1;
    const weak = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3);

    view.replaceChildren();
    const wrap = document.createElement('section');
    wrap.className = 'practice';
    wrap.innerHTML = `
      <div class="practice-head"><div>
        <a class="back-link" href="#/">← 코스 목록</a>
        <h2>${esc(lesson.title)} 완료</h2>
      </div></div>
      <div class="score-head is-perfect">
        <div class="score-ring" style="background: conic-gradient(var(--ok) ${(cleared / lesson.sentences.length) * 360}deg, var(--bg-elev-2) 0deg);">
          <span style="display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:var(--bg-elev);">${cleared}/${lesson.sentences.length}</span>
        </div>
        <div class="score-copy">
          <h3>${cleared === lesson.sentences.length ? '전 문장을 완벽하게 통과했습니다.' : '수고했습니다.'}</h3>
          <p>힌트 없이 한 번에 맞힌 문장 ${cleared}개</p>
        </div>
      </div>
      ${
        weak.length
          ? `<div class="result-block"><h4>이 코스에서 자주 놓친 유형</h4>
             <div class="chip-row">${weak
               .map(([cat, n]) => `<span class="chip">${esc(categoryLabel(cat))} <b>${n}</b></span>`)
               .join('')}</div>
             <p class="weak-hint">${esc(categoryHint(weak[0][0]))}</p></div>`
          : ''
      }
      <div class="next-row">
        <a class="btn btn-ghost" href="#/stats">전체 취약점 보기</a>
        <a class="btn btn-primary" href="#/">코스 목록으로</a>
      </div>`;
    view.appendChild(wrap);
  }

  // ── 버튼/단축키 ──

  el.check.addEventListener('click', () => check());

  el.hint.addEventListener('click', () => {
    el.hintRow.textContent = current().text.split(/\s+/).map(maskWord).join('  ');
    el.hintRow.hidden = false;
    el.hint.disabled = true;
    el.answer.focus();
  });

  el.reveal.addEventListener('click', () => check({ revealed: true }));

  function onKeydown(e) {
    if (e.key !== 'Enter') return;

    // ⌘/Ctrl + Enter → 다시 듣기
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      playCurrent();
      return;
    }
    if (e.shiftKey) return; // 줄바꿈 허용

    if (session.checked) {
      e.preventDefault();
      nextSentence();
    } else if (e.target === el.answer) {
      e.preventDefault();
      check();
    }
  }

  document.addEventListener('keydown', onKeydown);

  loadSentence();

  return () => {
    document.removeEventListener('keydown', onKeydown);
    player.onStateChange(() => {});
    yt?.destroy();
  };
}

// ── 결과 화면 조각들 ──────────────────────────────────────────────────

function renderDiffBlock(result) {
  const refHtml = [];
  const hypHtml = [];

  for (const op of result.ops) {
    switch (op.type) {
      case 'match':
        refHtml.push(`<span class="w w-match">${esc(op.refDisplay)}</span>`);
        hypHtml.push(`<span class="w w-match">${esc(op.hypDisplay)}</span>`);
        break;
      case 'near':
        refHtml.push(`<span class="w w-near">${esc(op.refDisplay)}</span>`);
        hypHtml.push(`<span class="w w-near">${esc(op.hypDisplay)}</span>`);
        break;
      case 'sub':
        refHtml.push(`<span class="w w-sub">${esc(op.refDisplay)}</span>`);
        hypHtml.push(`<span class="w w-sub">${esc(op.hypDisplay)}</span>`);
        break;
      case 'del':
        refHtml.push(`<span class="w w-del">${esc(op.refDisplay)}</span>`);
        hypHtml.push(`<span class="w w-miss">${'_'.repeat(Math.max(2, op.refDisplay.length))}</span>`);
        break;
      case 'ins':
        hypHtml.push(`<span class="w w-ins">${esc(op.hypDisplay)}</span>`);
        break;
    }
  }

  return `
    <div class="result-block">
      <h4>단어 단위 비교</h4>
      <p class="diff-line"><span class="diff-label">정답</span>${refHtml.join(' ')}</p>
      <p class="diff-line"><span class="diff-label">내 답</span>${hypHtml.join(' ') || '<span class="w w-miss">(입력 없음)</span>'}</p>
      <div class="diff-legend">
        <span class="lg-del">놓침 / 다름</span>
        <span class="lg-near">철자만 틀림</span>
        <span class="lg-ins">불필요하게 추가</span>
      </div>
    </div>`;
}

/** 축약 표기 차이 — 소리는 맞게 들었으므로 감점하지 않고 안내만 한다 */
function renderFormNotes(notes) {
  if (!notes?.length) return '';
  return `
    <div class="result-block">
      <h4>표기만 다름 (감점 없음)</h4>
      <ul class="mistake-list">
        ${notes
          .map(
            (n) =>
              `<li><span class="mistake-cat">축약형</span><span class="mistake-body">
                 <span class="bad" style="text-decoration:none">${esc(n.got)}</span> →
                 <span class="good">${esc(n.expected)}</span>
               </span></li>`
          )
          .join('')}
      </ul>
      <p class="weak-hint">소리는 정확히 들었습니다. 원문 표기도 함께 익혀두면 읽기·쓰기에서 헷갈리지 않습니다.</p>
    </div>`;
}

function renderMistakeBlock(mistakes, tally) {
  const chips = Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, n]) => `<span class="chip">${esc(categoryLabel(cat))} <b>${n}</b></span>`)
    .join('');

  const items = mistakes
    .map((m) => {
      let body;
      if (m.type === 'del') body = `<span class="good">${esc(m.expected)}</span> <span class="mistake-note">← 빠뜨렸습니다</span>`;
      else if (m.type === 'ins') body = `<span class="bad">${esc(m.got)}</span> <span class="mistake-note">← 없는 단어입니다</span>`;
      else body = `<span class="bad">${esc(m.got)}</span> → <span class="good">${esc(m.expected)}</span>`;
      return `<li><span class="mistake-cat">${esc(categoryLabel(m.category))}</span><span class="mistake-body">${body}</span></li>`;
    })
    .join('');

  const topCat = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];

  return `
    <div class="result-block">
      <h4>오답 유형</h4>
      <div class="chip-row">${chips}</div>
      <ul class="mistake-list">${items}</ul>
      ${topCat ? `<p class="weak-hint">${esc(categoryHint(topCat))}</p>` : ''}
    </div>`;
}

function renderAnswerBlock(sentence) {
  const links = (sentence.linking || [])
    .map(
      (l) =>
        `<li><span class="linking-span">${esc(l.span)}</span><span class="linking-tip">${esc(l.tip)}</span></li>`
    )
    .join('');

  // 가져온 코스에는 해설과 번역이 없다 — 원문과 재생 구간만 보여준다
  return `
    <div class="result-block">
      <h4>${links ? '정답과 연음 해설' : '정답'}</h4>
      <p class="sentence-full">${sentenceWithLinks(sentence.text, sentence.linking)}</p>
      ${sentence.ko ? `<p class="sentence-ko">${esc(sentence.ko)}</p>` : ''}
      ${
        sentence.start !== undefined
          ? `<p class="sentence-ko">영상 ${esc(formatTime(sentence.start))} 구간</p>`
          : ''
      }
      ${links ? `<ul class="linking-list" style="margin-top:16px">${links}</ul>` : ''}
      <div class="shadow-row" style="margin-top:16px">
        <button class="btn btn-ghost btn-sm" data-act="replay">원음 다시 듣기</button>
      </div>
    </div>`;
}

function renderShadowBlock() {
  if (!recorder.supported) return '';
  return `
    <div class="result-block">
      <h4>섀도잉 — 따라 말하고 비교하기</h4>
      <p class="weak-hint" style="margin-top:0">
        정답을 보며 원음과 같은 속도, 같은 연결로 소리 내어 읽고 녹음해 보세요.
        받아쓰기로 분해한 소리를 그대로 발화에 옮기는 단계입니다.
      </p>
      <div class="shadow-row" style="margin-top:12px">
        <button class="btn btn-sm" data-act="record">🎙 녹음 시작</button>
        <span data-role="rec-status" class="mistake-note"></span>
      </div>
      <div data-role="rec-output"></div>
    </div>`;
}

function bindShadowing(root, sentence) {
  const btn = root.querySelector('[data-act="record"]');
  if (!btn) return;
  const status = root.querySelector('[data-role="rec-status"]');
  const output = root.querySelector('[data-role="rec-output"]');

  btn.addEventListener('click', async () => {
    if (recorder.isRecording) {
      btn.disabled = true;
      try {
        const url = await recorder.stop();
        output.innerHTML = `<audio class="shadow-audio" controls src="${url}"></audio>`;
        status.textContent = '원음과 번갈아 들으며 리듬을 비교해 보세요.';
      } catch (err) {
        status.textContent = err.message;
      }
      btn.textContent = '🎙 다시 녹음';
      btn.disabled = false;
      return;
    }

    try {
      await recorder.start();
      btn.textContent = '■ 녹음 중지';
      status.innerHTML = '<span class="rec-dot"></span>녹음 중…';
    } catch {
      status.textContent = '마이크 권한이 필요합니다.';
    }
  });
}

// ── 유튜브 자막 가져오기 ──────────────────────────────────────────────

function renderImport() {
  view.appendChild(useTemplate('tpl-import'));

  const el = {
    url: document.getElementById('imp-url'),
    urlState: document.getElementById('imp-url-state'),
    text: document.getElementById('imp-text'),
    file: document.getElementById('imp-file'),
    fileName: document.getElementById('imp-file-name'),
    lengths: [...document.querySelectorAll('#imp-length button')],
    preview: document.getElementById('imp-preview'),
    result: document.getElementById('imp-result'),
  };

  let targetWords = 11;

  el.url.addEventListener('input', () => {
    const id = extractVideoId(el.url.value);
    el.urlState.textContent = el.url.value.trim()
      ? id
        ? `영상 ID: ${id}`
        : '유튜브 주소를 인식하지 못했습니다.'
      : '';
    el.urlState.classList.toggle('is-error', !!el.url.value.trim() && !id);
  });

  el.file.addEventListener('change', async () => {
    const file = el.file.files?.[0];
    if (!file) return;
    el.text.value = await file.text();
    el.fileName.textContent = `${file.name} 불러옴`;
  });

  for (const btn of el.lengths) {
    btn.addEventListener('click', () => {
      targetWords = Number(btn.dataset.words);
      for (const b of el.lengths) b.classList.toggle('is-active', b === btn);
      if (!el.result.hidden) preview();
    });
  }

  el.preview.addEventListener('click', preview);

  function preview() {
    const videoId = extractVideoId(el.url.value);
    if (!videoId) {
      toast('먼저 유튜브 영상 주소를 입력해 주세요.');
      el.url.focus();
      return;
    }
    if (!el.text.value.trim()) {
      toast('자막을 붙여넣거나 자막 파일을 올려 주세요.');
      el.text.focus();
      return;
    }

    const { sentences, cueCount, format } = buildSentences(el.text.value, {
      targetWords,
      maxWords: targetWords + 9,
    });

    if (!sentences.length) {
      el.result.hidden = false;
      el.result.innerHTML = `<p class="empty-note">자막을 해석하지 못했습니다.
        유튜브 '스크립트 표시' 패널의 내용을 통째로 복사했는지, 또는 올린 파일이
        <code>.srt</code> / <code>.vtt</code> 형식인지 확인해 주세요.</p>`;
      return;
    }

    const formatLabel =
      { vtt: 'WebVTT 자막', srt: 'SubRip 자막', transcript: '유튜브 스크립트 패널' }[format] || format;

    el.result.hidden = false;
    el.result.innerHTML = `
      <div class="result-block">
        <h4>미리보기</h4>
        <p class="weak-hint" style="margin-top:0">
          ${esc(formatLabel)}에서 자막 ${cueCount}개를 읽어 문장 ${sentences.length}개로 합쳤습니다.
          빼고 싶은 문장은 체크를 해제하세요.
        </p>
        <label class="field-label" for="imp-title">코스 이름</label>
        <input id="imp-title" class="field" value="${esc(guessTitle(el.text.value, videoId))}" />
        <ul class="cue-list">
          ${sentences
            .map(
              (s, i) => `<li>
                <label>
                  <input type="checkbox" data-idx="${i}" checked />
                  <span class="cue-time">${esc(formatTime(s.start))}</span>
                  <span class="cue-text">${esc(s.text)}</span>
                </label>
              </li>`
            )
            .join('')}
        </ul>
        <div class="action-row">
          <button class="btn btn-primary" data-act="save">코스로 저장</button>
          <button class="btn btn-ghost" data-act="toggle">전체 선택 / 해제</button>
        </div>
      </div>`;

    const boxes = () => [...el.result.querySelectorAll('input[type=checkbox]')];

    el.result.querySelector('[data-act="toggle"]').addEventListener('click', () => {
      const allOn = boxes().every((b) => b.checked);
      for (const b of boxes()) b.checked = !allOn;
    });

    el.result.querySelector('[data-act="save"]').addEventListener('click', () => {
      const picked = boxes()
        .filter((b) => b.checked)
        .map((b) => sentences[Number(b.dataset.idx)]);

      if (!picked.length) {
        toast('최소 한 문장은 선택해야 합니다.');
        return;
      }

      const title = document.getElementById('imp-title').value.trim() || '가져온 영상';
      const lessonId = `yt-${videoId}`;

      try {
        store.saveUserLesson({
          id: lessonId,
          title,
          desc: `유튜브 영상에서 가져온 ${picked.length}문장. 실제 원어민 음성으로 해당 구간만 반복 재생됩니다.`,
          level: '가져온 코스',
          videoId,
          source: 'youtube',
          createdAt: Date.now(),
          sentences: picked.map((s, i) => ({
            // 같은 영상을 다시 가져오면 문장 id가 유지되어 학습 기록이 이어진다
            id: `${lessonId}-${Math.round(s.start * 10)}`,
            text: s.text,
            start: s.start,
            end: s.end,
          })),
        });
      } catch (err) {
        toast(err.message);
        return;
      }

      toast(`"${title}" 코스를 만들었습니다.`);
      location.hash = `#/lesson/${lessonId}`;
    });
  }

  /** 자막 첫 문장으로 코스 이름 추정 */
  function guessTitle(raw, videoId) {
    const { sentences } = buildSentences(raw, { targetWords: 8, maxWords: 10 });
    const first = sentences[0]?.text || '';
    const short = first.split(/\s+/).slice(0, 6).join(' ');
    return short ? `${short}…` : `YouTube ${videoId}`;
  }

  el.url.focus();
}

// ── 통계 ──────────────────────────────────────────────────────────────

function renderStats() {
  view.appendChild(useTemplate('tpl-stats'));
  const body = document.getElementById('stats-body');

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (!confirm('모든 학습 기록을 지웁니다. 되돌릴 수 없습니다.\n먼저 내보내기로 백업해 두는 것을 권합니다.\n\n계속할까요?')) return;
    store.resetAll();
    toast('기록을 초기화했습니다.');
    renderStats();
  });

  document.getElementById('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(store.exportAll(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = store.exportFilename();
    a.click();
    URL.revokeObjectURL(url);
    toast('백업 파일을 내려받았습니다.');
  });

  const importInput = document.getElementById('btn-import');
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const result = store.importAll(JSON.parse(await file.text()));
      const parts = [`시도 ${result.addedAttempts}건 추가`];
      if (result.skippedAttempts) parts.push(`중복 ${result.skippedAttempts}건 건너뜀`);
      if (result.addedLessons) parts.push(`코스 ${result.addedLessons}개 복원`);
      toast(parts.join(' · '));
      renderStats();
    } catch (err) {
      toast(err instanceof SyntaxError ? 'JSON 형식이 아닙니다.' : err.message);
    } finally {
      importInput.value = ''; // 같은 파일을 다시 골라도 change 가 발생하도록
    }
  });

  const stats = store.overallStats();
  if (!stats.totalAttempts) {
    body.innerHTML = `<p class="empty-note" style="margin-top:24px">
      아직 분석할 기록이 없습니다. 문장을 몇 개 받아쓰면 자주 놓치는 유형이 여기 쌓입니다.</p>`;
    return;
  }

  const tally = store.categoryTally();
  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const max = ranked[0]?.[1] || 1;
  const totalMistakes = ranked.reduce((acc, [, n]) => acc + n, 0);

  const trend = store.dailyAccuracy(14);
  const summary = store.sentenceSummary();
  const sentenceById = new Map(allSentences().map((s) => [s.id, s]));

  const review = [...summary.values()]
    .filter((s) => !s.cleared && sentenceById.has(s.sentenceId))
    .sort((a, b) => a.best - b.best)
    .slice(0, 8);

  body.innerHTML = `
    <section class="stat-strip" style="margin-top:0">
      ${[
        ['총 시도', `${stats.totalAttempts}`],
        ['받아쓴 문장', `${stats.sentencesTried}<small> / ${allSentences().length}</small>`],
        ['완벽 통과', `${stats.sentencesCleared}`],
        ['최근 20회 정확도', pct(stats.recentAccuracy)],
      ]
        .map(([l, v]) => `<dl class="stat-tile"><dt>${l}</dt><dd>${v}</dd></dl>`)
        .join('')}
    </section>

    <section class="block">
      <h2 class="block-title">최근 2주 정확도</h2>
      <div class="trend">
        ${trend
          .map((d) => {
            const h = d.accuracy === null ? 3 : Math.max(4, d.accuracy * 100);
            const label = new Date(d.ts).getDate();
            return `<div class="trend-col" title="${d.count ? `${d.count}회 · ${pct(d.accuracy)}` : '기록 없음'}">
              <div class="trend-bar${d.accuracy === null ? ' is-empty' : ''}" style="height:${h}%"></div>
              <span class="trend-day">${label}</span>
            </div>`;
          })
          .join('')}
      </div>
    </section>

    <section class="block">
      <h2 class="block-title">자주 놓치는 유형</h2>
      <ul class="weak-list">
        ${ranked
          .map(([cat, n]) => {
            const words = store.topMissedWords(cat, 8);
            return `<li class="weak-item">
              <div class="weak-top">
                <span class="weak-name">${esc(categoryLabel(cat))}</span>
                <span class="weak-count">${n}회 · 전체 실수의 ${Math.round((n / totalMistakes) * 100)}%</span>
              </div>
              <div class="weak-bar"><i style="width:${(n / max) * 100}%"></i></div>
              <p class="weak-hint">${esc(categoryHint(cat))}</p>
              ${
                words.length
                  ? `<div class="weak-words">${words
                      .map((w) => `<code>${esc(w.word)}${w.count > 1 ? ` ×${w.count}` : ''}</code>`)
                      .join('')}</div>`
                  : ''
              }
            </li>`;
          })
          .join('')}
      </ul>
    </section>

    ${
      review.length
        ? `<section class="block">
            <h2 class="block-title">다시 풀어야 할 문장</h2>
            <ul class="review-list">
              ${review
                .map((r) => {
                  const s = sentenceById.get(r.sentenceId);
                  return `<li>
                    <span class="review-text">${esc(s.text)}</span>
                    <span class="review-score">최고 ${pct(r.best)}</span>
                    <a class="btn btn-ghost btn-sm" href="#/lesson/${esc(s.lessonId)}">코스로 이동</a>
                  </li>`;
                })
                .join('')}
            </ul>
          </section>`
        : ''
    }`;
}

// ── 시작 ──────────────────────────────────────────────────────────────

player.init();
render();
