import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, readdir } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('_site');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const server = createServer(async (req, res) => {
  try {
    let path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!path.startsWith(root + '/') && path !== root) throw Error('outside site');
    if ((await stat(path)).isDirectory()) path += '/index.html';
    res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.statusCode = 404; res.end('Not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors = [];
page.on('pageerror', err => errors.push(err.message));
await mkdir('test-results', {recursive:true});
try {
  const visit = async path => { await page.goto(origin + path); await page.waitForLoadState('load'); };
  await visit('/index.html');
  assert.equal(await page.locator('.navbar-logo').evaluate(img => img.complete && img.naturalWidth > 0), true);
  await page.screenshot({path:'test-results/home-desktop.png',fullPage:true});
  assert.equal(await page.locator('script[data-goatcounter]').count(), 0, 'local tests must not count as visits');
  await visit('/demo-oevelser.html');
  assert.equal(await page.locator('#demo-basic input').count(), 3, 'inline R must be rendered');
  const checkInput = async (selector, value, expected) => {
    const input = page.locator(selector).first();
    await input.fill(value);
    const classes = (await input.getAttribute('class')).split(' ');
    assert.equal(classes.includes('webex-correct'), expected === 'correct', `${selector}: ${value}`);
    assert.equal(classes.includes('webex-incorrect'), expected === 'incorrect', `${selector}: ${value}`);
  };
  await checkInput('#demo-basic input:nth-of-type(1)', '41', 'incorrect');
  await checkInput('#demo-basic input:nth-of-type(1)', '42', 'correct');
  await checkInput('#demo-basic input:nth-of-type(1)', '', 'empty');
  // Each input is in its own paragraph, use locators for subsequent exercises.
  const basic = page.locator('#demo-basic input');
  await basic.nth(2).fill('.5');
  assert.match(await basic.nth(2).getAttribute('class'), /webex-correct/);
  const alternatives = page.locator('#demo-alternatives input');
  await alternatives.nth(0).fill('DATA FRAME');
  assert.match(await alternatives.nth(0).getAttribute('class'), /webex-correct/);
  await alternatives.nth(1).fill('library( webexercises )');
  assert.match(await alternatives.nth(1).getAttribute('class'), /webex-correct/);
  await alternatives.nth(2).fill('Rersjovt');
  assert.match(await alternatives.nth(2).getAttribute('class'), /webex-incorrect/);
  await alternatives.nth(2).fill('R er sjovt');
  assert.match(await alternatives.nth(2).getAttribute('class'), /webex-correct/);
  await checkInput('#demo-tolerance input', '3.14', 'incorrect');
  await checkInput('#demo-tolerance input', '3.142', 'correct');
  await checkInput('#demo-tolerance input', '', 'empty');
  const regex = page.locator('#demo-regex input');
  await regex.nth(0).fill('abcd');
  assert.match(await regex.nth(0).getAttribute('class'), /webex-incorrect/);
  await regex.nth(0).fill('abc');
  assert.match(await regex.nth(0).getAttribute('class'), /webex-correct/);
  assert.doesNotMatch(await regex.nth(0).getAttribute('class'), /webex-incorrect/);
  await regex.nth(1).fill('mean( x )');
  assert.match(await regex.nth(1).getAttribute('class'), /webex-correct/);
  const select = page.locator('#demo-mcq select').first();
  await select.selectOption({label:'sum'});
  assert.match(await select.getAttribute('class'), /webex-incorrect/);
  await select.selectOption({label:'mean'});
  assert.match(await select.getAttribute('class'), /webex-correct/);
  const torf = page.locator('#demo-torf select');
  await torf.nth(0).selectOption({label:'TRUE'});
  await torf.nth(1).selectOption({label:'FALSE'});
  for (const field of await torf.all()) assert.match(await field.getAttribute('class'), /webex-correct/);
  await page.locator('#demo-longmcq input[value="answer"]').check();
  assert.equal(await page.locator('#demo-longmcq label.webex-correct').count(), 1);
  const checked = page.locator('#demo-check');
  assert.match(await checked.getAttribute('class'), /unchecked/);
  await checked.locator('input').fill('5');
  await checked.locator('select').selectOption({label:'TRUE'});
  await checked.getByRole('button', {name:'Tjek svar',exact:true}).click();
  assert.equal(await checked.locator('.webex-total_correct').textContent(), '2 af 2 rigtige');
  await checked.getByRole('button', {name:'Skjul feedback',exact:true}).click();
  assert.match(await checked.getAttribute('class'), /unchecked/);
  const hint = page.locator('.webex-solution').filter({has:page.getByRole('button',{name:'Vis hint',exact:true})}).first();
  assert.equal(await hint.getByRole('button').getAttribute('aria-expanded'), 'false');
  await hint.getByRole('button').click();
  assert.equal(await hint.getByRole('button').getAttribute('aria-expanded'), 'true');
  assert.equal(await hint.locator('p').isVisible(), true);
  const figure = page.getByRole('button',{name:'Vis kode og figur',exact:true});
  assert.equal(await figure.count(), 1, 'webex.hide hook must render');
  await figure.click();
  const quizzes = page.locator('.webex-check').filter({hasText:'En blandet quiz'});
  assert.equal(await quizzes.count(), 1);
  assert.equal(await quizzes.locator('input, select').count(), 6);
  assert.equal(await page.locator('.webex-check').filter({hasText:'Spørgsmål fra en fil'}).count(), 1);
  await page.screenshot({path:'test-results/demo-desktop.png',fullPage:true});
  // Check every internal HTML link and locally referenced image/script/stylesheet.
  const walk = async dir => (await Promise.all((await readdir(dir,{withFileTypes:true})).map(x => x.isDirectory() ? walk(resolve(dir,x.name)) : resolve(dir,x.name)))).flat();
  for (const file of (await walk(root)).filter(x => x.endsWith('.html'))) {
    if (!(await readFile(file, 'utf8')).includes('<html')) continue;
    await visit(file.slice(root.length));
    const urls = await page.locator('a[href], img[src], script[src], link[rel="stylesheet"]').evaluateAll(nodes => nodes.map(n => n.href || n.src));
    for (const raw of urls) {
      const url = new URL(raw);
      if (url.origin !== origin) continue;
      let target = resolve(root, '.' + decodeURIComponent(url.pathname));
      if ((await stat(target)).isDirectory()) target += '/index.html';
      await stat(target);
    }
    assert.equal(await page.locator('.navbar-logo').evaluate(img => img.complete && img.naturalWidth > 0), true, file);
  }
  await page.setViewportSize({width:390,height:844});
  for (const [path,name] of [['/index.html','home'],['/demo-oevelser.html','demo'],['/vejledning/ny-oevelsesside.html','guide']]) {
    await visit(path);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), true, `mobile overflow: ${path}`);
    await page.screenshot({path:`test-results/${name}-mobile.png`,fullPage:true});
  }
  assert.deepEqual(errors, []);
  console.log('PASS: rendered pages, logo, internal links, widgets, quizzes, hidden content, mobile layout and local analytics exclusion.');
} catch (error) {
  await page.screenshot({path:'test-results/failure.png',fullPage:true});
  throw error;
} finally { await browser.close(); server.close(); }
