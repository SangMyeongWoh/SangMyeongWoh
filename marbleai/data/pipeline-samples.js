/* 파이프라인 데모 샘플. 본문은 JSON 그대로이고, file:// 로 열어도 읽히도록 스크립트로 싣는다. */
window.PIPELINE_SAMPLES = {
  "_todo": "네 샘플 모두 형식 확인용으로 지어낸 값입니다. 가상의 게임 문장으로 실제 파이프라인을 돌린 결과(출력 토큰, 로그, latency_ms)로 교체해야 합니다. 회사 데이터는 넣지 않습니다.",
  "samples": [
    {
      "id": "clean-pass",
      "title": "한 번에 통과",
      "pair": "ko → en",
      "_todo": "placeholder",
      "source": "{0}님이 <color=#FFD700>여명의 검</color>을 획득했습니다.",
      "tokens": [
        {"id": "v0",  "text": "{0}",              "kind": "var"},
        {"id": "w1",  "text": "님이 ",            "kind": "word"},
        {"id": "t1o", "text": "<color=#FFD700>",  "kind": "tag"},
        {"id": "w2",  "text": "여명의 검",        "kind": "word"},
        {"id": "t1c", "text": "</color>",         "kind": "tag"},
        {"id": "w3",  "text": "을 획득했습니다.", "kind": "word"}
      ],
      "stages": [
        {
          "name": "mask",
          "label": "태그 마스킹",
          "log": "태그 2개, 변수 1개를 가려둠 (게임별 정규식 + 예외 목록)",
          "masks": {"v0": "⟦V0⟧", "t1o": "⟦T1⟧", "t1c": "⟦/T1⟧"}
        },
        {
          "name": "glossary",
          "label": "용어집",
          "log": "지정 용어 1건 매칭 · 유사 문장을 few-shot으로 주입",
          "hits": [{"token": "w2", "term": "여명의 검", "target": "Sword of Dawn"}]
        },
        {
          "name": "translate",
          "label": "번역",
          "log": "LLM 초안 생성",
          "latency_ms": 1200,
          "output_tokens": [
            {"id": "v0",  "text": "⟦V0⟧",          "kind": "var"},
            {"id": "r1",  "text": " obtained the ", "kind": "word"},
            {"id": "t1o", "text": "⟦T1⟧",          "kind": "tag"},
            {"id": "r2",  "text": "Sword of Dawn",  "kind": "word", "term": true},
            {"id": "t1c", "text": "⟦/T1⟧",         "kind": "tag"},
            {"id": "r3",  "text": ".",              "kind": "word"}
          ]
        },
        {
          "name": "check",
          "label": "무결성 검사",
          "log": "태그 수 일치 · 변수 수 일치 · 용어 사용 확인 · 리플렉션 없이 통과",
          "results": {"tags": "pass", "vars": "pass", "glossary": "pass"},
          "final": "{0} obtained the <color=#FFD700>Sword of Dawn</color>."
        }
      ]
    },
    {
      "id": "reflect-once",
      "title": "리플렉션 1회로 통과",
      "pair": "ko → ru",
      "_todo": "placeholder",
      "source": "<color=red>마력 결정</color>을 {0}개 획득했다.",
      "tokens": [
        {"id": "t1o", "text": "<color=red>",  "kind": "tag"},
        {"id": "w1",  "text": "마력 결정",    "kind": "word"},
        {"id": "t1c", "text": "</color>",     "kind": "tag"},
        {"id": "w2",  "text": "을 ",          "kind": "word"},
        {"id": "v0",  "text": "{0}",          "kind": "var"},
        {"id": "w3",  "text": "개 획득했다.", "kind": "word"}
      ],
      "stages": [
        {
          "name": "mask",
          "label": "태그 마스킹",
          "log": "태그 2개, 변수 1개를 가려둠 (게임별 정규식 + 예외 목록)",
          "masks": {"t1o": "⟦T1⟧", "t1c": "⟦/T1⟧", "v0": "⟦V0⟧"}
        },
        {
          "name": "glossary",
          "label": "용어집",
          "log": "지정 용어 1건 매칭 · 유사 문장을 few-shot으로 주입",
          "hits": [{"token": "w1", "term": "마력 결정", "target": "Кристалл маны"}]
        },
        {
          "name": "translate",
          "label": "번역",
          "log": "LLM 초안 생성",
          "latency_ms": 1400,
          "output_tokens": [
            {"id": "r1",  "text": "Получено ",       "kind": "word"},
            {"id": "v0",  "text": "⟦V0⟧",           "kind": "var"},
            {"id": "r2",  "text": " Кристалла маны", "kind": "word", "term": true},
            {"id": "t1c", "text": "⟦/T1⟧",          "kind": "tag"},
            {"id": "r3",  "text": ".",               "kind": "word"}
          ]
        },
        {
          "name": "check",
          "label": "무결성 검사",
          "log": "여는 태그 ⟦T1⟧ 누락 · 변수 수 일치 · 용어 사용 확인 (격변화 Кристалла → 기본형 Кристалл)",
          "results": {"tags": "fail", "vars": "pass", "glossary": "pass"},
          "missing": [{"id": "t1o", "text": "⟦T1⟧", "before": "r2"}]
        },
        {
          "name": "reflect",
          "label": "수정",
          "log": "실패 항목만 LLM에 수정 요청 (전체 재번역 아님)",
          "latency_ms": 600,
          "insert": [{"id": "t1o", "text": "⟦T1⟧", "before": "r2"}]
        },
        {
          "name": "check",
          "label": "재검사",
          "log": "통과 · 태그 복원",
          "results": {"tags": "pass", "vars": "pass", "glossary": "pass"},
          "final": "Получено {0} <color=red>Кристалла маны</color>."
        }
      ]
    },
    {
      "id": "inflection",
      "title": "격변화에도 용어 검사 통과",
      "pair": "ko → ru",
      "_todo": "placeholder",
      "source": "<b>마력 결정</b>이 부족합니다.",
      "tokens": [
        {"id": "t1o", "text": "<b>",           "kind": "tag"},
        {"id": "w1",  "text": "마력 결정",     "kind": "word"},
        {"id": "t1c", "text": "</b>",          "kind": "tag"},
        {"id": "w2",  "text": "이 부족합니다.", "kind": "word"}
      ],
      "stages": [
        {
          "name": "mask",
          "label": "태그 마스킹",
          "log": "태그 2개를 가려둠 (게임별 정규식 + 예외 목록)",
          "masks": {"t1o": "⟦T1⟧", "t1c": "⟦/T1⟧"}
        },
        {
          "name": "glossary",
          "label": "용어집",
          "log": "지정 용어 1건 매칭 · 유사 문장을 few-shot으로 주입",
          "hits": [{"token": "w1", "term": "마력 결정", "target": "Кристалл маны"}]
        },
        {
          "name": "translate",
          "label": "번역",
          "log": "LLM 초안 생성",
          "latency_ms": 1300,
          "output_tokens": [
            {"id": "r1",  "text": "Недостаточно ",   "kind": "word"},
            {"id": "t1o", "text": "⟦T1⟧",           "kind": "tag"},
            {"id": "r2",  "text": "Кристаллов маны", "kind": "word", "term": true},
            {"id": "t1c", "text": "⟦/T1⟧",          "kind": "tag"},
            {"id": "r3",  "text": ".",               "kind": "word"}
          ]
        },
        {
          "name": "check",
          "label": "무결성 검사",
          "log": "태그 수 일치 · 용어는 기본형으로 비교해 통과 (Кристаллов → Кристалл)",
          "results": {"tags": "pass", "vars": "pass", "glossary": "pass"},
          "lemma": {"token": "r2", "from": "Кристаллов", "to": "Кристалл"},
          "final": "Недостаточно <b>Кристаллов маны</b>."
        }
      ]
    }
  ]
};
