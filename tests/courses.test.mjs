import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, stat, mkdir, writeFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {chromium} from 'playwright';

// Match the GitHub Pages subdirectory, including nested course pages.
const root = resolve('_site');
const prefix = '/exercises';
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.wasm':'application/wasm'};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    assert.ok(url.pathname.startsWith(prefix + '/'));
    let path = resolve(root, '.' + decodeURIComponent(url.pathname.slice(prefix.length)));
    assert.ok(path.startsWith(root + '/'));
    if ((await stat(path)).isDirectory()) path += '/index.html';
    res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.statusCode = 404; res.end('Not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}${prefix}`;
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:1280,height:900}});
await mkdir('test-results', {recursive:true});
const cases = JSON.parse(await readFile('tests/course-cases.json', 'utf8'));
const report = [];
try {
  for (const test of cases) {
    console.log('CHECK ' + test.path);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if(msg.type()==='error') console.log('BROWSER ' + msg.text()); });
    try {
      const source = await readFile(test.path, 'utf8');
      const match = source.match(/<!-- solution:start -->\s*```(?:r|python)\n([\s\S]*?)\n```\s*<!-- solution:end -->/);
      assert.ok(match, 'Each case must test the actual published solution: ' + test.path);
      await page.goto(origin + '/' + test.path.replace(/\.qmd$/, '.html'));
      await page.waitForLoadState('load');
      assert.equal(await page.locator('.navbar-logo').evaluate(img => img.complete && img.naturalWidth > 0), true);
      const lab = page.locator('#exercise-lab');
      const run = lab.locator('.exercise-editor-btn-run-code:not(.disabled)');
      await run.waitFor({state:'visible',timeout:240000});
      const marker = 'COURSE_SOLUTION_OK';
      const code = match[1] + '\n' + test.checks + '\n' + (test.engine==='webr' ? `cat("${marker}\\n")` : `print("${marker}")`);
      const editor = lab.locator('.cm-content[contenteditable="true"]');
      await editor.click();
      await editor.press('ControlOrMeta+a');
      await editor.press('Backspace');
      await page.keyboard.insertText(code);
      assert.equal(await editor.innerText(), code);
      await run.click();
      await lab.locator('.cell-output-stdout').filter({hasText:marker}).first().waitFor({timeout:60000});
      if (test.plot) await lab.locator('.cell-output-display canvas, .cell-output-display img').first().waitFor({timeout:30000});

      // Check that questions were rendered and feedback accepts their authored answers.
      const sections = page.locator('.webex-check');
      assert.equal(await sections.count(), 3);
      for (const section of await sections.all()) {
        let total = 0;
        for (const input of await section.locator('input.webex-solveme').all()) {
          const answers = JSON.parse(await input.getAttribute('data-answer'));
          await input.fill(String(answers[0]));
          total++;
        }
        for (const radio of await section.locator('input[type="radio"][value="answer"]').all()) {
          await radio.check();
          total++;
        }
        assert.ok(total > 0, 'Empty question section');
        await section.getByRole('button',{name:'Tjek svar',exact:true}).click();
        assert.equal(await section.locator('.webex-total_correct').textContent(), `${total} af ${total} rigtige`);
      }
      const hint = page.getByRole('button', {name:'Vis hint',exact:true});
      await hint.click();
      assert.equal(await hint.getAttribute('aria-expanded'), 'true');
      await page.getByRole('button', {name:'Vis løsningsforslag',exact:true}).click();
      assert.deepEqual(errors, []);
      report.push({page:test.path,status:'passed',engine:test.engine,plot:test.plot});
      console.log('PASS ' + test.path);
    } catch(error) {
      await page.screenshot({path:'test-results/course-failure.png',fullPage:true});
      await writeFile('test-results/course-failure.html', await page.content());
      console.error('FAILED ' + test.path + '\n' + errors.join('\n'));
      throw error;
    } finally { await page.close(); }
  }
  console.log(`PASS: ${report.length} published solutions executed in real browser runtimes.`);
} finally {
  await writeFile('test-results/course-results.json', JSON.stringify(report,null,2));
  await browser.close();
  server.close();
}
