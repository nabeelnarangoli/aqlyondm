/* Aqlyon Digital Marketing — interactions */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- hero: glow, ring and parallax follow the mouse ---------- */
  var hero = document.querySelector("[data-hero]");
  if (hero && !reduce) {
    var frame = null, ev = null;
    window.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      ev = e;
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = null;
        var r = hero.getBoundingClientRect();
        var x = ev.clientX - r.left, y = ev.clientY - r.top;
        if (x < 0 || y < 0 || x > r.width || y > r.height) return;
        hero.style.setProperty("--cx", x + "px");
        hero.style.setProperty("--cy", y + "px");
        hero.style.setProperty("--mx", ((x / r.width) - 0.5) * 2);
        hero.style.setProperty("--my", ((y / r.height) - 0.5) * 2);
      });
    }, { passive: true });
  }

  /* ---------- journey: scroll drives the story ---------- */
  var journey = document.querySelector("[data-journey]");
  if (journey) {
    var stage = journey.querySelector(".journey-stage");
    var texts = journey.querySelectorAll("[data-chapter]");
    var scenes = journey.querySelectorAll("[data-scene]");
    var nodes = journey.querySelectorAll("[data-go]");
    var numEl = journey.querySelector("[data-step-num]");
    var bgs = ["#FFF6D1", "#DDF7E8", "#EEE8FF", "#FFEACC", "#E0F2FF", "#FFE2DC", "#E4F9EE"];
    var n = texts.length, current = -1;

    var setStep = function (i) {
      if (i === current) return;
      current = i;
      texts.forEach(function (t, k) { t.classList.toggle("is-active", k === i); });
      scenes.forEach(function (s, k) { s.classList.toggle("is-active", k === i % scenes.length); });
      nodes.forEach(function (b, k) {
        b.classList.toggle("is-active", k === i);
        b.classList.toggle("is-done", k < i);
        if (k === i) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
      });
      if (numEl) numEl.textContent = String(i + 1).padStart(2, "0");
      stage.style.setProperty("--stage-bg", bgs[i % bgs.length]);
    };

    var progress = function () {
      var r = journey.getBoundingClientRect();
      var total = r.height - stage.offsetHeight;
      return Math.min(1, Math.max(0, -r.top / total));
    };
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var p = progress();
        journey.style.setProperty("--p", p);
        setStep(Math.min(n - 1, Math.floor(p * n)));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    nodes.forEach(function (b) {
      b.addEventListener("click", function () {
        var i = +b.getAttribute("data-go");
        var top = journey.getBoundingClientRect().top + window.scrollY;
        var total = journey.offsetHeight - stage.offsetHeight;
        window.scrollTo({ top: top + ((i + 0.5) / n) * total, behavior: reduce ? "auto" : "smooth" });
      });
    });
  }

  /* ---------- event gallery lightbox ---------- */
  var gallery = document.querySelector("[data-gallery]");
  var lb = document.querySelector("[data-lightbox]");
  if (gallery && lb && typeof lb.showModal === "function") {
    var items = Array.prototype.slice.call(gallery.querySelectorAll("button"));
    var img = lb.querySelector("img"), cap = lb.querySelector(".lb-cap"), idx = 0;
    var show = function (i) {
      idx = (i + items.length) % items.length;
      var b = items[idx];
      img.src = b.getAttribute("data-full");
      img.alt = b.querySelector("img").alt;
      cap.textContent = b.getAttribute("data-caption") || (idx + 1) + " / " + items.length;
    };
    items.forEach(function (b, i) { b.addEventListener("click", function () { show(i); lb.showModal(); }); });
    lb.addEventListener("click", function (e) {
      var a = e.target.getAttribute && e.target.getAttribute("data-lb");
      if (a === "prev") show(idx - 1);
      else if (a === "next") show(idx + 1);
      else if (a === "close" || e.target === lb) lb.close();
    });
    lb.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") show(idx - 1);
      if (e.key === "ArrowRight") show(idx + 1);
    });
  }
})();
