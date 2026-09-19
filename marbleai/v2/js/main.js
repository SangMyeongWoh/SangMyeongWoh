/* 등장 모션, 숫자 카운트업, 내비 하이라이트, 접기/펼치기, 딥다이브 이동 */
(function () {
  var hasGsap = typeof window.gsap !== 'undefined';
  var hasST = hasGsap && typeof window.ScrollTrigger !== 'undefined';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var animate = hasGsap && !reduce;
  function all(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }

  if (animate) {
    /* 첫 화면: 위에서부터 차례로 */
    gsap.from('[data-in]', { opacity: 0, y: 22, duration: 0.9, ease: 'expo.out', stagger: 0.09, delay: 0.05, clearProps: 'opacity,transform' });
  }

  if (animate && hasST) {
    /* 숫자는 화면에 들어올 때 센다 */
    all('[data-count]').forEach(function (el) {
      var end = +el.dataset.count, suffix = el.dataset.suffix || '', comma = 'comma' in el.dataset, obj = { val: 0 };
      function fmt(v) { return (comma ? v.toLocaleString('en-US') : v) + suffix; }
      el.textContent = fmt(0);
      gsap.to(obj, {
        val: end, duration: 1.4, ease: 'power3.out', snap: { val: 1 },
        onUpdate: function () { el.textContent = fmt(obj.val); },
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

    ScrollTrigger.batch('[data-rise]', {
      start: 'top 88%', once: true,
      onEnter: function (els) { gsap.to(els, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.07, clearProps: 'opacity,transform' }); }
    });
    gsap.set('[data-rise]', { opacity: 0, y: 24 });

    gsap.from('.bridge__line', {
      opacity: 0, y: 18, duration: 0.8, ease: 'expo.out', stagger: 0.14,
      scrollTrigger: { trigger: '.bridge__text', start: 'top 78%', once: true }
    });

    /* 항목마다 P → A → A → R 순서로 열린다 */
    all('.case').forEach(function (c) {
      gsap.from(all('.step, .cmp__col, .flow__step, .ptabs', c).filter(function (e) { return !(e.classList.contains('cmp__col') && e.closest('.flow')); }), {
        opacity: 0, y: 20, duration: 0.7, ease: 'expo.out', stagger: 0.08, clearProps: 'opacity,transform',
        scrollTrigger: { trigger: c, start: 'top 78%', once: true }
      });
    });
  }

  /* 내비: 현재 구간 */
  var links = all('.nav__links a');
  if (hasST) {
    links.forEach(function (a) {
      var sec = document.querySelector(a.getAttribute('href'));
      if (!sec) return;
      // "개요"는 헤드라인부터 데모·운영 실적까지를 한 구간으로 본다
      var until = a.dataset.until && document.querySelector(a.dataset.until);
      ScrollTrigger.create(until
        ? { trigger: sec, start: 'top bottom', endTrigger: until, end: 'top 45%', onToggle: function (self) { a.classList.toggle('on', self.isActive); } }
        : { trigger: sec, start: 'top 45%', end: 'bottom 45%', onToggle: function (self) { a.classList.toggle('on', self.isActive); } });
    });
  }

  /* 접기/펼치기: 높이 보간 */
  function openFold(d, instant) {
    if (d.open) return;
    d.open = true;
    var body = d.querySelector('.fold__body');
    if (!animate || instant || !body) return;
    gsap.fromTo(body, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.5, ease: 'expo.out', clearProps: 'height,opacity', onComplete: refresh });
  }
  function closeFold(d) {
    var body = d.querySelector('.fold__body');
    if (!animate || !body) { d.open = false; return; }
    gsap.to(body, { height: 0, opacity: 0, duration: 0.35, ease: 'power2.inOut', onComplete: function () { d.open = false; gsap.set(body, { clearProps: 'height,opacity' }); refresh(); } });
  }
  function refresh() { if (hasST) ScrollTrigger.refresh(); }
  all('details.fold > summary').forEach(function (s) {
    s.addEventListener('click', function (e) {
      e.preventDefault();
      var d = s.parentNode;
      if (d.open) closeFold(d); else openFold(d);
    });
  });

  /* 아키텍처 노드, "자세히 보기" 링크, 되돌아가기 */
  var smooth = reduce ? 'auto' : 'smooth';
  function icon(name) { return '<svg class="ic" aria-hidden="true"><use href="#ph-' + name + '"/></svg>'; }

  // 문제 해결의 탭에서 링크를 타고 왔을 때만, 도착한 곳에 그 탭으로 돌아가는 버튼을 단다
  function addBack(target, from) {
    var panel = from.closest('[role="tabpanel"]'), item = from.closest('.case');
    if (!panel || !item) return;
    var tab = document.getElementById(panel.getAttribute('aria-labelledby'));
    var host = target.querySelector('.arch figcaption') || target.querySelector('.fold__in');
    if (!tab || !host) return;
    all('.backlink').forEach(function (b) { b.remove(); });
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'backlink';
    btn.innerHTML = icon('arrow-left') + '<span>' + item.querySelector('h3').textContent + ' · ' + tab.querySelector('span').textContent + ' 탭으로 되돌아가기</span>';
    btn.addEventListener('click', function () {
      tab.click();
      btn.remove();
      item.scrollIntoView({ behavior: smooth, block: 'start' });
      tab.focus({ preventScroll: true });
    });
    if (host.tagName === 'FIGCAPTION') host.appendChild(btn); else host.insertBefore(btn, host.firstChild);
  }

  function goTo(id, from) {
    var t = document.getElementById(id);
    if (!t) return;
    if (t.tagName === 'DETAILS') openFold(t, true);
    if (from) addBack(t, from);
    // 펼친 뒤의 길이를 먼저 반영하고 나서 움직인다. 이동 중에 refresh가 끼어들면 부드러운 스크롤이 중간에 끊긴다
    refresh();
    var fig = t.querySelector('.arch');
    if (fig) fig.scrollIntoView({ behavior: smooth, block: 'center' });   // 그림은 화면 가운데에 놓는다
    else t.scrollIntoView({ behavior: smooth, block: 'start' });
    var f = t.tagName === 'DETAILS' ? t.querySelector('summary') : null;
    if (f) f.focus({ preventScroll: true });
  }
  all('.arch-node').forEach(function (g) {
    g.addEventListener('click', function () { goTo(g.dataset.target); });
    g.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goTo(g.dataset.target); }
    });
  });
  all('a[data-open]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); goTo(a.dataset.open, a); });
  });
  // 접으면 되돌아가기 버튼도 치운다
  all('details.dd').forEach(function (d) {
    d.addEventListener('toggle', function () { if (!d.open) all('.backlink', d).forEach(function (b) { b.remove(); }); });
  });
})();
