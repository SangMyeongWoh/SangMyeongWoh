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
  function navTarget(a) {
    var section = document.querySelector(a.getAttribute('href'));
    if (!section) return null;
    return (a.dataset.scrollTarget && document.querySelector(a.dataset.scrollTarget))
      || section.querySelector('.case__head, .shell') || section;
  }
  all('.rail a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var href = a.getAttribute('href');
      var target = navTarget(a);
      if (!target) return;
      e.preventDefault();
      history.pushState(null, '', href);
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });
  function updateNav() {
    var line = Math.min(window.innerHeight * .35, 180);
    ['.nav__links a', '.rail a'].forEach(function (selector) {
      var group = all(selector), active = group[0];
      group.forEach(function (a) {
        var target = navTarget(a);
        if (target && target.getBoundingClientRect().top <= line) active = a;
      });
      group.forEach(function (a) { a.classList.toggle('on', a === active); });
    });
  }
  var navPending = false;
  function scheduleNav() {
    if (navPending) return;
    navPending = true;
    requestAnimationFrame(function () { navPending = false; updateNav(); });
  }
  window.addEventListener('scroll', scheduleNav, { passive: true });
  window.addEventListener('resize', scheduleNav);
  window.addEventListener('load', scheduleNav);
  window.addEventListener('popstate', scheduleNav);
  if ('ResizeObserver' in window) new ResizeObserver(scheduleNav).observe(document.body);
  scheduleNav();

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

  // 본문에서 상세 링크를 타고 왔을 때, 원래 위치로 돌아가는 버튼을 단다
  function addBack(target, from) {
    var panel = from.closest('[role="tabpanel"]'), item = from.closest('.case');
    var overview = from.closest('.overview');
    if (!item && !overview) return;
    var topic = from.closest('.gen1__topic'), step = from.closest('.gen1__step');
    var tab = panel && document.getElementById(panel.getAttribute('aria-labelledby'));   // 탭이 없는 항목도 있다
    var host = target.querySelector('.arch:not(.flowfig) figcaption') || target.querySelector('.fold__in');   // 흐름도 그림은 되돌아가기 버튼의 자리가 아니다
    if (!host) return;
    all('.backlink').forEach(function (b) { b.remove(); });
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'backlink';
    var name = topic ? topic.querySelector('h3').textContent : item ? item.querySelector('.case__title').textContent : overview.querySelector('h2').textContent;
    var stepName = step ? step.querySelector('h4').textContent.trim().replace(/^[PA]\s*/, '') : '';
    var returnLabel = tab ? name + ' · ' + tab.querySelector('span').textContent : step ? name + ' · ' + stepName : name + ' · ' + from.textContent.trim();
    btn.innerHTML = icon('arrow-left') + '<span>' + returnLabel + '으로 돌아가기</span>';
    btn.addEventListener('click', function () {
      if (tab) tab.click();
      btn.remove();
      from.scrollIntoView({ behavior: smooth, block: 'center' });
      from.focus({ preventScroll: true });
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
    var fig = t.querySelector('.arch:not(.flowfig)');
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
