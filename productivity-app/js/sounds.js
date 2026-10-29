/* ═══════════ SoundEngine — синтезированные звуки через Web Audio API ═══════════ */
globalThis.SoundEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let volume = 0.6;
  let muted = false;
  let ambientNodes = null; // активный белый шум

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : volume;
      // лёгкий компрессор для приятного звучания
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 4;
      masterGain.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function setVolume(v) {
    volume = v;
    if (masterGain && !muted) masterGain.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
  }
  function setMuted(m) {
    muted = m;
    if (masterGain) masterGain.gain.setTargetAtTime(m ? 0 : volume, ctx.currentTime, 0.05);
  }

  /* ── базовый тон с огибающей ── */
  function tone(freq, { dur = 0.3, type = 'sine', gain = 0.5, delay = 0, attack = 0.01, glide = 0 } = {}) {
    const c = ensureCtx();
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glide) osc.frequency.exponentialRampToValueAtTime(freq * glide, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(masterGain);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  /* ── шумовой всплеск (для «прибоя»/«отметки») ── */
  function noiseBurst({ dur = 0.25, gain = 0.25, freq = 1200, q = 0.8, delay = 0, sweep = 0 } = {}) {
    const c = ensureCtx();
    const t0 = c.currentTime + delay;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
    if (sweep) bp.frequency.exponentialRampToValueAtTime(freq * sweep, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp); bp.connect(g); g.connect(masterGain);
    src.start(t0);
  }

  /* ═══ Публичные звуки ═══ */

  // Старт блока: восходящий тёплый аккорд + мягкий «whoosh»
  function playStart() {
    noiseBurst({ dur: 0.5, gain: 0.12, freq: 500, sweep: 3, q: 0.5 });
    tone(261.63, { dur: 0.7, type: 'sine', gain: 0.32, delay: 0.02 });   // C4
    tone(329.63, { dur: 0.7, type: 'sine', gain: 0.26, delay: 0.08 });   // E4
    tone(392.00, { dur: 0.9, type: 'sine', gain: 0.24, delay: 0.14 });   // G4
    tone(523.25, { dur: 1.1, type: 'triangle', gain: 0.14, delay: 0.2 }); // C5
  }

  // Тик таймера: очень тихий короткий клик
  function playTick() {
    tone(1150, { dur: 0.045, type: 'square', gain: 0.05, attack: 0.002 });
  }

  // Завершение блока: колокольчиковая каденция
  function playDone() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      tone(f, { dur: 1.4, type: 'sine', gain: 0.3, delay: i * 0.12 });
      tone(f * 2, { dur: 0.9, type: 'sine', gain: 0.08, delay: i * 0.12 });
    });
    noiseBurst({ dur: 1.2, gain: 0.06, freq: 3000, q: 1.2, delay: 0.1 });
  }

  // Отметка задачи: короткий радостный «дзынь»
  function playCheck() {
    tone(880, { dur: 0.14, type: 'sine', gain: 0.28, attack: 0.003 });
    tone(1318.5, { dur: 0.3, type: 'sine', gain: 0.22, delay: 0.06 });
    noiseBurst({ dur: 0.12, gain: 0.05, freq: 5200, q: 2, delay: 0.05 });
  }

  // Звук перерыва — мягко, ниже
  function playBreak() {
    tone(392, { dur: 0.9, type: 'sine', gain: 0.26 });
    tone(493.88, { dur: 1.0, type: 'sine', gain: 0.22, delay: 0.12 });
    tone(587.33, { dur: 1.3, type: 'triangle', gain: 0.16, delay: 0.24 });
  }

  /* ═══ Генеративный белый шум (ambient) ═══ */
  function makeNoiseBuffer(kind) {
    const c = ensureCtx();
    const secs = 4;
    const len = c.sampleRate * secs;
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0, brownLast = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (0.98 * last + 0.02 * white) / 1.02;          // pink-ish
        brownLast = (brownLast + 0.02 * white) / 1.02;       // brown
        if (kind === 'waves' || kind === 'cafe') d[i] = brownLast * 6 + last * 0.5;
        else if (kind === 'wind') d[i] = last * 1.6 + brownLast * 3;
        else d[i] = last * 1.1 + white * 0.35;               // rain
      }
    }
    return buf;
  }

  function stopAmbient() {
    if (ambientNodes) {
      ambientNodes.forEach(n => { try { n.stop ? n.stop() : n.disconnect(); } catch(e){} });
      ambientNodes = null;
    }
  }

  // kind: waves | wind | rain | cafe | off
  function startAmbient(kind) {
    stopAmbient();
    if (!kind || kind === 'off') return;
    const c = ensureCtx();
    const nodes = [];
    const src = c.createBufferSource();
    src.buffer = makeNoiseBuffer(kind);
    src.loop = true;

    const filter = c.createBiquadFilter();
    const lfoGain = c.createGain();
    const amp = c.createGain();
    amp.gain.value = 0;

    if (kind === 'waves') {
      filter.type = 'lowpass'; filter.frequency.value = 500; filter.Q.value = .4;
      // LFO имитирует прибой
      const lfo = c.createOscillator(); lfo.frequency.value = 0.11;
      lfoGain.gain.value = 0.14;
      const base = 0.16;
      lfo.connect(lfoGain); lfoGain.connect(amp.gain);
      amp.gain.value = base;
      lfo.start(); nodes.push(lfo);
      src.playbackRate.value = 0.8;
    } else if (kind === 'wind') {
      filter.type = 'bandpass'; filter.frequency.value = 380; filter.Q.value = 0.55;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.19;
      const lfoF = c.createGain(); lfoF.gain.value = 240;
      lfo.connect(lfoF); lfoF.connect(filter.frequency);
      lfo.start(); nodes.push(lfo);
      amp.gain.value = 0.22;
    } else if (kind === 'rain') {
      filter.type = 'highpass'; filter.frequency.value = 900;
      amp.gain.value = 0.18;
      // редкие «капли»
      const drip = () => {
        if (!ambientNodes) return;
        noiseBurst({ dur: 0.05, gain: 0.03, freq: 2500 + Math.random() * 3000, q: 6 });
        setTimeout(drip, 300 + Math.random() * 1400);
      };
      setTimeout(drip, 500);
    } else if (kind === 'cafe') {
      filter.type = 'lowpass'; filter.frequency.value = 1100;
      amp.gain.value = 0.15;
      const murmur = () => {
        if (!ambientNodes) return;
        noiseBurst({ dur: 0.25 + Math.random() * 0.4, gain: 0.035, freq: 700 + Math.random() * 900, q: 1.5 });
        setTimeout(murmur, 700 + Math.random() * 2200);
      };
      setTimeout(murmur, 400);
    }

    src.connect(filter); filter.connect(amp); amp.connect(masterGain);
    src.start();
    nodes.push(src, filter, amp, lfoGain);
    ambientNodes = nodes;
  }

  function play(name) {
    ({ start: playStart, tick: playTick, done: playDone, check: playCheck, break: playBreak })[name]?.();
  }

  return { play, startAmbient, stopAmbient, setVolume, setMuted, ensureCtx };
})();
