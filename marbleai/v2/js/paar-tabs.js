/* 항목 안의 세로 탭 (P · A · A · R). 누르면 같은 자리에서 내용만 바뀐다.
   상자 높이는 선택된 탭의 내용에 맞추고, 바뀔 때는 이전 높이에서 새 높이로 미끄러지듯 움직인다. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  [].forEach.call(document.querySelectorAll('[data-ptabs]'), function (root) {
    var tabs = [].slice.call(root.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    var box = root.querySelector('.ptabs__panels');
    if (!tabs.length || !box) return;

    // 패널을 한 겹으로 모아 둔다. 선택된 패널만 자리를 차지하고 나머지는 같은 자리에 겹쳐 숨는다
    var stack = document.createElement('div');
    stack.className = 'ptabs__stack';
    panels.forEach(function (p) { stack.appendChild(p); });
    box.appendChild(stack);

    var current = -1;
    // 선택된 탭의 아래 끝이 상자의 아래 끝과 만나면(맨 아래 탭 + 짧은 내용) 상자의 둥근 왼쪽 아래 모서리가
    // 탭에서 떨어져 틈이 보인다. 그때만 그 모서리를 각지게 해서 탭과 이어 붙인다
    function flushBottom(i) {
      var tb = tabs[i].getBoundingClientRect().bottom, pb = box.getBoundingClientRect().bottom;
      root.classList.toggle('is-flush-bottom', pb - tb < 20);
    }
    function select(i, focus) {
      i = (i + tabs.length) % tabs.length;
      if (i === current) { if (focus) tabs[i].focus(); return; }
      var from = stack.offsetHeight;
      tabs.forEach(function (t, k) {
        var on = k === i;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        panels[k].classList.toggle('is-on', on);
        panels[k].setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      root.classList.toggle('is-result', tabs[i].classList.contains('is-r'));
      root.classList.toggle('is-first', i === 0);   // 첫 탭이 선택됐을 때만 상자의 왼쪽 위 모서리가 탭과 이어진다
      flushBottom(i);
      if (current >= 0 && !reduce) {
        var to = stack.offsetHeight;
        if (to !== from) {
          stack.style.height = from + 'px';
          stack.offsetHeight;                      // 시작 높이를 확정한 뒤
          stack.style.height = to + 'px';          // 새 높이로 보낸다
        }
      }
      current = i;
      if (focus) tabs[i].focus();
    }
    stack.addEventListener('transitionend', function (e) {
      if (e.target === stack && e.propertyName === 'height') stack.style.height = '';
    });

    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, d = (k === 'ArrowDown' || k === 'ArrowRight') ? 1 : (k === 'ArrowUp' || k === 'ArrowLeft') ? -1 : 0;
        if (d) { e.preventDefault(); select(i + d, true); }
        else if (k === 'Home') { e.preventDefault(); select(0, true); }
        else if (k === 'End') { e.preventDefault(); select(tabs.length - 1, true); }
      });
    });

    root.classList.add('is-ready');
    select(0);
    window.addEventListener('resize', function () { if (current >= 0) flushBottom(current); });
  });
})();
