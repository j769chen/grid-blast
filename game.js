(() => {
  const N = 8;
  const COLORS = ['#e5483f', '#f2902c', '#f4c430', '#45b94d', '#2fbfdc', '#3d6ee0', '#9a52dd'];
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
  const SHAPES = DEFS.map(([weight, rows]) => {
    const cells = [];
    rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') cells.push([r, c]); }));
    return { w: rows[0].length, h: rows.length, cells, weight };
  });
  const TOTAL = SHAPES.reduce((a, s) => a + s.weight, 0);
  const PRAISE = ['', '', 'Good!', 'Great!', 'Excellent!', 'Amazing!', 'Unbelievable!'];

  const $ = (id) => document.getElementById(id);
  const app = $('app'), cellsEl = $('cells'), fxEl = $('fx'), trayEl = $('tray'), ghost = $('ghost');
  const scoreEl = $('score'), bestEl = $('best'), overEl = $('over'), soundBtn = $('sound'), restartBtn = $('restart');
  const slots = [...trayEl.children];

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem('gridblast.' + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('gridblast.' + k, JSON.stringify(v)); } catch (e) {} },
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

  function pickShape() {
    let x = Math.random() * TOTAL;
    for (let i = 0; i < SHAPES.length; i++) { x -= SHAPES[i].weight; if (x <= 0) return i; }
    return 0;
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function fits(grid, s, r, c) {
    const sh = SHAPES[s];
    if (r < 0 || c < 0 || r + sh.h > N || c + sh.w > N) return false;
    return sh.cells.every(([dr, dc]) => grid[(r + dr) * N + c + dc] < 0);
  }
  function canPlace(grid, s) {
    const sh = SHAPES[s];
    for (let r = 0; r <= N - sh.h; r++) for (let c = 0; c <= N - sh.w; c++) if (fits(grid, s, r, c)) return true;
    return false;
  }
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
      const tray = [0, 1, 2].map((i) => ({ s: pickShape(), c: colors[i] }));
      if (tray.some((p) => canPlace(S.grid, p.s))) return tray;
    }
    return [0, 1, 2].map((i) => ({ s: 0, c: i }));
  }

  function seed() {
    let placed = 0;
    for (let tries = 0; tries < 200 && placed < 4; tries++) {
      const s = pickShape();
      if (SHAPES[s].cells.length > 5) continue;
      const r = Math.floor(Math.random() * (N - SHAPES[s].h + 1));
      const c = Math.floor(Math.random() * (N - SHAPES[s].w + 1));
      if (!fits(S.grid, s, r, c)) continue;
      const g = S.grid.slice();
      const color = Math.floor(Math.random() * COLORS.length);
      SHAPES[s].cells.forEach(([dr, dc]) => { g[(r + dr) * N + c + dc] = color; });
      const lines = fullLines(g);
      if (lines.rows.length || lines.cols.length) continue;
      S.grid = g;
      placed++;
    }
  }

  function newGame() {
    S = { grid: Array(N * N).fill(-1), tray: [], score: 0, best: store.get('best') || 0, combo: 0, idle: 0, over: false };
    seed();
    S.tray = newTray();
    shown = 0;
    overEl.hidden = true;
    save();
    render();
  }

  function save() { store.set('game', S); }

  function render() {
    renderBoard();
    renderTray();
    bestEl.textContent = S.best;
    tickScore();
  }

  function renderBoard() {
    S.grid.forEach((v, i) => {
      const el = cellEls[i];
      el.className = v >= 0 ? 'cell filled' : 'cell';
      if (v >= 0) el.style.setProperty('--c', COLORS[v]); else el.style.removeProperty('--c');
    });
  }

  function buildPiece(p) {
    const sh = SHAPES[p.s];
    const el = document.createElement('div');
    el.className = 'piece';
    el.style.gridTemplateColumns = `repeat(${sh.w}, var(--cs))`;
    el.style.gridTemplateRows = `repeat(${sh.h}, var(--cs))`;
    sh.cells.forEach(([r, c]) => {
      const b = document.createElement('div');
      b.className = 'block';
      b.style.gridRow = r + 1;
      b.style.gridColumn = c + 1;
      b.style.setProperty('--c', COLORS[p.c]);
      el.appendChild(b);
    });
    return el;
  }

  function renderTray() {
    slots.forEach((slot, i) => {
      slot.innerHTML = '';
      slot.classList.remove('lifted', 'nofit');
      const p = S.tray[i];
      if (!p) return;
      slot.appendChild(buildPiece(p));
      if (!canPlace(S.grid, p.s)) slot.classList.add('nofit');
    });
  }

  let ticking = false;
  function tickScore() {
    if (ticking) return;
    ticking = true;
    const step = () => {
      if (shown === S.score) { scoreEl.textContent = shown; ticking = false; return; }
      const diff = S.score - shown;
      shown += Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) * 0.12));
      scoreEl.textContent = shown;
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
      if (S.grid[i] < 0) el.style.removeProperty('--c');
    });
    preview = [];
  }

  function showPreview(p, r, c) {
    clearPreview();
    const sh = SHAPES[p.s];
    const g = S.grid.slice();
    const color = COLORS[p.c];
    sh.cells.forEach(([dr, dc]) => {
      const i = (r + dr) * N + c + dc;
      g[i] = p.c;
      cellEls[i].classList.add('ghosted');
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
    const g = geo();
    ghost.innerHTML = '';
    const piece = buildPiece(p);
    piece.style.setProperty('--cs', g.size + 'px');
    piece.style.gap = g.gap + 'px';
    ghost.appendChild(piece);
    ghost.hidden = false;
    slot.classList.add('lifted');
    drag = { i, p, slot, touch: e.pointerType !== 'mouse', id: e.pointerId, r: -1, c: -1, ok: false };
    tone(520, 0.05, 'sine', 0.05);
    moveDrag(e);
  }

  function moveDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const g = geo();
    const sh = SHAPES[drag.p.s];
    const w = sh.w * g.pitch - g.gap, h = sh.h * g.pitch - g.gap;
    const x = e.clientX - w / 2;
    const y = drag.touch ? e.clientY - h - Math.max(36, g.pitch * 0.9) : e.clientY - h / 2;
    ghost.style.transform = `translate(${x}px, ${y}px)`;
    const c = Math.round((x - g.left) / g.pitch);
    const r = Math.round((y - g.top) / g.pitch);
    if (r === drag.r && c === drag.c) return;
    drag.r = r; drag.c = c;
    drag.ok = fits(S.grid, drag.p.s, r, c);
    if (drag.ok) showPreview(drag.p, r, c); else clearPreview();
  }

  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    ghost.hidden = true;
    clearPreview();
    if (e.type === 'pointerup' && d.ok) commit(d.i, d.r, d.c);
    else d.slot.classList.remove('lifted');
  }

  function commit(i, r, c) {
    const p = S.tray[i];
    const sh = SHAPES[p.s];
    sh.cells.forEach(([dr, dc]) => { S.grid[(r + dr) * N + c + dc] = p.c; });
    let gained = sh.cells.length;
    const lines = fullLines(S.grid);
    const count = lines.rows.length + lines.cols.length;
    const g = geo();
    const cx = (c + sh.w / 2) * g.pitch, cy = (r + sh.h / 2) * g.pitch;

    if (count) {
      S.combo += 1;
      S.idle = 0;
      const pts = 5 * count * (count + 1) * S.combo;
      gained += pts;
      const cleared = lineCells(lines);
      burst(cleared, lines, p, r + sh.h / 2, c + sh.w / 2, g);
      cleared.forEach((idx) => { S.grid[idx] = -1; });
      const perfect = S.grid.every((v) => v < 0);
      if (perfect) gained += 300;
      popText(`+${gained}`, 'points', cx, cy);
      if (perfect) popText('Board clear!', 'praise', g.pitch * 4, g.pitch * 3.4);
      else if (count >= 2) popText(PRAISE[Math.min(count, PRAISE.length - 1)], 'praise', g.pitch * 4, g.pitch * 3.4);
      if (S.combo >= 2) popText(`Combo ${S.combo}`, 'combo', g.pitch * 4, g.pitch * (count >= 2 || perfect ? 4.6 : 3.8));
      chime(count, S.combo);
    } else {
      S.idle += 1;
      if (S.idle >= 3) S.combo = 0;
      tone(180, 0.09, 'square', 0.04);
    }

    S.tray[i] = null;
    if (S.tray.every((x) => !x)) S.tray = newTray();
    S.score += gained;
    if (S.score > S.best) S.best = S.score;
    store.set('best', S.best);
    scoreEl.classList.remove('bump'); void scoreEl.offsetWidth; scoreEl.classList.add('bump');

    if (!S.tray.some((x) => x && canPlace(S.grid, x.s))) {
      S.over = true;
      setTimeout(showOver, 900);
    }
    save();
    render();
  }

  function burst(cleared, lines, p, pr, pc, g) {
    lines.rows.forEach((r) => addFx('sweep', 0, r * g.pitch, g.pitch * N - g.gap, g.size));
    lines.cols.forEach((c) => addFx('sweep', c * g.pitch, 0, g.size, g.pitch * N - g.gap));
    cleared.forEach((idx) => {
      const r = Math.floor(idx / N), c = idx % N;
      const el = addFx('burst', c * g.pitch, r * g.pitch, g.size, g.size);
      el.style.setProperty('--c', COLORS[p.c]);
      el.style.animationDelay = (Math.hypot(r - pr, c - pc) * 28) + 'ms';
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
    $('final').textContent = S.score;
    $('finalBest').textContent = S.best;
    $('newBest').hidden = !(S.score > 0 && S.score >= S.best);
    overEl.hidden = false;
    tone(330, 0.2, 'triangle', 0.08); tone(247, 0.35, 'triangle', 0.08, 0.18);
    $('again').focus();
  }

  let AC = null;
  function tone(freq, dur, type = 'triangle', vol = 0.1, when = 0) {
    if (!soundOn) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const t = AC.currentTime + when;
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(AC.destination);
      o.start(t); o.stop(t + dur + 0.03);
    } catch (e) {}
  }
  function chime(count, combo) {
    const base = 523 * Math.pow(2, Math.min(combo - 1, 6) / 12);
    const notes = [1, 1.26, 1.5, 2, 2.52].slice(0, Math.min(2 + count, 5));
    notes.forEach((m, k) => tone(base * m, 0.18, 'triangle', 0.09, k * 0.06));
  }

  const SOUND_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
  const SOUND_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M16 9l5 6M21 9l-5 6"/></svg>';
  function renderSound() {
    soundBtn.innerHTML = soundOn ? SOUND_ON : SOUND_OFF;
    soundBtn.setAttribute('aria-label', soundOn ? 'Mute sound' : 'Turn sound on');
  }
  soundBtn.addEventListener('click', () => { soundOn = !soundOn; store.set('sound', soundOn); renderSound(); tone(660, 0.06, 'sine', 0.06); });

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
  window.addEventListener('pointermove', moveDrag, { passive: true });
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  document.addEventListener('touchmove', (e) => { if (drag) e.preventDefault(); }, { passive: false });

  function fit() {
    const w = app.clientWidth - 32;
    const h = app.clientHeight;
    const size = Math.max(220, Math.min(w, 440, (h - 150) / 1.36));
    app.style.setProperty('--size', size + 'px');
  }
  window.addEventListener('resize', fit);

  function valid(g) {
    return g && Array.isArray(g.grid) && g.grid.length === N * N && Array.isArray(g.tray) && g.tray.length === 3;
  }

  function start(data) {
    fit();
    renderSound();
    const restored = data && valid(data.S) ? data.S : store.get('game');
    if (valid(restored) && !restored.over) {
      S = restored;
      S.best = Math.max(S.best || 0, store.get('best') || 0);
      shown = S.score;
      render();
    } else {
      newGame();
    }
  }

  start({});
})();
