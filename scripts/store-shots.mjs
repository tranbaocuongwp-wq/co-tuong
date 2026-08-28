/**
 * Store screenshots, captured at native resolution.
 *
 * App Store and Play both want images at exact pixel sizes, and both reject
 * anything that has obviously been scaled up. So this drives a real Chrome over
 * the DevTools protocol with `deviceScaleFactor` set: a 430×932 layout rendered
 * at 3× comes out as 1290×2796 real pixels, which is the iPhone 6.7" slot
 * exactly. Nothing is resized afterwards and nothing is cropped — the frame you
 * see is the whole screen.
 *
 * The scenes are staged rather than played. Waiting for a real game to reach a
 * mating position would take minutes per shot and would not be reproducible; a
 * seeded autosave puts the board wherever it needs to be in one navigation, and
 * the engine, the commentary and the interface all behave exactly as they would
 * have. The mate position is a real one, verified by the rules rather than by
 * eye: `e2e6` is checkmate, found by playing every legal move and asking the
 * engine which one ended the game.
 *
 *     node scripts/store-shots.mjs [--port 4211] [--out store-shots]
 *
 * Expects a build being served — `npx vite preview --port 4211`.
 */

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}

const PORT = Number(flag('port', 4211))
const OUT = flag('out', 'store-shots')
const BASE = `http://localhost:${PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

/**
 * The two slots that matter.
 *
 * Play accepts the iPhone size as-is (it takes anything from 320 to 3840 with a
 * sane aspect ratio), so one phone set covers both shops.
 */
const DEVICES = [
  { name: 'iphone-6.7', width: 430, height: 932, scale: 3, mobile: true },
  { name: 'ipad-12.9', width: 1024, height: 1366, scale: 2, mobile: true },
  { name: 'ipad-ngang', width: 1366, height: 1024, scale: 2, mobile: true },
]

/** The engine's own start position, as `Game.restore` expects it. */
const START_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1'

/** A real middlegame, so the board looks like a game and not like a puzzle. */
const MIDGAME = 'h2e2 h9g7 h0g2 b9c7 i0h0 i9h9 h0h4 h7h5 b0c2 b7b3 c3c4 c6c5'

/**
 * One ply before mate, with Black to move.
 *
 * It starts a move early on purpose: the app refuses to restore a save whose
 * move list is empty — correctly, since that is what a fresh game looks like —
 * so a position alone cannot be seeded. Black plays the forced king step and
 * Red mates with the Chariot.
 *
 * Verified against the rules rather than by eye: every Black reply was played
 * out, and every Red answer after it, keeping the one the engine reported as
 * checkmate.
 */
const MATE_FEN = '3k5/R3b4/9/p1p1p1p1p/9/9/P1P1P1P1P/4C4/9/2BAKAB2 b - - 0 1'
const MATE_SETUP = 'd9e9'
/** Xe 9 tiến 1 — from a8 to a9, which is row 2 to row 1 in the board's labels. */
const MATE_FROM = 'Ô hàng 2 cột 1'
const MATE_TO = 'Ô hàng 1 cột 1'

// --- CDP ------------------------------------------------------------------

let nextId = 1
function rpc(ws, method, params = {}, sessionId) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id !== id) return
      ws.removeEventListener('message', onMessage)
      msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)
    }
    ws.addEventListener('message', onMessage)
    ws.send(JSON.stringify({ id, method, params, sessionId }))
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function evaluate(ws, expression) {
  const res = await rpc(ws, 'Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description ?? 'lỗi trong trang')
  }
  return res.result.value
}

// --- page-side helpers ----------------------------------------------------

/**
 * Written as a string because it runs inside the page, not here.
 *
 * Seeding goes straight to IndexedDB rather than through the app's own store:
 * the store module is bundled and not reachable from the console, and the
 * schema is one table with a string key, so there is very little to get wrong.
 */
const HELPERS = `
window.__seed = {
  async games(rows) {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('co-tuong');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('games', 'readwrite');
    const store = tx.objectStore('games');
    store.clear();
    rows.forEach((row, i) => store.put({
      format: 1, id: 'shot-' + i,
      createdAt: Date.now() - i * 5400e3,
      endedAt: Date.now() - i * 5400e3 + row.mins * 60e3,
      mode: 'pve', redPlayer: row.red, blackPlayer: row.black,
      difficulty: row.d, result: row.result, reason: row.reason,
      startFen: '', moves: '', finalFen: '', moveCount: row.moves,
      durationMs: row.mins * 60e3, appVersion: '0.4.0', shared: false,
      assists: row.assists ?? [],
    }));
    await new Promise(res => { tx.oncomplete = res });
  },
  async inProgress(startFen, moves, difficulty) {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('co-tuong');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('inProgress', 'readwrite');
    const store = tx.objectStore('inProgress');
    store.clear();
    if (moves !== null) {
      // The store keeps one row holding the record as a JSON string, not the
      // record itself. Writing the record directly leaves getInProgress()
      // parsing undefined, which it treats as a corrupt save and deletes.
      const record = {
        format: 1, id: 'shot-live',
        createdAt: Date.now() - 9 * 60e3, endedAt: null, mode: 'pve',
        redPlayer: 'human', blackPlayer: 'ai', difficulty,
        result: 'unfinished', reason: '',
        startFen, moves, finalFen: '',
        moveCount: moves ? moves.split(' ').length : 0,
        durationMs: 9 * 60e3, appVersion: '0.4.0', shared: false,
      };
      store.put({ id: 1, payload: JSON.stringify(record), updatedAt: Date.now() });
    }
    await new Promise(res => { tx.oncomplete = res });
  },
  settings(patch) {
    const key = 'co-tuong.settings.v1';
    const cur = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({ ...cur, ...patch }));
  },
};
window.__wait = async (test, ms = 25000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (test()) return true } catch {}
    await new Promise(r => setTimeout(r, 80));
  }
  return false;
};
/**
 * Has the seeded game actually been restored?
 *
 * Piece count is useless — the opening has thirty-two and so does a middlegame
 * with no captures — and the last-move markers never appear, because restoring
 * a save deliberately clears the last move. What does change is the *shape*:
 * the start position puts every piece on one of six ranks, and any real game
 * spreads them over more. Counting distinct rows needs nothing from the app.
 */
window.__developed = () => {
  const tops = new Set(
    [...document.querySelectorAll('.piece')].map((el) => el.style.top)
  );
  return tops.size > 6;
};
window.__calm = () => {
  // Chrome keeps a focus ring on whatever was clicked last. That is the
  // browser's furniture, not the app's, and it has no business in a store
  // image — so drop focus and suppress the ring for the shot.
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  if (!document.getElementById('__shot-css')) {
    const style = document.createElement('style');
    style.id = '__shot-css';
    style.textContent = '*:focus,*:focus-visible{outline:none !important;box-shadow:none !important}';
    document.head.appendChild(style);
  }
};
window.__tap = (label) => {
  const el = document.querySelector('[aria-label="' + label + '"]');
  if (el) { el.click(); return true }
  return false;
};
window.__tapText = (re) => {
  const rx = new RegExp(re);
  const el = [...document.querySelectorAll('button, a')].find(e => rx.test(e.textContent || ''));
  if (el) { el.click(); return true }
  return false;
};
'true'
`

const HISTORY_ROWS = `[
  { result: 'redWin',   reason: 'checkmate',      red: 'human', black: 'ai',    moves: 74, d: 'master', mins: 21 },
  { result: 'redWin',   reason: 'stalemate',      red: 'human', black: 'ai',    moves: 58, d: 'hard',   mins: 14 },
  { result: 'blackWin', reason: 'checkmate',      red: 'human', black: 'ai',    moves: 63, d: 'master', mins: 17 },
  { result: 'draw',     reason: 'sixtyMove',      red: 'human', black: 'ai',    moves: 96, d: 'hard',   mins: 26 },
  { result: 'redWin',   reason: 'perpetualCheck', red: 'ai',    black: 'human', moves: 41, d: 'medium', mins: 11 },
  { result: 'blackWin', reason: 'checkmate',      red: 'human', black: 'ai',    moves: 52, d: 'easy',   mins: 9 }
]`

// --- scenes ---------------------------------------------------------------
//
// `hash: '#/play'` rather than `path: '/play'`, even though routing left the
// hash behind. `src/main.tsx` rewrites a `#/…` address to the real path before
// the router ever reads it — that is how links saved in the hash era keep
// working — so these are still correct, and they stay in this spelling because
// the hash never reaches the dev server and therefore never needs its SPA
// fallback.

/**
 * Each scene says where to go, what to set up first, and what to wait for
 * before the shutter. Waiting on a condition rather than on a timer is what
 * keeps these reproducible: a shot taken 200ms early is a shot of a spinner.
 */
const SCENES = [
  /*
   * The old scene here opened `#/` and photographed the launcher.
   *
   * `/` is the marketing front page now, and a page of prose about the app is
   * not a screenshot of the app — a store reviewer would be right to reject it.
   * The three choices the launcher used to offer live in the Ván mới sheet
   * instead, so that is what this shot is of.
   */
  {
    file: '01-van-moi',
    dark: false,
    hash: '#/play',
    setup: `await window.__seed.inProgress('${START_FEN}', '${MIDGAME}', 'master');
            await window.__seed.games(${HISTORY_ROWS});
            window.__seed.settings({ difficulty: 'master', mode: 'pve', playerSide: 'r', voice: true });`,
    ready: `window.__developed()`,
    after: `window.__tap('Mở bảng điều khiển');
            await window.__wait(() => (document.querySelector('[role="dialog"]')?.innerText || '').includes('Ván đấu'));
            window.__tap('Ván mới');
            await window.__wait(() => (document.querySelector('[role="dialog"]')?.innerText || '').includes('Cầm quân'));`,
    settle: 600,
  },
  {
    file: '02-ban-co',
    dark: false,
    hash: '#/play',
    setup: `window.__seed.settings({ voice: true, difficulty: 'master' });
            await window.__seed.inProgress('${START_FEN}', '${MIDGAME}', 'master');`,
    ready: `window.__developed()`,
    // Give the commentator a moment to have something on screen. Not waited on:
    // a caption is a bonus in this shot, not the subject of it.
    settle: 7000,
    settle: 1200,
  },
  {
    file: '03-goi-y',
    dark: false,
    hash: '#/play',
    setup: `await window.__seed.inProgress('${START_FEN}', '${MIDGAME}', 'master');`,
    ready: `window.__developed()`,
    after: `window.__tap('Gợi ý nước đi');
            await window.__wait(() => (document.querySelector('[role="dialog"]')?.innerText || '').includes('Cân bằng')
              || /\\d\\. |Pháo|Xe|Mã|Tốt/.test(document.querySelector('[role="dialog"]')?.innerText || ''));`,
    settle: 700,
  },
  {
    file: '04-xem-truoc',
    dark: false,
    hash: '#/play',
    setup: `await window.__seed.inProgress('${START_FEN}', '${MIDGAME}', 'master');`,
    ready: `window.__developed()`,
    after: `window.__tap('Gợi ý nước đi');
            await window.__wait(() => document.querySelectorAll('[role="dialog"] button[aria-pressed]').length >= 2);
            document.querySelectorAll('[role="dialog"] button[aria-pressed]')[0].click();
            await window.__wait(() => !!document.querySelector('.board__arrow--preview'));`,
    settle: 900,
  },
  {
    file: '05-thang',
    dark: false,
    hash: '#/play',
    setup: `await window.__seed.inProgress('${MATE_FEN}', '${MATE_SETUP}', 'master');`,
    // The mate position is sparse; the opening is not. Waiting for the board to
    // thin out is waiting for the seed to have been restored.
    ready: `document.querySelectorAll('.piece').length <= 22`,
    after: `await window.__wait(() => document.querySelectorAll('.board__point').length > 80);
            // Play the mating move by tapping its two squares, exactly as a player would.
            const from = document.querySelector('[aria-label="${MATE_FROM}"]');
            const to = document.querySelector('[aria-label="${MATE_TO}"]');
            from.click(); await new Promise(r => setTimeout(r, 250)); to.click();
            await window.__wait(() => (document.body.innerText || '').includes('Bạn thắng'), 20000);`,
    settle: 900,
  },
  {
    file: '06-menu',
    dark: false,
    hash: '#/play',
    setup: `await window.__seed.inProgress('${START_FEN}', '${MIDGAME}', 'master');`,
    ready: `window.__developed()`,
    after: `window.__tap('Mở bảng điều khiển');
            await window.__wait(() => (document.querySelector('[role="dialog"]')?.innerText || '').includes('Ván đấu'));`,
    settle: 600,
  },
  {
    file: '07-lich-su',
    dark: false,
    hash: '#/history',
    setup: `await window.__seed.games(${HISTORY_ROWS});`,
    ready: `document.body.innerText.includes('Thắng') && document.querySelectorAll('li').length >= 5`,
  },
  {
    file: '08-ho-so',
    dark: false,
    hash: '#/profile',
    setup: `await window.__seed.games(${HISTORY_ROWS});`,
    ready: `/\\d+%/.test(document.body.innerText)`,
  },
  {
    file: '09-cai-dat',
    dark: false,
    hash: '#/settings',
    setup: `window.__seed.settings({ difficulty: 'master' });`,
    ready: `document.body.innerText.includes('Tiếng nói ngoại tuyến')`,
    settle: 2500,
  },
  {
    file: '10-gioi-thieu',
    dark: false,
    hash: '#/about',
    setup: ``,
    ready: `document.body.innerText.includes('Vì sao có ứng dụng này')`,
    settle: 2000,
  },
  {
    file: '11-ban-co-toi',
    dark: true,
    hash: '#/play',
    setup: `window.__seed.settings({ voice: true, difficulty: 'master' });
            await window.__seed.inProgress('${START_FEN}', '${MIDGAME}', 'master');`,
    ready: `window.__developed()`,
    // Give the commentator a moment to have something on screen. Not waited on:
    // a caption is a bonus in this shot, not the subject of it.
    settle: 7000,
    settle: 1200,
  },
]

// --- driver ---------------------------------------------------------------

async function main() {
  mkdirSync(OUT, { recursive: true })

  const profile = join(OUT, '.chrome-profile')
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--remote-debugging-port=9333',
      `--user-data-dir=${profile}`,
      '--hide-scrollbars',
      '--force-color-profile=srgb',
      '--disable-features=DialMediaRouteProvider',
      'about:blank',
    ],
    { stdio: 'ignore' }
  )

  // Wait for the debugging endpoint to answer.
  let target = null
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250)
    try {
      const res = await fetch('http://127.0.0.1:9333/json/version')
      if (res.ok) target = (await res.json()).webSocketDebuggerUrl
    } catch {
      /* not up yet */
    }
  }
  if (!target) throw new Error('Chrome không mở được cổng gỡ lỗi')

  const browser = new WebSocket(target)
  await new Promise((res, rej) => {
    browser.addEventListener('open', res, { once: true })
    browser.addEventListener('error', rej, { once: true })
  })

  const { targetId } = await rpc(browser, 'Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await rpc(browser, 'Target.attachToTarget', { targetId, flatten: true })

  const ws = {
    send: (raw) => {
      const msg = JSON.parse(raw)
      browser.send(JSON.stringify({ ...msg, sessionId }))
    },
    addEventListener: (...a) => browser.addEventListener(...a),
    removeEventListener: (...a) => browser.removeEventListener(...a),
  }

  await rpc(ws, 'Page.enable')
  await rpc(ws, 'Runtime.enable')

  let made = 0
  for (const device of DEVICES) {
    for (const scene of SCENES) {
      // Landscape only makes sense for the scenes that gain a side column.
      if (device.name === 'ipad-ngang' && !['02-ban-co', '04-xem-truoc'].includes(scene.file)) {
        continue
      }

      await rpc(ws, 'Emulation.setDeviceMetricsOverride', {
        width: device.width,
        height: device.height,
        deviceScaleFactor: device.scale,
        mobile: device.mobile,
      })
      await rpc(ws, 'Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: scene.dark ? 'dark' : 'light' }],
      })

      // Land on the origin first so storage is reachable, seed, then go.
      await rpc(ws, 'Page.navigate', { url: `${BASE}/` })
      await sleep(900)
      await evaluate(ws, HELPERS)
      if (scene.setup) await evaluate(ws, `(async () => { ${scene.setup} })()`)

      await rpc(ws, 'Page.navigate', { url: `${BASE}/${scene.hash}` })
      await sleep(700)
      await evaluate(ws, HELPERS)

      const ready = await evaluate(ws, `window.__wait(() => (${scene.ready}))`)
      if (!ready) console.warn(`  ! ${scene.file} @ ${device.name}: chờ mãi không thấy`)

      if (scene.after) await evaluate(ws, `(async () => { ${scene.after} })()`)
      await sleep(scene.settle ?? 500)
      await evaluate(ws, 'window.__calm(), true')
      await sleep(150)

      const shot = await rpc(ws, 'Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      })
      const name = `${device.name}__${scene.file}.png`
      writeFileSync(join(OUT, name), Buffer.from(shot.data, 'base64'))
      made++
      console.log(`  ${name}  ${device.width * device.scale}x${device.height * device.scale}`)
    }
  }

  await rpc(browser, 'Target.closeTarget', { targetId })
  browser.close()
  chrome.kill()
  console.log(`\nXong: ${made} ảnh trong ${OUT}/`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
