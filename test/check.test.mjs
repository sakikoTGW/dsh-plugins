import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  checkReadme,
  checkRepository,
  validateCatalog,
} from '../scripts/check.mjs';
import { END_MARKER, START_MARKER } from '../scripts/render.mjs';
import {
  CHECK_SCRIPT,
  FIXTURE_DIR,
  combinedOutput,
  errorLines,
  loadValidCatalog,
  loadValidReadme,
  makeTempRepo,
  runCli,
} from './helpers.mjs';

function reasons(errors) {
  return errors.map((error) => `${error.file}: ${error.reason}`);
}

function assertHasIssue(errors, file, pattern) {
  assert.ok(
    errors.some((error) => error.file === file && pattern.test(error.reason)),
    `期望 ${file} 出现 ${pattern}，实际错误：\n${reasons(errors).join('\n') || '（无错误）'}`,
  );
}

function mutate(mutator) {
  const catalog = loadValidCatalog();
  mutator(catalog);
  return catalog;
}

// ---------------------------------------------------------------------------
// validateCatalog：schema 校验
// ---------------------------------------------------------------------------

test('合法 fixture 通过校验', () => {
  assert.deepEqual(validateCatalog(loadValidCatalog()), []);
});

test('schemaVersion 不是 1 → 失败', () => {
  const errors = validateCatalog(mutate((c) => { c.schemaVersion = 2; }));
  assertHasIssue(errors, 'catalog.json', /schemaVersion 必须为 1/);
});

test('owner / maintainer / updated 缺失或格式不对 → 失败', () => {
  const errors = validateCatalog(mutate((c) => {
    c.owner = '';
    delete c.maintainer;
    c.updated = '2026/10/27';
  }));
  assertHasIssue(errors, 'catalog.json', /owner 不能为空/);
  assertHasIssue(errors, 'catalog.json', /maintainer 不能为空/);
  assertHasIssue(errors, 'catalog.json', /updated 必须是 YYYY-MM-DD/);
});

test('categories 为空或 category id 重复 → 失败', () => {
  assertHasIssue(
    validateCatalog(mutate((c) => { c.categories = []; })),
    'catalog.json',
    /categories 必须是非空数组/,
  );
  assertHasIssue(
    validateCatalog(mutate((c) => { c.categories[1].id = 'input'; })),
    'catalog.json',
    /categories\[1\]\.id 重复：input/,
  );
});

test('插件 id 重复 → 失败', () => {
  const errors = validateCatalog(mutate((c) => { c.plugins[1].id = c.plugins[0].id; }));
  assertHasIssue(errors, 'catalog.json', /plugins\[1\]\.id 重复：element-picker/);
});

test('插件 name 重复 → 失败', () => {
  const errors = validateCatalog(mutate((c) => { c.plugins.push({ ...structuredClone(c.plugins[0]), id: 'other' }); }));
  assertHasIssue(errors, 'catalog.json', /plugins\[2\]\.name 重复：dsh-element-picker/);
});

test('name 不符合 ^dsh-[a-z0-9][a-z0-9-]*$ → 失败', () => {
  const errors = validateCatalog(mutate((c) => { c.plugins[0].name = 'element-picker'; }));
  assertHasIssue(errors, 'catalog.json', /plugins\[0\]\.name 不符合/);
});

test('未知 category → 失败', () => {
  const errors = validateCatalog(mutate((c) => { c.plugins[0].category = 'widgets'; }));
  assertHasIssue(errors, 'catalog.json', /plugins\[0\]\.category 未定义：/);
});

test('非法 status → 失败', () => {
  const errors = validateCatalog(mutate((c) => { c.plugins[0].status = 'published'; }));
  assertHasIssue(errors, 'catalog.json', /plugins\[0\]\.status 非法：/);
});

test('summary 为空 → 失败', () => {
  const errors = validateCatalog(mutate((c) => { c.plugins[0].summary = '   '; }));
  assertHasIssue(errors, 'catalog.json', /plugins\[0\]\.summary 不能为空/);
});

test('install 不含插件名 → 失败', () => {
  const errors = validateCatalog(mutate((c) => { c.plugins[0].install = 'dsh plugin add something-else'; }));
  assertHasIssue(errors, 'catalog.json', /plugins\[0\]\.install 必须包含插件名 dsh-element-picker/);
});

test('repo 不是 null 也不是 https://github.com/sakikoTGW/<name> → 失败', () => {
  const errors = validateCatalog(mutate((c) => {
    c.plugins[1].repo = 'https://github.com/someone-else/dsh-plugin-resolver';
  }));
  assertHasIssue(errors, 'catalog.json', /plugins\[1\]\.repo 必须是 null 或 https:\/\/github\.com\/sakikoTGW\/dsh-plugin-resolver/);

  const httpErrors = validateCatalog(mutate((c) => {
    c.plugins[1].repo = 'http://github.com/sakikoTGW/dsh-plugin-resolver';
  }));
  assertHasIssue(httpErrors, 'catalog.json', /\.repo 必须是 null 或/);
});

test('live/beta 没有 version / version 非 semver → 失败', () => {
  const missing = validateCatalog(mutate((c) => { delete c.plugins[1].version; }));
  assertHasIssue(missing, 'catalog.json', /plugins\[1\]\.version 在 status=live 时必须是 semver/);

  const bad = validateCatalog(mutate((c) => { c.plugins[1].version = 'v0.1.2'; }));
  assertHasIssue(bad, 'catalog.json', /plugins\[1\]\.version 在 status=live 时必须是 semver（当前 "v0\.1\.2"）/);

  const beta = validateCatalog(mutate((c) => {
    c.plugins[1].status = 'beta';
    c.plugins[1].version = '0.1';
  }));
  assertHasIssue(beta, 'catalog.json', /plugins\[1\]\.version 在 status=beta 时必须是 semver/);
});

test('live/beta 既无 npm 也无 repo → 失败', () => {
  const errors = validateCatalog(mutate((c) => {
    c.plugins[1].repo = null;
    delete c.plugins[1].npm;
  }));
  assertHasIssue(errors, 'catalog.json', /plugins\[1\] 在 status=live 时至少要有 npm 或 repo/);
});

test('wip/planned 允许没有 version', () => {
  for (const status of ['wip', 'planned']) {
    const errors = validateCatalog(mutate((c) => {
      c.plugins[0].status = status;
      delete c.plugins[0].version;
    }));
    assert.deepEqual(errors, [], `${status} 不应强制 version：${reasons(errors).join('；')}`);
  }
});

test('engines.dsh / license 为空 → 失败', () => {
  const errors = validateCatalog(mutate((c) => {
    c.plugins[0].engines = { node: '>=20' };
    c.plugins[0].license = '';
  }));
  assertHasIssue(errors, 'catalog.json', /plugins\[0\]\.engines\.dsh 不能为空/);
  assertHasIssue(errors, 'catalog.json', /plugins\[0\]\.license 不能为空/);
});

test('一次收集多条错误（不因第一条错误中断）', () => {
  const errors = validateCatalog(mutate((c) => {
    c.plugins[0].status = 'nope';
    c.plugins[0].install = 'install nothing';
    c.plugins[1].license = '';
  }));
  assert.ok(errors.length >= 3, reasons(errors).join('\n'));
});

// ---------------------------------------------------------------------------
// checkReadme：README 一致性
// ---------------------------------------------------------------------------

test('合法 fixture 的 README 通过一致性校验', () => {
  assert.deepEqual(checkReadme(loadValidCatalog(), loadValidReadme()), []);
});

test('README 被手改后校验失败', () => {
  const readme = loadValidReadme().replace('0.2.1', '0.2.9');
  const errors = checkReadme(loadValidCatalog(), readme);
  assertHasIssue(errors, 'README.md', /渲染结果与 README 不一致（从第 \d+ 行开始/);
});

test('README 缺 marker / marker 重复 / 顺序颠倒 → 失败', () => {
  const catalog = loadValidCatalog();
  const readme = loadValidReadme();

  const missingStart = readme.replace(START_MARKER, '');
  assertHasIssue(checkReadme(catalog, missingStart), 'README.md', /catalog:start --> 必须恰好出现一次（当前 0 次）/);

  const duplicatedEnd = `${readme}\n${END_MARKER}\n`;
  assertHasIssue(checkReadme(catalog, duplicatedEnd), 'README.md', /catalog:end --> 必须恰好出现一次（当前 2 次）/);

  const reversed = `${END_MARKER}\n正文\n${START_MARKER}\n`;
  assertHasIssue(checkReadme(catalog, reversed), 'README.md', /必须位于.*catalog:end --> 之前/);
});

test('README 渲染所需字段被破坏时给出「无法渲染」错误而不是崩栈', () => {
  const catalog = mutate((c) => { c.plugins[0].status = 'published'; });
  const errors = checkReadme(catalog, loadValidReadme());
  assertHasIssue(errors, 'README.md', /无法按 catalog\.json 渲染目录段：未知 status/);
});

// ---------------------------------------------------------------------------
// checkRepository：读文件 + 汇总
// ---------------------------------------------------------------------------

test('checkRepository 在合法 fixture 上零错误，并返回插件/分类数', () => {
  const result = checkRepository(FIXTURE_DIR);
  assert.deepEqual(result.errors, []);
  assert.equal(result.pluginCount, 2);
  assert.equal(result.categoryCount, 2);
});

test('checkRepository：catalog.json 缺失 / JSON 损坏 / README 缺失 → 明确错误', (t) => {
  const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-plugins-empty-'));
  t.after(() => fs.rmSync(emptyRoot, { recursive: true, force: true }));
  assertHasIssue(checkRepository(emptyRoot).errors, 'catalog.json', /文件不存在/);

  const brokenJson = makeTempRepo(t);
  fs.writeFileSync(path.join(brokenJson, 'catalog.json'), '{ "schemaVersion": 1, ');
  assertHasIssue(checkRepository(brokenJson).errors, 'catalog.json', /JSON 解析失败/);

  const missingReadme = makeTempRepo(t);
  fs.rmSync(path.join(missingReadme, 'README.md'));
  assertHasIssue(checkRepository(missingReadme).errors, 'README.md', /文件不存在/);
});

// ---------------------------------------------------------------------------
// CLI：退出码与 `文件: 原因` 输出格式
// ---------------------------------------------------------------------------

test('CLI: 合法 fixture 退出码 0，打印含插件数的 OK 摘要', () => {
  const result = runCli(CHECK_SCRIPT, ['--root', FIXTURE_DIR]);
  assert.equal(result.status, 0, combinedOutput(result));
  assert.match(result.stdout, /OK: catalog\.json \/ README\.md 校验通过（2 个插件、2 个分类）/);
  assert.equal(result.stderr, '');
});

test('CLI: 非法 fixture 退出码 1，错误行形如 `文件: 原因`', (t) => {
  const tempRoot = makeTempRepo(t);
  const catalogPath = path.join(tempRoot, 'catalog.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  catalog.plugins[0].status = 'published';
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

  const result = runCli(CHECK_SCRIPT, ['--root', tempRoot]);
  assert.equal(result.status, 1, combinedOutput(result));
  assert.match(result.stderr, /^catalog\.json: plugins\[0\]\.status 非法：/m);
  assert.match(result.stderr, /✗ 校验失败：共 \d+ 个错误（2 个插件、2 个分类）/);
});

test('CLI: README 被手改后退出码 1，错误指向 README.md', (t) => {
  const tempRoot = makeTempRepo(t);
  const readmePath = path.join(tempRoot, 'README.md');
  fs.writeFileSync(readmePath, fs.readFileSync(readmePath, 'utf8').replace('0.1.2', '0.1.3'));

  const result = runCli(CHECK_SCRIPT, ['--root', tempRoot]);
  assert.equal(result.status, 1, combinedOutput(result));
  assert.match(result.stderr, /^README\.md: 渲染结果与 README 不一致/m);
});

test('CLI: 缺 marker 时退出码 1', (t) => {
  const tempRoot = makeTempRepo(t);
  const readmePath = path.join(tempRoot, 'README.md');
  fs.writeFileSync(readmePath, fs.readFileSync(readmePath, 'utf8').replace(END_MARKER, ''));

  const result = runCli(CHECK_SCRIPT, ['--root', tempRoot]);
  assert.equal(result.status, 1, combinedOutput(result));
  assert.match(result.stderr, /^README\.md: <!-- catalog:end --> 必须恰好出现一次（当前 0 次）/m);
});

test('CLI: 未知参数给出明确错误且退出码 1', () => {
  const result = runCli(CHECK_SCRIPT, ['--bogus']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /check\.mjs: 未知参数：--bogus/);
});

test('CLI: catalog.json 缺失时退出码 1，错误行指出文件不存在', (t) => {
  const tempRoot = makeTempRepo(t);
  fs.rmSync(path.join(tempRoot, 'catalog.json'));
  const result = runCli(CHECK_SCRIPT, ['--root', tempRoot]);
  assert.equal(result.status, 1);
  const lines = errorLines(result);
  assert.ok(lines.includes('catalog.json: 文件不存在'), lines.join('\n'));
});

// ---------------------------------------------------------------------------
// CRLF：Windows 上 core.autocrlf=true 时 README 工作区是 CRLF，校验不应假失败
// ---------------------------------------------------------------------------

test('README 为 CRLF 时 checkReadme / checkRepository / CLI 均通过', (t) => {
  const catalog = loadValidCatalog();
  const crlfReadme = loadValidReadme().replace(/\n/g, '\r\n');
  assert.deepEqual(checkReadme(catalog, crlfReadme), []);

  const tempRoot = makeTempRepo(t);
  fs.writeFileSync(path.join(tempRoot, 'README.md'), crlfReadme);
  assert.deepEqual(checkRepository(tempRoot).errors, []);

  const result = runCli(CHECK_SCRIPT, ['--root', tempRoot]);
  assert.equal(result.status, 0, combinedOutput(result));
  assert.match(result.stdout, /OK: catalog\.json \/ README\.md 校验通过（2 个插件、2 个分类）/);
});

test('CRLF README 被手改后仍报不一致（归一化不掩盖真实差异）', (t) => {
  const tempRoot = makeTempRepo(t);
  const readmePath = path.join(tempRoot, 'README.md');
  fs.writeFileSync(readmePath, loadValidReadme().replace(/\n/g, '\r\n').replace('0.2.1', '0.2.9'));

  const result = runCli(CHECK_SCRIPT, ['--root', tempRoot]);
  assert.equal(result.status, 1, combinedOutput(result));
  assert.match(result.stderr, /^README\.md: 渲染结果与 README 不一致/m);
});
