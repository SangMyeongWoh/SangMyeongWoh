/* 전처리 상세: 의미 경계 → 세그먼트 → 검색 자산을 보여 주는 단계 데모 */
(function () {
  var root = document.getElementById('preprocess-demo');
  if (!root) return;

  var host = root.closest('details');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var steps = [].slice.call(root.querySelectorAll('[data-step]'));
  var log = root.querySelector('.pdemo__log');
  var controls = {
    prev: root.querySelector('[data-act="prev"]'),
    toggle: root.querySelector('[data-act="toggle"]'),
    next: root.querySelector('[data-act="next"]'),
    speed: root.querySelector('[data-act="speed"]')
  };
  var messages = [
    '원문을 줄 단위로 정리합니다.',
    'LLM이 내용이 바뀌는 지점을 찾습니다.',
    '의미 경계를 기준으로 세그먼트를 나눕니다.',
    '각 세그먼트에서 BM25 토큰과 예상 질문을 만듭니다.'
  ];
  var stage = 0, timer = null, playing = false, touched = false, speed = 1;

  function sync() {
    root.dataset.stage = String(stage);
    log.textContent = messages[stage];
    steps.forEach(function (button, index) {
      if (index === stage) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    controls.prev.disabled = stage === 0;
    controls.next.disabled = stage === 3;
    var label = playing ? '일시정지' : stage === 3 ? '다시 재생' : '재생';
    controls.toggle.textContent = label;
    controls.toggle.setAttribute('aria-label', label);
  }

  function stop() {
    if (timer) clearTimeout(timer);
    timer = null;
    playing = false;
    sync();
  }

  function show(next) {
    stage = Math.max(0, Math.min(3, next));
    sync();
  }

  function tick() {
    timer = null;
    if (!playing || (host && !host.open)) return;
    show(stage + 1);
    if (stage === 3) stop();
    else schedule();
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(tick, 1500 / speed);
  }

  function play() {
    if (reduce) return;
    if (stage === 3) show(0);
    playing = true;
    sync();
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
  if (reduce) root.classList.add('is-reduced');
  show(reduce ? 3 : 0);

  if (host) {
    host.addEventListener('toggle', function () {
      if (!host.open) { stop(); show(reduce ? 3 : 0); touched = false; return; }
      if (reduce) return;
      setTimeout(function () { if (host.open && !touched && !playing && stage === 0) play(); }, 700);
    });
    if (host.open && !reduce) play();
  }
})();
