import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  END_MARKER,
  GENERATED_NOTE,
  START_MARKER,
  firstDifferingLine,
  formatUnifiedDiff,
  locateMarkers,
  normalizeNewlines,
  pluginUrl,
  renderCatalogSection,
  renderPluginRow,
  replaceCatalogSection,
  statusLabel,
} from '../scripts/render.mjs';
import {
  FIXTURE_DIR,
  RENDER_SCRIPT,
  combinedOutput,
  loadValidCatalog,
  loadValidReadme,
  makeTempRepo,
  runCli,
} from './helpers.mjs';

// 手写的期望字符串：与 test/fixtures/valid/catalog.json 对应的目录段（不含 marker）。
// 先写期望、再让 render 去匹配，避免「用实现验证实现」。
const EXPECTED_SECTION = [
  '',
  GENERATED_NOTE,
  '',
  '当前收录 **2** 个插件，按用途分组：',
  '',
  '### 输入与引用',
  '> 把说不清的东西变成可点的引用，少解释一句。',
  '',
  '| 插件 | 一句话 | 安装 | 状态 |',
  '| --- | --- | --- | --- |',
  '| [dsh-element-picker](https://www.npmjs.com/package/dsh-element-picker) | 把元素、链接、文件路径变成输入框里的引用芯片，模型不用再猜「你说的是哪个」 | `dsh plugin --profile <profile> add dsh-element-picker` | ✅ 可用 · 0.2.1 |',
  '',
  '### 安装与开发',
  '> 让装插件、改插件这件事少踩坑。',
  '',
  '| 插件 | 一句话 | 安装 | 状态 |',
  '| --- | --- | --- | --- |',
  '| [dsh-plugin-resolver](https://github.com/sakikoTGW/dsh-plugin-resolver) | 一次工具调用把插件装对：搜目录、同名消歧、按当前内核选兼容版本、装完校验 | `dsh plugin --profile <profile> add dsh-plugin-resolver` | ✅ 可用 · 0.1.2 |',
  '',
].join('\n');

test('renderCatalogSection 输出精确匹配期望字符串', () => {
  assert.equal(renderCatalogSection(loadValidCatalog()), EXPECTED_SECTION);
});

test('replaceCatalogSection 自洽替换且不碰手写正文', () => {
  const catalog = loadValidCatalog();
  const readme = loadValidReadme();

  assert.equal(replaceCatalogSection(readme, catalog), readme, '未改动 catalog 时应逐字节还原');

  const changed = structuredClone(catalog);
  changed.plugins[0].summary = '改过的摘要';
  const rendered = replaceCatalogSection(readme, changed);

  const prefix = readme.slice(0, readme.indexOf(START_MARKER));
  const suffix = readme.slice(readme.indexOf(END_MARKER) + END_MARKER.length);
  assert.ok(rendered.startsWith(prefix), 'start marker 之前的手写内容必须原样保留');
  assert.ok(rendered.endsWith(suffix), 'end marker 之后的手写内容必须原样保留');
  assert.match(rendered, /改过的摘要/);
  assert.ok(!rendered.includes('模型不用再猜「你说的是哪个」'));
});

test('link 优先 repo，无 repo 回退 npm 包页；各状态文案正确', () => {
  const base = {
    id: 'demo',
    name: 'dsh-demo',
    summary: '一句话',
    install: 'dsh plugin add dsh-demo',
    license: 'MIT',
  };

  assert.equal(pluginUrl({ ...base, repo: null, npm: 'dsh-demo' }), 'https://www.npmjs.com/package/dsh-demo');
  assert.equal(
    pluginUrl({ ...base, repo: 'https://github.com/sakikoTGW/dsh-demo', npm: 'dsh-demo' }),
    'https://github.com/sakikoTGW/dsh-demo',
  );

  assert.equal(statusLabel({ ...base, status: 'live', version: '1.2.3' }), '✅ 可用 · 1.2.3');
  assert.equal(statusLabel({ ...base, status: 'beta', version: '0.3.0' }), '🧪 Beta · 0.3.0');
  assert.equal(statusLabel({ ...base, status: 'wip' }), '🚧 开发中');
  assert.equal(statusLabel({ ...base, status: 'planned' }), '📝 计划中');
  assert.equal(statusLabel({ ...base, status: 'archived', version: '0.9.0' }), '📦 已归档 · 0.9.0');

  assert.equal(
    renderPluginRow({ ...base, status: 'wip', repo: null, npm: 'dsh-demo' }),
    '| [dsh-demo](https://www.npmjs.com/package/dsh-demo) | 一句话 | `dsh plugin add dsh-demo` | 🚧 开发中 |',
  );

  assert.throws(() => statusLabel({ ...base, status: 'published' }), /未知 status/);
  assert.throws(() => renderPluginRow({ ...base, status: 'live', repo: null, npm: '' }), /既无 repo 也无 npm/);
});

test('marker 缺失 / 重复 / 顺序错误时 replaceCatalogSection 抛明确错误', () => {
  const catalog = loadValidCatalog();
  const readme = loadValidReadme();

  assert.throws(
    () => replaceCatalogSection('# 没有 marker 的 README\n', catalog),
    /catalog:start --> 必须恰好出现一次（当前 0 次）/,
  );
  assert.throws(
    () => replaceCatalogSection(`${readme}\n${START_MARKER}\n`, catalog),
    /catalog:start --> 必须恰好出现一次（当前 2 次）/,
  );
  assert.throws(
    () => replaceCatalogSection(readme.replace(END_MARKER, ''), catalog),
    /catalog:end --> 必须恰好出现一次（当前 0 次）/,
  );
  assert.throws(
    () => replaceCatalogSection(`${END_MARKER}\n正文\n${START_MARKER}\n`, catalog),
    /catalog:start 必须位于 catalog:end 之前/,
  );

  const markers = locateMarkers(readme);
  assert.equal(markers.startCount, 1);
  assert.equal(markers.endCount, 1);
  assert.equal(markers.valid, true);
});

test('formatUnifiedDiff 输出 unified diff，firstDifferingLine 定位首个差异行', () => {
  const before = 'a\nb\nc\n';
  const after = 'a\nB\nc\n';
  const diff = formatUnifiedDiff(before, after);
  assert.match(diff, /^--- /m);
  assert.match(diff, /^\+\+\+ /m);
  assert.match(diff, /^@@ /m);
  assert.match(diff, /^-b$/m);
  assert.match(diff, /^\+B$/m);
  assert.match(diff, /^ a$/m);

  assert.equal(formatUnifiedDiff(before, before), '');
  assert.equal(firstDifferingLine('a\nb\nc', 'a\nb\nc'), 0);
  assert.equal(firstDifferingLine('a\nb\nc', 'a\nB\nc'), 2);
  assert.equal(firstDifferingLine('a\nb', 'a\nb\nc'), 3);
});

test('CLI: fixture 上 render --check 通过', () => {
  const result = runCli(RENDER_SCRIPT, ['--check', '--root', FIXTURE_DIR]);
  assert.equal(result.status, 0, combinedOutput(result));
  assert.match(result.stdout, /OK: README\.md 与 catalog\.json 渲染结果一致（2 个插件）/);
  assert.equal(result.stderr, '');
});

test('CLI: README 被手改后 render --check 失败、打印 diff 且不写盘', (t) => {
  const tempRoot = makeTempRepo(t);
  const readmePath = path.join(tempRoot, 'README.md');
  const handEdited = fs.readFileSync(readmePath, 'utf8').replace('0.2.1', '0.2.9');
  fs.writeFileSync(readmePath, handEdited);

  const result = runCli(RENDER_SCRIPT, ['--check', '--root', tempRoot]);
  assert.equal(result.status, 1, combinedOutput(result));
  assert.match(result.stderr, /README\.md 与 catalog\.json 渲染结果不一致/);
  assert.match(result.stderr, /^@@ /m);
  assert.match(result.stderr, /^-.*0\.2\.9/m);
  assert.match(result.stderr, /^\+.*0\.2\.1/m);

  assert.equal(fs.readFileSync(readmePath, 'utf8'), handEdited, '--check 不得改写 README');
});

test('CLI: 默认模式重写 README 的目录段', (t) => {
  const tempRoot = makeTempRepo(t);
  const readmePath = path.join(tempRoot, 'README.md');
  const original = fs.readFileSync(readmePath, 'utf8');
  fs.writeFileSync(readmePath, original.replace('0.1.2', '9.9.9'));

  const result = runCli(RENDER_SCRIPT, ['--root', tempRoot]);
  assert.equal(result.status, 0, combinedOutput(result));
  assert.match(result.stdout, /README\.md 已更新（2 个插件）/);
  assert.equal(fs.readFileSync(readmePath, 'utf8'), original);
});

// ---------------------------------------------------------------------------
// CRLF：Windows 上 core.autocrlf=true 时工作区 README 是 CRLF，不能因此假失败
// ---------------------------------------------------------------------------

test('normalizeNewlines 统一 CRLF / 孤立 CR 为 LF', () => {
  assert.equal(normalizeNewlines('a\r\nb\rc\nd'), 'a\nb\nc\nd');
  assert.equal(normalizeNewlines(loadValidReadme()), loadValidReadme());
  assert.equal(normalizeNewlines(undefined), undefined);
});

test('replaceCatalogSection 收到 CRLF 时输出纯 LF，且与 LF golden 逐字节一致', () => {
  const catalog = loadValidCatalog();
  const lfReadme = loadValidReadme();
  const crlfReadme = lfReadme.replace(/\n/g, '\r\n');

  const rendered = replaceCatalogSection(crlfReadme, catalog);
  assert.equal(rendered, lfReadme, 'CRLF 输入应与 LF golden 结果一致');
  assert.ok(!rendered.includes('\r'), '渲染结果不得含 CR');
});

test('CLI: fixture README 存成 CRLF 时 render --check 通过且不写盘', (t) => {
  const tempRoot = makeTempRepo(t);
  const readmePath = path.join(tempRoot, 'README.md');
  const crlfReadme = loadValidReadme().replace(/\n/g, '\r\n');
  fs.writeFileSync(readmePath, crlfReadme);

  const result = runCli(RENDER_SCRIPT, ['--check', '--root', tempRoot]);
  assert.equal(result.status, 0, combinedOutput(result));
  assert.match(result.stdout, /OK: README\.md 与 catalog\.json 渲染结果一致（2 个插件）/);
  assert.equal(fs.readFileSync(readmePath, 'utf8'), crlfReadme, '--check 不得改写 README');
});

test('CLI: 默认模式把 CRLF README 重写成纯 LF', (t) => {
  const tempRoot = makeTempRepo(t);
  const readmePath = path.join(tempRoot, 'README.md');
  fs.writeFileSync(readmePath, loadValidReadme().replace(/\n/g, '\r\n'));

  const result = runCli(RENDER_SCRIPT, ['--root', tempRoot]);
  assert.equal(result.status, 0, combinedOutput(result));

  const written = fs.readFileSync(readmePath, 'utf8');
  assert.ok(!written.includes('\r'), '写盘不得含 CR');
  assert.equal(written, loadValidReadme(), '重写结果应为纯 LF 的 golden');
});
