/* 태그 규칙 데모 (딥다이브 > 게임별 전처리)
   pipeline-demo.js와 같은 방식: 단계 경계의 화면 상태를 미리 계산하고,
   각 단계는 "이전 상태를 그린 뒤 → 다음 상태로 가는 타임라인"으로 만든다. */
(function () {
  var root = document.getElementById('rules-demo');
  var D = window.RULES_SAMPLE;
  if (!root || !D) return;

  var hasGsap = typeof window.gsap !== 'undefined';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var instant = reduce || !hasGsap;
  var host = root.closest('details');

  function $(s) { return root.querySelector(s); }
  function $$(s) { return [].slice.call(root.querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function codeHtml(s) { return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>'); }

  var el = {
    rows: $('.rdemo__rows'), win: $('.rdemo__win'), table: $('.rdemo__table'),
    regex: $('.rdemo__regex'), list: $('.rdemo__list'), card: $('.rdemo__rules'),
    desc: $('.rdemo__desc'), descText: $('.rdemo__desctext'), log: $('.rdemo__log'),
    steps: $$('.rdemo__steps li'), btn: {}
  };
  $$('[data-act]').forEach(function (b) { el.btn[b.dataset.act] = b; });

  /* ── 후보와 규칙 ───────────────────────────────────── */
  var cands = {}, order = [];
  D.rows.forEach(function (r, ri) {
    r.ko.forEach(function (s) { if (s.id) { cands[s.id] = { id: s.id, text: s.text, row: ri }; order.push(s.id); } });
    r.en.forEach(function (s) { if (s.of) cands[s.of].en = s.text; });
  });
  order.forEach(function (id) { cands[id].isTag = cands[id].text === cands[id].en; });

  var rulesV1 = D.rules;
  var REV = D.revise.regex, ADD = D.revise.listAdd || [];
  var rulesV2 = {
    regex: D.rules.regex.map(function (r) { return r.id === REV.id ? { id: r.id, src: REV.src, fresh: true } : r; }),
    list: D.rules.list.concat(ADD.map(function (l) { return { id: l.id, text: l.text, fresh: true }; }))
  };
  function caught(c, rules) {
    return rules.regex.some(function (r) { return new RegExp('^(?:' + r.src + ')$').test(c.text); }) ||
           rules.list.some(function (l) { return l.text === c.text; });
  }
  // 규칙이 태그는 잡고 텍스트는 안 잡아야 통과
  function marksFor(rules) {
    var m = {};
    order.forEach(function (id) { m[id] = caught(cands[id], rules) === cands[id].isTag ? 'ok' : 'bad'; });
    return m;
  }

  var N = 6;
  var states = [
    { cand: 'none',   rules: null,    marks: null,             desc: '',   saved: false },
    { cand: 'found',  rules: null,    marks: null,             desc: '',   saved: false },
    { cand: 'judged', rules: null,    marks: null,             desc: '',   saved: false },
    { cand: 'judged', rules: rulesV1, marks: null,             desc: '',   saved: false },
    { cand: 'judged', rules: rulesV1, marks: marksFor(rulesV1), desc: 'on', saved: false },
    { cand: 'judged', rules: rulesV2, marks: null,             desc: 'dim', saved: false },
    { cand: 'judged', rules: rulesV2, marks: marksFor(rulesV2), desc: 'dim', saved: true }
  ];
  states.forEach(function (s, k) { s.k = k; s.log = D.logs[k]; });

  /* ── 그리기 ────────────────────────────────────────── */
  function segHtml(seg, s, side) {
    if (typeof seg === 'string') return esc(seg);
    var id = seg.id || seg.of, c = cands[id], cls = 'rc';
    if (s.cand === 'found' && side === 'ko') cls += ' is-cand';
    if (s.cand === 'judged') cls += c.isTag ? ' is-tag' : ' is-text';
    if (s.marks) cls += ' is-' + s.marks[id];
    return '<span class="' + cls + '" data-' + (side === 'ko' ? 'id' : 'of') + '="' + id + '">' + esc(seg.text) + '</span>';
  }
  function ruleHtml(r) {
    return '<li data-rule="' + r.id + '"' + (r.fresh ? ' class="is-new"' : '') + '><code>' + esc(r.src || r.text) + '</code></li>';
  }
  function setSteps(k, fail) {
    el.steps.forEach(function (li, d) {
      li.classList.toggle('is-on', d < k);
      li.classList.toggle('is-fail', d === 3 && (k === 4 || k === 5) && fail !== false);   // 고쳐서 통과한 뒤에는 지운다
      li.classList.toggle('is-pass', d === 5 && k >= 6);
      var b = li.querySelector('button');
      if (d === k - 1) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
  }
  function render(s) {
    if (hasGsap) gsap.set([el.win, el.desc, el.log, el.card], { clearProps: 'all' });
    el.rows.innerHTML = D.rows.map(function (r) {
      return '<div class="rdemo__row"><div class="rdemo__cell" lang="ko">' + r.ko.map(function (x) { return segHtml(x, s, 'ko'); }).join('') +
             '</div><div class="rdemo__cell" lang="en">' + r.en.map(function (x) { return segHtml(x, s, 'en'); }).join('') + '</div></div>';
    }).join('');
    el.regex.innerHTML = s.rules ? s.rules.regex.map(ruleHtml).join('') : '';
    el.list.innerHTML = s.rules ? s.rules.list.map(ruleHtml).join('') : '';
    el.card.classList.toggle('is-empty', !s.rules);
    el.card.classList.toggle('is-saved', s.saved);
    el.desc.hidden = !s.desc;
    el.desc.classList.toggle('is-dim', s.desc === 'dim');
    el.descText.innerHTML = codeHtml(D.desc);
    el.log.textContent = s.log;
    setSteps(s.k);
  }

  /* ── 단계 애니메이션 ───────────────────────────────── */
  var p = 0, tl = null, playing = false, once = false, touched = false, speed = 1;

  function logSwap(t, text) {
    t.to(el.log, { opacity: 0, duration: 0.15, ease: 'power1.inOut' }, 0)
     .call(function () { el.log.textContent = text; }, null, 0.15)
     .fromTo(el.log, { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out', immediateRender: false }, 0.15);
  }
  function pair(id) { return $$('[data-id="' + id + '"], [data-of="' + id + '"]'); }

  // 창이 후보가 든 행을 세 줄씩 묶어 끝까지 지나간다. 창에 들어온 후보마다 판정 표시가 붙는다
  function sweep(t, at, marks, hold) {
    var rows = $$('.rdemo__row'), size = Math.min(3, rows.length), done = {};
    function geom(i) {
      var a = rows[i], b = rows[i + size - 1];
      return { y: a.offsetTop, height: b.offsetTop + b.offsetHeight - a.offsetTop };
    }
    function markRows(i) {
      order.forEach(function (id) {
        var c = cands[id];
        if (done[id] || c.row < i || c.row >= i + size) return;
        done[id] = 1;
        pair(id).forEach(function (e) { e.classList.add('is-' + marks[id]); });
      });
    }
    var g0 = geom(0);
    t.set(el.win, { y: g0.y, height: g0.height, opacity: 0 }, at);
    t.to(el.win, { opacity: 1, duration: 0.25, ease: 'power1.inOut' }, at);
    t.call(markRows, [0], at + 0.2);
    var cur = at + 0.25 + hold;
    for (var i = 1; i + size <= rows.length; i++) {
      var g = geom(i);
      t.to(el.win, { y: g.y, height: g.height, duration: 0.4, ease: 'power2.inOut' }, cur);
      t.call(markRows, [i], cur + 0.3);
      cur += 0.4 + hold;
    }
    t.to(el.win, { opacity: 0, duration: 0.25, ease: 'power1.inOut' }, cur);
    return cur + 0.25;
  }

  var build = [
    null,
    function found(t) {
      var chips = $$('[data-id]');
      chips.forEach(function (c, i) {
        t.call(function () { c.classList.add('is-cand'); }, null, 0.3 + i * 0.09);
        t.fromTo(c, { scale: 0.8 }, { scale: 1, duration: 0.35, ease: 'back.out(2.4)', immediateRender: false }, 0.3 + i * 0.09);
      });
      t.to({}, { duration: 0.7 }, 0.3 + chips.length * 0.09);
    },
    function judged(t) {
      order.forEach(function (id, i) {
        var at = 0.3 + i * 0.3, els = pair(id), c = cands[id];
        t.call(function () { els.forEach(function (e) { e.classList.add('is-cmp'); }); }, null, at);
        t.call(function () {
          els.forEach(function (e) { e.classList.remove('is-cmp', 'is-cand'); e.classList.add(c.isTag ? 'is-tag' : 'is-text'); });
        }, null, at + 0.24);
      });
      t.to({}, { duration: 0.8 }, 0.3 + order.length * 0.3);
    },
    function written(t) {
      t.call(function () {
        el.card.classList.remove('is-empty');
        el.regex.innerHTML = rulesV1.regex.map(ruleHtml).join('');
        el.list.innerHTML = rulesV1.list.map(ruleHtml).join('');
        gsap.set($$('.rdemo__rules li'), { opacity: 0, x: -10 });
      }, null, 0.3);
      t.call(function () {
        t.add(gsap.to($$('.rdemo__rules li'), { opacity: 1, x: 0, duration: 0.4, stagger: 0.16, ease: 'power3.out' }), t.time());
      }, null, 0.32);
      t.to({}, { duration: 0.4 + 5 * 0.16 + 0.8 }, 0.32);
    },
    function verify(t) {
      var end = sweep(t, 0.3, states[4].marks, 0.45);
      t.call(function () { setSteps(4, true); el.desc.hidden = false; el.desc.classList.remove('is-dim'); }, null, end);
      t.fromTo(el.desc, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out', immediateRender: false }, end);
      t.call(function () {
        t.add(gsap.fromTo($$('.rc.is-bad'), { x: -3 }, { x: 3, duration: 0.05, repeat: 5, yoyo: true, ease: 'none', clearProps: 'x' }), t.time());
      }, null, end + 0.1);
      t.to({}, { duration: 1.8 }, end + 0.45);
    },
    function revise(t) {
      t.call(function () {
        $$('.rc').forEach(function (e) { e.classList.remove('is-ok', 'is-bad'); });
        var li = $('[data-rule="' + REV.id + '"]');
        li.classList.add('is-bad');
      }, null, 0.35);
      t.call(function () {
        var li = $('[data-rule="' + REV.id + '"]');
        t.add(gsap.to(li, { scaleX: 0, opacity: 0, transformOrigin: 'left center', duration: 0.25, ease: 'power2.in' }), t.time());
      }, null, 1.0);
      t.call(function () {
        var li = $('[data-rule="' + REV.id + '"]');
        li.querySelector('code').textContent = REV.src;
        li.classList.remove('is-bad'); li.classList.add('is-new');
        t.add(gsap.to(li, { scaleX: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.6)' }), t.time());
      }, null, 1.3);
      // 정규식으로 묶이지 않는 대괄호 태그는 목록에 낱개로 들어간다
      t.call(function () {
        el.list.innerHTML = rulesV2.list.map(ruleHtml).join('');
        var added = ADD.map(function (l) { return $('[data-rule="' + l.id + '"]'); });
        t.add(gsap.fromTo(added, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.45, stagger: 0.15, ease: 'power3.out' }), t.time());
        el.desc.classList.add('is-dim');
      }, null, 2.0);
      t.to({}, { duration: 1.4 }, 2.0);
    },
    function recheck(t) {
      var end = sweep(t, 0.3, states[6].marks, 0.2);
      t.call(function () { el.card.classList.add('is-saved'); setSteps(6); }, null, end);
      t.to({}, { duration: 1.0 }, end);
    }
  ];

  /* ── 재생 제어 ─────────────────────────────────────── */
  function kill() { if (tl) { tl.kill(); tl = null; } }
  function sync() {
    var b = el.btn, label = playing ? '정지' : (p >= N ? '다시 재생' : '재생');
    b.toggle.querySelector('span').textContent = label;
    b.toggle.setAttribute('aria-label', label);
    b.toggle.classList.toggle('is-playing', playing);
    b.prev.disabled = !tl && p <= 0;
    b.next.disabled = !tl && p >= N;
  }
  function setPlaying(v) { playing = v; sync(); }
  function show(k) { kill(); p = Math.max(0, Math.min(N, k)); render(states[p]); setPlaying(false); }
  function playStage(i) {
    kill();
    p = i - 1; render(states[p]);
    tl = gsap.timeline({
      onComplete: function () {
        tl = null; p = i; render(states[i]);
        if (once || !playing || i >= N) { once = false; setPlaying(false); return; }
        playStage(i + 1);
      }
    });
    tl.timeScale(speed);
    logSwap(tl, states[i].log);
    tl.call(function () { setSteps(i, false); }, null, 0);
    build[i](tl);
    sync();
  }
  function start() { once = false; playing = true; playStage(1); }

  el.btn.toggle.addEventListener('click', function () {
    touched = true;
    if (tl) {
      if (tl.paused()) { once = false; tl.play(); setPlaying(true); } else { tl.pause(); setPlaying(false); }
      return;
    }
    if (p >= N) { start(); return; }
    once = false; playing = true; playStage(p + 1);
  });
  el.btn.next.addEventListener('click', function () {
    touched = true;
    if (instant || tl) { show(p + 1); return; }
    if (p < N) { once = true; playing = true; playStage(p + 1); }
  });
  el.btn.prev.addEventListener('click', function () { touched = true; show(tl ? p : p - 1); });
  el.steps.forEach(function (li, d) {
    li.querySelector('button').addEventListener('click', function () {
      touched = true;
      if (instant) { show(d + 1); return; }
      once = true; playing = true; playStage(d + 1);
    });
  });
  el.btn.speed.addEventListener('click', function () {
    speed = speed === 1 ? 2 : 1;
    el.btn.speed.textContent = speed + 'x';
    if (tl) tl.timeScale(speed);
  });

  if (instant) { root.classList.add('is-static'); show(N); return; }
  show(0);
  // 접힌 항목 안에 있으므로, 펼쳐질 때 재생을 시작하고 접히면 처음으로 되돌린다
  if (host) {
    host.addEventListener('toggle', function () {
      if (!host.open) { show(0); touched = false; return; }
      gsap.delayedCall(0.7, function () { if (host.open && !touched && !tl && p === 0) start(); });
    });
    if (host.open) start();
  } else {
    start();
  }
})();
