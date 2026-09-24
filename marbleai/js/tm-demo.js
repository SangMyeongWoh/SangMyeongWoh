/* 똑같은 문장 찾기 데모 (자세히 보기 > Translation Memory와 few-shot 선정)
   다른 데모와 같은 방식: 단계 경계의 화면 상태를 미리 정해 두고,
   각 단계는 "이전 상태를 그린 뒤 → 다음 상태로 가는 타임라인"으로 만든다. */
(function () {
  var root = document.getElementById('tm-demo');
  var D = window.TM_SAMPLES;
  if (!root || !D) return;

  var hasGsap = typeof window.gsap !== 'undefined';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var instant = reduce || !hasGsap;
  var host = root.closest('details');
  var N = 5;   // 정규화 · 문장 비교 · 태그 비교 · 기존 번역문 확인 · 결과

  function $(s) { return root.querySelector(s); }
  function $$(s) { return [].slice.call(root.querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function icon(name, cls) { return '<svg class="ic ' + (cls || '') + '" aria-hidden="true"><use href="#ph-' + name + '"/></svg>'; }

  var el = { rows: $('.tmdemo__rows'), out: $('.tmdemo__out'), log: $('.rdemo__log'), tabs: $('.demo__tabs'), steps: $$('.rdemo__steps li'), btn: {} };
  $$('[data-act]').forEach(function (b) { el.btn[b.dataset.act] = b; });
  var items = {};
  $$('.demo__checks li').forEach(function (li) {
    items[li.dataset.check] = li;
    li.querySelector('.ck').innerHTML = '<i></i>' + icon('check', 'ck-pass') + icon('x', 'ck-fail');
  });

  var samples = D.samples, idx = 0, S, facts;
  var p = 0, tl = null, playing = false, once = false, touched = false, speed = 1;

  /* ── 샘플에서 판정을 계산한다 ── */
  function tagsOf(row) { return row.filter(function (x) { return x.tag; }); }
  function analyze(s) {
    var inT = tagsOf(s.input), srcT = tagsOf(s.src), tgtT = tagsOf(s.tgt), val = {};
    inT.forEach(function (t) { val[t.key] = t.tag; });
    var sameValues = srcT.every(function (t) { return val[t.key] === t.tag; });
    var missing = srcT.filter(function (t) { return !tgtT.some(function (u) { return u.key === t.key; }); }).map(function (t) { return t.key; });
    return {
      hasTags: srcT.length > 0, sameValues: sameValues, missing: missing, ok: missing.length === 0, val: val,
      tagLabel: !srcT.length ? '태그 없음' : (sameValues ? '태그 값 일치' : '태그 값만 다름'),
      out: s.tgt.map(function (x) { return x.tag ? { tag: val[x.key] || x.tag, key: x.key, swapped: val[x.key] !== x.tag } : x; })
    };
  }

  /* ── 그리기 ── */
  function seg(x, k, row) {
    if (typeof x === 'string') return '<span class="tt' + (k >= 2 && row !== 'tgt' ? ' is-same' : '') + '">' + esc(x) + '</span>';
    if (x.drop) return '<span class="tt is-drop' + (k >= 1 ? ' is-gone' : '') + '">' + esc(x.text).replace(/ /g, '&nbsp;') + '</span>';
    var cls = 'tt is-tag';
    if (row !== 'tgt' && k >= 3) cls += facts.sameValues ? ' is-ok' : ' is-diff';
    if (k >= 4) {
      if (row === 'src' && facts.missing.indexOf(x.key) >= 0) cls += ' is-bad';
      if (row === 'tgt') cls += ' is-ok';
    }
    if (k < 1) cls = 'tt is-rawtag';
    return '<span class="' + cls + '" data-key="' + x.key + '">' + esc(x.tag) + '</span>';
  }
  function rowHtml(name, label, arr, k) {
    return '<div class="tmdemo__row" data-row="' + name + '"><span class="tmdemo__label">' + label + '</span><span class="tmdemo__text">' +
      arr.map(function (x) { return seg(x, k, name); }).join('') + '</span></div>';
  }
  function checkState(k) {
    return {
      sentence: k >= 2 ? 'pass' : 'idle',
      tags: k >= 3 ? 'pass' : 'idle',
      target: k >= 4 ? (facts.ok ? 'pass' : 'fail') : 'idle'
    };
  }
  function setChecks(c, k) {
    Object.keys(items).forEach(function (key) { items[key].dataset.res = c[key]; });
    items.tags.querySelector('.ck__t').textContent = k >= 3 ? facts.tagLabel : '태그';
  }
  function outHtml() {
    if (!facts.ok) {
      // 정답지(기존 번역)가 잘못된 경우: 무엇이 빠졌는지와, 그래서 어디로 보내는지를 같이 보여 준다
      var lost = tagsOf(S.src).filter(function (x) { return facts.missing.indexOf(x.key) >= 0; })
        .map(function (x) { return '<span class="tt is-tag is-bad">' + esc(x.tag) + '</span>'; }).join('');
      return '<span class="tmdemo__label">기존 번역에 없는 태그</span><span class="tmdemo__text">' + lost + '</span>' +
             '<span class="tmdemo__badge is-fail">' + icon('x') + '쓰지 않고 LLM 번역으로</span>';
    }
    return '<span class="tmdemo__label">출력</span><span class="tmdemo__text">' +
      facts.out.map(function (x) { return typeof x === 'string' ? '<span class="tt">' + esc(x) + '</span>' : '<span class="tt is-tag' + (x.swapped ? ' is-swapped' : ' is-ok') + '">' + esc(x.tag) + '</span>'; }).join('') +
      '</span><span class="tmdemo__badge">' + icon('check') + '번역 파이프라인 없이 출력</span>';
  }
  function setSteps(k) {
    el.steps.forEach(function (li, d) {
      li.classList.toggle('is-on', d < k);
      li.classList.toggle('is-pass', d === N - 1 && k >= N && facts.ok);
      li.classList.toggle('is-fail', d === N - 1 && k >= N && !facts.ok);
      var b = li.querySelector('button');
      if (d === k - 1) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
  }
  function render(k) {
    if (hasGsap) gsap.set([el.out, el.log], { clearProps: 'all' });
    el.rows.innerHTML = rowHtml('input', '번역할 문장', S.input, k) + rowHtml('src', '기존 원문', S.src, k) + rowHtml('tgt', '기존 번역', S.tgt, k);
    setChecks(checkState(k), k);
    el.out.innerHTML = k >= N ? outHtml() : '';
    el.out.classList.toggle('is-on', k >= N);
    el.out.classList.toggle('is-miss', k >= N && !facts.ok);
    el.log.textContent = S.logs[k];
    setSteps(k);
  }

  /* ── 단계 애니메이션 ── */
  function logSwap(t, text) {
    t.to(el.log, { opacity: 0, duration: 0.15, ease: 'power1.inOut' }, 0)
     .call(function () { el.log.textContent = text; }, null, 0.15)
     .fromTo(el.log, { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out', immediateRender: false }, 0.15);
  }
  function judge(t, key, res, at) {
    var li = items[key];
    t.call(function () { li.dataset.res = 'spin'; }, null, at);
    t.fromTo(li.querySelector('.ck i'), { rotation: 0 }, { rotation: 180, duration: 0.25, ease: 'none', immediateRender: false }, at);
    t.call(function () { li.dataset.res = res; if (key === 'tags') li.querySelector('.ck__t').textContent = facts.tagLabel; }, null, at + 0.25);
    t.fromTo(li.querySelector(res === 'pass' ? '.ck-pass' : '.ck-fail'), { scale: 0 }, { scale: 1, duration: 0.3, ease: 'back.out(2.4)', immediateRender: false }, at + 0.25);
    if (res === 'fail') t.fromTo(li, { x: -3 }, { x: 3, duration: 0.05, repeat: 5, yoyo: true, ease: 'none', immediateRender: false, clearProps: 'x' }, at + 0.25);
  }
  function addClassSeq(t, els, cls, at, gap) {
    els.forEach(function (e, i) { t.call(function () { e.classList.add(cls); }, null, at + i * gap); });
    return at + els.length * gap;
  }
  var build = [
    null,
    function normalize(t) {          // 무시할 글자는 접히고, 태그는 칩이 된다
      var drops = $$('.tt.is-drop'), raws = $$('.tt.is-rawtag');
      if (drops.length) t.to(drops, { scaleX: 0, opacity: 0, width: 0, transformOrigin: 'left center', duration: 0.4, ease: 'power2.in' }, 0.35);
      raws.forEach(function (e, i) {
        t.call(function () { e.className = 'tt is-tag'; }, null, 0.35 + i * 0.07);
        t.fromTo(e, { scale: 0.8 }, { scale: 1, duration: 0.35, ease: 'back.out(2.4)', immediateRender: false }, 0.35 + i * 0.07);
      });
      t.to({}, { duration: 0.8 }, 0.75 + raws.length * 0.07);
    },
    function sentence(t) {           // 태그를 뺀 글자를 두 줄에서 나란히 짚는다
      var a = $$('[data-row="input"] .tt:not(.is-tag):not(.is-drop)'), b = $$('[data-row="src"] .tt:not(.is-tag):not(.is-drop)');
      var end = 0.3;
      for (var i = 0; i < Math.max(a.length, b.length); i++) {
        (function (x, y, at) { t.call(function () { if (x) x.classList.add('is-same'); if (y) y.classList.add('is-same'); }, null, at); })(a[i], b[i], 0.3 + i * 0.3);
        end = 0.3 + i * 0.3;
      }
      judge(t, 'sentence', 'pass', end + 0.35);
      t.to({}, { duration: 0.7 }, end + 0.95);
    },
    function tags(t) {               // 같은 자리의 태그끼리 값을 비교한다
      var keys = tagsOf(S.src).map(function (x) { return x.key; }), at = 0.3;
      keys.forEach(function (key, i) {
        var els = $$('[data-row="input"] [data-key="' + key + '"], [data-row="src"] [data-key="' + key + '"]');
        t.call(function () { els.forEach(function (e) { e.classList.add('is-cmp'); }); }, null, at + i * 0.4);
        t.call(function () { els.forEach(function (e) { e.classList.remove('is-cmp'); e.classList.add(facts.sameValues ? 'is-ok' : 'is-diff'); }); }, null, at + i * 0.4 + 0.28);
      });
      at += keys.length * 0.4;
      judge(t, 'tags', 'pass', at + 0.1);
      t.to({}, { duration: 0.8 }, at + 0.7);
    },
    function target(t) {             // 기존 원문의 태그가 기존 번역문에도 다 있는지 본다
      var at = 0.3;
      tagsOf(S.src).forEach(function (x, i) {
        var src = $('[data-row="src"] [data-key="' + x.key + '"]'), tg = $('[data-row="tgt"] [data-key="' + x.key + '"]');
        t.call(function () { src.classList.add('is-cmp'); if (tg) tg.classList.add('is-cmp'); }, null, at + i * 0.4);
        t.call(function () {
          src.classList.remove('is-cmp');
          if (tg) { tg.classList.remove('is-cmp'); tg.classList.add('is-ok'); } else { src.classList.remove('is-ok', 'is-diff'); src.classList.add('is-bad'); }
        }, null, at + i * 0.4 + 0.28);
      });
      at += tagsOf(S.src).length * 0.4;
      judge(t, 'target', facts.ok ? 'pass' : 'fail', at + 0.1);
      t.to({}, { duration: facts.ok ? 0.8 : 1.2 }, at + 0.7);
    },
    function result(t) {
      t.call(function () {
        el.out.innerHTML = outHtml(); el.out.classList.add('is-on'); el.out.classList.toggle('is-miss', !facts.ok);
        // 값이 바뀌는 태그는 기존 값에서 새 값으로 뒤집힌다
        $$('.tmdemo__out .is-swapped').forEach(function (e, i) {
          var now = e.textContent, key = facts.out.filter(function (x) { return x.swapped; })[i].key;
          var old = tagsOf(S.tgt).filter(function (x) { return x.key === key; })[0].tag;
          e.textContent = old;
          t.add(gsap.timeline().to(e, { scaleY: 0, duration: 0.2, ease: 'power2.in', delay: 0.5 + i * 0.25 })
            .call(function () { e.textContent = now; }).to(e, { scaleY: 1, duration: 0.3, ease: 'back.out(2)' }), t.time());
        });
      }, null, 0.3);
      t.fromTo(el.out, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out', immediateRender: false }, 0.3);
      t.call(function () { setSteps(N); }, null, 0.5);
      t.to({}, { duration: 1.9 }, 0.5);
    }
  ];

  /* ── 재생 제어 ── */
  function kill() { if (tl) { tl.kill(); tl = null; } }
  function sync() {
    var b = el.btn, label = playing ? '정지' : (p >= N ? '다시 재생' : '재생');
    b.toggle.querySelector('span').textContent = label; b.toggle.setAttribute('aria-label', label);
    b.toggle.classList.toggle('is-playing', playing);
    b.prev.disabled = !tl && p <= 0; b.next.disabled = !tl && p >= N;
  }
  function setPlaying(v) { playing = v; sync(); }
  function show(k) { kill(); p = Math.max(0, Math.min(N, k)); render(p); setPlaying(false); }
  function playStage(i) {
    kill(); p = i - 1; render(p);
    tl = gsap.timeline({ onComplete: function () {
      tl = null; p = i; render(i);
      if (once || !playing || i >= N) { once = false; setPlaying(false); return; }
      playStage(i + 1);
    } });
    tl.timeScale(speed);
    logSwap(tl, S.logs[i]);
    tl.call(function () { setSteps(i); el.steps[N - 1].classList.remove('is-pass', 'is-fail'); }, null, 0);
    build[i](tl);
    sync();
  }
  function start() { once = false; playing = true; playStage(1); }
  function load(i) {
    kill(); idx = (i + samples.length) % samples.length; S = samples[idx]; facts = analyze(S);
    [].forEach.call(el.tabs.children, function (b, k) { b.setAttribute('aria-pressed', k === idx ? 'true' : 'false'); });
    p = 0; render(0); sync();
  }

  samples.forEach(function (s, k) {
    var t = document.createElement('button');
    t.type = 'button'; t.textContent = s.title; t.setAttribute('aria-pressed', 'false');
    t.addEventListener('click', function () { touched = true; load(k); if (instant) show(N); else start(); });
    el.tabs.appendChild(t);
  });
  el.btn.toggle.addEventListener('click', function () {
    touched = true;
    if (tl) { if (tl.paused()) { once = false; tl.play(); setPlaying(true); } else { tl.pause(); setPlaying(false); } return; }
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
    speed = speed === 1 ? 2 : 1; el.btn.speed.textContent = speed + 'x';
    if (tl) tl.timeScale(speed);
  });

  load(0);
  if (instant) { root.classList.add('is-static'); show(N); return; }
  // 접힌 항목 안에 있으므로, 펼쳐질 때 재생을 시작하고 접히면 처음으로 되돌린다
  if (host) {
    host.addEventListener('toggle', function () {
      if (!host.open) { load(0); touched = false; return; }
      gsap.delayedCall(0.7, function () { if (host.open && !touched && !tl && p === 0) start(); });
    });
    if (host.open) start();
  } else { start(); }
})();
