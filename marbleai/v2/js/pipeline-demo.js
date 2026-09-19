/* 파이프라인 데모
   단계 경계마다의 화면 상태(states[k])를 데이터에서 미리 계산해 두고,
   각 단계 애니메이션은 "states[k-1]을 그린 뒤 → states[k]로 가는 타임라인"으로 만든다.
   어느 단계로 점프해도 render(states[k])부터 시작하므로 DOM이 어긋나지 않는다. */
(function () {
  var root = document.getElementById('pipeline');
  if (!root) return;

  var hasGsap = typeof window.gsap !== 'undefined' && typeof window.Flip !== 'undefined';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var instant = reduce || !hasGsap;

  function $(s) { return root.querySelector(s); }
  function $$(s) { return [].slice.call(root.querySelectorAll(s)); }
  function icon(name, cls) { return '<svg class="ic ' + (cls || '') + '" aria-hidden="true"><use href="#ph-' + name + '"/></svg>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // 데이터의 ⟦T1⟧ 표기는 화면에서 칩으로 그린다. 글꼴에 없는 괄호 글리프에 기대지 않는다
  function chip(s) { return s.replace(/[⟦⟧]/g, ''); }
  function logHtml(s) { return esc(s).replace(/⟦([^⟧]+)⟧/g, '<code>$1</code>'); }

  var el = {
    toks: $('.demo__toks'), stage: $('.demo__stage'), scan: $('.demo__scan'),
    card: $('.demo__card'), dots: $('.demo__dots'), checks: $('.demo__checks'),
    log: $('.demo__log'), logText: $('.demo__logtext'), meta: $('.demo__meta'),
    src: $('.demo__src'), tgt: $('.demo__tgt'), tabs: $('.demo__tabs'),
    loop: $('.demo__loop'), steps: $$('.demo__steps li[data-stage]'), work: $('.demo__work'),
    btn: {}
  };
  $$('[data-act]').forEach(function (b) { el.btn[b.dataset.act] = b; });
  var items = {};
  $$('.demo__checks li').forEach(function (li) {
    items[li.dataset.check] = li;
    li.querySelector('.ck').innerHTML = '<i></i>' + icon('check', 'ck-pass') + icon('x', 'ck-fail');
  });
  var CHECK_KEYS = ['tags', 'vars', 'glossary'];
  var SLOT_TEXT = '​';

  var samples = [], sampleIdx = 0, sample, states, n, orig;
  var p = 0;            // 끝난 단계 수. 화면은 states[p]
  var tl = null, wait = null;
  var playing = false, once = false, touched = false, speed = 1, autoCount = 0;

  /* ── 상태 계산 ─────────────────────────────────────── */
  function dotsOf(i) {
    var st = sample.stages[i];
    if (st.name === 'mask') return [0];
    if (st.name === 'glossary') return [1];
    if (st.name === 'translate') return [2];
    if (st.name === 'reflect') return [4];
    if (!st.final) return [3];
    var reflected = sample.stages.slice(0, i).some(function (s) { return s.name === 'reflect'; });
    return reflected ? [5] : [3, 5];
  }
  function stageOfDot(d) {
    for (var i = 0; i < n; i++) if (dotsOf(i).indexOf(d) >= 0) return i + 1;
    return 0;
  }
  function clone(s) { return JSON.parse(JSON.stringify(s)); }
  function cardOf(st) {
    if (st.name === 'glossary' && st.hits && st.hits.length) return { a: st.hits[0].term, b: st.hits[0].target };
    if (st.lemma) return { a: st.lemma.from, b: '기본형 ' + st.lemma.to };
    return null;
  }

  function computeStates() {
    orig = {};
    sample.tokens.forEach(function (t) { orig[t.id] = t; });
    var cur = {
      toks: sample.tokens.map(function (t) { return { id: t.id, text: t.text, kind: t.kind }; }),
      checks: null, log: '원문', meta: '', lit: [0, 0, 0, 0, 0, 0], dot: -1, partial: false, round: 0, card: null
    };
    var out = [cur], loops = 0;
    sample.stages.forEach(function (st, i) {
      var s = clone(cur);
      s.log = st.log; s.card = null;
      var ds = dotsOf(i);
      ds.forEach(function (d) { s.lit[d] = 1; });
      s.dot = ds[ds.length - 1];

      if (st.name === 'mask') {
        s.toks.forEach(function (t) { if (st.masks[t.id]) { t.text = st.masks[t.id]; t.kind = 'mask'; } });
      } else if (st.name === 'glossary') {
        (st.hits || []).forEach(function (h) {
          s.toks.forEach(function (t) { if (t.id === h.token) t.term = true; });
        });
        s.card = cardOf(st);
      } else if (st.name === 'translate') {
        s.toks = st.output_tokens.map(function (o) {
          return { id: o.id, text: o.text, kind: o.kind === 'word' ? 'word' : 'mask' };
        });
      } else if (st.name === 'reflect') {
        loops++;
        (st.insert || []).forEach(function (ins) {
          s.toks.forEach(function (t) { if (t.id === ins.id) { t.kind = 'mask'; t.text = ins.text; } });
        });
        if (s.checks) s.checks.dim = true;
      } else if (st.name === 'check') {
        s.checks = { res: st.results, dim: false };
        if (!st.final) s.round++;
        (st.missing || []).forEach(function (m) {
          if (s.toks.some(function (t) { return t.id === m.id; })) return;
          var at = s.toks.findIndex(function (t) { return t.id === m.before; });
          s.toks.splice(at < 0 ? s.toks.length : at, 0, { id: m.id, text: '', kind: 'slot' });
        });
        if (st.lemma) s.card = cardOf(st);
        if (st.final) {
          s.toks.forEach(function (t) {
            if (t.kind === 'mask') { t.text = orig[t.id].text; t.kind = orig[t.id].kind; }
          });
          s.partial = st.status === 'partial';
          s.meta = '루프 ' + loops + '회';
        }
      }
      out.push(s); cur = s;
    });
    return out;
  }

  /* ── 그리기 ────────────────────────────────────────── */
  function makeTok(t) {
    var s = document.createElement('span');
    s.className = 'tok' + (t.term ? ' is-term' : '');
    s.dataset.id = t.id; s.dataset.kind = t.kind;
    s.textContent = t.kind === 'slot' ? SLOT_TEXT : chip(t.text.trim());
    return s;
  }
  // 토큰 앞뒤 공백은 요소 밖 텍스트 노드로 둔다. 줄이 바뀌는 자리에서는 공백이 접혀 들여쓰기가 생기지 않는다
  function put(parent, e, raw) {
    if (/^\s/.test(raw)) parent.appendChild(document.createTextNode(' '));
    parent.appendChild(e);
    if (/\s$/.test(raw) && raw.trim()) parent.appendChild(document.createTextNode(' '));
    return e;
  }
  function tok(id) { return el.toks.querySelector('[data-id="' + id + '"]'); }
  function allToks() { return [].slice.call(el.toks.children); }

  function setTrack(s) {
    el.steps.forEach(function (li, d) {
      li.classList.toggle('is-on', !!s.lit[d]);
      li.classList.toggle('is-partial', d === 5 && !!s.lit[5] && s.partial);
      li.classList.toggle('is-pass', d === 5 && !!s.lit[5] && !s.partial);
      var b = li.querySelector('button');
      if (s.dot === d) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    el.loop.classList.toggle('is-on', s.round >= 2);
    el.loop.textContent = s.round >= 2 ? '×' + s.round : '';
  }
  function setChecks(c) {
    el.checks.classList.toggle('is-on', !!c);
    CHECK_KEYS.forEach(function (k) {
      items[k].dataset.res = c ? c.res[k] : 'idle';
      items[k].classList.toggle('is-dim', !!(c && c.dim && c.res[k] === 'pass'));
    });
  }
  function setCard(c) {
    el.card.hidden = !c;
    el.card.innerHTML = c ? '<span>' + esc(c.a) + '</span>' + icon('arrow-right') + '<span>' + esc(c.b) + '</span>' : '';
  }
  function setLog(text, meta) { el.logText.innerHTML = logHtml(text); el.meta.textContent = meta || ''; }

  function render(s) {
    if (hasGsap) {
      gsap.set([el.toks, el.log, el.card, el.scan, el.work].concat($$('.ck i, .ck svg, .ck__t, .demo__dots i')), { clearProps: 'all' });
    }
    el.toks.innerHTML = '';
    s.toks.forEach(function (t) { put(el.toks, makeTok(t), t.text); });
    el.dots.classList.remove('is-on');
    el.stage.classList.remove('is-pass', 'is-spot');
    setChecks(s.checks); setCard(s.card); setTrack(s); setLog(s.log, s.meta);
  }

  /* ── 타임라인 조각 ─────────────────────────────────── */
  // 콜백 안에서 만든 트윈도 현재 단계 타임라인에 넣어, 정지·배속이 같이 먹게 한다
  function live(anim) { if (tl) tl.add(anim, tl.time()); return anim; }

  function logSwap(t, text) {
    t.to(el.log, { opacity: 0, duration: 0.15, ease: 'power1.inOut' }, 0)
     .call(function () { setLog(text, ''); }, null, 0.15)
     .fromTo(el.log, { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out', immediateRender: false }, 0.15);
  }
  function invQuadInOut(x) { return x < 0.5 ? Math.sqrt(x / 2) : 1 - Math.sqrt((1 - x) / 2); }

  function waitDots(t, at, latency) {
    var w = Math.max(0.6, Math.min(1.5, (latency || 1000) / 1000 * 0.6));
    var rep = Math.max(1, 2 * Math.round(w / 0.8) - 1);
    t.call(function () { el.dots.classList.add('is-on'); }, null, at);
    t.fromTo($$('.demo__dots i'), { opacity: 0.25 }, { opacity: 1, duration: 0.4, stagger: 0.13, repeat: rep, yoyo: true, ease: 'power1.inOut' }, at);
    t.call(function () { el.dots.classList.remove('is-on'); }, null, at + w);
    return at + w;
  }

  var build = {
    mask: function (t, st) {
      var masked = Object.keys(st.masks).map(tok).filter(Boolean);
      var others = allToks().filter(function (e) { return masked.indexOf(e) < 0; });
      t.to(masked, { scaleX: 0, opacity: 0, transformOrigin: 'left center', duration: 0.25, ease: 'power2.in', stagger: 0.04 }, 0.25);
      var at = 0.5 + masked.length * 0.04;
      t.call(function () {
        var state = Flip.getState(others);
        masked.forEach(function (m) { m.textContent = chip(st.masks[m.dataset.id]); m.dataset.kind = 'mask'; });
        live(Flip.from(state, { duration: 0.5, ease: 'power3.out' }));
      }, null, at);
      t.to(masked, { scaleX: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.6)', stagger: 0.05 }, at);
      t.to({}, { duration: 0.5 }, at + 0.4);
    },

    glossary: function (t, st) {
      var W = el.stage.clientWidth, at = 0.25, end = at + 0.7;
      t.set(el.scan, { opacity: 1, x: 0 }, at)
       .to(el.scan, { x: W, duration: 0.7, ease: 'power1.inOut' }, at)
       .to(el.scan, { opacity: 0, duration: 0.15, ease: 'power1.inOut' }, end);
      (st.hits || []).forEach(function (h) {
        var e = tok(h.token); if (!e) return;
        var when = at + 0.7 * invQuadInOut((e.offsetLeft + e.offsetWidth / 2) / W);
        t.call(function () { e.classList.add('is-flash'); }, null, when);
        t.fromTo(e, { '--u': 0 }, { '--u': 1, duration: 0.4, ease: 'power3.out' }, when);
      });
      t.call(function () { setCard(cardOf(st)); }, null, end);
      t.fromTo(el.card, { x: 14, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out', immediateRender: false }, end);
      t.to({}, { duration: 0.8 }, end + 0.3);
    },

    translate: function (t, st) {
      var outIds = st.output_tokens.map(function (o) { return o.id; });
      var leaving = allToks().filter(function (e) { return outIds.indexOf(e.dataset.id) < 0; });
      t.to(el.card, { opacity: 0, duration: 0.2, ease: 'power1.inOut' }, 0);
      t.to(el.toks, { opacity: 0.45, duration: 0.25, ease: 'power1.inOut' }, 0.2);
      var end = waitDots(t, 0.4, st.latency_ms);
      t.to(leaving, { opacity: 0, y: -6, duration: 0.25, stagger: 0.02, ease: 'power2.in' }, end);
      t.to(el.toks, { opacity: 1, duration: 0.2, ease: 'power1.inOut' }, end);
      var swapAt = end + 0.25 + leaving.length * 0.02;
      t.call(function () {
        setCard(null);
        var keep = {};
        allToks().forEach(function (e) { if (outIds.indexOf(e.dataset.id) >= 0) keep[e.dataset.id] = e; });
        var kept = Object.keys(keep).map(function (k) { return keep[k]; });
        var state = Flip.getState(kept);
        var frag = document.createDocumentFragment(), fresh = [], terms = [];
        st.output_tokens.forEach(function (o) {
          var e = keep[o.id];
          if (!e) { e = makeTok({ id: o.id, text: o.text, kind: 'word' }); fresh.push(e); if (o.term) terms.push(e); }
          put(frag, e, o.text);
        });
        el.toks.innerHTML = '';
        el.toks.appendChild(frag);
        gsap.set(fresh, { opacity: 0, y: 8 });
        // 마스크 칩은 같은 요소라 사라지지 않고 새 자리로 이동한다
        live(Flip.from(state, { duration: 0.6, ease: 'power3.out' }));
        live(gsap.to(fresh, { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power3.out' }));
        if (terms.length) {
          live(gsap.timeline()
            .call(function () { terms.forEach(function (e) { e.classList.add('is-flash'); }); }, null, 0.35)
            .call(function () { terms.forEach(function (e) { e.classList.remove('is-flash'); }); }, null, 1.0));
        }
      }, null, swapAt);
      t.to({}, { duration: 1.4 }, swapAt);
    },

    check: function (t, st, i) {
      var prev = states[i - 1], next = states[i];
      var recheck = !!st.final && dotsOf(i - 1).length === 1;   // 수정 뒤의 마지막 검사
      var gap = recheck ? 0.15 : 0.3, spin = recheck ? 0.12 : 0.25, at = 0.25;

      t.call(function () {
        el.checks.classList.add('is-on');
        CHECK_KEYS.forEach(function (k) { items[k].dataset.res = 'idle'; items[k].classList.remove('is-dim'); });
      }, null, at);
      at += prev.checks ? 0.15 : 0.3;
      if (!st.final && next.round >= 2) {
        t.call(function () { el.loop.textContent = '×' + next.round; el.loop.classList.add('is-on'); }, null, at);
      }

      CHECK_KEYS.forEach(function (k, idx) {
        var li = items[k], res = st.results[k], a = at + idx * gap;
        t.call(function () { li.dataset.res = 'spin'; }, null, a);
        t.fromTo(li.querySelector('.ck i'), { rotation: 0 }, { rotation: 180, duration: spin, ease: 'none', immediateRender: false }, a);
        t.call(function () { li.dataset.res = res; }, null, a + spin);
        t.fromTo(li.querySelector(res === 'pass' ? '.ck-pass' : '.ck-fail'), { scale: 0 }, { scale: 1, duration: 0.3, ease: 'back.out(2.4)', immediateRender: false }, a + spin);
        if (res === 'fail') {
          t.fromTo(li, { x: -3 }, { x: 3, duration: 0.05, repeat: 5, yoyo: true, ease: 'none', immediateRender: false }, a + spin);
          t.set(li, { x: 0 }, a + spin + 0.31);
        }
        if (k === 'glossary' && st.lemma) {
          t.call(function () { setCard(cardOf(st)); }, null, a + spin);
          t.fromTo(el.card, { x: 14, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out', immediateRender: false }, a + spin);
        }
      });
      at += 2 * gap + spin + 0.3;

      var failed = CHECK_KEYS.some(function (k) { return st.results[k] !== 'pass'; });
      if (failed && !st.final) {
        t.call(function () {
          var fresh = [];
          (st.missing || []).forEach(function (m) {
            if (tok(m.id)) return;
            var s = makeTok({ id: m.id, text: '', kind: 'slot' });
            el.toks.insertBefore(s, tok(m.before));
            fresh.push(s);
          });
          // 폭이 0에서 자라면서 옆 토큰을 밀어낸다
          if (fresh.length) live(gsap.from(fresh, { width: 0, marginLeft: 0, marginRight: 0, opacity: 0, duration: 0.45, ease: 'power4.out' }));
          live(gsap.fromTo(el.toks.querySelectorAll('[data-kind="slot"]'), { opacity: 1 }, { opacity: 0.35, duration: 0.18, repeat: 3, yoyo: true, ease: 'power1.inOut', delay: 0.45 }));
        }, null, at);
        t.to({}, { duration: 0.45 + 0.72 + 0.3 }, at);   // 마지막 0.3초는 실패를 읽을 시간
      }
      if (st.final) finalize(t, st, i, at);
      else if (!failed) t.to({}, { duration: 0.3 }, at);
    },

    reflect: function (t, st) {
      var at = 0.25;
      // 통과한 것은 물러나고 빈 슬롯만 남는다. 실패한 부분만 다시 보낸다는 표시
      t.call(function () {
        CHECK_KEYS.forEach(function (k) { if (items[k].dataset.res === 'pass') items[k].classList.add('is-dim'); });
        el.stage.classList.add('is-spot');
      }, null, at);
      var end = waitDots(t, at + 0.5, st.latency_ms);
      var filled = [];
      t.call(function () {
        (st.insert || []).forEach(function (ins) {
          var s = tok(ins.id); if (!s) return;
          var w0 = s.offsetWidth;
          var inner = document.createElement('span');
          inner.className = 'tok__in'; inner.textContent = chip(ins.text);
          s.textContent = ''; s.appendChild(inner); s.classList.add('is-filled');
          s.style.width = 'auto';
          var w1 = s.offsetWidth;
          s.style.width = '';
          live(gsap.fromTo(s, { width: w0 }, { width: w1, duration: 0.4, ease: 'power3.out' }));
          live(gsap.fromTo(inner, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }));
          filled.push(s);
        });
      }, null, end);
      t.call(function () { el.stage.classList.remove('is-spot'); }, null, end + 0.5);
      t.call(function () {
        filled.forEach(function (s) { s.dataset.kind = 'mask'; s.classList.remove('is-filled'); s.style.width = ''; });
      }, null, end + 0.9);
      t.to({}, { duration: 0.4 }, end + 0.9);
    }
  };

  function finalize(t, st, i, at) {
    var next = states[i];
    var chips = [].slice.call(el.toks.querySelectorAll('[data-kind="mask"]'));
    t.call(function () { setTrack(next); }, null, at);
    t.to(chips, { scaleX: 0, opacity: 0, transformOrigin: 'left center', duration: 0.22, ease: 'power2.in', stagger: 0.03 }, at);
    var sw = at + 0.22 + chips.length * 0.03;
    t.call(function () {
      var others = allToks().filter(function (e) { return chips.indexOf(e) < 0; });
      var state = Flip.getState(others);
      chips.forEach(function (c) { c.textContent = orig[c.dataset.id].text; c.dataset.kind = orig[c.dataset.id].kind; });
      live(Flip.from(state, { duration: 0.5, ease: 'power3.out' }));
    }, null, sw);
    t.to(chips, { scaleX: 1, opacity: 1, duration: 0.35, ease: 'power3.out', stagger: 0.04 }, sw);
    if (!next.partial) {
      t.call(function () { el.stage.classList.add('is-pass'); }, null, sw + 0.35);
      t.call(function () { el.stage.classList.remove('is-pass'); }, null, sw + 1.15);
    }
    t.call(function () { el.meta.textContent = next.meta; }, null, sw + 0.4);
    t.to({}, { duration: 1.5 }, sw + 0.35);
  }

  /* ── 재생 제어 ─────────────────────────────────────── */
  function kill() {
    if (tl) { tl.kill(); tl = null; }
    if (wait) { wait.kill(); wait = null; }
  }
  function sync() {
    var b = el.btn;
    var label = playing ? '정지' : (p >= n ? '다시 재생' : '재생');
    b.toggle.querySelector('span').textContent = label;
    b.toggle.setAttribute('aria-label', label);
    b.toggle.classList.toggle('is-playing', playing);
    b.prev.disabled = !tl && p <= 0;
    b.next.disabled = !tl && p >= n;
  }
  function setPlaying(v) { playing = v; sync(); }
  function show(k) { kill(); p = Math.max(0, Math.min(n, k)); render(states[p]); setPlaying(false); }

  function playStage(i) {
    kill();
    p = i - 1; render(states[p]);
    var st = sample.stages[i - 1];
    tl = gsap.timeline({
      onComplete: function () {
        tl = null; p = i; render(states[i]);
        if (once || !playing) { once = false; setPlaying(false); return; }
        if (i < n) playStage(i + 1); else finished();
      }
    });
    tl.timeScale(speed);
    logSwap(tl, st.log);
    var ds = dotsOf(i - 1), mid = clone(states[i]);
    // 한 번에 통과하는 검사는 '무결성 검사'부터 켜고, '재검사'는 마무리에서 켠다
    if (ds.length > 1) { mid.lit[5] = 0; mid.dot = 3; mid.partial = false; }
    mid.round = states[p].round;
    tl.call(function () { setTrack(mid); }, null, 0);
    build[st.name](tl, st, i);
    sync();
  }
  function start() {
    kill();
    p = 0; render(states[0]); once = false; playing = true;
    tl = gsap.timeline({ onComplete: function () { tl = null; if (playing) playStage(1); else sync(); } });
    tl.timeScale(speed);
    tl.from(allToks(), { opacity: 0, y: 10, duration: 0.5, stagger: 0.04, ease: 'power3.out' }).to({}, { duration: 0.5 });
    sync();
  }
  function finished() {
    setPlaying(false);
    if (touched || autoCount >= samples.length - 1) return;
    wait = gsap.delayedCall(2, function () {
      wait = null; autoCount++;
      gsap.to(el.work, {
        opacity: 0, duration: 0.3, ease: 'power1.inOut',
        onComplete: function () { loadSample((sampleIdx + 1) % samples.length); start(); }
      });
    });
  }

  function loadSample(idx) {
    kill();
    sampleIdx = (idx + samples.length) % samples.length;
    sample = samples[sampleIdx]; n = sample.stages.length;
    states = computeStates();
    var pair = sample.pair.split(/\s*→\s*/);
    el.src.textContent = pair[0] || ''; el.tgt.textContent = pair[1] || '';
    [].forEach.call(el.tabs.children, function (b, k) { b.setAttribute('aria-pressed', k === sampleIdx ? 'true' : 'false'); });
    var on = el.tabs.children[sampleIdx];
    if (on && el.tabs.scrollWidth > el.tabs.clientWidth) el.tabs.scrollTo({ left: on.offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' });
    el.steps.forEach(function (li, d) { li.querySelector('button').disabled = !stageOfDot(d); });
    p = 0; render(states[0]); sync();
  }

  function bind() {
    var b = el.btn;
    samples.forEach(function (s, k) {
      var t = document.createElement('button');
      t.type = 'button'; t.textContent = s.title; t.setAttribute('aria-pressed', 'false');
      t.addEventListener('click', function () {
        touched = true;
        loadSample(k);
        if (instant) show(n); else start();
      });
      el.tabs.appendChild(t);
    });
    b.toggle.addEventListener('click', function () {
      touched = true;
      if (tl) {
        if (tl.paused()) { once = false; tl.play(); setPlaying(true); } else { tl.pause(); setPlaying(false); }
        return;
      }
      if (wait) { wait.kill(); wait = null; }
      if (p >= n) { start(); return; }
      once = false; playing = true; playStage(p + 1);
    });
    b.next.addEventListener('click', function () {
      touched = true;
      if (instant || tl) { show(p + 1); return; }
      if (p < n) { once = true; playing = true; playStage(p + 1); }
    });
    b.prev.addEventListener('click', function () {
      touched = true;
      show(tl ? p : p - 1);
    });
    el.steps.forEach(function (li, d) {
      li.querySelector('button').addEventListener('click', function () {
        var i = stageOfDot(d); if (!i) return;
        touched = true;
        if (instant) { show(i); return; }
        once = true; playing = true; playStage(i);
      });
    });
    b.speed.addEventListener('click', function () {
      speed = speed === 1 ? 2 : 1;
      b.speed.textContent = speed + 'x';
      if (tl) tl.timeScale(speed);
    });
  }

  function init(data) {
    samples = data.samples || [];
    if (!samples.length) return;
    bind();
    loadSample(0);
    if (instant) { root.classList.add('is-static'); show(n); return; }
    // 패널이 화면에 들어온 뒤, 첫 화면 등장이 끝나고 시작
    function enter() { gsap.delayedCall(1.1, function () { if (!touched && !tl && p === 0) start(); }); }
    if (window.ScrollTrigger) {
      ScrollTrigger.create({ trigger: '.demo__panel', start: 'top 80%', once: true, onEnter: enter });
    } else if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { io.disconnect(); enter(); }
      }, { threshold: 0.3 });
      io.observe(root);
    }
  }

  if (window.PIPELINE_SAMPLES && window.PIPELINE_SAMPLES.samples) {
    init(window.PIPELINE_SAMPLES);
  } else {
    el.logText.textContent = '샘플을 불러오지 못했습니다.';
    $$('.demo__bar button').forEach(function (b) { b.disabled = true; });
  }
})();
