// 딕테이션 학습 콘텐츠
//
// 각 문장 구조:
//   text    : 받아쓸 정답 문장 (정답 비교 + TTS 낭독에 그대로 사용)
//   ko      : 한국어 뜻
//   audioUrl: (선택) 원어민 녹음 파일 경로. 없으면 브라우저 TTS로 대체 재생한다.
//   linking : 연음/축약 해설. span 은 text 안에 실제로 등장하는 부분 문자열이어야
//             정답 공개 화면에서 해당 구간이 하이라이트된다.

export const LESSONS = [
  {
    id: 'l1',
    title: '연음의 기초 — 자음과 모음이 붙을 때',
    desc: '단어 끝 자음이 다음 단어의 첫 모음으로 넘어가면서 소리가 완전히 달라지는 패턴입니다. 아는 단어가 안 들리는 가장 흔한 이유예요.',
    level: '입문',
    sentences: [
      {
        id: 'l1-1',
        text: "I'll pick it up on my way out.",
        ko: '나가는 길에 그거 가지러 갈게.',
        linking: [
          { span: 'pick it up', tip: "pi-ck_i-t_up → '피키럽'. k가 it의 i로, t가 up의 u로 넘어갑니다. 모음 사이의 t는 [ɾ]로 약해져 한국어 ㄹ에 가깝게 들려요." },
          { span: 'way out', tip: "way_out → '웨이아웃'. 앞 단어가 모음으로 끝나면 [w] 소리가 살짝 끼어 자연스럽게 이어집니다." },
        ],
      },
      {
        id: 'l1-2',
        text: 'Take a look at this one first.',
        ko: '이것부터 먼저 한번 봐봐.',
        linking: [
          { span: 'Take a look at', tip: "Ta-ke_a_loo-k_at → '테이커루컷'. a는 [ə]로 뭉개지고 앞뒤 자음에 완전히 흡수됩니다." },
          { span: 'at this', tip: 'at_this → t가 뒤의 th에 먹혀 거의 들리지 않습니다. 자음 두 개가 만나면 앞 자음은 파열되지 않아요.' },
        ],
      },
      {
        id: 'l1-3',
        text: 'She ran out of time again.',
        ko: '그 사람 또 시간이 부족했어.',
        linking: [
          { span: 'ran out of', tip: "ra-n_ou-t_of → '레나우럽'. n이 out으로, t는 of 앞에서 [ɾ]가 되고 of의 f는 거의 사라집니다." },
          { span: 'time again', tip: "time_again → '타이머겐'. m이 again의 a로 넘어갑니다." },
        ],
      },
      {
        id: 'l1-4',
        text: 'Can I get a hold of him later?',
        ko: '나중에 그 사람이랑 연락될까?',
        linking: [
          { span: 'Can I get a', tip: "Can_I_ge-t_a → '커나이게러'. Can은 강세가 없어 [kən]으로 약화되고, get a의 t는 [ɾ]입니다." },
          { span: 'of him', tip: "of_him → '어범'. h는 강세 없는 대명사에서 자주 탈락합니다 (h-dropping)." },
        ],
      },
      {
        id: 'l1-5',
        text: 'Put it on the shelf over there.',
        ko: '저기 선반 위에 올려놔.',
        linking: [
          { span: 'Put it on', tip: "Pu-t_i-t_on → '푸리론'. t 두 개가 모두 [ɾ]로 약화됩니다." },
          { span: 'shelf over', tip: 'shelf_over → f가 over로 넘어가 [fo]처럼 붙습니다.' },
        ],
      },
      {
        id: 'l1-6',
        text: 'Is it all right if I come in early?',
        ko: '내가 일찍 들어와도 괜찮아?',
        linking: [
          { span: 'Is it all right', tip: "I-s_i-t_all → '이지롤라잇'. s가 [z]로 유성음화되면서 it과 붙습니다." },
          { span: 'come in', tip: "come_in → '커민'. m이 in으로 넘어갑니다." },
        ],
      },
      {
        id: 'l1-7',
        text: 'He asked me about it this morning.',
        ko: '그 사람이 오늘 아침에 그거 물어봤어.',
        linking: [
          { span: 'asked me', tip: "asked_me → '애스미'. 자음 3개(-skt)가 겹치면 가운데 t가 탈락합니다." },
          { span: 'about it', tip: "abou-t_it → '어바우릿'. t가 [ɾ]로 약화되며 이어집니다." },
        ],
      },
      {
        id: 'l1-8',
        text: 'Give me a couple of minutes.',
        ko: '몇 분만 시간 줘.',
        linking: [
          { span: 'Give me a', tip: "Give_me_a → '기미어'. 실제 회화에서는 gimme로 축약되기도 합니다." },
          { span: 'couple of', tip: "couple_of → '커플러'. of가 [ə]로 줄어 앞 단어에 붙습니다." },
        ],
      },
    ],
  },

  {
    id: 'l2',
    title: '축약과 약화 — gonna, wanna, 그리고 사라지는 소리들',
    desc: '원어민은 기능어(전치사·조동사·대명사)를 거의 발음하지 않습니다. 여기서 안 들린 부분이 곧 당신의 취약점입니다.',
    level: '초급',
    sentences: [
      {
        id: 'l2-1',
        text: "I'm going to have to think about that.",
        ko: '그건 좀 생각해 봐야겠는데.',
        linking: [
          { span: 'going to', tip: "going to → '거너'(gonna). 뒤에 동사가 오면 거의 항상 축약됩니다." },
          { span: 'have to', tip: "have to → '해프투'. v가 무성음화되어 [hæftə]가 됩니다." },
          { span: 'about that', tip: 'about_that → t가 th에 흡수되어 한 번만 소리납니다.' },
        ],
      },
      {
        id: 'l2-2',
        text: 'What do you want me to do with it?',
        ko: '이걸로 내가 뭘 하면 돼?',
        linking: [
          { span: 'What do you', tip: "What do you → '와루야' 또는 '와디야'. do you가 [dʒə]로 뭉개집니다." },
          { span: 'want me to', tip: "want me to → '워미러'. want의 t가 탈락하고 to는 [tə]로 약화됩니다." },
          { span: 'with it', tip: "with_it → '위딧'. th가 it으로 넘어갑니다." },
        ],
      },
      {
        id: 'l2-3',
        text: "I don't know what you're talking about.",
        ko: '무슨 말인지 모르겠어.',
        linking: [
          { span: "don't know", tip: "don't know → '더노'. t가 완전히 탈락하고 n만 남습니다." },
          { span: "what you're", tip: "what you're → '왓츄어'. t + y가 만나 [tʃ]로 융합됩니다 (구개음화)." },
          { span: 'talking about', tip: 'talking_about → g가 about으로 넘어가고 -ing는 [ɪn]으로 발음되기도 합니다.' },
        ],
      },
      {
        id: 'l2-4',
        text: 'Did you get a chance to look at them?',
        ko: '그것들 볼 기회 있었어?',
        linking: [
          { span: 'Did you', tip: "Did you → '디쥬'. d + y가 [dʒ]로 융합됩니다." },
          { span: 'get a chance to', tip: "get a → '게러'. chance to의 t 하나만 발음됩니다." },
          { span: 'at them', tip: "at them → '애럼'. them은 'em[əm]으로 줄고 th가 탈락합니다." },
        ],
      },
      {
        id: 'l2-5',
        text: 'You should have told me sooner.',
        ko: '더 일찍 말해줬어야지.',
        linking: [
          { span: 'should have', tip: "should have → '슈러브'(shoulda). have가 [əv]로 완전히 약화됩니다. of로 잘못 듣기 쉬운 대표 구간이에요." },
          { span: 'told me', tip: 'told me → d가 m 앞에서 파열되지 않아 거의 사라집니다.' },
        ],
      },
      {
        id: 'l2-6',
        text: "There's a lot of stuff we haven't covered yet.",
        ko: '아직 안 다룬 게 많아.',
        linking: [
          { span: "There's a lot of", tip: "There's a lo-t_of → '데어저라러브'. 세 단어가 한 덩어리로 들립니다." },
          { span: "haven't covered", tip: "haven't → '해븐'. t가 자음 앞에서 탈락합니다." },
        ],
      },
      {
        id: 'l2-7',
        text: 'I kind of want to see how it goes.',
        ko: '어떻게 되는지 좀 보고 싶긴 해.',
        linking: [
          { span: 'kind of', tip: "kind of → '카이너'(kinda). d가 탈락합니다." },
          { span: 'want to', tip: "want to → '워너'(wanna)." },
          { span: 'how it goes', tip: "how_it → '하우잇'. w 소리가 연결고리 역할을 합니다." },
        ],
      },
      {
        id: 'l2-8',
        text: "Let me know if you're not going to make it.",
        ko: '못 올 것 같으면 알려줘.',
        linking: [
          { span: 'Let me know', tip: "Let me → '레미'. t가 m 앞에서 탈락합니다." },
          { span: 'make it', tip: "make_it → '메이킷'. k가 it으로 넘어갑니다." },
        ],
      },
    ],
  },

  {
    id: 'l3',
    title: '전치사와 관사 — 가장 많이 놓치는 자리',
    desc: '한국어에 없는 a/the, 그리고 약하게 발음되는 전치사는 받아쓰기에서 압도적으로 많이 틀리는 부분입니다. 의미가 아니라 소리로 잡아내는 연습을 하세요.',
    level: '초급',
    sentences: [
      {
        id: 'l3-1',
        text: 'She works at a hospital in the city.',
        ko: '그 사람은 시내에 있는 병원에서 일해.',
        linking: [
          { span: 'at a', tip: "at_a → '애러'. 두 단어가 한 음절처럼 들려 통째로 놓치기 쉽습니다." },
          { span: 'in the', tip: "in the → '인더'. the는 [ðə]로 극도로 약해집니다." },
        ],
      },
      {
        id: 'l3-2',
        text: 'We talked about it for over an hour.',
        ko: '우리 그거에 대해 한 시간 넘게 얘기했어.',
        linking: [
          { span: 'about it for', tip: "abou-t_it for → t가 [ɾ]로 약화되고 for는 [fər]로 줄어듭니다." },
          { span: 'over an hour', tip: "over_an_hour → '오버러나워'. hour의 h는 묵음이라 an과 바로 이어집니다." },
        ],
      },
      {
        id: 'l3-3',
        text: 'Put the box on top of the table.',
        ko: '상자를 탁자 위에 올려놔.',
        linking: [
          { span: 'on top of the', tip: "on top of the → '온타퍼더'. of the가 통째로 [əvðə]로 뭉개집니다." },
        ],
      },
      {
        id: 'l3-4',
        text: 'He got a call from the bank this afternoon.',
        ko: '그 사람 오늘 오후에 은행에서 전화 받았어.',
        linking: [
          { span: 'got a call', tip: "go-t_a → '가러'. a는 거의 들리지 않지만 반드시 써야 합니다." },
          { span: 'from the', tip: "from the → '프럼더'. m과 th가 이어지며 뭉개집니다." },
        ],
      },
      {
        id: 'l3-5',
        text: 'There was a problem with the order.',
        ko: '주문에 문제가 있었어.',
        linking: [
          { span: 'There was a', tip: "There wa-s_a → '데어워저'. was의 s가 [z]로 유성음화되며 a와 붙습니다." },
          { span: 'with the', tip: 'with the → th 두 개가 연속되면 하나로 합쳐집니다.' },
        ],
      },
      {
        id: 'l3-6',
        text: 'I sent it to the wrong address by mistake.',
        ko: '실수로 잘못된 주소로 보냈어.',
        linking: [
          { span: 'sent it to the', tip: "sent_it to the → '센이러더'. sent의 t가 탈락하고 to the가 붙습니다." },
          { span: 'by mistake', tip: 'by mistake → 강세가 mistake의 두 번째 음절에 있어 by는 거의 안 들립니다.' },
        ],
      },
      {
        id: 'l3-7',
        text: 'Most of the people in the room agreed.',
        ko: '방에 있던 사람들 대부분이 동의했어.',
        linking: [
          { span: 'Most of the', tip: "Most of the → '모스터더'. t가 탈락하고 of the가 [əvðə]로 줄어듭니다." },
          { span: 'room agreed', tip: "room_agreed → '루머그리드'. m이 넘어갑니다." },
        ],
      },
      {
        id: 'l3-8',
        text: 'She looked at me for a second and left.',
        ko: '그 사람이 잠깐 날 보더니 가버렸어.',
        linking: [
          { span: 'looked at me', tip: "looke-d_at me → '룩터미'. -ed는 [t]로 발음되고 at과 이어집니다." },
          { span: 'for a second', tip: "for_a → '퍼러'. 관사 a가 완전히 흡수됩니다." },
        ],
      },
    ],
  },

  {
    id: 'l4',
    title: '문법 취약점 — 복수형, 시제, 3인칭 s',
    desc: '들리긴 하는데 안 써지는 소리들입니다. 문장 끝 -s, -ed 는 아주 짧게 스쳐 지나가므로 의식적으로 잡아야 합니다.',
    level: '중급',
    sentences: [
      {
        id: 'l4-1',
        text: 'He always asks the same questions.',
        ko: '그 사람은 항상 똑같은 질문을 해.',
        linking: [
          { span: 'asks the', tip: "asks the → '애스더'. -sks 자음군에서 k가 거의 탈락합니다. 그래도 s는 반드시 표기해야 합니다." },
        ],
      },
      {
        id: 'l4-2',
        text: 'They finished the project two weeks ago.',
        ko: '그들은 2주 전에 프로젝트를 끝냈어.',
        linking: [
          { span: 'finished the', tip: '-ed 뒤에 the가 오면 [t]가 th에 흡수되어 시제 단서가 거의 사라집니다.' },
          { span: 'weeks ago', tip: "week-s_ago → '위크서고'. s가 ago로 넘어갑니다." },
        ],
      },
      {
        id: 'l4-3',
        text: 'She used to live in a small town.',
        ko: '그 사람은 예전에 작은 마을에 살았어.',
        linking: [
          { span: 'used to', tip: "used to → '유스투'. d가 t에 흡수되어 [juːstə]가 됩니다. use to로 잘못 쓰기 쉬워요." },
          { span: 'in a small', tip: "in_a → '이너'. 관사 a를 놓치기 쉽습니다." },
        ],
      },
      {
        id: 'l4-4',
        text: "It doesn't seem to bother him at all.",
        ko: '그 사람은 전혀 신경 안 쓰는 것 같아.',
        linking: [
          { span: "doesn't seem", tip: "doesn't → '더즌'. t가 s 앞에서 탈락해 부정형인지 놓치기 쉽습니다." },
          { span: 'him at all', tip: "him_a-t_all → '이머롤'. h 탈락 + t 약화가 동시에 일어납니다." },
        ],
      },
      {
        id: 'l4-5',
        text: 'The prices have gone up quite a bit.',
        ko: '가격이 꽤 많이 올랐어.',
        linking: [
          { span: 'prices have', tip: "prices have → '프라이시저브'. have가 [əv]로 약화되며 앞에 붙습니다." },
          { span: 'quite a bit', tip: "qui-te_a bit → '콰이러빗'. t가 [ɾ]로 약화됩니다." },
        ],
      },
      {
        id: 'l4-6',
        text: "I've been meaning to ask you about that.",
        ko: '그거에 대해 물어보려고 했었어.',
        linking: [
          { span: "I've been", tip: "I've been → '아이븐'. 've가 거의 안 들려 완료 시제를 놓치기 쉽습니다." },
          { span: 'ask you', tip: "ask you → '애스큐'. k + y가 이어집니다." },
        ],
      },
      {
        id: 'l4-7',
        text: 'Nobody told us the meeting was canceled.',
        ko: '회의가 취소됐다고 아무도 우리한테 말 안 해줬어.',
        linking: [
          { span: 'told us', tip: "tol-d_us → '톨더스'. d가 us로 넘어갑니다." },
          { span: 'was canceled', tip: 'was canceled → was가 [wəz]로 약화되어 수동태 단서가 흐려집니다.' },
        ],
      },
      {
        id: 'l4-8',
        text: 'He said he would call me back tomorrow.',
        ko: '그 사람이 내일 다시 전화한다고 했어.',
        linking: [
          { span: 'he would', tip: "he would → '히드'(he'd). would가 [d]만 남습니다." },
          { span: 'call me back', tip: 'call me → l이 m 앞에서 뭉개집니다.' },
        ],
      },
    ],
  },

  {
    id: 'l5',
    title: '실전 회화 — 빠른 속도로 이어지는 문장',
    desc: '지금까지 배운 연음·축약·기능어 약화가 한 문장에 동시에 나타납니다. 1.0배속으로 한 번에 받아쓰는 것을 목표로 하세요.',
    level: '중급',
    sentences: [
      {
        id: 'l5-1',
        text: "I was gonna call you but I figured you'd be busy.",
        ko: '전화하려다가 바쁠 것 같아서 안 했어.',
        linking: [
          { span: 'was gonna call you', tip: "was가 [wəz]로, call you가 '콜유'로 이어집니다." },
          { span: "figured you'd", tip: "figured you'd → '피결유드'. d + y가 [dʒ]로 융합됩니다." },
        ],
      },
      {
        id: 'l5-2',
        text: "That's not what I meant at all.",
        ko: '내 말은 전혀 그게 아니야.',
        linking: [
          { span: "That's not what I", tip: "not what I → '낫와라이'. what의 t가 [ɾ]로 약화됩니다." },
          { span: 'meant at all', tip: "mean-t_a-t_all → '멘터롤'. t 두 개가 연달아 약화됩니다." },
        ],
      },
      {
        id: 'l5-3',
        text: 'Let me check and get back to you on that.',
        ko: '확인해보고 그건 다시 알려줄게.',
        linking: [
          { span: 'Let me check and', tip: "check and → '체컨'. and가 [ən]으로 줄어듭니다." },
          { span: 'get back to you', tip: 'get back → t가 b 앞에서 파열되지 않습니다.' },
        ],
      },
      {
        id: 'l5-4',
        text: "I don't think it's a big deal, honestly.",
        ko: '솔직히 별일 아닌 것 같은데.',
        linking: [
          { span: "think it's a", tip: "thin-k_it-'s_a → '띵킷처'. k와 s가 연달아 넘어갑니다." },
          { span: 'honestly', tip: 'honestly → h는 묵음이고 t는 거의 들리지 않습니다.' },
        ],
      },
      {
        id: 'l5-5',
        text: "You could have just asked me first.",
        ko: '그냥 나한테 먼저 물어보지 그랬어.',
        linking: [
          { span: 'could have just', tip: "could have → '쿠러브'(coulda). just의 t는 asked 앞에서 탈락합니다." },
          { span: 'asked me', tip: "asked me → '애스미'. 자음군 단순화." },
        ],
      },
      {
        id: 'l5-6',
        text: "It's been a while since we last talked.",
        ko: '우리 마지막으로 얘기한 지 꽤 됐네.',
        linking: [
          { span: "It's been a while", tip: "It-'s been_a → '잇츠비너와일'. been a가 붙습니다." },
          { span: 'last talked', tip: 'last talked → t가 하나만 발음됩니다 (중복 자음 축약).' },
        ],
      },
      {
        id: 'l5-7',
        text: 'I have no idea what he was thinking.',
        ko: '그 사람이 무슨 생각이었는지 모르겠어.',
        linking: [
          { span: 'no idea what', tip: "no_idea → '노아이디어'. w 연결음이 들어갑니다." },
          { span: 'he was thinking', tip: "he was → '히워즈'. h가 약해지고 was가 [wəz]로 줄어듭니다." },
        ],
      },
      {
        id: 'l5-8',
        text: "We're running a little behind, so let's wrap it up.",
        ko: '좀 늦어지고 있으니까 이만 마무리하죠.',
        linking: [
          { span: 'running a little', tip: "running_a li-ttle → '러닝어리를'. little의 tt는 [ɾ]입니다." },
          { span: "let's wrap it up", tip: "wra-p_i-t_up → '래피럽'. p와 t가 연달아 넘어갑니다." },
        ],
      },
    ],
  },
];

export function allSentences() {
  return LESSONS.flatMap((l) => l.sentences.map((s) => ({ ...s, lessonId: l.id, lessonTitle: l.title })));
}

export function findLesson(id) {
  return LESSONS.find((l) => l.id === id) || null;
}
