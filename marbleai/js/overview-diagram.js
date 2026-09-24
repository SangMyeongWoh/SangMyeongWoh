/* 한눈에 보기: MaMT 흐름 애니메이션과 관련 흐름 강조 */
(function () {
  var root = document.querySelector(".mamt-overview");
  if (!root) return;
  var NS = "http://www.w3.org/2000/svg";
  var svg = document.getElementById("mamt-diagram");
  var layer = document.getElementById("mamt-tokens");

  // path: 지나갈 선, color: 색, dur: 한 번 지나는 시간(초), n: 동시에 보이는 화살표 수
  var FLOWS = [
    { path: "mamt-p1", color: "sentence",  dur: 1.8, n: 1 },
    { path: "mamt-p2", color: "mtf",       dur: 1.8, n: 1 },
    { path: "mamt-p3", color: "mtf",       dur: 4.0, n: 2 },
    { path: "mamt-p4", color: "sentence",  dur: 1.8, n: 1 },
    { path: "mamt-pa", color: "sentence",  dur: 1.8, n: 1 },
    { path: "mamt-pb", color: "translate", dur: 1.8, n: 1 },
    { path: "mamt-p5", color: "translate", dur: 1.8, n: 1 },
    { path: "mamt-mq", color: "sentence", dur: 7.0, n: 3 },
    { path: "mamt-mr", color: "glossary", dur: 7.0, n: 3 },
    { path: "mamt-vq", color: "translate", dur: 7.0, n: 3 },
    { path: "mamt-vr", color: "glossary", dur: 7.0, n: 3 },
    { path: "mamt-p8", color: "glossary", dur: 5.5, n: 3 },
    { path: "mamt-e1", color: "translate", dur: 2.6, n: 1 },
    { path: "mamt-eq", color: "translate", dur: 9.0, n: 4 },
    { path: "mamt-er", color: "glossary", dur: 9.0, n: 4 },
    { path: "mamt-e2", color: "eval",      dur: 1.8, n: 1 }
  ];
  var FILL = { sentence: "#eeece6", mtf: "#e3c77a", translate: "#e3c77a", glossary: "#e3c77a", eval: "#e3c77a" };

  function el(name, attrs) {
    var node = document.createElementNS(NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }
  function makeArrow(color) {
    return el("path", { d: "M-5,-4.5 L1,0 L-5,4.5", fill: "none", stroke: color,
                        "stroke-width": 1.8, "stroke-linecap": "round", "stroke-linejoin": "round" });
  }

  FLOWS.forEach(function (f) {
    var owner = document.getElementById(f.path).parentNode;
    for (var i = 0; i < f.n; i++) {
      var g = el("g", { "class": "token", "data-nodes": owner.getAttribute("data-nodes") });
      g.appendChild(makeArrow(FILL[f.color]));

      var move = el("animateMotion", {
        dur: f.dur + "s",
        begin: (-f.dur * i / f.n).toFixed(2) + "s",
        repeatCount: "indefinite",
        rotate: "auto"
      });
      move.appendChild(el("mpath", { href: "#" + f.path }));
      g.appendChild(move);
      layer.appendChild(g);
    }
  });

  // 이름표 바탕을 글자 크기에 맞춘다
  svg.querySelectorAll(".flow-label").forEach(function (label) {
    var box = label.querySelector("text").getBBox();
    var rect = label.querySelector("rect");
    rect.setAttribute("x", box.x - 18); rect.setAttribute("y", box.y - 8);
    rect.setAttribute("width", box.width + 36); rect.setAttribute("height", box.height + 16);
    rect.setAttribute("rx", (box.height + 16) / 2);
  });

  // 상자에 올리거나 초점을 주면 그 상자와 닿지 않는 흐름을 흐리게
  var related = svg.querySelectorAll(".flow, .small, .token");
  function focusNode(name) {
    related.forEach(function (node) {
      var hit = !name || (node.getAttribute("data-nodes") || "").split(" ").indexOf(name) !== -1;
      node.classList.toggle("dim", !hit);
    });
  }
  svg.querySelectorAll(".node").forEach(function (node) {
    var name = node.getAttribute("data-node");
    node.addEventListener("mouseenter", function () { focusNode(name); });
    node.addEventListener("mouseleave", function () { focusNode(null); });
    node.addEventListener("focusin", function () { focusNode(name); });
    node.addEventListener("focusout", function () { focusNode(null); });
  });

  // 움직임 줄이기 설정에서는 정지한 흐름도를 보여 준다.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    svg.setCurrentTime(1);
    svg.pauseAnimations();
    svg.classList.add("paused");
  }
})();
