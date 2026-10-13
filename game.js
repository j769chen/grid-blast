(() => {
  const N = 8;
  const COLORS = ['#ff4d5e', '#ffa62b', '#ffe14d', '#4da3ff', '#3fe0ff', '#ff5fd2', '#eef3ff'];
  const MAX_CHARGE = 5;
  const START_CHARGE = 3;
  const CORE_CHANCE = 0.4;
  const PTS = { cell: 10, line: 100, core: 40, perfect: 3000 };
  const DEFS = [
    [0.35, ['#']],
    [1, ['##']], [1, ['#', '#']],
    [1, ['###']], [1, ['#', '#', '#']],
    [0.9, ['####']], [0.9, ['#', '#', '#', '#']],
    [0.55, ['#####']], [0.55, ['#', '#', '#', '#', '#']],
    [1.2, ['##', '##']],
    [0.45, ['###', '###', '###']],
    [0.75, ['###', '###']], [0.75, ['##', '##', '##']],
    [0.8, ['##', '#.']], [0.8, ['##', '.#']], [0.8, ['#.', '##']], [0.8, ['.#', '##']],
    [0.45, ['###', '#..', '#..']], [0.45, ['###', '..#', '..#']], [0.45, ['#..', '#..', '###']], [0.45, ['..#', '..#', '###']],
    [0.6, ['#.', '#.', '##']], [0.6, ['.#', '.#', '##']], [0.6, ['##', '#.', '#.']], [0.6, ['##', '.#', '.#']],
    [0.6, ['###', '#..']], [0.6, ['###', '..#']], [0.6, ['#..', '###']], [0.6, ['..#', '###']],
    [0.6, ['###', '.#.']], [0.6, ['.#.', '###']], [0.6, ['#.', '##', '#.']], [0.6, ['.#', '##', '.#']],
    [0.5, ['##.', '.##']], [0.5, ['.##', '##.']], [0.5, ['#.', '##', '.#']], [0.5, ['.#', '##', '#.']],
    [0.25, ['#.', '.#']], [0.25, ['.#', '#.']],
  ];
  const BASE = DEFS.map(([weight, rows]) => {
    const cells = [];
    rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') cells.push([r, c]); }));
    return { w: rows[0].length, h: rows.length, cells, weight };
  });
  const TOTAL = BASE.reduce((a, s) => a + s.weight, 0);
  const PRAISE = ['', '', 'Double!', 'Triple!', 'Quad!', 'Overload!', 'Meltdown!'];

  const $ = (id) => document.getElementById(id);
  const app = $('app'), cellsEl = $('cells'), fxEl = $('fx'), trayEl = $('tray'), ghost = $('ghost');
  const scoreEl = $('score'), bestEl = $('best'), chargeEl = $('charge'), pipsEl = $('pips'), overEl = $('over');
  const soundBtn = $('sound'), restartBtn = $('restart');
  const slots = [...trayEl.children];
  const rotBtns = [...$('rots').children];
  const fmt = (n) => n.toLocaleString('en-US');

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem('overclock.' + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('overclock.' + k, JSON.stringify(v)); } catch (e) {} },
  };

  let S = null;
  let shown = 0;
  let soundOn = store.get('sound') !== false;
  let drag = null;
  let preview = [];

  for (let i = 0; i < N * N; i++) {
    const d = document.createElement('div');
    d.className = 'cell';
    cellsEl.appendChild(d);
  }
  const cellEls = [...cellsEl.children];
  for (let i = 0; i < MAX_CHARGE; i++) pipsEl.appendChild(document.createElement('i'));

  function pickShape() {
    let x = Math.random() * TOTAL;
    for (let i = 0; i < BASE.length; i++) { x -= BASE[i].weight; if (x <= 0) return i; }
    return 0;
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function makePiece(s, c) {
    const b = BASE[s];
    return { w: b.w, h: b.h, cells: b.cells.map((x) => x.slice()), c, core: -1 };
  }
  function rotate(p) {
    return { ...p, w: p.h, h: p.w, cells: p.cells.map(([r, c]) => [c, p.h - 1 - r]) };
  }

  function fits(grid, p, r, c) {
    if (r < 0 || c < 0 || r + p.h > N || c + p.w > N) return false;
    return p.cells.every(([dr, dc]) => grid[(r + dr) * N + c + dc] < 0);
  }
  function canPlace(grid, p) {
    for (let r = 0; r <= N - p.h; r++) for (let c = 0; c <= N - p.w; c++) if (fits(grid, p, r, c)) return true;
    return false;
  }
  function turnsToFit(p, maxTurns) {
    let q = p;
    for (let k = 0; k <= Math.min(3, maxTurns); k++) {
      if (canPlace(S.grid, q)) return k;
      q = rotate(q);
    }
    return -1;
  }
  function anyMove() { return S.tray.some((p) => p && turnsToFit(p, S.charge) >= 0); }

  function fullLines(grid) {
    const rows = [], cols = [];
    for (let i = 0; i < N; i++) {
      let row = true, col = true;
      for (let j = 0; j < N; j++) { if (grid[i * N + j] < 0) row = false; if (grid[j * N + i] < 0) col = false; }
      if (row) rows.push(i);
      if (col) cols.push(i);
    }
    return { rows, cols };
  }
  function lineCells({ rows, cols }) {
    const set = new Set();
    rows.forEach((r) => { for (let c = 0; c < N; c++) set.add(r * N + c); });
    cols.forEach((c) => { for (let r = 0; r < N; r++) set.add(r * N + c); });
    return set;
  }

  function newTray() {
    for (let t = 0; t < 40; t++) {
      const colors = shuffle([0, 1, 2, 3, 4, 5, 6]);
      const tray = [0, 1, 2].map((i) => makePiece(pickShape(), colors[i]));
      if (Math.random() < CORE_CHANCE) {
        const options = tray.filter((p) => p.cells.length > 1);
        if (options.length) {
          const p = options[Math.floor(Math.random() * options.length)];
          p.core = Math.floor(Math.random() * p.cells.length);
        }
      }
      if (tray.some((p) => turnsToFit(p, S.charge) >= 0)) return tray;
    }
    return [0, 1, 2].map((i) => makePiece(0, i));
  }

  function seed() {
    let placed = 0;
    for (let tries = 0; tries < 200 && placed < 4; tries++) {
      const p = makePiece(pickShape(), Math.floor(Math.random() * COLORS.length));
      if (p.cells.length > 5) continue;
      const r = Math.floor(Math.random() * (N - p.h + 1));
      const c = Math.floor(Math.random() * (N - p.w + 1));
      if (!fits(S.grid, p, r, c)) continue;
      const g = S.grid.slice();
      p.cells.forEach(([dr, dc]) => { g[(r + dr) * N + c + dc] = p.c; });
      const lines = fullLines(g);
      if (lines.rows.length || lines.cols.length) continue;
      S.grid = g;
      placed++;
    }
  }

  function newGame() {
    S = {
      grid: Array(N * N).fill(-1),
      cores: Array(N * N).fill(false),
      tray: [],
      score: 0,
      best: store.get('best') || 0,
      combo: 0,
      idle: 0,
      charge: START_CHARGE,
      over: false,
    };
    seed();
    S.tray = newTray();
    shown = 0;
    overEl.hidden = true;
    save();
    render({ deal: true });
  }

  function save() { store.set('game', S); }

  function render(opts = {}) {
    renderBoard();
    renderTray(opts);
    renderCharge();
    bestEl.textContent = fmt(S.best);
    tickScore();
  }

  function renderBoard() {
    S.grid.forEach((v, i) => {
      const el = cellEls[i];
      el.className = v < 0 ? 'cell' : S.cores[i] ? 'cell filled core' : 'cell filled';
      if (v >= 0) el.style.setProperty('--c', COLORS[v]); else el.style.removeProperty('--c');
    });
  }

  function buildPiece(p) {
    const el = document.createElement('div');
    el.className = 'piece';
    el.style.gridTemplateColumns = `repeat(${p.w}, var(--cs))`;
    el.style.gridTemplateRows = `repeat(${p.h}, var(--cs))`;
    p.cells.forEach(([r, c], k) => {
      const b = document.createElement('div');
      b.className = k === p.core ? 'block core' : 'block';
      b.style.gridRow = r + 1;
      b.style.gridColumn = c + 1;
      b.style.setProperty('--c', COLORS[p.c]);
      el.appendChild(b);
    });
    return el;
  }

  function renderTray({ deal = false, spun = -1 } = {}) {
    slots.forEach((slot, i) => {
      slot.innerHTML = '';
      slot.classList.remove('lifted', 'nofit');
      const p = S.tray[i];
      const btn = rotBtns[i];
      btn.classList.toggle('gone', !p);
      btn.classList.remove('ready');
      btn.setAttribute('aria-disabled', String(!p || S.charge < 1));
      if (!p) return;
      const el = buildPiece(p);
      if (deal) el.classList.add('deal');
      if (spun === i) el.classList.add('spun');
      slot.appendChild(el);
      const turns = turnsToFit(p, S.charge);
      if (turns < 0) slot.classList.add('nofit');
      else if (turns > 0) btn.classList.add('ready');
    });
  }

  function renderCharge() {
    [...pipsEl.children].forEach((el, i) => el.classList.toggle('on', i < S.charge));
    chargeEl.setAttribute('aria-label', `Rotation charges: ${S.charge} of ${MAX_CHARGE}`);
  }

  let ticking = false;
  function tickScore() {
    if (ticking) return;
    ticking = true;
    const step = () => {
      if (shown !== S.score) {
        const diff = S.score - shown;
        shown += Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) * 0.12));
      }
      const text = fmt(shown);
      scoreEl.textContent = text;
      scoreEl.classList.toggle('long', text.length > 7);
      if (shown === S.score) { ticking = false; return; }
      requestAnimationFrame(step);
    };
    step();
  }

  function geo() {
    const r = cellsEl.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(cellsEl).columnGap) || 0;
    const pitch = (r.width + gap) / N;
    return { left: r.left, top: r.top, pitch, size: pitch - gap, gap };
  }

  function clearPreview() {
    preview.forEach((i) => {
      const el = cellEls[i];
      el.classList.remove('ghosted', 'hint');
      el.style.removeProperty('--h');
      if (S.grid[i] < 0) {
        el.classList.remove('core');
        el.style.removeProperty('--c');
      }
    });
    preview = [];
  }

  function showPreview(p, r, c) {
    clearPreview();
    const g = S.grid.slice();
    const color = COLORS[p.c];
    p.cells.forEach(([dr, dc], k) => {
      const i = (r + dr) * N + c + dc;
      g[i] = p.c;
      cellEls[i].classList.add('ghosted');
      if (k === p.core) cellEls[i].classList.add('core');
      cellEls[i].style.setProperty('--c', color);
      preview.push(i);
    });
    lineCells(fullLines(g)).forEach((i) => {
      cellEls[i].classList.add('hint');
      cellEls[i].style.setProperty('--h', color);
      preview.push(i);
    });
  }

  function startDrag(e) {
    const slot = e.target.closest('.slot');
    if (!slot || !S || S.over || drag) return;
    const i = +slot.dataset.i;
    const p = S.tray[i];
    if (!p) return;
    e.preventDefault();
    drag = { i, p, slot, touch: e.pointerType !== 'mouse', id: e.pointerId, x0: e.clientX, y0: e.clientY, live: false, r: -1, c: -1, ok: false };
  }

  function liftDrag() {
    const g = geo();
    ghost.innerHTML = '';
    const piece = buildPiece(drag.p);
    piece.style.setProperty('--cs', g.size + 'px');
    piece.style.gap = g.gap + 'px';
    ghost.appendChild(piece);
    ghost.hidden = false;
    drag.slot.classList.add('lifted');
    drag.live = true;
    tone(520, 0.05, 'square', 0.03);
  }

  function moveDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.live) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
      liftDrag();
    }
    const g = geo();
    const p = drag.p;
    const w = p.w * g.pitch - g.gap, h = p.h * g.pitch - g.gap;
    const x = e.clientX - w / 2;
    const y = drag.touch ? e.clientY - h - Math.max(36, g.pitch * 0.9) : e.clientY - h / 2;
    ghost.style.transform = `translate(${x}px, ${y}px)`;
    const c = Math.round((x - g.left) / g.pitch);
    const r = Math.round((y - g.top) / g.pitch);
    if (r === drag.r && c === drag.c) return;
    drag.r = r; drag.c = c;
    drag.ok = fits(S.grid, p, r, c);
    if (drag.ok) showPreview(p, r, c); else clearPreview();
  }

  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    ghost.hidden = true;
    clearPreview();
    if (!d.live) return;
    if (e.type === 'pointerup' && d.ok) commit(d.i, d.r, d.c);
    else d.slot.classList.remove('lifted');
  }

  function spin(i) {
    if (S.over || !S.tray[i]) return;
    if (S.charge < 1) {
      chargeEl.classList.remove('empty'); void chargeEl.offsetWidth; chargeEl.classList.add('empty');
      tone(120, 0.14, 'square', 0.05);
      return;
    }
    S.tray[i] = rotate(S.tray[i]);
    S.charge -= 1;
    tone(600, 0.07, 'square', 0.035, 0, 950);
    checkOver();
    save();
    render({ spun: i });
  }

  function checkOver() {
    if (anyMove()) return;
    S.over = true;
    setTimeout(showOver, 900);
  }

  function commit(i, r, c) {
    const p = S.tray[i];
    p.cells.forEach(([dr, dc], k) => {
      const idx = (r + dr) * N + c + dc;
      S.grid[idx] = p.c;
      if (k === p.core) S.cores[idx] = true;
    });
    let gained = p.cells.length * PTS.cell;
    const lines = fullLines(S.grid);
    const count = lines.rows.length + lines.cols.length;
    const g = geo();
    const pr = r + p.h / 2, pc = c + p.w / 2;

    if (count) {
      const lineSet = lineCells(lines);
      const cleared = new Set(lineSet);
      const surges = [];
      const seen = new Set();
      const queue = [...cleared].filter((k) => S.cores[k]);
      while (queue.length) {
        const k = queue.shift();
        if (seen.has(k)) continue;
        seen.add(k);
        surges.push(k);
        const kr = Math.floor(k / N), kc = k % N;
        for (let j = 0; j < N; j++) {
          [kr * N + j, j * N + kc].forEach((x) => {
            if (S.grid[x] < 0 || cleared.has(x)) return;
            cleared.add(x);
            if (S.cores[x]) queue.push(x);
          });
        }
      }
      const extra = cleared.size - lineSet.size;

      S.combo += 1;
      S.idle = 0;
      S.charge = Math.min(MAX_CHARGE, S.charge + 1);
      gained += PTS.line * count * (count + 1) / 2 * S.combo + extra * PTS.core;
      blast(cleared, lineSet, lines, surges, pr, pc, g);
      cleared.forEach((k) => { S.grid[k] = -1; S.cores[k] = false; });
      const perfect = S.grid.every((v) => v < 0);
      if (perfect) gained += PTS.perfect;

      popText(`+${fmt(gained)}`, 'points', pc * g.pitch, pr * g.pitch);
      const headline = perfect ? 'Board clear!'
        : surges.length > 1 ? `Surge ×${surges.length}!`
        : surges.length ? 'Surge!'
        : count >= 2 ? PRAISE[Math.min(count, PRAISE.length - 1)] : '';
      let y = g.pitch * 3.2;
      if (headline) {
        popText(headline, surges.length && !perfect ? 'praise surge' : 'praise', g.pitch * 4, y);
        y += g.pitch * 1.2;
      }
      if (S.combo >= 2) popText(`Combo ${S.combo}`, 'combo', g.pitch * 4, y);
      chime(count, S.combo);
      if (surges.length) tone(1400, 0.35, 'sawtooth', 0.04, 0.1, 80);
    } else {
      S.idle += 1;
      if (S.idle >= 3) S.combo = 0;
      tone(160, 0.09, 'square', 0.04);
    }

    S.tray[i] = null;
    const dealt = S.tray.every((x) => !x);
    if (dealt) S.tray = newTray();
    S.score += gained;
    if (S.score > S.best) S.best = S.score;
    store.set('best', S.best);
    scoreEl.classList.remove('bump'); void scoreEl.offsetWidth; scoreEl.classList.add('bump');

    checkOver();
    save();
    render({ deal: dealt });
  }

  function blast(cleared, lineSet, lines, surges, pr, pc, g) {
    const span = g.pitch * N - g.gap;
    lines.rows.forEach((r) => addFx('trace', 0, r * g.pitch, span, g.size));
    lines.cols.forEach((c) => addFx('trace v', c * g.pitch, 0, g.size, span));
    surges.forEach((k, n) => {
      const kr = Math.floor(k / N), kc = k % N;
      const delay = (120 + n * 120) + 'ms';
      addFx('trace surge', 0, kr * g.pitch, span, g.size).style.animationDelay = delay;
      addFx('trace v surge', kc * g.pitch, 0, g.size, span).style.animationDelay = delay;
      addFx('ring', kc * g.pitch, kr * g.pitch, g.size, g.size).style.animationDelay = delay;
    });
    cleared.forEach((k) => {
      const r = Math.floor(k / N), c = k % N;
      const el = addFx('burst', c * g.pitch, r * g.pitch, g.size, g.size);
      el.style.setProperty('--c', COLORS[S.grid[k]]);
      const dist = Math.hypot(r - pr, c - pc);
      el.style.animationDelay = (lineSet.has(k) ? dist * 28 : 260 + dist * 20) + 'ms';
    });
  }

  function addFx(cls, x, y, w, h) {
    const el = document.createElement('div');
    el.className = cls;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.width = w + 'px'; el.style.height = h + 'px';
    el.addEventListener('animationend', () => el.remove());
    fxEl.appendChild(el);
    return el;
  }

  function popText(text, cls, x, y) {
    const el = document.createElement('div');
    el.className = 'pop ' + cls;
    el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.addEventListener('animationend', () => el.remove());
    fxEl.appendChild(el);
  }

  function showOver() {
    $('final').textContent = fmt(S.score);
    $('finalBest').textContent = fmt(S.best);
    $('newBest').hidden = !(S.score > 0 && S.score >= S.best);
    overEl.hidden = false;
    tone(330, 0.2, 'square', 0.05);
    tone(220, 0.4, 'sawtooth', 0.05, 0.18, 60);
    $('again').focus();
  }

  let AC = null;
  function tone(freq, dur, type = 'triangle', vol = 0.1, when = 0, endFreq = 0) {
    if (!soundOn) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const t = AC.currentTime + when;
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(AC.destination);
      o.start(t); o.stop(t + dur + 0.03);
    } catch (e) {}
  }
  function chime(count, combo) {
    const base = 440 * Math.pow(2, Math.min(combo - 1, 7) / 12);
    const notes = [1, 1.5, 2, 3, 4].slice(0, Math.min(2 + count, 5));
    notes.forEach((m, k) => tone(base * m, 0.12, 'square', 0.04, k * 0.05));
  }

  const SOUND_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
  const SOUND_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M16 9l5 6M21 9l-5 6"/></svg>';
  function renderSound() {
    soundBtn.innerHTML = soundOn ? SOUND_ON : SOUND_OFF;
    soundBtn.setAttribute('aria-label', soundOn ? 'Mute sound' : 'Turn sound on');
  }
  soundBtn.addEventListener('click', () => { soundOn = !soundOn; store.set('sound', soundOn); renderSound(); tone(660, 0.06, 'square', 0.04); });

  let armTimer = null;
  const RESTART_ICON = restartBtn.innerHTML;
  restartBtn.addEventListener('click', () => {
    if (S.over || restartBtn.classList.contains('arm')) {
      clearTimeout(armTimer);
      restartBtn.classList.remove('arm');
      restartBtn.innerHTML = RESTART_ICON;
      newGame();
      return;
    }
    restartBtn.classList.add('arm');
    restartBtn.textContent = 'Restart?';
    armTimer = setTimeout(() => { restartBtn.classList.remove('arm'); restartBtn.innerHTML = RESTART_ICON; }, 2200);
  });
  $('again').addEventListener('click', newGame);

  trayEl.addEventListener('pointerdown', startDrag);
  rotBtns.forEach((b, i) => b.addEventListener('click', () => spin(i)));
  window.addEventListener('pointermove', moveDrag, { passive: true });
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  document.addEventListener('touchmove', (e) => { if (drag) e.preventDefault(); }, { passive: false });

  function fit() {
    const w = app.clientWidth - 32;
    const h = app.clientHeight;
    const size = Math.max(220, Math.min(w, 440, (h - 240) / 1.36));
    app.style.setProperty('--size', size + 'px');
  }
  window.addEventListener('resize', fit);

  function valid(g) {
    return g && Array.isArray(g.grid) && g.grid.length === N * N
      && Array.isArray(g.cores) && g.cores.length === N * N
      && Array.isArray(g.tray) && g.tray.length === 3
      && g.tray.every((p) => p === null || Array.isArray(p.cells))
      && typeof g.charge === 'number';
  }

  function start() {
    fit();
    renderSound();
    const restored = store.get('game');
    if (valid(restored) && !restored.over) {
      S = restored;
      S.best = Math.max(S.best || 0, store.get('best') || 0);
      shown = S.score;
      render();
      checkOver();
    } else {
      newGame();
    }
  }

  start();
})();
