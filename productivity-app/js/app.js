/* ═══════════ FlowFocus — логика приложения ═══════════ */
(() => {
  'use strict';

  /* ────────── Хранилище ────────── */
  const KEY = 'flowfocus_v1';
  const todayKey = () => new Date().toISOString().slice(0, 10);

  const defaults = {
    tasks: [],           // {id,text,prio,done,createdAt}
    blocks: [],          // {id,title,min,taskId,done}
    routines: [],        // {id,title,time,days:[..],history:{date:true}}
    stats: {},           // {date:{blocks:n,minutes:n,tasks:n}}
    settings: {
      focusLen: 25, shortBreak: 5, longBreak: 15, cycle: 4,
      autoBreak: true, autoNext: false,
      volume: .6, muted: false, theme: 'dark', accent: '#38bdf8',
      bg: 'sea', bgIntensity: 1, ambient: 'off'
    }
  };

  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)) || structuredClone(defaults); }
  catch { S = structuredClone(defaults); }
  S.settings = Object.assign({}, defaults.settings, S.settings || {});

  const save = () => localStorage.setItem(KEY, JSON.stringify(S));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const dayStat = d => (S.stats[d] ||= { blocks: 0, minutes: 0, tasks: 0 });

  /* ────────── Дата в шапке ────────── */
  $('#date-line').textContent = new Date().toLocaleDateString('ru-RU',
    { weekday: 'long', day: 'numeric', month: 'long' });

  /* ────────── Вкладки ────────── */
  $$('.tab').forEach(tab => tab.addEventListener('click', () => {
    $$('.tab').forEach(t => t.classList.toggle('active', t === tab));
    $$('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + tab.dataset.tab));
    SoundEngine.play('tick');
  }));

  /* ────────── Тосты ────────── */
  function toast(msg, kind = 'info', ms = 3200) {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = msg;
    $('#toast-stack').appendChild(el);
    setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 400); }, ms);
  }

  /* ══════════════ ТАЙМЕР ФОКУСА ══════════════ */
  const CIRC = 2 * Math.PI * 100;
  const ring = $('#ring-progress');
  ring.style.strokeDasharray = CIRC;

  let timer = { mode: 'focus', total: S.settings.focusLen * 60, left: S.settings.focusLen * 60, running: false, blockNum: 1, interval: null, currentBlockId: null };

  function fmt(sec) {
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function renderTimer() {
    $('#timer-time').textContent = fmt(timer.left);
    const frac = timer.total ? timer.left / timer.total : 0;
    ring.style.strokeDashoffset = CIRC * (1 - frac);
    document.body.classList.toggle('break-mode', timer.mode === 'break');
    document.body.classList.toggle('running', timer.running);
    $('#focus-mode-label').textContent = timer.mode === 'focus' ? 'СЕАНС ФОКУСА' : '☕ ПЕРЕРЫВ';
    $('#timer-cycle').textContent = timer.mode === 'focus'
      ? `блок ${timer.blockNum} · фокус`
      : `перерыв после блока ${timer.blockNum}`;
    $('#btn-start').textContent = timer.running ? '⏸ Пауза'
      : (timer.left === timer.total ? '▶ Начать блок' : '▶ Продолжить');
    document.title = timer.running
      ? `${fmt(timer.left)} · ${timer.mode === 'focus' ? 'фокус' : 'перерыв'} — FlowFocus`
      : 'FlowFocus — продуктивность по блокам';
  }

  function setPhase(mode, minutes) {
    clearInterval(timer.interval);
    timer.mode = mode; timer.total = minutes * 60; timer.left = timer.total; timer.running = false;
    renderTimer();
  }

  function startPause() {
    SoundEngine.ensureCtx();
    if (timer.running) {
      clearInterval(timer.interval); timer.running = false;
    } else {
      if (timer.left <= 0) timer.left = timer.total;
      timer.running = true;
      if (timer.mode === 'focus') SoundEngine.play('start'); else SoundEngine.play('break');
      if (S.settings.ambient !== 'off') SoundEngine.startAmbient(S.settings.ambient);
      timer.interval = setInterval(tick, 1000);
    }
    renderTimer();
  }

  let lastTickSec = 0;
  function tick() {
    timer.left--;
    // тик раз в минуту и на последних 5 секундах
    if (timer.left % 60 === 0 || timer.left <= 5) SoundEngine.play('tick');
    if (timer.left <= 0) finishPhase();
    renderTimer();
  }

  function finishPhase() {
    clearInterval(timer.interval); timer.running = false;
    SoundEngine.stopAmbient();
    if (timer.mode === 'focus') {
      SoundEngine.play('done');
      Confetti.burst(70);
      dayStat(todayKey()).blocks++;
      dayStat(todayKey()).minutes += Math.round(timer.total / 60);
      if (timer.currentBlockId) {
        const b = S.blocks.find(x => x.id === timer.currentBlockId);
        if (b) { b.done = true; if (b.taskId) completeTask(b.taskId); }
        timer.currentBlockId = null;
        renderBlocks();
      }
      updateStats(); updateStreak();
      toast(`🎉 Блок завершён! ${Math.round(timer.total / 60)} минут фокуса.`, 'success');
      const isLong = timer.blockNum % S.settings.cycle === 0;
      setPhase('break', isLong ? S.settings.longBreak : S.settings.shortBreak);
      if (S.settings.autoBreak) startPause();
    } else {
      SoundEngine.play('start');
      toast('Перерыв окончен — следующий блок готов 💪', 'info');
      timer.blockNum++;
      setPhase('focus', S.settings.focusLen);
      if (S.settings.autoNext) startPause();
    }
    renderTimer();
  }

  $('#btn-start').addEventListener('click', startPause);
  $('#btn-reset').addEventListener('click', () => {
    setPhase(timer.mode, Math.round(timer.total / 60));
    SoundEngine.stopAmbient();
  });
  $('#btn-skip').addEventListener('click', () => {
    timer.left = 1; if (!timer.running) finishPhase();
  });

  // быстрые пресеты
  $$('#quick-presets .chip').forEach(ch => ch.addEventListener('click', () => {
    $$('#quick-presets .chip').forEach(c => c.classList.remove('selected'));
    ch.classList.add('selected');
    const min = +ch.dataset.min;
    S.settings.focusLen = min;
    $('#set-focus-len').value = min;
    if (!timer.running && timer.mode === 'focus') setPhase('focus', min);
    save(); SoundEngine.play('tick');
  }));

  function showCurrentTask(text) {
    const b = $('#current-task-banner');
    if (text) { $('#current-task-text').textContent = text; b.style.display = 'flex'; }
    else b.style.display = 'none';
  }

  /* ══════════════ ЗАДАЧИ ══════════════ */
  let taskFilter = 'all';

  function addTask(text, prio) {
    S.tasks.unshift({ id: uid(), text, prio, done: false, createdAt: Date.now() });
    save(); renderTasks(); SoundEngine.play('check');
  }

  function completeTask(id) {
    const t = S.tasks.find(x => x.id === id);
    if (t && !t.done) { t.done = true; t.completedAt = todayKey(); dayStat(todayKey()).tasks++; }
  }

  function renderTasks() {
    const list = $('#task-list'); list.innerHTML = '';
    const tasks = S.tasks.filter(t =>
      taskFilter === 'all' ? true : taskFilter === 'done' ? t.done : !t.done);
    tasks.forEach((t, i) => {
      const li = document.createElement('li');
      li.className = 'task-item' + (t.done ? ' done' : '');
      li.style.animationDelay = Math.min(i * 40, 300) + 'ms';
      li.innerHTML = `
        <input type="checkbox" class="task-check" ${t.done ? 'checked' : ''}>
        <span class="task-text"></span>
        <span class="task-prio prio-${t.prio}">${{ high: '🔥', mid: '⭐', low: '🌱' }[t.prio]}</span>
        <button class="task-focus-btn" title="Фокус на этой задаче">🎯</button>
        <button class="task-del" title="Удалить">✕</button>`;
      li.querySelector('.task-text').textContent = t.text;
      li.querySelector('.task-check').addEventListener('change', e => {
        t.done = e.target.checked;
        if (t.done) {
          t.completedAt = todayKey(); dayStat(todayKey()).tasks++;
          SoundEngine.play('check');
          const remaining = S.tasks.filter(x => !x.done).length;
          if (remaining === 0 && S.tasks.length > 3) { Confetti.burst(120); toast('🏆 Все задачи выполнены! Великолепно!', 'success'); }
        } else {
          const ds = dayStat(todayKey()); ds.tasks = Math.max(0, ds.tasks - 1);
        }
        save(); renderTasks(); updateStats(); updateStreak();
      });
      li.querySelector('.task-focus-btn').addEventListener('click', () => {
        timer.currentBlockId = null;
        showCurrentTask(t.text);
        setPhase('focus', S.settings.focusLen);
        $('.tab[data-tab="focus"]').click();
        toast(`Фокус на задаче: «${t.text}»`, 'info');
      });
      li.querySelector('.task-del').addEventListener('click', () => {
        li.classList.add('removing');
        setTimeout(() => { S.tasks = S.tasks.filter(x => x.id !== t.id); save(); renderTasks(); renderBlockTaskOptions(); }, 280);
      });
      list.appendChild(li);
    });
    $('#tasks-empty').classList.toggle('show', tasks.length === 0);
    const active = S.tasks.filter(t => !t.done).length, done = S.tasks.length - active;
    $('#task-counter').textContent = S.tasks.length ? `${active} активных · ${done} выполнено` : '';
    $('#task-footer').style.display = S.tasks.length ? 'flex' : 'none';
  }

  $('#task-form').addEventListener('submit', e => {
    e.preventDefault();
    const inp = $('#task-input'), text = inp.value.trim();
    if (!text) return;
    addTask(text, $('#task-priority').value);
    inp.value = '';
  });
  $$('#task-filters .chip').forEach(ch => ch.addEventListener('click', () => {
    $$('#task-filters .chip').forEach(c => c.classList.remove('selected'));
    ch.classList.add('selected'); taskFilter = ch.dataset.filter; renderTasks();
  }));
  $('#btn-clear-done').addEventListener('click', () => {
    S.tasks = S.tasks.filter(t => !t.done); save(); renderTasks(); toast('Выполненные задачи удалены', 'info');
  });

  /* советы по задачам */
  const advices = [
    'Формулируйте задачу как конкретное действие: не «проект», а «написать введение на 300 слов».',
    'Разбейте большую задачу на шаги по 25–50 минут — ровно на один фокус-блок.',
    'Каждый вечер выбирайте 3 главные задачи на завтра. Утром начните с самой важной («съешьте лягушку»).',
    'Если задача зависла — сформулируйте следующий минимальный шаг. Мелкое действие легче начать.',
    'Помечайте приоритет честно: если всё «срочно» — значит, ничего не срочно.',
    'Закрывайте задачи со звуком ✓ — мозг запоминает награду и хочет ещё.',
    'Не держите задачи в голове: выгрузите все в список, голова нужна для мышления, а не для хранения.',
  ];
  function rollAdvice() {
    $('#task-advice p').textContent = advices[Math.floor(Math.random() * advices.length)];
  }
  $('#btn-task-advice').addEventListener('click', rollAdvice);
  rollAdvice();

  /* ══════════════ БЛОКИ (план) ══════════════ */
  function renderBlocks() {
    const wrap = $('#block-plan-list'); wrap.innerHTML = '';
    S.blocks.forEach(b => {
      const div = document.createElement('div');
      div.className = 'block-item' + (b.done ? ' done' : '');
      const task = b.taskId ? S.tasks.find(t => t.id === b.taskId) : null;
      div.innerHTML = `<span class="bi-min">${b.min}м</span><span class="bi-title"></span>
        <button class="bi-start" title="Запустить">▶</button><button class="bi-del" title="Удалить">✕</button>`;
      div.querySelector('.bi-title').textContent = b.title + (task ? ` → ${task.text}` : '');
      div.querySelector('.bi-start').addEventListener('click', () => {
        timer.currentBlockId = b.id;
        showCurrentTask(task ? task.text : b.title);
        setPhase('focus', b.min);
        startPause();
        toast(`Блок «${b.title}» запущен ⏳`, 'success');
      });
      div.querySelector('.bi-del').addEventListener('click', () => {
        S.blocks = S.blocks.filter(x => x.id !== b.id); save(); renderBlocks();
      });
      wrap.appendChild(div);
    });
  }

  function renderBlockTaskOptions() {
    const sel = $('#nb-task');
    sel.innerHTML = '<option value="">— без задачи —</option>';
    S.tasks.filter(t => !t.done).forEach(t => {
      const o = document.createElement('option');
      o.value = t.id; o.textContent = t.text; sel.appendChild(o);
    });
  }

  $('#btn-add-block').addEventListener('click', () => {
    renderBlockTaskOptions();
    $('#nb-min').value = S.settings.focusLen;
    $('#modal-block').hidden = false;
    $('#nb-title').focus();
  });
  $('#nb-cancel').addEventListener('click', () => $('#modal-block').hidden = true);
  $('#nb-save').addEventListener('click', () => {
    const title = $('#nb-title').value.trim() || 'Фокус-блок';
    const min = Math.max(5, Math.min(120, +$('#nb-min').value || 25));
    S.blocks.push({ id: uid(), title, min, taskId: $('#nb-task').value || null, done: false });
    save(); renderBlocks();
    $('#modal-block').hidden = true; $('#nb-title').value = '';
    toast(`Блок «${title}» запланирован 🗓`, 'success');
    SoundEngine.play('check');
  });

  /* ══════════════ РУТИНЫ ══════════════ */
  const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  function routineDueToday(r) { return r.days.includes(new Date().getDay()); }

  function renderRoutines() {
    const list = $('#routine-list'); list.innerHTML = '';
    const due = S.routines.filter(routineDueToday);
    const doneCount = due.filter(r => r.history[todayKey()]).length;

    due.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
    due.forEach((r, i) => {
      const done = !!r.history[todayKey()];
      const li = document.createElement('li');
      li.className = 'routine-item' + (done ? ' done' : '');
      li.style.animationDelay = i * 50 + 'ms';
      const streak = routineStreak(r);
      li.innerHTML = `
        <input type="checkbox" class="task-check" ${done ? 'checked' : ''}>
        <span class="routine-title"></span>
        ${r.time ? `<span class="routine-time-tag">${r.time}</span>` : ''}
        ${r.days.length < 7 ? `<span class="routine-days-tag">${r.days.map(d => DAY_NAMES[d]).join(' ')}</span>` : ''}
        ${streak > 1 ? `<span class="routine-streak">🔥${streak}</span>` : ''}`;
      li.querySelector('.routine-title').textContent = r.title;
      li.querySelector('.task-check').addEventListener('change', e => {
        if (e.target.checked) { r.history[todayKey()] = true; SoundEngine.play('check'); }
        else delete r.history[todayKey()];
        save(); renderRoutines(); renderWeekGrid(); updateStreak();
        if (due.every(x => x.history[todayKey()]) && due.length >= 3) {
          Confetti.burst(100); toast('🌟 Все рутины на сегодня выполнены!', 'success');
        }
      });
      li.querySelector('.routine-title').addEventListener('click', () => openRoutineModal(r.id));
      list.appendChild(li);
    });

    // обычные (не на сегодня) — приглушённо
    S.routines.filter(r => !routineDueToday(r)).forEach(r => {
      const li = document.createElement('li');
      li.className = 'routine-item'; li.style.opacity = '.45';
      li.innerHTML = `<span class="task-check" style="pointer-events:none"></span>
        <span class="routine-title"></span>
        <span class="routine-days-tag">${r.days.map(d => DAY_NAMES[d]).join(' ')}</span>`;
      li.querySelector('.routine-title').textContent = r.title;
      li.querySelector('.routine-title').addEventListener('click', () => openRoutineModal(r.id));
      list.appendChild(li);
    });

    $('#routines-empty').classList.toggle('show', S.routines.length === 0);
    $('#routine-progress-pill').textContent = `${doneCount} / ${due.length}`;
    $('#routine-progress-fill').style.width = due.length ? (doneCount / due.length * 100) + '%' : '0%';
  }

  function routineStreak(r) {
    let s = 0; const d = new Date();
    // сегодня ещё не выполнено — не обрываем серию, считаем с вчера
    if (!r.history[todayKey()]) d.setDate(d.getDate() - 1);
    for (let i = 0; i < 400; i++) {
      const key = d.toISOString().slice(0, 10);
      if (!r.days.includes(d.getDay())) { d.setDate(d.getDate() - 1); continue; }
      if (r.history[key]) s++; else break;
      d.setDate(d.getDate() - 1);
    }
    return s;
  }

  $('#routine-form').addEventListener('submit', e => {
    e.preventDefault();
    const title = $('#routine-input').value.trim();
    if (!title) return;
    const daysSel = Array.from($('#routine-days').selectedOptions).map(o => +o.value);
    S.routines.push({
      id: uid(), title, time: $('#routine-time').value || '',
      days: daysSel.length ? daysSel : [0, 1, 2, 3, 4, 5, 6], history: {}
    });
    save(); renderRoutines(); renderWeekGrid();
    $('#routine-input').value = ''; $('#routine-time').value = '';
    toast(`Рутина «${title}» добавлена`, 'success');
    SoundEngine.play('check');
  });

  // модалка рутины
  let editingRoutine = null;
  function openRoutineModal(id) {
    editingRoutine = S.routines.find(r => r.id === id);
    if (!editingRoutine) return;
    $('#rt-title').value = editingRoutine.title;
    $('#rt-time').value = editingRoutine.time;
    $$('#rt-days .chip').forEach(ch => ch.classList.toggle('selected', editingRoutine.days.includes(+ch.dataset.d)));
    $('#modal-routine').hidden = false;
  }
  $$('#rt-days .chip').forEach(ch => ch.addEventListener('click', () => ch.classList.toggle('selected')));
  $('#rt-cancel').addEventListener('click', () => $('#modal-routine').hidden = true);
  $('#rt-save').addEventListener('click', () => {
    if (!editingRoutine) return;
    editingRoutine.title = $('#rt-title').value.trim() || editingRoutine.title;
    editingRoutine.time = $('#rt-time').value;
    editingRoutine.days = $$('#rt-days .chip.selected').map(ch => +ch.dataset.d);
    if (!editingRoutine.days.length) editingRoutine.days = [0, 1, 2, 3, 4, 5, 6];
    save(); renderRoutines(); renderWeekGrid();
    $('#modal-routine').hidden = true;
  });
  $('#rt-delete').addEventListener('click', () => {
    if (!editingRoutine) return;
    S.routines = S.routines.filter(r => r.id !== editingRoutine.id);
    save(); renderRoutines(); renderWeekGrid();
    $('#modal-routine').hidden = true;
    toast('Рутина удалена', 'info');
  });

  // недельная сетка
  function renderWeekGrid() {
    const grid = $('#week-grid'); grid.innerHTML = '';
    const now = new Date();
    const mondayIdx = (now.getDay() + 6) % 7;
    const start = new Date(now); start.setDate(now.getDate() - mondayIdx);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const due = S.routines.filter(r => r.days.includes(d.getDay()));
      const done = due.filter(r => r.history[key]).length;
      const cell = document.createElement('div');
      cell.className = 'week-cell';
      let cls = 'wc-dot';
      if (due.length && done === due.length) cls += ' full';
      else if (done > 0) cls += ' part';
      if (key === todayKey()) cls += ' today';
      cell.innerHTML = `<span class="wc-day">${DAY_NAMES[d.getDay()]}</span>
        <div class="${cls}">${due.length && done === due.length ? '✓' : (done > 0 ? done : '')}</div>`;
      grid.appendChild(cell);
    }
  }

  /* ══════════════ СТАТИСТИКА / СТРИК ══════════════ */
  function updateStats() {
    const st = dayStat(todayKey());
    $('#stat-blocks').textContent = st.blocks;
    $('#stat-minutes').textContent = st.minutes;
    $('#stat-tasks').textContent = st.tasks;
  }

  function computeStreak() {
    let s = 0; const d = new Date();
    for (let i = 0; i < 400; i++) {
      const key = d.toISOString().slice(0, 10);
      const productive = isProductive(key);
      if (productive) s++;
      else if (i > 0) break;   // сегодня ещё может быть не закончен
      d.setDate(d.getDate() - 1);
    }
    return s;
  }
  function isProductive(key) {
    const st = S.stats[key];
    const due = S.routines.filter(r => r.days.includes(new Date(key + 'T12:00').getDay()));
    const routinesDone = due.length > 0 && due.every(r => r.history[key]);
    const tasksDone = (S.tasks.some(t => t.completedAt === key));
    return (st && st.blocks > 0) || routinesDone || tasksDone;
  }
  function updateStreak() {
    const el = $('#streak-count');
    const prev = +el.textContent;
    const cur = computeStreak();
    el.textContent = cur;
    if (cur > prev) {
      $('#streak-badge').classList.remove('bump'); void $('#streak-badge').offsetWidth;
      $('#streak-badge').classList.add('bump');
    }
  }

  /* ══════════════ МЫСЛЬ ДНЯ ══════════════ */
  const mantras = [
    '«Секрет продвижения вперёд — начать.» — Марк Твен',
    '«Чтобы сделать великие дела, нужно не только действовать, но и мечтать.» — Анатоль Франс',
    '«Вы не обязаны видеть всю лестницу. Просто сделайте первый шаг.» — Мартин Лютер Кинг',
    '«Фокус — это говорить „нет“ тысяче хороших идей.» — Стив Джобс',
    '«Продуктивность — это не больше дел, а правильные дела.» — Тим Феррис',
    '«Discipline equals freedom.» — Jocko Willink',
    '«Лучшее время начать было час назад. Второе лучшее — сейчас.»',
    '«Мы то, что повторяем снова и снова. Превосходство — не поступок, а привычка.» — Аристотель',
    '«Отдых — часть работы, а не награда за неё.»',
    '«Одна задача за раз. Один вдох за раз. Сейчас — достаточно.»',
  ];
  function rollMantra() {
    $('#mantra-text').textContent = mantras[Math.floor(Math.random() * mantras.length)];
  }
  $('#btn-mantra').addEventListener('click', rollMantra);
  rollMantra();

  /* ══════════════ ПАМЯТКИ ══════════════ */
  const TIPS = {
    methods: [
      { icon: '🍅', title: 'Метод Помодоро', text: 'Классика: 25 минут работы + 5 минут перерыва. После четырёх «помидоров» — длинный перерыв 15–30 минут. Таймер снижает прокрастинацию: легко согласиться всего на 25 минут.', steps: ['Выберите одну задачу', 'Работайте без отвлечений до звона', 'Обязательно встаньте на перерыве'] },
      { icon: '🦁', title: 'Deep Work (глубокая работа)', text: 'Долгие блоки концентрации на сложных задачах без телефона и мессенджеров. 90-минутные блоки соответствуют ультрадианным ритмам мозга.', steps: ['Уберите телефон в другую комнату', 'Закройте лишние вкладки', 'Начните с самого сложного утром'] },
      { icon: '🐸', title: 'Съешьте лягушку', text: 'Самую неприятную и важную задачу делайте первой с утра. После неё весь день ощущается лёгким.', steps: ['Определите «лягушку» с вечера', 'Не проверяйте почту до неё', 'Наградите себя после'] },
      { icon: '🔢', title: 'Правило 3 задач', text: 'Выберите всего 3 задачи, которые сделают день успешным. Ограничение создаёт ясность и защищает от распыления.', steps: ['Запишите 3 — не 10', 'Нумеруйте по важности', 'Вечером отметьте результат'] },
      { icon: '⏳', title: 'Time-blocking', text: 'Планируйте не список, а календарь: каждой задаче — свой блок времени. Так иллюзия «всё успею» превращается в честный план.', steps: ['Блокируйте утро для глубокой работы', 'Группируйте мелочь в один блок', 'Оставляйте буфер 20% времени'] },
      { icon: '🧼', title: 'Метод 2 минут × 5', text: 'Разгон перед большой задачей: 5 минут делайте что угодно, связанное с ней. Инерция старта сильнее мотивации.', steps: ['Поставьте таймер на 5 минут', 'Откройте файл, напишите заголовок', 'Продолжайте, если «зашло»'] },
    ],
    habits: [
      { icon: '🧱', title: 'Habit stacking', text: 'Привязывайте новую рутину к существующей: «после того как налью кофе — 10 минут планирования». Контекст запускает привычку автоматически.', steps: ['Найдите якорь (устоявшееся действие)', 'Формула: после X я делаю Y', 'Начинайте с микро-версии'] },
      { icon: '📈', title: 'Не прерывай цепочку', text: 'Отмечайте дни выполнения на календаре. Визуальная цепочка 🔥 — мощный мотиватор: не хочется обрывать серию.', steps: ['Ставьте отметку каждый день', 'Пропуск — только один подряд', 'Празднуйте каждую неделю серии'] },
      { icon: '🌅', title: 'Утренний ритуал', text: 'Первые 60 минут задают тон дню. Типичный набор: вода, движение, свет, планирование — и никаких соцсетей до завершения ритуала.', steps: ['Приготовьте всё с вечера', 'Никакого телефона первые 30 минут', 'Зарядите привычку звуком/светом'] },
      { icon: '🌙', title: 'Вечерний shutdown', text: 'Мозг отдыхает, когда уверен, что всё под контролем. Заканчивайте день ритуалом: записать незакрытые хвосты и план на завтра.', steps: ['Выгрузите мысли в список', 'Выберите 3 задачи завтра', 'Определите «лягушку» дня'] },
      { icon: '🎯', title: 'Make it easy', text: 'Снизьте трение: форма для бега у кровати, рабочий файл открыт, приложение на главном экране. Привычка побеждает силу воли.', steps: ['Подготовьте окружение заранее', 'Уберите трение для нужного действия', 'Добавьте трение для вредного'] },
    ],
    energy: [
      { icon: '🚶', title: 'Активный перерыв', text: 'На перерыве вставайте: проход, растяжка, вода. Экран-скроллинг не восстанавливает внимание — движение восстанавливает.', steps: ['Правило 20-20-20 для глаз', '2 минуты ходьбы = перезагрузка', 'Сделайте 10 приседаний'] },
      { icon: '💧', title: 'Вода и еда для мозга', text: 'Лёгкое обезвоживание уже снижает концентрацию. Держите бутылку воды на столе и не работайте голодным на сложных задачах.', steps: ['Стакан воды сразу после пробуждения', 'Поставьте бутылку рядом с рабочим местом', 'Орехи вместо сладкого перекуса'] },
      { icon: '😴', title: 'Сон — фундамент', text: 'Продуктивность начинается с ночи. 7–9 часов сна, регулярное время подъёма. Недосып крадёт working memory и силу воли.', steps: ['Отбой и подъём в одно время', 'Без экранов за 30 минут до сна', 'Прохлада и темнота в комнате'] },
      { icon: '🌬️', title: 'Дыхание 4-7-8', text: 'Быстрый способ снять тревогу перед сложной задачей: вдох 4 сек, задержка 7, выдох 8. Три цикла — и вы спокойнее.', steps: ['Сядьте прямо, язык к нёбу', '4 сек вдох носом', '7 сек задержка, 8 сек выдох ртом'] },
      { icon: '☀️', title: 'Свет и ритмы', text: 'Яркий свет утром калибрует циркадные ритмы и даёт энергию днём. Работайте у окна, выходите на улицу в обед.', steps: ['10 минут дневного света утром', 'Рабочее место ближе к окну', 'Прогулка в обеденный перерыв'] },
    ],
    quotes: [
      { icon: '✨', title: 'О начале', text: '«Начинать — это половина дела.» — Пифагор. Самый ценный ресурс — решимость сделать первый шаг, пусть даже несовершенный.' },
      { icon: '🧭', title: 'О направлении', text: '«Если человек знает, куда плывёт, весь мир даёт ему дорогу.» — Сенека. Ясность цели экономит больше времени, чем любой таймер.' },
      { icon: '🪜', title: 'О малых шагах', text: '«Кто не может лететь, тот ползёт; кто не может ползти, тот хотя бы быстро идёт.» Постоянство бьёт интенсивность: маленькие шаги каждый день ведут дальше больших рывков.' },
      { icon: '🌊', title: 'О потоке', text: '«Поток возникает, когда вызов чуть выше ваших навыков.» — Михай Чиксентмихайи. Слишком легко — скука, слишком сложно — тревога. Настройте блоки под «ещё выше».' },
      { icon: '🕰️', title: 'О времени', text: '«Вы всегда можете найти время для того, что действительно важно.» — Франсис Мерил. Проблема не во времени, а в приоритетах.' },
      { icon: '🌱', title: 'О росте', text: '«Лучше 1% улучшения каждый день, чем рывок раз в год.» — сложный процент привычек превращает маленькие шаги в большие перемены.' },
    ]
  };

  function renderTips(setName) {
    const grid = $('#tips-grid'); grid.innerHTML = '';
    (TIPS[setName] || []).forEach((tip, i) => {
      const card = document.createElement('div');
      card.className = 'card tip-card';
      card.style.animationDelay = i * 70 + 'ms';
      card.innerHTML = `<span class="tip-icon">${tip.icon}</span><h4></h4><p></p>
        ${tip.steps ? `<ul class="tip-steps">${tip.steps.map(s => `<li>${s}</li>`).join('')}</ul>` : ''}`;
      card.querySelector('h4').textContent = tip.title;
      card.querySelector('p').textContent = tip.text;
      grid.appendChild(card);
    });
  }
  $$('#tips-tabs .chip').forEach(ch => ch.addEventListener('click', () => {
    $$('#tips-tabs .chip').forEach(c => c.classList.remove('selected'));
    ch.classList.add('selected'); renderTips(ch.dataset.tipset); SoundEngine.play('tick');
  }));
  renderTips('methods');

  /* ══════════════ НАСТРОЙКИ ══════════════ */
  const st = S.settings;

  function applyTheme() {
    document.body.classList.toggle('light', st.theme === 'light');
    document.documentElement.style.setProperty('--accent', st.accent);
  }
  function applyBg() {
    Backgrounds.set(st.bg);
    Backgrounds.setIntensity(st.bgIntensity);
    $$('#bg-picker .bg-option').forEach(b => b.classList.toggle('selected', b.dataset.bg === st.bg));
  }

  // привязка полей
  const bindNum = (sel, key, onChange) => {
    const el = $(sel); el.value = st[key];
    el.addEventListener('change', () => {
      st[key] = Math.max(+el.min || 0, Math.min(+el.max || 999, +el.value || 0));
      el.value = st[key]; save(); onChange?.();
    });
  };
  bindNum('#set-focus-len', 'focusLen', () => {
    if (!timer.running && timer.mode === 'focus') setPhase('focus', st.focusLen);
    $$('#quick-presets .chip').forEach(c => c.classList.toggle('selected', +c.dataset.min === st.focusLen));
  });
  bindNum('#set-short-break', 'shortBreak');
  bindNum('#set-long-break', 'longBreak');
  bindNum('#set-cycle', 'cycle');

  const bindCheck = (sel, key) => {
    const el = $(sel); el.checked = st[key];
    el.addEventListener('change', () => { st[key] = el.checked; save(); SoundEngine.play('tick'); });
  };
  bindCheck('#set-auto-break', 'autoBreak');
  bindCheck('#set-auto-next', 'autoNext');

  $('#set-volume').value = st.volume;
  $('#set-volume').addEventListener('input', e => {
    st.volume = +e.target.value; SoundEngine.setVolume(st.volume); save();
  });
  $$('.sound-test-row [data-sound]').forEach(b =>
    b.addEventListener('click', () => { SoundEngine.ensureCtx(); SoundEngine.play(b.dataset.sound); }));

  $('#set-theme').value = st.theme;
  $('#set-theme').addEventListener('change', e => { st.theme = e.target.value; applyTheme(); save(); });

  $$('#accent-row .accent-dot').forEach(dot => {
    dot.classList.toggle('selected', dot.dataset.accent === st.accent);
    dot.addEventListener('click', () => {
      st.accent = dot.dataset.accent;
      $$('#accent-row .accent-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected'); applyTheme(); save(); SoundEngine.play('check');
    });
  });

  $$('#bg-picker .bg-option').forEach(opt => opt.addEventListener('click', () => {
    st.bg = opt.dataset.bg; applyBg(); save(); SoundEngine.play('tick');
  }));
  $('#bg-intensity').value = st.bgIntensity;
  $('#bg-intensity').addEventListener('input', e => {
    st.bgIntensity = +e.target.value; Backgrounds.setIntensity(st.bgIntensity); save();
  });

  $$('#ambient-row .chip').forEach(ch => {
    ch.classList.toggle('selected', ch.dataset.amb === st.ambient);
    ch.addEventListener('click', () => {
      st.ambient = ch.dataset.amb;
      $$('#ambient-row .chip').forEach(c => c.classList.remove('selected'));
      ch.classList.add('selected'); save();
      SoundEngine.ensureCtx();
      if (st.ambient === 'off') { SoundEngine.stopAmbient(); toast('Фоновый звук выключен', 'info'); }
      else { SoundEngine.startAmbient(st.ambient); toast(`🎵 Играет: ${ch.textContent.trim()}`, 'info'); }
    });
  });

  // mute
  function syncMuteIcon() {
    $('#icon-sound-on').style.display = st.muted ? 'none' : 'block';
    $('#icon-sound-off').style.display = st.muted ? 'block' : 'none';
  }
  $('#btn-mute').addEventListener('click', () => {
    st.muted = !st.muted; SoundEngine.setMuted(st.muted); syncMuteIcon(); save();
    if (!st.muted) SoundEngine.play('tick');
  });

  // экспорт/импорт/сброс
  $('#btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `flowfocus-${todayKey()}.json`; a.click();
    toast('Данные экспортированы 💾', 'success');
  });
  $('#btn-import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result);
        if (!data.tasks || !data.settings) throw 0;
        S = Object.assign(structuredClone(defaults), data);
        S.settings = Object.assign({}, defaults.settings, S.settings);
        save(); location.reload();
      } catch { toast('Некорректный файл 😕', 'info'); }
    };
    rd.readAsText(f);
  });
  $('#btn-reset-all').addEventListener('click', () => {
    if (confirm('Удалить все данные и настройки?')) {
      localStorage.removeItem(KEY); location.reload();
    }
  });

  // закрытие модалок по фону
  $$('.modal-backdrop').forEach(md => md.addEventListener('click', e => {
    if (e.target === md) md.hidden = true;
  }));

  // горячие клавиши
  document.addEventListener('keydown', e => {
    if (e.target.matches('input,select,textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); startPause(); }
    if (e.key === 'Escape') $$('.modal-backdrop').forEach(m => m.hidden = true);
    if (e.key >= '1' && e.key <= '5') $$('.tab')[+e.key - 1]?.click();
  });

  // новая ночь — обновить день
  setInterval(() => {
    const dl = $('#date-line');
    const fresh = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    if (dl.textContent !== fresh) { dl.textContent = fresh; renderRoutines(); renderWeekGrid(); updateStats(); updateStreak(); }
  }, 60000);

  /* ══════════════ ИНИЦИАЛИЗАЦИЯ ══════════════ */
  applyTheme(); applyBg(); syncMuteIcon();
  SoundEngine.setVolume(st.volume); SoundEngine.setMuted(st.muted);
  setPhase('focus', st.focusLen);
  $$('#quick-presets .chip').forEach(c => c.classList.toggle('selected', +c.dataset.min === st.focusLen));
  renderTasks(); renderBlocks(); renderRoutines(); renderWeekGrid(); updateStats(); updateStreak();

  // приветствие
  setTimeout(() => {
    const h = new Date().getHours();
    const greet = h < 6 ? 'Доброй ночи 🌙' : h < 12 ? 'Доброе утро ☀️' : h < 18 ? 'Добрый день 🌤' : 'Добрый вечер 🌆';
    toast(`${greet}! Запланируйте первый фокус-блок — пробел тоже работает.`, 'info', 4200);
  }, 800);
})();
