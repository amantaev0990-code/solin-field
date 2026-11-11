'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const {chromium, devices} = require('playwright');

const root = path.resolve(process.argv[2] || 'www');
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.wasm':'application/wasm'};
const server = http.createServer(async (request, response) => {
  try {
    const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
    if (!file.startsWith(root + path.sep)) throw Error('Invalid path');
    const data = await fs.readFile(file);
    response.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'});
    response.end(data);
  } catch {
    response.writeHead(404).end();
  }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({channel: process.env.SOLIN_BROWSER_CHANNEL});
    const page = await browser.newPage({
      ...devices['Pixel 7'], viewport: {width: 1067, height: 667}, reducedMotion: 'no-preference'
    });
    await page.route(url => url.hostname !== '127.0.0.1', route => route.abort());
    await page.addInitScript(() => {
      window.transitions = [];
      document.addEventListener('animationstart', event => {
        const screen = event.target.parentElement;
        if (event.target.matches('.workspace') && screen?.matches('.screen'))
          window.transitions.push([screen.id, event.animationName]);
      });
    });
    await page.goto('http://127.0.0.1:' + server.address().port, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => document.documentElement.classList.contains('v37-menu-ready'));
    // Forest workspaces initialize asynchronously. Earlier tests raced
    // their redirect to homeScreen and clicked an inactive old menu.
    await page.waitForFunction(() => window.SolinWorkspace && window.SolinV37);
    await page.evaluate(async () => {
      await window.SolinWorkspace.ready;
      // Only a selected forest enables the legacy field-menu actions.
      // Initialization intentionally opens the chooser, not the working map.
      if(window.SolinWorkspace.activeId)
        await window.SolinWorkspace.activate(window.SolinWorkspace.activeId);
      window.show('mainScreen');
    });
    await page.waitForFunction(() => document.querySelector('#mainScreen.active'));
    const active = page.locator('.screen.active');
    // Navigation removes its own button as soon as a click is handled.
    // Playwright's actionability retry may see it as hidden *after* successful
    // navigation. Assert visibility before dispatch and test the real handler.
    const route = async id => {
      const button=page.locator('#mainScreen [data-field-route="' + id + '"]');
      await button.waitFor({state:'visible'});
      await button.dispatchEvent('click');
    };
    const snapshot = () => page.evaluate(() => {
      const screen = document.querySelector('.screen.active');
      const workspace = screen.querySelector(':scope > .workspace');
      return {
        id: screen.id, count: document.querySelectorAll('.screen.active').length,
        y: screen.scrollTop, windowY: window.scrollY,
        animations: workspace.getAnimations().map(animation => animation.animationName)
      };
    });
    const addScrollRoom = id => page.locator('#' + id).evaluate(screen => {
      const tail = document.createElement('div');
      tail.style.height = '1800px';
      screen.append(tail);
    });

    await addScrollRoom('refsScreen');
    await route('refsScreen');
    await page.waitForFunction(() => window.transitions.some(([id, name]) => id === 'refsScreen' && name === 'field-screen-enter'));
    assert.equal(await active.getAttribute('id'), 'refsScreen');
    await active.evaluate(screen => { screen.scrollTop = 640; });
    assert.equal((await snapshot()).y, 640);
    const same = await page.evaluate(() => {
      window.show('refsScreen');
      return document.querySelector('#refsScreen').scrollTop;
    });
    assert.equal(same, 640, 'Re-selecting the same screen must preserve its scroll position');
    assert.equal(await page.evaluate(() => window.SolinV37.back()), 'navigated');
    assert.equal(await active.getAttribute('id'), 'mainScreen');

    const frames = await page.evaluate(async () => {
      document.querySelector('#mainScreen [data-field-route="refsScreen"]').click();
      const screen = document.querySelector('#refsScreen');
      const workspace = screen.querySelector(':scope > .workspace');
      const snapshot = () => {
        const css = getComputedStyle(workspace);
        return {y: screen.scrollTop, windowY: window.scrollY, opacity: +css.opacity, transform: css.transform, animation: css.animationName};
      };
      const result = [snapshot()];
      await new Promise(resolve => {
        const end = performance.now() + 300;
        function sample() {
          result.push(snapshot());
          if (performance.now() >= end) resolve();
          else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      return result;
    });
    assert.ok(frames.every(frame => frame.y === 0 && frame.windowY === 0), 'Both scroll positions must stay at the top from the first frame');
    assert.ok(frames.some(frame => frame.animation === 'field-screen-enter' && frame.opacity < .95 && frame.transform !== 'none'), 'The real browser must render a visible fade and movement');
    assert.deepEqual(await snapshot(), {id:'refsScreen', count:1, y:0, windowY:0, animations:[]});

    assert.equal(await page.evaluate(() => window.SolinV37.back()), 'navigated');
    await route('mapScreen');
    await page.waitForFunction(() => window.transitions.some(([id, name]) => id === 'mapScreen' && name === 'field-screen-enter'));
    assert.equal(await active.getAttribute('id'), 'mapScreen');
    assert.ok(await page.locator('#fieldMap').isVisible(), 'Map must remain visible on its real route');

    const rapid = await page.evaluate(async () => {
      window.show('mainScreen');
      await new Promise(requestAnimationFrame);
      window.show('refsScreen');
      await new Promise(requestAnimationFrame);
      window.show('mainScreen');
      return [...document.querySelectorAll('.screen-enter')].map(screen => screen.id);
    });
    assert.deepEqual(rapid, ['mainScreen']);
    await page.emulateMedia({reducedMotion:'reduce'});
    await route('refsScreen');
    assert.deepEqual(await snapshot(), {id:'refsScreen', count:1, y:0, windowY:0, animations:[]});
    assert.ok((await page.evaluate(() => window.transitions)).every(([,name]) => name === 'field-screen-enter'));
    console.log('V38 Chromium PASS: menu clicks, native Back router, stable scroll, visible motion, rapid re-entry and reduced motion');
  } finally {
    await browser?.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
