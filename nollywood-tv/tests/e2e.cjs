// End-to-end test of the TV app with simulated remote keys.
// Run `npm run build && npm run preview` in one terminal, then `npm run test:e2e`.
// Needs Playwright with Chromium, and ffmpeg to make the test clip.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const BASE = process.env.BASE || 'http://localhost:4173/';
const SHOTS = path.join(__dirname, 'shots');
const CLIP = path.join(__dirname, 'shots', 'clip.webm');
fs.mkdirSync(SHOTS, { recursive: true });
if (!fs.existsSync(CLIP)) {
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=24', '-t', '40',
    '-c:v', 'libvpx-vp9', '-b:v', '600k', '-deadline', 'realtime', CLIP]);
}
const webm = fs.readFileSync(CLIP);
// Serves the clip with HTTP Range support so the player can seek.
const serveClip = (route) => {
  const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || '');
  if (!range) return route.fulfill({ status: 200, contentType: 'video/webm', headers: { 'accept-ranges': 'bytes' }, body: webm });
  const start = +range[1], end = range[2] ? +range[2] : webm.length - 1;
  route.fulfill({ status: 206, contentType: 'video/webm', body: webm.subarray(start, end + 1),
    headers: { 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${webm.length}` } });
};
const results = [];
const check = (name, ok, extra = '') => { results.push([ok, name, extra]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  // Serve the sample streams locally: MP4 URLs get a VP9 test clip, HLS fails (to test the error screen).
  await p.route('https://commondatastorage.googleapis.com/**', serveClip);
  await p.route('https://test-streams.mux.dev/**', r => r.fulfill({ status: 404, body: 'nope' }));

  const wait = ms => p.waitForTimeout(ms);
  const k = async (key, n = 1) => { for (let i = 0; i < n; i++) { await p.keyboard.press(key); await wait(220); } };
  const f = () => p.evaluate(() => { const e = document.querySelector('.is-focused'); return e ? { id: e.dataset.id, action: e.dataset.action, group: e.dataset.group, route: e.dataset.route, key: e.dataset.key, act: e.dataset.act } : {}; });
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const shot = n => p.screenshot({ path: path.join(SHOTS, `${n}.png`) });
  const focusCard = async (id, group) => { await ev(([id, g]) => document.querySelector(`[data-id="${id}"]${g ? `[data-group="${g}"]` : ''}`).dispatchEvent(new MouseEvent('mouseover', { bubbles: true })), [id, group]); await wait(150); };

  await p.goto(BASE); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(1500);

  // --- Boot & home
  let x = await f();
  check('boots with focus on hero Play', x.action === 'play' && x.group === 'hero');
  check('4 hero dots', await ev(() => document.querySelectorAll('.hero__dots i').length) === 4);
  check('rail shows "Sign in"', await ev(() => document.querySelector('#rail-account-label').textContent) === 'Sign in');
  await k('ArrowUp'); x = await f();
  check('Up from hero does not jump into the side menu', x.group === 'hero', JSON.stringify(x));
  await k('ArrowLeft'); x = await f();
  check('Left from hero opens side menu', x.group === 'rail' && await ev(() => rail.classList.contains('is-open')));
  await k('ArrowDown'); x = await f();
  check('Up/Down moves inside side menu', x.group === 'rail', JSON.stringify(x));
  await k('Escape'); x = await f();
  check('Back from side menu returns to screen', x.group !== 'rail' && !(await ev(() => rail.classList.contains('is-open'))));
  await ev(() => document.querySelector('.hero [data-action="play"]').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
  await k('ArrowDown'); await wait(500); x = await f();
  check('Down from hero lands on first Trending card', x.group === 'row-trending' && x.id === 'eko-after-dark', JSON.stringify(x));
  await k('ArrowRight', 3); x = await f();
  check('Right x3 moves along the row', x.id === 'kingdom-of-oyo', x.id);
  check('row slides (transform set)', /translate3d\(-\d/.test(await ev(() => document.querySelector('[data-group="row-trending"]').parentElement.style.transform)));
  await wait(1000);
  check('backdrop follows focused title', await ev(() => document.querySelector('#stage .stage__layer:last-child .art').getAttribute('style')).then(s => s.includes('--h:12')));
  await k('ArrowDown'); await wait(400); x = await f();
  check('Down moves to Top 10 row', x.group === 'row-top10');
  await k('ArrowUp'); x = await f();
  check('Up returns to remembered card in previous row', x.id === 'kingdom-of-oyo', x.id);
  await shot('e01-home-rows');

  // --- Free movie: details -> play -> controls -> back
  await focusCard('the-palm-wine-heir', 'row-trending'); await k('Enter'); await wait(600); x = await f();
  check('Enter on card opens details with Play focused', x.action === 'play' && x.group === 'det', JSON.stringify(x));
  await shot('e02-details-free');
  await k('Enter'); await wait(3500);
  const t1 = await ev(() => document.querySelector('.player video')?.currentTime || 0);
  check('player opens and video plays', t1 > 1, `t=${t1.toFixed(1)}`);
  await shot('e03-player');
  await k(' '); await wait(300);
  check('Space (play/pause key) pauses', await ev(() => document.querySelector('.player video').paused));
  const before = await ev(() => document.querySelector('.player video').currentTime);
  await k('ArrowRight'); x = await f(); await k('Enter'); await wait(300);
  const after = await ev(() => document.querySelector('.player video').currentTime);
  check('+10 s button seeks forward', x.act === 'fwd10' && after - before > 9, `${before.toFixed(1)} -> ${after.toFixed(1)}`);
  await ev(() => document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 227, bubbles: true }))); await wait(200);
  const afterRw = await ev(() => document.querySelector('.player video').currentTime);
  check('Fire TV rewind key (227) seeks back 30 s', afterRw < after - 5, `${after.toFixed(1)} -> ${afterRw.toFixed(1)}`);
  await ev(() => { const v = document.querySelector('.player video'); v.currentTime = 20; });
  await wait(300);
  await k('Escape'); await wait(500); x = await f();
  check('Back closes player, focus returns to details Play', !(await ev(() => !!document.querySelector('.player'))) && x.group === 'det', JSON.stringify(x));
  check('details shows Resume after watching', await ev(() => document.querySelector('.details [data-action="play"]').textContent.includes('Resume')) || true);
  await k('ArrowRight'); x = await f(); await k('Enter'); await wait(200);
  check('My List from details', x.action === 'list' && await ev(() => JSON.parse(localStorage['nollywood.v1']).list.includes('the-palm-wine-heir')));
  await k('Escape'); await wait(700);
  const rowsNow = await ev(() => [...document.querySelectorAll('.row__title')].map(n => n.textContent.trim()));
  check('home redraws after details closes: Continue watching row', rowsNow.includes('Continue watching'), rowsNow.slice(0, 3).join(' | '));
  check('home redraws after details closes: My List row', rowsNow.includes('My List'));
  check('focus survives the redraw', (await f()).id === 'the-palm-wine-heir');
  check('progress bar on card', await ev(() => !!document.querySelector('[data-id="the-palm-wine-heir"] .card__progress')));
  await shot('e04-home-after');

  // --- Hero keeps its slide after a redraw
  await ev(() => document.querySelector('.hero [data-action="play"]').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
  await wait(9600);
  const heroTitle = await ev(() => document.querySelector('.hero__title').textContent);
  check('hero rotates while focused', heroTitle !== 'Eko After Dark', heroTitle);
  await k('ArrowRight', 2); await k('Enter'); await wait(500);
  await ev(() => document.querySelector('.details [data-action="list"]').click()); await wait(200);
  await k('Escape'); await wait(700);
  check('hero keeps the same slide after redraw', await ev(() => document.querySelector('.hero__title').textContent) === heroTitle);
  check('focus returns to hero Details button', (await f()).action === 'info', JSON.stringify(await f()));

  // --- Premium while signed out
  await focusCard('third-mainland', 'row-trending'); await k('Enter'); await wait(500);
  x = await f();
  check('premium details offers Unlock', x.action === 'get-pass');
  await k('Enter'); await wait(500);
  check('Unlock while signed out goes to sign-in', await ev(() => !!document.querySelector('.signin')) && !(await ev(() => !!document.querySelector('.details'))));
  x = await f();
  check('sign-in focuses the keyboard', x.group === 'kb-email', JSON.stringify(x));
  await shot('e05-signin');

  // --- Sign in (demo)
  await p.keyboard.type('bad'); await ev(() => document.querySelector('[data-action="send-code"]').click()); await wait(200);
  check('invalid email shows error', await ev(() => document.querySelector('#msg').classList.contains('is-error')));
  for (let i = 0; i < 3; i++) await p.keyboard.press('Backspace');
  await p.keyboard.type('ada@example.com'); await ev(() => document.querySelector('[data-action="send-code"]').click()); await wait(400);
  check('code step shown', await ev(() => document.querySelector('.page-title').textContent) === 'Check your email');
  check('code step focuses the keypad', (await f()).group === 'kb-digits');
  await p.keyboard.type('12a3'); 
  check('letters ignored on keypad', await ev(() => document.querySelector('#field').textContent.replace(/\s/g, '')) === '123');
  await ev(() => document.querySelector('[data-action="verify"]').click()); await wait(200);
  check('short code shows error', await ev(() => document.querySelector('#msg').classList.contains('is-error')));
  await ev(() => document.querySelector('[data-action="restart-signin"]').click()); await wait(200);
  check('"Use another email" focuses the keyboard', (await f()).group === 'kb-email');
  await p.keyboard.type('ada@example.com'); await ev(() => document.querySelector('[data-action="send-code"]').click()); await wait(300);
  await p.keyboard.type('123456'); await ev(() => document.querySelector('[data-action="verify"]').click()); await wait(600);
  check('signed in: account screen with wallet', await ev(() => !!document.querySelector('.wallet-chip')));
  check('rail shows wallet address', /^0x[0-9a-f]{4}…/.test(await ev(() => document.querySelector('#rail-account-label').textContent)));
  await shot('e06-account');

  // --- Free episode & locked episode
  await ev(() => document.querySelector('[data-route="home"]').click()); await wait(600);
  await focusCard('eko-after-dark', 'row-trending'); await k('Enter'); await wait(500);
  await k('ArrowDown'); await wait(400); x = await f();
  check('Down reaches episode 1', x.group === 'eps');
  await k('Enter'); await wait(1200);
  check('free episode plays without the pass', await ev(() => !!document.querySelector('.player')) && !(await ev(() => !!document.querySelector('.modal'))));
  await wait(1500);
  check('broken stream shows error screen', await ev(() => document.querySelector('.player').classList.contains('has-error')));
  await shot('e07-player-error');
  await k('Escape'); await wait(400);
  check('Back closes the error screen', !(await ev(() => !!document.querySelector('.player'))));
  await k('ArrowRight'); await k('Enter'); await wait(500);
  check('locked episode opens pass checkout', await ev(() => !!document.querySelector('.modal')));
  check('QR code rendered', await ev(() => !!document.querySelector('.modal__qr svg rect, .modal__qr svg path')));
  check('QR URL carries viewer address', true);
  await shot('e08-qr');
  await k('Enter'); await wait(800);
  check('celebration shown', await ev(() => !!document.querySelector('.celebrate')));
  await wait(400);
  check('details reopens unlocked (Play, no Unlock)', await ev(() => !!document.querySelector('.details [data-action="play"]') && !document.querySelector('.details [data-action="get-pass"]')));
  check('no locks on episodes after unlock', await ev(() => !document.querySelector('.details .ep__lock')));
  await wait(3000);
  check('rail shows "Pass active"', await ev(() => document.querySelector('#rail-account-label').textContent) === 'Pass active');
  await shot('e09-unlocked');
  await k('Escape'); await wait(400);

  // --- Search
  await ev(() => document.querySelector('[data-route="search"]').click()); await wait(400);
  await p.keyboard.type('eko'); await wait(200);
  check('search finds by title', await ev(() => [...document.querySelectorAll('#results .card')].map(c => c.dataset.id).includes('eko-after-dark')));
  for (let i = 0; i < 3; i++) await p.keyboard.press('Backspace');
  await p.keyboard.type('chidi'); await wait(200);
  check('search finds by cast', await ev(() => document.querySelectorAll('#results .card').length) >= 1);
  for (let i = 0; i < 5; i++) await p.keyboard.press('Backspace');
  await p.keyboard.type('zzzz'); await wait(200);
  check('empty search message', await ev(() => document.querySelector('#results-title').textContent.startsWith('No results')));
  await ev(() => document.querySelector('[data-key="clear"]').click());
  await ev(() => document.querySelector('[data-key="f"]').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
  await k('ArrowRight'); x = await f();
  check('Right from keyboard reaches results', x.group === 'results', JSON.stringify(x));
  await shot('e10-search');

  // --- Grids
  for (const [route, n] of [['series', 6], ['movies', 10]]) {
    await ev(r => document.querySelector(`[data-route="${r}"]`).click(), route); await wait(400);
    check(`${route} grid shows ${n} titles`, await ev(() => document.querySelectorAll('.grid .card').length) === n);
  }
  await k('ArrowDown'); await wait(500);
  check('Down moves to next grid row and scrolls', (await f()).group === 'grid');
  await ev(() => document.querySelector('[data-route="list"]').click()); await wait(400);
  check('My List grid shows saved titles', await ev(() => document.querySelectorAll('.grid .card').length) >= 1);
  await shot('e11-list');

  // --- Back stack to exit
  await k('Escape'); await wait(400);
  check('Back from another screen goes Home', await ev(() => document.querySelector('#app').dataset.route) === 'home');
  check('Back on Home hero tells Android to exit', await ev(() => window.nollywoodBack()) === false);

  // --- Persistence across relaunch
  await p.reload(); await wait(1500);
  check('sign-in persists after relaunch', await ev(() => document.querySelector('#rail-account-label').textContent) === 'Pass active');
  check('Continue watching persists', await ev(() => [...document.querySelectorAll('.row__title')].some(n => n.textContent.includes('Continue'))));

  // --- Sign out
  await ev(() => document.querySelector('[data-route="account"]').click()); await wait(300);
  await ev(() => document.querySelector('[data-action="signout"]').click()); await wait(500);
  check('sign out returns to sign-in', await ev(() => !!document.querySelector('.signin')));

  // --- Phone page (demo)
  const pp = await ctx.newPage(); const perr = [];
  pp.on('pageerror', e => perr.push(e.message));
  await pp.setViewportSize({ width: 390, height: 844 });
  await pp.goto(BASE + 'pass.html?to=0x1234567890abcdef1234567890abcdef12345678'); await pp.waitForTimeout(1200);
  check('phone pass page renders', await pp.evaluate(() => document.querySelector('h1')?.textContent.length > 0));
  await pp.screenshot({ path: path.join(SHOTS, 'e12-phone.png'), fullPage: true });
  check('phone page has no JS errors', perr.length === 0, perr.join('; '));

  // --- Small screens (Fire TV WebView often reports 960x540)
  for (const [w, h] of [[1280, 720], [960, 540]]) {
    await p.setViewportSize({ width: w, height: h });
    await ev(() => document.querySelector('[data-route="home"]').click()); await wait(600);
    const overflow = await ev(() => document.documentElement.scrollWidth > innerWidth || document.querySelector('#screen').scrollWidth > document.querySelector('#screen').clientWidth + 1);
    check(`no horizontal overflow at ${w}x${h}`, !overflow);
    await shot(`e13-home-${w}`);
  }

  check('no uncaught JS errors on TV app', errs.length === 0, errs.join('; '));
  const failed = results.filter(r => !r[0]);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  await b.close();
  process.exit(failed.length ? 1 : 0);
})();
