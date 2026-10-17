import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP = process.env.APP_URL ?? 'http://localhost:8081/';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const OUT = join(import.meta.dirname, '..', 'store', 'screenshots');

const DEVICES = [
  { name: 'ios', width: 440, height: 956 },
  { name: 'android', width: 360, height: 720 },
];
const SCENES = { play: '1-play', circuit: '2-circuit', daily: '3-daily', rules: '4-rules', stats: '5-stats' };

function seedPage() {
  const scene = globalThis.location.hash.slice(1);
  if (!scene) return;
  const RealDate = Date;
  const offset = new RealDate(2026, 10, 8, 12).getTime() - RealDate.now();
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      if (args.length) super(...args);
      else super(RealDate.now() + offset);
    }
    static now() {
      return RealDate.now() + offset;
    }
  };

  const base = ['...33...', '.1.3..55', '.113.445', '.....4..', '22.000.6', '2..0...6', '..55.336', '..5..3..'];
  const rows = scene === 'circuit' ? ['000.344.', ...base.slice(1)] : base;
  const cores = Array(64).fill(null);
  cores[36] = 'area';
  cores[54] = 'line';
  const piece = (w, h, cells, c, core = -1) => ({ w, h, cells, c, core, coreKind: 'line' });
  const ell = piece(
    2,
    3,
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ],
    1,
  );
  const square = piece(
    2,
    2,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    4,
    3,
  );
  const bar = piece(
    3,
    1,
    [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    0,
  );
  const dot = piece(1, 1, [[0, 0]], 2);
  const game = {
    grid: [...rows.join('')].map((ch) => (ch === '.' ? -1 : Number(ch))),
    cores,
    terminals:
      scene === 'circuit'
        ? { plus: { side: 'left', at: 0 }, minus: { side: 'top', at: 6 } }
        : { plus: { side: 'left', at: 5 }, minus: { side: 'top', at: 2 } },
    tray: scene === 'circuit' ? [dot, ell, square] : [ell, square, bar],
    score: 12480,
    best: 48210,
    combo: 0,
    idle: 0,
    over: false,
  };

  const store = globalThis.localStorage;
  const set = (key, value) =>
    store.setItem(`overclock.${key}`, typeof value === 'string' ? value : JSON.stringify(value));
  store.clear();
  set('game', { v: 6, game, startBest: 48210 });
  set('best', '48210');
  set('stats', {
    games: 64,
    total: 1212160,
    lines: 2318,
    circuits: 187,
    bestCombo: 14,
    bestChain: 4,
    perfects: 7,
    dailies: 21,
    bestDaily: 31560,
    bestStreak: 9,
  });
  if (scene !== 'rules') set('helpSeen', 'true');
  if (scene === 'daily') {
    const run = { day: 26, moves: 41, circuits: 3, game: { ...game, score: 14320, best: 0, over: true } };
    set('daily', { v: 6, run });
    set('dailyRecord', { day: 26, score: 14320, circuits: 3, streak: 5 });
  } else {
    set('dailyRecord', { day: 25, score: 16880, circuits: 4, streak: 5 });
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pageSocketUrl() {
  for (let i = 0; i < 50; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}

const profile = mkdtempSync(join(tmpdir(), 'overclock-shots-'));
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--hide-scrollbars',
    '--mute-audio',
    '--no-first-run',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

try {
  const ws = new WebSocket(await pageSocketUrl());
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    const call = pending.get(msg.id);
    if (!call) return;
    pending.delete(msg.id);
    if (msg.error) call.reject(new Error(msg.error.message));
    else call.resolve(msg.result);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  const centerOf = async (label) => {
    const { result } = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const el = [...document.querySelectorAll('[aria-label]')].find((n) => n.getAttribute('aria-label').startsWith(${JSON.stringify(label)}));
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`,
    });
    return result.value;
  };
  const waitFor = async (label) => {
    for (let i = 0; i < 100; i++) {
      const point = await centerOf(label).catch(() => null);
      if (point) return point;
      await sleep(100);
    }
    throw new Error(`Nothing labelled "${label}"`);
  };
  const mouse = (type, { x, y }, buttons = 1) =>
    send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 });
  const click = async (label) => {
    const point = await waitFor(label);
    await mouse('mouseMoved', point, 0);
    await mouse('mousePressed', point);
    await mouse('mouseReleased', point, 0);
  };

  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(${seedPage})()` });
  for (const device of DEVICES) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: device.width,
      height: device.height,
      deviceScaleFactor: 3,
      mobile: true,
    });
    mkdirSync(join(OUT, device.name), { recursive: true });
    for (const [scene, file] of Object.entries(SCENES)) {
      await send('Page.navigate', { url: 'about:blank' });
      await send('Page.navigate', { url: `${APP}#${scene}` });
      const socket = await waitFor('U1, ');
      await sleep(1500);
      let held = null;
      if (scene === 'circuit') {
        const target = await waitFor('A4, ');
        await mouse('mouseMoved', socket, 0);
        await mouse('mousePressed', socket);
        for (let i = 1; i <= 24; i++) {
          held = { x: socket.x + ((target.x - socket.x) * i) / 24, y: socket.y + ((target.y - socket.y) * i) / 24 };
          await mouse('mouseMoved', held);
          await sleep(16);
        }
      } else if (scene === 'daily') {
        await click("Today's daily circuit");
      } else if (scene === 'stats') {
        await click('Peak score');
      }
      await sleep(1200);
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const path = join(OUT, device.name, `${file}.png`);
      writeFileSync(path, Buffer.from(data, 'base64'));
      console.log(path);
      if (held) await mouse('mouseReleased', held, 0);
    }
  }
  ws.close();
} finally {
  chrome.kill();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true });
}
