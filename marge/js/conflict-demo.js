/* 문서 충돌 감지: 같은 주제 묶기 → 쌍마다 모순 찾기 → 다시 검토 → 원본 지목을 보여 주는 단계 데모 */
(function () {
  var root = document.getElementById('conflict-demo');
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
    'Q-cluster 질의로 같은 주제의 세그먼트를 모읍니다.',
    'LLM이 문서 쌍마다 서로 어긋나는 내용을 짚어냅니다.',
    '정확성과 논리 일관성을 다시 검토해, 조건이 다른 예외는 모순에서 뺍니다.',
    '실제 모순만 원본 문서를 지목해 사용자에게 알립니다.'
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
