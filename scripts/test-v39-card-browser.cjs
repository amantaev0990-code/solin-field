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
    page.setDefaultTimeout(5000);
    page.on('pageerror', error => console.error(error.message));
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
    await page.waitForFunction(() => document.querySelector('#mainScreen.active') && window.SolinV37);
    await page.waitForFunction(() => D?.quarters && window.SolinWorkspace?.activeId);
    const context = await page.evaluate(async () => {
      await window.SolinWorkspace.ready;
      await window.SolinWorkspace.activate(window.SolinWorkspace.activeId);
      const populated = stand => stand._children?.Макет10?.length >= 2;
      const quarter = Object.entries(D.quarters).find(([,q]) => q.compartments?.some(populated));
      if (!quarter) throw Error('No sample stands');
      const [key, q] = quarter;
      const row = q.compartments.find(populated);
      current = row;
      renderComp();
      window.show('card');
      return {key, vd:row.VD};
    });
    const card = page.locator('#card.active');
    const original = await page.evaluate(() => {
      const rows = current._children.Макет10;
      const prior = rows.map(row => row.POL);
      rows[0].POL = '0.699999999999999988079071';
      rows[1].POL = 65;
      return prior;
    });
    await card.getByRole('button',{name:'КТ',exact:true}).click();
    const pol = page.locator('.kt-stand tbody tr td:nth-child(9)');
    assert.equal(await pol.nth(0).textContent(), '0.7');
    assert.equal(await pol.nth(1).textContent(), '65');
    await page.evaluate(prior => {
      const rows = current._children.Макет10;
      if (rows[0].POL !== '0.699999999999999988079071') throw Error('KT changed stored data');
      prior.forEach((value, i) => { rows[i].POL = value; });
    }, original);
    await page.locator('.kt-sheet').waitFor();
    assert.equal(await page.locator('.kt-sheet .kt-block output').first().textContent(),String(context.vd));
    await page.getByRole('button',{name:'Выход',exact:true}).click();
    assert.equal(await page.locator('.kt-sheet').isVisible(),false);
    await card.getByRole('button',{name:'Быстрый ввод',exact:true}).click();
    const form = page.locator('#ce-form');
    assert.equal(await form.getAttribute('data-quick-step'),'base');
    await form.getByRole('button',{name:'Макет 10',exact:true}).click();
    const rowControls = 'input[data-ce-field]:visible:not([readonly]):not([disabled]),select[data-ce-field]:visible:not([disabled])';
    const rows = form.locator('#ce-table-Макет10 tbody tr');
    const endOfRow = rows.nth(0).locator(rowControls).last();
    const startOfRow = rows.nth(1).locator(rowControls).first();
    await endOfRow.focus();
    await endOfRow.press('Enter');
    assert.ok(await startOfRow.evaluate(el => el === document.activeElement), 'Enter wraps to the next row');

    await form.getByRole('button',{name:'Макет 31',exact:true}).click();
    const first = form.locator('[data-ce-field="PRkol"]');
    const second = form.locator('[data-ce-field="PRH"]');
    await first.focus();
    await first.press('Enter');
    assert.ok(await second.evaluate(el => el === document.activeElement));
    await form.getByRole('button',{name:'Ввод ↵',exact:true}).click();
    assert.ok(await form.locator('[data-ce-field="PRA"]').evaluate(el => el === document.activeElement));
    await form.getByRole('button',{name:'Макет 23',exact:true}).click();
    assert.ok(await form.locator('#ce-table-Макет23').isVisible());
    await page.locator('#ce-cancel').click();
    await page.locator('#modal').waitFor({state:'hidden'});
    await card.getByRole('button',{name:'Изменить карточку'}).click();
    assert.equal(await form.getAttribute('data-quick-step'),null);
    await page.locator('#ce-cancel').click();
    await page.locator('#modal').waitFor({state:'hidden'});
    await page.locator('#solin-v37-new-button').click();
    await page.waitForFunction(() => current?._local === true);
    await card.getByRole('button',{name:'Быстрый ввод',exact:true}).click();
    assert.ok(await form.locator('input[data-ce-field="VD"]').isVisible());
    await page.locator('#ce-cancel').click();
    await page.locator('#modal').waitFor({state:'hidden'});
    await page.evaluate(key => {window.show('quartersScreen');openQuarter(key);}, context.key);
    const quarterKT = page.locator('#quarters > .kt-quarter-footer:last-child').getByRole('button',{name:'КТ — просмотр выделов квартала'});
    assert.equal(await quarterKT.evaluate(button => getComputedStyle(button).backgroundColor), 'rgb(23, 91, 176)');
    await quarterKT.click();
    const nav = page.locator('.kt-review-nav');
    const prev = nav.getByRole('button',{name:/Предыдущий/});
    const next = nav.getByRole('button',{name:/Следующий/});
    assert.ok(await prev.isDisabled());
    assert.match(await nav.locator('span').textContent(), / · 1 из \d+$/);
    await next.click();
    assert.match(await nav.locator('span').textContent(), / · 2 из \d+$/);
    await prev.click();
    assert.ok(await prev.isDisabled());

    console.log('V39 browser PASS: read-only KT, keyboard and screen Enter, Maket 23, complete editor and new stand');
  } finally {
    await browser?.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
