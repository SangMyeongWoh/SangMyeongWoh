/* 태그 규칙 데모 샘플. 과정을 보여주기 위한 가상 예시이고 문장은 가상의 게임 텍스트다.
   {}와 <>는 항상 태그라 정규식으로 잡고, 태그 목록에는 [PlayerName]처럼 모양만으로는 가릴 수 없는 대괄호 태그가 들어간다.
   ko의 {id} 조각이 태그 후보, en의 {of} 조각이 그 후보의 번역 쪽 짝이다.
   규칙의 src는 실제 정규식이고, 데모는 이 정규식을 그대로 돌려 후보가 잡히는지 판정한다. */
window.RULES_SAMPLE = {
  "rows": [
    {
      "ko": [{"id": "c1", "text": "<color=red>"}, "마력 결정", {"id": "c2", "text": "</color>"}, "을 ", {"id": "c3", "text": "{0}"}, "개 획득했다."],
      "en": ["Obtained ", {"of": "c3", "text": "{0}"}, " ", {"of": "c1", "text": "<color=red>"}, "Mana Crystals", {"of": "c2", "text": "</color>"}, "."]
    },
    {
      "ko": [{"id": "c4", "text": "[길드]"}, " ", {"id": "c5", "text": "[PlayerName]"}, "님이 가입했습니다."],
      "en": [{"of": "c4", "text": "[Guild]"}, " ", {"of": "c5", "text": "[PlayerName]"}, " has joined."]
    },
    {
      "ko": [{"id": "c6", "text": "[Lv:1~2]"}, " 초원의 늑대"],
      "en": [{"of": "c6", "text": "[Lv:1~2]"}, " Meadow Wolf"]
    },
    {
      "ko": [{"id": "c7", "text": "<color=blue>"}, "심연의 문", {"id": "c8", "text": "</color>"}, "이 열렸습니다."],
      "en": ["The ", {"of": "c7", "text": "<color=blue>"}, "Abyss Gate", {"of": "c8", "text": "</color>"}, " has opened."]
    },
    {
      "ko": [{"id": "c9", "text": "[공지]"}, " 점검은 ", {"id": "c10", "text": "{1}"}, "시에 끝납니다."],
      "en": [{"of": "c9", "text": "[Notice]"}, " Maintenance ends at ", {"of": "c10", "text": "{1}"}, "."]
    },
    {
      "ko": [{"id": "c11", "text": "[Lv:3~4]"}, " 동굴 박쥐"],
      "en": [{"of": "c11", "text": "[Lv:3~4]"}, " Cave Bat"]
    }
  ],
  "rules": {
    "regex": [
      {"id": "r1", "src": "<color=\\w+>"},
      {"id": "r2", "src": "</color>"},
      {"id": "r3", "src": "\\{[^}]+\\}"},
      {"id": "r4", "src": "\\[.+?\\]"}
    ],
    "list": []
  },
  "revise": {
    "regex": {"id": "r4", "src": "\\[Lv:\\d+~\\d+\\]"},
    "listAdd": [{"id": "l1", "text": "[PlayerName]"}]
  },
  "desc": "`[길드]`는 `[Guild]`로 번역된 텍스트인데 `\\[.+?\\]`가 태그로 잡음. `[공지]`도 같음. 대괄호 가운데 번역에 그대로 남는 것은 `[Lv:숫자~숫자]` 꼴과 `[PlayerName]`뿐.",
  "logs": [
    "기존 번역 파일",
    "괄호 모양으로 태그 후보를 전부 추출",
    "번역에 그대로 남은 후보는 태그, 번역된 후보는 텍스트",
    "Claude가 규칙 작성. {}와 <>는 정규식으로, 대괄호도 정규식 하나로 묶음",
    "Gemini가 후보를 문장·번역과 함께 끝까지 훑어 검증. 틀린 점을 서술",
    "Claude가 서술을 보고 수정. 규칙성이 있는 것은 정규식으로 좁히고, 없는 것은 태그 목록에 기록",
    "전체 후보 통과. 규칙 저장"
  ]
};
