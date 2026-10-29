/* ═══════════ Анимированные фоны на Canvas ═══════════ */
globalThis.Backgrounds = (() => {
  const canvas = document.getElementById('bg-canvas');
  const ctx2 = canvas.getContext('2d');
  let W, H, raf, t = 0, intensity = 1, current = 'sea', particles = [];

  function resize() {
    W = canvas.width = window.innerWidth * devicePixelRatio;
    H = canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    initParticles();
  }
  window.addEventListener('resize', resize);

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function initParticles() {
    particles = [];
    if (current === 'field') {
      // травинки
      const n = Math.floor(W / (22 * devicePixelRatio));
      for (let i = 0; i < n; i++) {
        particles.push({ x: rnd(0, W), h: rnd(H * .06, H * .16), phase: rnd(0, 6.28), speed: rnd(.7, 1.4), hue: rnd(75, 130), top: rnd(H * .72, H * .84) });
      }
      // одуванчики-пушинки
      for (let i = 0; i < 14; i++) particles.push({ seed: true, x: rnd(0, W), y: rnd(H * .2, H * .7), r: rnd(2, 4) * devicePixelRatio, vx: rnd(.4, 1.2), vy: rnd(-.3, .3), phase: rnd(0, 6.28) });
    } else if (current === 'night') {
      const n = Math.floor(W / (9 * devicePixelRatio));
      for (let i = 0; i < n; i++) particles.push({ x: rnd(0, W), y: rnd(0, H * .8), r: rnd(.4, 1.8) * devicePixelRatio, tw: rnd(0, 6.28), sp: rnd(.5, 2) });
      // падающие звёзды
      for (let i = 0; i < 3; i++) particles.push({ shoot: true, x: rnd(0, W), y: rnd(0, H * .4), len: 0, v: rnd(9, 16) * devicePixelRatio, cooldown: rnd(0, 500) });
    } else if (current === 'rain') {
      const n = Math.floor(W / (5 * devicePixelRatio));
      for (let i = 0; i < n; i++) particles.push({ x: rnd(0, W), y: rnd(0, H), l: rnd(8, 22) * devicePixelRatio, v: rnd(7, 14) * devicePixelRatio, o: rnd(.1, .45) });
    } else if (current === 'aurora') {
      for (let i = 0; i < 3; i++) particles.push({ band: true, off: rnd(0, 100), hue: [160, 280, 190][i], amp: rnd(.08, .16), yBase: rnd(.15, .4), speed: rnd(.3, .7) });
      const n = Math.floor(W / (16 * devicePixelRatio));
      for (let i = 0; i < n; i++) particles.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(.3, 1.3) * devicePixelRatio, tw: rnd(0, 6.28), sp: rnd(.5, 1.5) });
    }
  }

  /* ── МОРЕ ── */
  function drawSea() {
    const g = ctx2.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#a5d8ff'); g.addColorStop(.38, '#4dabf7');
    g.addColorStop(.55, '#1c7ed6'); g.addColorStop(1, '#013a63');
    ctx2.fillStyle = g; ctx2.fillRect(0, 0, W, H);

    // солнце/блик
    const sx = W * .72, sy = H * .18;
    const sg = ctx2.createRadialGradient(sx, sy, 0, sx, sy, H * .5);
    sg.addColorStop(0, 'rgba(255,244,200,.85)'); sg.addColorStop(.12, 'rgba(255,235,170,.35)'); sg.addColorStop(1, 'rgba(255,235,170,0)');
    ctx2.fillStyle = sg; ctx2.fillRect(0, 0, W, H);

    // слои волн
    const layers = [
      { y: .52, amp: .022, freq: .0016, sp: .55, col: 'rgba(76,166,224,.55)' },
      { y: .60, amp: .028, freq: .0021, sp: .8, col: 'rgba(33,115,181,.6)' },
      { y: .70, amp: .034, freq: .0026, sp: 1.1, col: 'rgba(18,84,143,.7)' },
      { y: .82, amp: .042, freq: .0031, sp: 1.5, col: 'rgba(7,50,94,.85)' },
    ];
    layers.forEach(L => {
      ctx2.beginPath();
      ctx2.moveTo(0, H);
      for (let x = 0; x <= W; x += 6 * devicePixelRatio) {
        const y = H * L.y + Math.sin(x * L.freq * intensity + t * .018 * L.sp * intensity) * H * L.amp
                        + Math.sin(x * L.freq * 2.7 + t * .03 * L.sp) * H * L.amp * .3;
        ctx2.lineTo(x, y);
      }
      ctx2.lineTo(W, H); ctx2.closePath();
      ctx2.fillStyle = L.col; ctx2.fill();
    });

    // блики света на воде
    ctx2.save();
    ctx2.globalCompositeOperation = 'screen';
    for (let i = 0; i < 26; i++) {
      const yy = H * (.55 + (i % 8) * .05);
      const xx = (sx + Math.sin(t * .012 + i * 1.7) * W * .12 + i * 37 * devicePixelRatio) % W;
      const w = (14 + Math.sin(t * .05 + i) * 8) * devicePixelRatio;
      ctx2.fillStyle = `rgba(255,255,230,${.05 + .04 * Math.sin(t * .04 + i)})`;
      ctx2.fillRect(xx, yy, w, 1.6 * devicePixelRatio);
    }
    ctx2.restore();

    // чайки
    ctx2.strokeStyle = 'rgba(255,255,255,.75)'; ctx2.lineWidth = 1.6 * devicePixelRatio;
    for (let i = 0; i < 3; i++) {
      const bx = ((t * (.4 + i * .15) * devicePixelRatio + i * W / 3) % (W + 200)) - 100;
      const by = H * (.14 + i * .06) + Math.sin(t * .03 + i) * 12 * devicePixelRatio;
      const s = (6 + i * 2) * devicePixelRatio;
      const flap = Math.sin(t * .12 + i * 2) * s * .5;
      ctx2.beginPath();
      ctx2.moveTo(bx - s, by - flap); ctx2.quadraticCurveTo(bx - s / 2, by + s / 3, bx, by);
      ctx2.quadraticCurveTo(bx + s / 2, by + s / 3, bx + s, by - flap);
      ctx2.stroke();
    }
  }

  /* ── ВЕТРЕНОЕ ПОЛЕ ── */
  function drawField() {
    const g = ctx2.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#cfe8ff'); g.addColorStop(.45, '#eaf6ff');
    g.addColorStop(.62, '#d9f0a3'); g.addColorStop(1, '#5c8a1e');
    ctx2.fillStyle = g; ctx2.fillRect(0, 0, W, H);

    // облака
    ctx2.fillStyle = 'rgba(255,255,255,.8)';
    for (let i = 0; i < 6; i++) {
      const cx = ((t * (.25 + i * .07) * intensity * devicePixelRatio + i * W / 5) % (W + 400)) - 200;
      const cy = H * (.08 + (i % 3) * .11);
      cloud(cx, cy, (30 + i * 9) * devicePixelRatio);
    }

    // дальние холмы
    ctx2.fillStyle = 'rgba(126,178,70,.5)';
    hill(H * .6, .004, 20);
    ctx2.fillStyle = 'rgba(101,153,45,.6)';
    hill(H * .68, .003, 30);

    // трава — изгибающиеся под ветром травинки
    const gust = Math.sin(t * .008 * intensity) * .5 + Math.sin(t * .021) * .3 + .8; // сила ветра
    particles.filter(p => p.h).forEach(p => {
      const bend = gust * p.speed * 26 * devicePixelRatio * intensity;
      const sway = Math.sin(t * .02 * p.speed + p.phase) * 6 * devicePixelRatio;
      ctx2.strokeStyle = `hsla(${p.hue},60%,${28 + p.speed * 10}%,.8)`;
      ctx2.lineWidth = 1.4 * devicePixelRatio;
      ctx2.beginPath();
      ctx2.moveTo(p.x, H);
      ctx2.quadraticCurveTo(p.x + (bend + sway) * .4, p.top - p.h * .4, p.x + bend + sway, p.top - p.h);
      ctx2.stroke();
    });

    // летящие пушинки
    ctx2.fillStyle = 'rgba(255,255,255,.85)';
    particles.filter(p => p.seed).forEach(p => {
      p.x += p.vx * intensity * devicePixelRatio * gust;
      p.y += Math.sin(t * .02 + p.phase) * .8 * devicePixelRatio + p.vy;
      if (p.x > W + 20) { p.x = -20; p.y = rnd(H * .15, H * .65); }
      ctx2.beginPath(); ctx2.arc(p.x, p.y, p.r, 0, 7); ctx2.fill();
      ctx2.strokeStyle = 'rgba(255,255,255,.4)'; ctx2.lineWidth = devicePixelRatio;
      for (let k = 0; k < 6; k++) {
        const a = k * 1.05 + t * .002;
        ctx2.beginPath(); ctx2.moveTo(p.x, p.y);
        ctx2.lineTo(p.x + Math.cos(a) * p.r * 2.6, p.y + Math.sin(a) * p.r * 2.6); ctx2.stroke();
      }
    });
  }
  function cloud(x, y, s) {
    ctx2.beginPath();
    ctx2.arc(x, y, s * .5, 0, 7);
    ctx2.arc(x + s * .5, y + s * .1, s * .4, 0, 7);
    ctx2.arc(x - s * .5, y + s * .12, s * .35, 0, 7);
    ctx2.arc(x + s * .2, y - s * .25, s * .35, 0, 7);
    ctx2.fill();
  }
  function hill(baseY, freq, amp) {
    ctx2.beginPath(); ctx2.moveTo(0, H);
    for (let x = 0; x <= W; x += 8 * devicePixelRatio) {
      ctx2.lineTo(x, baseY + Math.sin(x * freq + t * .002) * amp * devicePixelRatio);
    }
    ctx2.lineTo(W, H); ctx2.closePath(); ctx2.fill();
  }

  /* ── НОЧНОЕ НЕБО ── */
  function drawNight() {
    const g = ctx2.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#020111'); g.addColorStop(.6, '#0a1128'); g.addColorStop(1, '#1c2a4a');
    ctx2.fillStyle = g; ctx2.fillRect(0, 0, W, H);

    // млечный путь
    ctx2.save();
    ctx2.translate(W / 2, H / 2); ctx2.rotate(-.5);
    const mg = ctx2.createLinearGradient(0, -H * .2, 0, H * .2);
    mg.addColorStop(0, 'rgba(180,190,255,0)'); mg.addColorStop(.5, 'rgba(180,190,255,.07)'); mg.addColorStop(1, 'rgba(180,190,255,0)');
    ctx2.fillStyle = mg; ctx2.fillRect(-W, -H * .2, W * 2, H * .4);
    ctx2.restore();

    particles.filter(p => p.r && !p.shoot).forEach(p => {
      const a = .35 + .65 * Math.abs(Math.sin(t * .008 * p.sp + p.tw));
      ctx2.fillStyle = `rgba(230,240,255,${a})`;
      ctx2.beginPath(); ctx2.arc(p.x, p.y, p.r, 0, 7); ctx2.fill();
    });

    // луна
    const mx = W * .82, my = H * .16, mr = 34 * devicePixelRatio;
    const mglow = ctx2.createRadialGradient(mx, my, mr * .4, mx, my, mr * 4);
    mglow.addColorStop(0, 'rgba(226,232,240,.25)'); mglow.addColorStop(1, 'rgba(226,232,240,0)');
    ctx2.fillStyle = mglow; ctx2.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
    ctx2.fillStyle = '#e2e8f0'; ctx2.beginPath(); ctx2.arc(mx, my, mr, 0, 7); ctx2.fill();
    ctx2.fillStyle = 'rgba(148,163,184,.4)';
    ctx2.beginPath(); ctx2.arc(mx - mr * .3, my - mr * .2, mr * .18, 0, 7); ctx2.fill();
    ctx2.beginPath(); ctx2.arc(mx + mr * .25, my + mr * .3, mr * .13, 0, 7); ctx2.fill();

    // падающие звёзды
    particles.filter(p => p.shoot).forEach(p => {
      p.cooldown--;
      if (p.cooldown <= 0) { p.x = rnd(W * .2, W); p.y = rnd(0, H * .3); p.len = 1; p.cooldown = rnd(300, 900); }
      if (p.len > 0 && p.len < 60) {
        p.x -= p.v; p.y += p.v * .45; p.len++;
        const grad = ctx2.createLinearGradient(p.x, p.y, p.x + p.v * 8, p.y - p.v * 3.6);
        grad.addColorStop(0, 'rgba(255,255,255,.9)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx2.strokeStyle = grad; ctx2.lineWidth = 1.8 * devicePixelRatio;
        ctx2.beginPath(); ctx2.moveTo(p.x, p.y); ctx2.lineTo(p.x + p.v * 8, p.y - p.v * 3.6); ctx2.stroke();
      }
    });
  }

  /* ── СЕВЕРНОЕ СИЯНИЕ ── */
  function drawAurora() {
    const g = ctx2.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#020e12'); g.addColorStop(.7, '#041420'); g.addColorStop(1, '#0a1f2e');
    ctx2.fillStyle = g; ctx2.fillRect(0, 0, W, H);

    particles.filter(p => p.r && !p.band).forEach(p => {
      const a = .3 + .6 * Math.abs(Math.sin(t * .01 * p.sp + p.tw));
      ctx2.fillStyle = `rgba(220,235,255,${a})`;
      ctx2.fillRect(p.x, p.y, p.r, p.r);
    });

    ctx2.save();
    ctx2.globalCompositeOperation = 'lighter';
    particles.filter(p => p.band).forEach((b, bi) => {
      for (let layer = 0; layer < 3; layer++) {
        ctx2.beginPath();
        const yBase = H * b.yBase + layer * 18 * devicePixelRatio;
        ctx2.moveTo(0, yBase);
        for (let x = 0; x <= W; x += 10 * devicePixelRatio) {
          const y = yBase
            + Math.sin(x * .002 + t * .006 * b.speed * intensity + b.off) * H * b.amp
            + Math.sin(x * .005 + t * .013 + layer * 2) * H * b.amp * .35;
          ctx2.lineTo(x, y);
        }
        ctx2.lineTo(W, 0); ctx2.lineTo(0, 0); ctx2.closePath();
        const ag = ctx2.createLinearGradient(0, yBase - H * b.amp, 0, yBase + H * .3);
        ag.addColorStop(0, `hsla(${b.hue + layer * 20},90%,60%,0)`);
        ag.addColorStop(.35, `hsla(${b.hue + layer * 20},85%,55%,${.07 - layer * .015})`);
        ag.addColorStop(1, `hsla(${b.hue},80%,45%,0)`);
        ctx2.fillStyle = ag; ctx2.fill();
      }
    });
    ctx2.restore();

    // силуэт гор внизу
    ctx2.fillStyle = '#01060a';
    ctx2.beginPath(); ctx2.moveTo(0, H);
    const peaks = [[0, .82], [.15, .72], [.3, .8], [.48, .66], [.62, .78], [.8, .7], [1, .8]];
    peaks.forEach(([px, py]) => ctx2.lineTo(px * W, py * H));
    ctx2.lineTo(W, H); ctx2.closePath(); ctx2.fill();
  }

  /* ── ДОЖДЬ ── */
  function drawRain() {
    const g = ctx2.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#3b4a63'); g.addColorStop(.6, '#2b3648'); g.addColorStop(1, '#1a2230');
    ctx2.fillStyle = g; ctx2.fillRect(0, 0, W, H);

    ctx2.strokeStyle = 'rgba(190,210,235,.5)';
    ctx2.lineWidth = 1.1 * devicePixelRatio;
    const wind = Math.sin(t * .004) * .25 + .2;
    particles.filter(p => p.l).forEach(p => {
      p.y += p.v * intensity; p.x += p.v * wind * intensity;
      if (p.y > H) { p.y = -20; p.x = rnd(-W * .2, W); }
      ctx2.globalAlpha = p.o;
      ctx2.beginPath(); ctx2.moveTo(p.x, p.y); ctx2.lineTo(p.x - p.l * wind, p.y - p.l); ctx2.stroke();
      // отскок у «земли»
      if (p.y > H * .93 && Math.random() < .05) {
        ctx2.globalAlpha = .25;
        ctx2.beginPath(); ctx2.arc(p.x, H * .95, rnd(1, 4) * devicePixelRatio, 0, 7); ctx2.stroke();
      }
    });
    ctx2.globalAlpha = 1;

    // редкая мягкая вспышка молнии
    if (Math.random() < .0008) {
      ctx2.fillStyle = 'rgba(255,255,255,.16)'; ctx2.fillRect(0, 0, W, H);
    }
  }

  /* ── ОДИНОКАЯ ВОДА / plain ── */
  function drawPlain() {
    const light = document.body.classList.contains('light');
    ctx2.clearRect(0, 0, W, H);
    if (!light) return;
    ctx2.fillStyle = '#eef2f8'; ctx2.fillRect(0, 0, W, H);
  }

  const drawers = { sea: drawSea, field: drawField, night: drawNight, aurora: drawAurora, rain: drawRain, plain: drawPlain };

  function loop() {
    t++;
    (drawers[current] || drawPlain)();
    raf = requestAnimationFrame(loop);
  }

  function set(name) {
    current = name;
    initParticles();
    if (name !== 'plain') { cancelAnimationFrame(raf); loop(); }
    else { cancelAnimationFrame(raf); drawPlain(); }
  }
  function setIntensity(v) { intensity = v; }

  resize();
  set('sea');

  return { set, setIntensity };
})();

/* ═══════════ Конфетти ═══════════ */
globalThis.Confetti = (() => {
  const cv = document.getElementById('confetti-canvas');
  const c = cv.getContext('2d');
  let parts = [], running = false;

  function resize() { cv.width = innerWidth; cv.height = innerHeight; }
  addEventListener('resize', resize); resize();

  function burst(n = 90) {
    const colors = ['#38bdf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#fb923c'];
    for (let i = 0; i < n; i++) {
      parts.push({
        x: innerWidth / 2 + (Math.random() - .5) * innerWidth * .4,
        y: innerHeight * .35,
        vx: (Math.random() - .5) * 14,
        vy: -Math.random() * 14 - 4,
        w: 6 + Math.random() * 8, h: 4 + Math.random() * 6,
        rot: Math.random() * 6.28, vr: (Math.random() - .5) * .3,
        col: colors[i % colors.length], life: 120 + Math.random() * 60
      });
    }
    if (!running) { running = true; tick(); }
  }

  function tick() {
    c.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter(p => p.life-- > 0 && p.y < cv.height + 40);
    parts.forEach(p => {
      p.vy += .28; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
      c.globalAlpha = Math.min(1, p.life / 40);
      c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      c.restore();
    });
    if (parts.length) requestAnimationFrame(tick);
    else { running = false; c.clearRect(0, 0, cv.width, cv.height); }
  }
  return { burst };
})();
