(() => {
  "use strict";

  const deck = document.getElementById("deck");
  const slides = Array.from(deck.querySelectorAll(".slide"));
  const total = slides.length;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let current = 0;
  // 슬라이드별 현재 step 진행도
  const stepState = slides.map((s) => 0);

  // ===== 화면 갱신 =====
  const pageNow = document.getElementById("pageNow");
  const pageTotal = document.getElementById("pageTotal");
  const progressFill = document.getElementById("progressFill");
  pageTotal.textContent = total;

  function render() {
    slides.forEach((s, i) => {
      s.classList.toggle("is-active", i === current);
      s.classList.toggle("is-prev", i < current);
    });
    pageNow.textContent = current + 1;
    progressFill.style.width = `${((current + 1) / total) * 100}%`;
    syncSteps(slides[current]);
    setParticleActive();
  }

  // ===== Step 인터랙션 =====
  function maxSteps(slide) {
    return parseInt(slide.dataset.steps || "0", 10);
  }

  // 현재 step 값에 맞춰 하위 요소 표시 상태 동기화
  function syncSteps(slide) {
    const done = stepState[current];
    // data-step 을 가진 요소들 (머신러닝/여정)
    slide.querySelectorAll("[data-step]").forEach((el) => {
      const n = parseInt(el.dataset.step, 10);
      el.classList.toggle("on", n <= done);
    });
    // 블랙박스(AI란?) 전용
    const bb = slide.querySelector("#blackbox");
    if (bb) bb.classList.toggle("open", done >= 1);
    // 패턴 데모(생성형 AI) 자동 실행
    if (slide.querySelector(".pattern-canvas") && done >= 1) startPattern();
  }

  // 다음: step 이 남아있으면 step 진행, 아니면 다음 슬라이드
  function next() {
    const slide = slides[current];
    if (stepState[current] < maxSteps(slide)) {
      stepState[current]++;
      syncSteps(slide);
      return;
    }
    if (current < total - 1) {
      current++;
      render();
    }
  }

  // 이전: 항상 이전 슬라이드 (그 슬라이드 step 은 모두 펼친 상태로)
  function prev() {
    if (current > 0) {
      current--;
      stepState[current] = maxSteps(slides[current]); // 되돌아가면 펼쳐진 상태
      render();
    }
  }

  function goFirst() { current = 0; stepState[0] = 0; render(); }
  function goLast() { current = total - 1; stepState[current] = maxSteps(slides[current]); render(); }

  // ===== 키보드 =====
  document.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowRight":
      case " ":
      case "PageDown":
        e.preventDefault(); next(); break;
      case "ArrowLeft":
      case "PageUp":
        e.preventDefault(); prev(); break;
      case "Home":
        e.preventDefault(); goFirst(); break;
      case "End":
        e.preventDefault(); goLast(); break;
      case "f":
      case "F":
        toggleFullscreen(); break;
    }
  });

  // ===== 마우스: 좌/우 영역 클릭으로 이동, 인터랙티브 요소는 제외 =====
  deck.addEventListener("click", (e) => {
    if (e.target.closest("a, button, .blackbox, .show-card, iframe, .gen-card")) return;
    const rect = deck.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.32) prev();
    else next();
  });

  // 블랙박스 직접 클릭 → step 진행
  const blackbox = document.getElementById("blackbox");
  if (blackbox) blackbox.addEventListener("click", (e) => { e.stopPropagation(); next(); });

  // 패턴 데모 버튼
  const patternBtn = document.getElementById("patternBtn");
  if (patternBtn) patternBtn.addEventListener("click", (e) => { e.stopPropagation(); startPattern(true); });

  // 쇼케이스 카드: data-link 가 # 가 아니면 새 탭
  document.querySelectorAll(".show-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      e.stopPropagation();
      const link = card.dataset.link;
      if (link && link !== "#") window.open(link, "_blank", "noopener");
    });
  });

  // HUD 버튼
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

  // ===== 도움말 힌트 자동 숨김 =====
  const helpHint = document.getElementById("helpHint");
  setTimeout(() => helpHint.classList.add("fade"), 5000);

  // ===== iframe placeholder 처리 =====
  const liveFrame = document.getElementById("liveFrame");
  const iframePh = document.getElementById("iframePh");
  if (liveFrame && iframePh) {
    const src = liveFrame.getAttribute("src");
    if (src && src.trim() !== "") iframePh.classList.add("hidden");
  }

  // ===================================================================
  // 파티클 배경 (뉴럴 네트워크 노드) — 표지/마무리
  // ===================================================================
  const particleCanvases = Array.from(document.querySelectorAll(".particle-canvas"));
  const fields = particleCanvases.map((cv) => new ParticleField(cv));

  function setParticleActive() {
    fields.forEach((f) => {
      const onActiveSlide = f.canvas.closest(".slide").classList.contains("is-active");
      f.setActive(onActiveSlide && !reduceMotion);
    });
  }

  function ParticleField(canvas) {
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let nodes = [];
    let raf = null;
    let active = false;
    const mouse = { x: -9999, y: -9999 };

    function resize() {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildNodes();
    }

    function buildNodes() {
      const count = Math.round((w * h) / 16000);
      const n = Math.max(28, Math.min(90, count));
      nodes = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
      }));
    }

    canvas.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener("mouseleave", () => { mouse.x = -9999; mouse.y = -9999; });

    function step() {
      ctx.clearRect(0, 0, w, h);
      for (const p of nodes) {
        // 마우스 근처 반발
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 14000) {
          const f = (14000 - d2) / 14000;
          const d = Math.sqrt(d2) || 1;
          p.vx += (dx / d) * f * 0.6;
          p.vy += (dy / d) * f * 0.6;
        }
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.98; p.vy *= 0.98;
        // 경계 래핑
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      }
      // 연결선
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            const al = (1 - dist / 130) * 0.5;
            ctx.strokeStyle = `rgba(120,160,255,${al})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      // 노드
      for (const p of nodes) {
        ctx.fillStyle = "rgba(160,190,255,0.9)";
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(step);
    }

    this.canvas = canvas;
    this.setActive = (on) => {
      if (on === active) return;
      active = on;
      if (on) {
        resize();
        if (!raf) raf = requestAnimationFrame(step);
      } else {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        ctx.clearRect(0, 0, w, h);
      }
    };

    window.addEventListener("resize", () => { if (active) resize(); });
  }

  // ===================================================================
  // 패턴 학습 미니 데모 (생성형 AI) — 흩어진 점 → 패턴(사인파)
  // ===================================================================
  let patternStarted = false;
  function startPattern(force) {
    const cv = document.querySelector(".pattern-canvas");
    if (!cv) return;
    if (patternStarted && !force) return;
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

    const N = 60;
    const pts = Array.from({ length: N }, (_, i) => {
      const tx = (i / (N - 1)) * (w - 30) + 15;
      const ty = h / 2 + Math.sin((i / (N - 1)) * Math.PI * 2) * (h * 0.3);
      return {
        x: Math.random() * w, y: Math.random() * h,
        tx, ty,
      };
    });

    let t = 0;
    const dur = reduceMotion ? 1 : 70;
    function frame() {
      t++;
      const e = Math.min(1, t / dur);
      const ease = 1 - Math.pow(1 - e, 3);
      ctx.clearRect(0, 0, w, h);
      // 목표 곡선(완성될수록 진하게)
      ctx.strokeStyle = `rgba(160,107,255,${ease * 0.4})`;
      ctx.lineWidth = 2; ctx.beginPath();
      pts.forEach((p, i) => { i ? ctx.lineTo(p.tx, p.ty) : ctx.moveTo(p.tx, p.ty); });
      ctx.stroke();
      // 점
      for (const p of pts) {
        const x = p.x + (p.tx - p.x) * ease;
        const y = p.y + (p.ty - p.y) * ease;
        ctx.fillStyle = `rgba(91,140,255,${0.5 + ease * 0.5})`;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      }
      if (e < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ===== 초기 렌더 =====
  render();
})();
