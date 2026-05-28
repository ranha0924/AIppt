(() => {
  "use strict";

  const deck = document.getElementById("deck");
  const slides = Array.from(deck.querySelectorAll(".slide"));
  const total = slides.length;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = (n) => String(n).padStart(2, "0");

  let current = 0;
  const stepState = slides.map(() => 0);

  const pageNow = document.getElementById("pageNow");
  const pageTotal = document.getElementById("pageTotal");
  const progressFill = document.getElementById("progressFill");
  pageTotal.textContent = pad(total);

  // ===== 렌더 =====
  function render() {
    slides.forEach((s, i) => {
      s.classList.toggle("is-active", i === current);
      s.classList.toggle("is-prev", i < current);
    });
    pageNow.textContent = pad(current + 1);
    progressFill.style.width = `${((current + 1) / total) * 100}%`;
    syncSteps(slides[current]);
    runReveal();
    setParticleActive();
  }

  // ===== 등장 모션 (절제된 stagger) =====
  function runReveal() {
    deck.querySelectorAll("[data-reveal]").forEach((el) => {
      el.classList.remove("in");
      el.style.transitionDelay = "";
    });
    const act = slides[current];
    const items = act.querySelectorAll("[data-reveal]");
    requestAnimationFrame(() => {
      items.forEach((el, i) => {
        el.style.transitionDelay = `${i * 70}ms`;
        el.classList.add("in");
      });
    });
  }

  // ===== Step 인터랙션 =====
  const maxSteps = (slide) => parseInt(slide.dataset.steps || "0", 10);

  function syncSteps(slide) {
    const done = stepState[current];
    slide.querySelectorAll("[data-step]").forEach((el) => {
      el.classList.toggle("on", parseInt(el.dataset.step, 10) <= done);
    });
    const bb = slide.querySelector("#blackbox");
    if (bb) bb.classList.toggle("open", done >= 1);
    if (slide.querySelector(".pattern-canvas") && done >= 1) startPattern();
  }

  function next() {
    const slide = slides[current];
    if (stepState[current] < maxSteps(slide)) {
      stepState[current]++;
      syncSteps(slide);
      return;
    }
    if (current < total - 1) { current++; render(); }
  }

  function prev() {
    if (current > 0) {
      current--;
      stepState[current] = maxSteps(slides[current]); // 되돌아가면 펼친 상태
      render();
    }
  }

  function goFirst() { current = 0; stepState[0] = 0; render(); }
  function goLast() { current = total - 1; stepState[current] = maxSteps(slides[current]); render(); }

  // ===== 키보드 =====
  document.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowRight": case " ": case "PageDown":
        e.preventDefault(); next(); break;
      case "ArrowLeft": case "PageUp":
        e.preventDefault(); prev(); break;
      case "Home": e.preventDefault(); goFirst(); break;
      case "End": e.preventDefault(); goLast(); break;
      case "f": case "F": toggleFullscreen(); break;
    }
  });

  // ===== 클릭 내비게이션 (좌/우 영역, 인터랙티브 요소 제외) =====
  deck.addEventListener("click", (e) => {
    if (e.target.closest("a, button, .chain-node.ai, .show-card, iframe, .gen-item")) return;
    const rect = deck.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width * 0.32) prev();
    else next();
  });

  const blackbox = document.getElementById("blackbox");
  if (blackbox) blackbox.addEventListener("click", (e) => { e.stopPropagation(); next(); });

  const patternBtn = document.getElementById("patternBtn");
  if (patternBtn) patternBtn.addEventListener("click", (e) => { e.stopPropagation(); startPattern(true); });

  document.querySelectorAll(".show-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      e.stopPropagation();
      const link = card.dataset.link;
      if (link && link !== "#") window.open(link, "_blank", "noopener");
    });
  });

  document.getElementById("nextBtn").addEventListener("click", (e) => { e.stopPropagation(); next(); });
  document.getElementById("prevBtn").addEventListener("click", (e) => { e.stopPropagation(); prev(); });

  // ===== 풀스크린 =====
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      (document.documentElement.requestFullscreen || (() => {})).call(document.documentElement);
    } else {
      (document.exitFullscreen || (() => {})).call(document);
    }
  }

  // ===== 도움말 자동 숨김 =====
  const helpHint = document.getElementById("helpHint");
  setTimeout(() => helpHint.classList.add("fade"), 5000);

  // ===== iframe placeholder =====
  const liveFrame = document.getElementById("liveFrame");
  const iframePh = document.getElementById("iframePh");
  if (liveFrame && iframePh) {
    const src = liveFrame.getAttribute("src");
    if (src && src.trim() !== "") iframePh.classList.add("hidden");
  }

  // ===================================================================
  // 배경 파티클 — 은은한 노드 연결망 (모노크롬, 절제)
  // ===================================================================
  const particleCanvases = Array.from(document.querySelectorAll(".particle-canvas"));
  const fields = particleCanvases.map((cv) => new ParticleField(cv));

  function setParticleActive() {
    fields.forEach((f) => {
      const onActive = f.canvas.closest(".slide").classList.contains("is-active");
      f.setActive(onActive && !reduceMotion);
    });
  }

  function ParticleField(canvas) {
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let nodes = [];
    let raf = null, active = false;
    const mouse = { x: -9999, y: -9999 };

    function resize() {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }
    function build() {
      const n = Math.max(22, Math.min(48, Math.round((w * h) / 30000)));
      nodes = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
      }));
    }

    canvas.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener("mouseleave", () => { mouse.x = -9999; mouse.y = -9999; });

    function step() {
      ctx.clearRect(0, 0, w, h);
      for (const p of nodes) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 12000) {
          const f = (12000 - d2) / 12000, d = Math.sqrt(d2) || 1;
          p.vx += (dx / d) * f * 0.25;
          p.vy += (dy / d) * f * 0.25;
        }
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.985; p.vy *= 0.985;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      }
      const MAX = 150;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX) {
            ctx.strokeStyle = `rgba(236,231,221,${(1 - dist / MAX) * 0.12})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const p of nodes) {
        const near = (p.x - mouse.x) ** 2 + (p.y - mouse.y) ** 2 < 12000;
        ctx.fillStyle = near ? "rgba(242,74,29,0.9)" : "rgba(236,231,221,0.5)";
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(step);
    }

    this.canvas = canvas;
    this.setActive = (on) => {
      if (on === active) return;
      active = on;
      if (on) { resize(); if (!raf) raf = requestAnimationFrame(step); }
      else { if (raf) cancelAnimationFrame(raf); raf = null; ctx.clearRect(0, 0, w, h); }
    };
    window.addEventListener("resize", () => { if (active) resize(); });
  }

  // ===================================================================
  // 패턴 학습 데모 — 흩어진 점 → 사인 곡선으로 정렬
  // ===================================================================
  let patternStarted = false;
  function startPattern(force) {
    const cv = document.querySelector(".pattern-canvas");
    if (!cv || (patternStarted && !force)) return;
    patternStarted = true;
    runPattern(cv);
  }

  function runPattern(canvas) {
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    const w = r.width, h = r.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const N = 56;
    const pts = Array.from({ length: N }, (_, i) => {
      const tx = (i / (N - 1)) * (w - 24) + 12;
      const ty = h / 2 + Math.sin((i / (N - 1)) * Math.PI * 2) * (h * 0.3);
      return { x: Math.random() * w, y: Math.random() * h, tx, ty };
    });

    let t = 0;
    const dur = reduceMotion ? 1 : 80;
    function frame() {
      t++;
      const e = Math.min(1, t / dur);
      const ease = 1 - Math.pow(1 - e, 4); // 절제된 expo-out
      ctx.clearRect(0, 0, w, h);
      // 목표 곡선 (완성될수록 진하게)
      ctx.strokeStyle = `rgba(242,74,29,${ease * 0.85})`;
      ctx.lineWidth = 1.4; ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.tx, p.ty) : ctx.moveTo(p.tx, p.ty)));
      ctx.stroke();
      // 점
      for (const p of pts) {
        const x = p.x + (p.tx - p.x) * ease;
        const y = p.y + (p.ty - p.y) * ease;
        ctx.fillStyle = `rgba(236,231,221,${0.4 + ease * 0.5})`;
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
      if (e < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ===== 초기 렌더 =====
  render();
})();
