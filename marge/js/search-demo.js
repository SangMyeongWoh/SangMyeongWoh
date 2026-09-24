/* 검색 상세: 질의 재작성 → 병렬 검색 → Q-cluster 매칭 → RRF → 경로 묶기 → 가지치기 → 근거 발췌 */
(function () {
  var root = document.getElementById('search-demo');
  if (!root) return;

  var host = root.closest('details');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var steps = [].slice.call(root.querySelectorAll('[data-step]'));
  var log = root.querySelector('.sdemo__log');
  var controls = {
    prev: root.querySelector('[data-act="prev"]'),
    toggle: root.querySelector('[data-act="toggle"]'),
    next: root.querySelector('[data-act="next"]'),
    speed: root.querySelector('[data-act="speed"]')
  };
  var messages = [
    '대화 이력으로 질문을 재작성하고 원본도 보존합니다.',
    '두 질문을 병렬로 처리하며, 각각 BM25와 벡터 검색을 수행합니다.',
    '유사한 예상 질문의 순위와 등장 횟수를 세그먼트별로 집계합니다.',
    '같은 세그먼트가 네 순위에서 얻은 RRF 점수를 합칩니다.',
    '세그먼트 메타데이터의 폴더·문서 경로로 후보를 묶습니다.',
    '검색 순위가 낮은 문서와 폴더 가지를 제거합니다.',
    'LLM이 남은 세그먼트에서 질문과 관련된 부분만 발췌합니다.'
  ];
  var stage = 0, timer = null, transitionTimer = null, transitionFrame = null, sceneTimers = [];
  var playing = false, touched = false, speed = 1;

  function clearSceneTimers() {
    sceneTimers.forEach(clearTimeout);
    sceneTimers = [];
  }

  function queueScene(callback, delay) {
    sceneTimers.push(setTimeout(callback, delay / speed));
  }

  function animateVotes() {
    var board = root.querySelector('[data-panel="2"]');
    var queries = board.querySelectorAll('[data-vote-query]');
    var hits = board.querySelectorAll('[data-vote-hit]');
    var segments = board.querySelectorAll('[data-vote-segment]');
    var counts = board.querySelectorAll('[data-vote-count]');
    function reset(query) {
      board.dataset.activeQuery = query;
      queries.forEach(function (item) { item.classList.toggle('is-active', item.dataset.voteQuery === query); });
      hits.forEach(function (item) { item.classList.remove('is-hit'); });
      segments.forEach(function (item) { item.classList.remove('is-leading'); });
      counts.forEach(function (item) { item.textContent = '0'; item.classList.remove('is-counting'); });
    }
    function hit(name, segment, count, leading) {
      board.querySelector('[data-vote-hit="' + name + '"]').classList.add('is-hit');
      var tally = board.querySelector('[data-vote-count="' + segment + '"]');
      tally.textContent = String(count);
      tally.classList.remove('is-counting');
      void tally.offsetWidth;
      tally.classList.add('is-counting');
      if (leading) board.querySelector('[data-vote-segment="' + segment + '"]').classList.add('is-leading');
    }
    reset('original');
    queueScene(function () { hit('o1', 'expense', 1, false); }, 350);
    queueScene(function () { hit('o2', 'expense', 2, false); }, 900);
    queueScene(function () { hit('o3', 'faq', 1, false); }, 1450);
    queueScene(function () { hit('o4', 'expense', 3, true); }, 2000);
    queueScene(function () { hit('o5', 'leave', 1, false); }, 2550);
    queueScene(function () { reset('rewritten'); }, 3600);
    queueScene(function () { hit('r1', 'faq', 1, false); }, 4050);
    queueScene(function () { hit('r2', 'faq', 2, false); }, 4600);
    queueScene(function () { hit('r3', 'expense', 1, false); }, 5150);
    queueScene(function () { hit('r4', 'faq', 3, true); }, 5700);
    queueScene(function () { hit('r5', 'equipment', 1, false); }, 6250);
  }

  function animateRrf() {
    var board = root.querySelector('[data-panel="3"]');
    var sources = board.querySelectorAll('[data-rrf-source]');
    var arrows = board.querySelectorAll('.sdemo__rrf-flow span');
    var tokens = board.querySelectorAll('[data-rrf-token]');
    var buckets = board.querySelector('.sdemo__rrf-buckets');
    var next = board.querySelector('.sdemo__rrf-next');
    sources.forEach(function (item) { item.classList.remove('is-current'); });
    arrows.forEach(function (item) { item.classList.remove('is-scored'); });
    tokens.forEach(function (item) { item.classList.remove('is-scored'); });
    buckets.classList.remove('is-complete');
    next.classList.remove('is-complete');
    [1, 2, 3, 4].forEach(function (number, index) {
      queueScene(function () {
        sources.forEach(function (item) { item.classList.toggle('is-current', item.dataset.rrfSource === String(number)); });
        arrows[index].classList.add('is-scored');
        tokens.forEach(function (item) {
          if (item.dataset.rrfToken === String(number)) item.classList.add('is-scored');
        });
      }, 350 + index * 570);
    });
    queueScene(function () {
      sources.forEach(function (item) { item.classList.remove('is-current'); });
      buckets.classList.add('is-complete');
      next.classList.add('is-complete');
    }, 2800);
  }

  function animateScene() {
    clearSceneTimers();
    if (reduced) {
      if (stage === 2) {
        root.querySelectorAll('[data-vote-query]').forEach(function (item) { item.classList.add('is-active'); });
        root.querySelectorAll('[data-vote-hit]').forEach(function (item) { item.classList.add('is-hit'); });
      }
      if (stage === 3) {
        root.querySelectorAll('.sdemo__rrf-flow span, [data-rrf-token]').forEach(function (item) { item.classList.add('is-scored'); });
        root.querySelector('.sdemo__rrf-buckets').classList.add('is-complete');
        root.querySelector('.sdemo__rrf-next').classList.add('is-complete');
      }
      return;
    }
    if (stage === 2) animateVotes();
    if (stage === 3) animateRrf();
  }

  function sync() {
    root.dataset.stage = String(stage);
    log.textContent = messages[stage];
    steps.forEach(function (button, index) {
      if (index === stage) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    controls.prev.disabled = stage === 0;
    controls.next.disabled = stage === 6;
    var label = playing ? '일시정지' : stage === 6 ? '다시 재생' : '재생';
    controls.toggle.textContent = label;
    controls.toggle.setAttribute('aria-label', label);
  }

  function stop() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (transitionTimer) clearTimeout(transitionTimer);
    if (transitionFrame) cancelAnimationFrame(transitionFrame);
    transitionTimer = transitionFrame = null;
    root.classList.remove('is-fading');
    clearSceneTimers();
    playing = false;
    sync();
  }

  function show(next, instant) {
    var previous = stage;
    stage = Math.max(0, Math.min(6, next));
    if (previous !== stage) clearSceneTimers();
    if (transitionTimer) clearTimeout(transitionTimer);
    if (transitionFrame) cancelAnimationFrame(transitionFrame);
    transitionTimer = null;
    transitionFrame = null;
    // 가지치기에서는 트리를 그대로 두어 제거되는 동작이 보이게 한다.
    if (instant || reduced || previous === stage || (previous === 4 && stage === 5) || (previous === 5 && stage === 4)) {
      root.classList.remove('is-fading');
      sync();
      if (previous !== stage) animateScene();
      return;
    }
    root.classList.add('is-fading');
    transitionTimer = setTimeout(function () {
      transitionTimer = null;
      sync();
      transitionFrame = requestAnimationFrame(function () {
        transitionFrame = null;
        root.classList.remove('is-fading');
        animateScene();
      });
    }, 240);
  }

  function tick() {
    timer = null;
    if (!playing || (host && !host.open)) return;
    var next = stage + 1;
    if (next === 6) playing = false;
    show(next);
    if (next !== 6) schedule();
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(tick, (stage === 2 ? 7350 : stage === 3 ? 3900 : stage === 4 ? 2200 : 1800) / speed);
  }

  function play() {
    if (reduced) return;
    playing = true;
    if (stage === 6) show(0);
    else {
      sync();
      if (stage === 2 || stage === 3) animateScene();
    }
    schedule();
  }

  controls.prev.addEventListener('click', function () { touched = true; stop(); show(stage - 1); });
  controls.next.addEventListener('click', function () { touched = true; stop(); show(stage + 1); });
  controls.toggle.addEventListener('click', function () {
    touched = true;
    if (playing) stop(); else play();
  });
  controls.speed.addEventListener('click', function () {
    touched = true;
    speed = speed === 1 ? 2 : 1;
    controls.speed.textContent = speed + 'x';
    if (stage === 2 || stage === 3) animateScene();
    if (playing) schedule();
  });
  steps.forEach(function (button) {
    button.addEventListener('click', function () {
      touched = true;
      stop();
      show(Number(button.dataset.step));
    });
  });

  root.classList.add('is-ready');
  if (reduced) root.classList.add('is-reduced');
  show(reduced ? 6 : 0, true);

  if (host) {
    host.addEventListener('toggle', function () {
      if (!host.open) { stop(); show(reduced ? 6 : 0, true); touched = false; return; }
      if (reduced) return;
      setTimeout(function () { if (host.open && !touched && !playing && stage === 0) play(); }, 700);
    });
    if (host.open && !reduced) play();
  }
})();
