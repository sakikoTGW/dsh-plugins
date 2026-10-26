import assert from 'node:assert/strict';
import test from 'node:test';
import { runOnlineChecks } from '../scripts/check.mjs';
import { loadValidCatalog } from './helpers.mjs';

function mockResponse({ status = 200, json, jsonThrows = false } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      if (jsonThrows) throw new Error('not json');
      return json;
    },
  };
}

/** 按 URL 路由的假 fetch；记录调用以便断言 header/URL。 */
function makeFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    for (const route of routes) {
      if (route.match(url)) return route.respond(url, init);
    }
    throw new Error(`未预期的请求：${url}`);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

const NPM_ELEMENT = (url) => url.includes('registry.npmjs.org') && url.includes('dsh-element-picker');
const NPM_RESOLVER = (url) => url.includes('registry.npmjs.org') && url.includes('dsh-plugin-resolver');
const GITHUB_RESOLVER = (url) => url.includes('api.github.com/repos/sakikoTGW/dsh-plugin-resolver');

function assertOnlineHasError(errors, pattern) {
  assert.ok(
    errors.some((error) => error.file === 'catalog.json' && pattern.test(error.reason)),
    `期望在线错误匹配 ${pattern}，实际：${JSON.stringify(errors, null, 2)}`,
  );
}

test('npm 版本一致 + GitHub 可达 → 无错误，note 覆盖两项检查', async () => {
  const fetchImpl = makeFetch([
    { match: NPM_ELEMENT, respond: () => mockResponse({ json: { latest: '0.2.1' } }) },
    { match: NPM_RESOLVER, respond: () => mockResponse({ json: { latest: '0.1.2' } }) },
    { match: GITHUB_RESOLVER, respond: () => mockResponse({ json: { full_name: 'sakikoTGW/dsh-plugin-resolver' } }) },
  ]);
  const { errors, notes } = await runOnlineChecks(loadValidCatalog(), { fetchImpl, githubToken: '' });
  assert.deepEqual(errors, []);
  assert.deepEqual(notes, [
    'npm dsh-element-picker@0.2.1',
    'npm dsh-plugin-resolver@0.1.2',
    'GitHub sakikoTGW/dsh-plugin-resolver',
  ]);
  // element-picker 的 repo 为 null，不应对它请求 GitHub（resolver 的 repo 非 null，会请求）
  assert.ok(
    fetchImpl.calls
      .filter((call) => call.url.includes('api.github.com'))
      .every((call) => !call.url.includes('dsh-element-picker')),
  );
});

test('npm registry 版本与 catalog version 不一致 → 失败', async () => {
  const fetchImpl = makeFetch([
    { match: NPM_ELEMENT, respond: () => mockResponse({ json: { latest: '0.2.1' } }) },
    { match: NPM_RESOLVER, respond: () => mockResponse({ json: { latest: '0.1.9' } }) },
    { match: GITHUB_RESOLVER, respond: () => mockResponse({}) },
  ]);
  const { errors } = await runOnlineChecks(loadValidCatalog(), { fetchImpl, githubToken: '' });
  assertOnlineHasError(errors, /npm 最新版本 0\.1\.9 与 catalog version 0\.1\.2 不一致/);
});

test('npm 包不存在（404）→ 明确错误', async () => {
  const fetchImpl = makeFetch([
    { match: NPM_ELEMENT, respond: () => mockResponse({ status: 404 }) },
    { match: NPM_RESOLVER, respond: () => mockResponse({ json: { latest: '0.1.2' } }) },
    { match: GITHUB_RESOLVER, respond: () => mockResponse({}) },
  ]);
  const { errors } = await runOnlineChecks(loadValidCatalog(), { fetchImpl, githubToken: '' });
  assertOnlineHasError(errors, /npm 在线检查失败（dsh-element-picker）：npm registry 上找不到该包（HTTP 404）/);
});

test('npm registry 网络失败 → 收集为明确错误、不抛异常', async () => {
  const networkError = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
  const fetchImpl = makeFetch([
    { match: () => true, respond: () => { throw networkError; } },
  ]);
  const { errors } = await runOnlineChecks(loadValidCatalog(), { fetchImpl, githubToken: '' });
  assertOnlineHasError(errors, /npm registry 不可达.*网络错误：fetch failed（ENOTFOUND）/);
  assertOnlineHasError(errors, /GitHub API 不可达.*网络错误：fetch failed（ENOTFOUND）/);
});

test('请求超时（AbortError / TimeoutError）→ 明确「请求超时」', async () => {
  const timeoutError = new Error('The operation was aborted due to timeout');
  timeoutError.name = 'TimeoutError';
  const fetchImpl = makeFetch([{ match: () => true, respond: () => { throw timeoutError; } }]);
  const { errors } = await runOnlineChecks(loadValidCatalog(), { fetchImpl, githubToken: '' });
  assertOnlineHasError(errors, /请求超时/);
});

test('GitHub 仓库 404 → 明确错误', async () => {
  const fetchImpl = makeFetch([
    { match: NPM_ELEMENT, respond: () => mockResponse({ json: { latest: '0.2.1' } }) },
    { match: NPM_RESOLVER, respond: () => mockResponse({ json: { latest: '0.1.2' } }) },
    { match: GITHUB_RESOLVER, respond: () => mockResponse({ status: 404 }) },
  ]);
  const { errors } = await runOnlineChecks(loadValidCatalog(), { fetchImpl, githubToken: '' });
  assertOnlineHasError(errors, /GitHub 在线检查失败（https:\/\/github\.com\/sakikoTGW\/dsh-plugin-resolver）：仓库不可达（HTTP 404/);
});

test('GitHub 403 且无 token → 提示可设置 GITHUB_TOKEN', async () => {
  const fetchImpl = makeFetch([
    { match: NPM_ELEMENT, respond: () => mockResponse({ json: { latest: '0.2.1' } }) },
    { match: NPM_RESOLVER, respond: () => mockResponse({ json: { latest: '0.1.2' } }) },
    { match: GITHUB_RESOLVER, respond: () => mockResponse({ status: 403 }) },
  ]);
  const { errors } = await runOnlineChecks(loadValidCatalog(), { fetchImpl, githubToken: '' });
  assertOnlineHasError(errors, /HTTP 403（可能是速率限制，可设置 GITHUB_TOKEN）/);
});

test('设置了 GITHUB_TOKEN → 请求带 Authorization: Bearer', async () => {
  const fetchImpl = makeFetch([
    { match: NPM_ELEMENT, respond: () => mockResponse({ json: { latest: '0.2.1' } }) },
    { match: NPM_RESOLVER, respond: () => mockResponse({ json: { latest: '0.1.2' } }) },
    { match: GITHUB_RESOLVER, respond: () => mockResponse({}) },
  ]);
  const { errors } = await runOnlineChecks(loadValidCatalog(), { fetchImpl, githubToken: 'test-token' });
  assert.deepEqual(errors, []);
  const githubCall = fetchImpl.calls.find((call) => call.url.includes('api.github.com'));
  assert.equal(githubCall.init.headers.authorization, 'Bearer test-token');
});

test('repo 为 null 时完全不请求 GitHub API', async () => {
  const catalog = loadValidCatalog();
  catalog.plugins = [catalog.plugins[0]]; // 只留 element-picker（repo: null）
  const fetchImpl = makeFetch([
    { match: NPM_ELEMENT, respond: () => mockResponse({ json: { latest: '0.2.1' } }) },
    { match: (url) => url.includes('api.github.com'), respond: () => { throw new Error('不应请求 GitHub'); } },
  ]);
  const { errors, notes } = await runOnlineChecks(catalog, { fetchImpl, githubToken: '' });
  assert.deepEqual(errors, []);
  assert.deepEqual(notes, ['npm dsh-element-picker@0.2.1']);
});

test('未登记 version 的插件跳过 npm 在线比对（不算错误）', async () => {
  const catalog = loadValidCatalog();
  catalog.plugins[0].status = 'wip';
  delete catalog.plugins[0].version;
  const fetchImpl = makeFetch([
    { match: NPM_ELEMENT, respond: () => { throw new Error('不应请求 element-picker 的 npm'); } },
    { match: NPM_RESOLVER, respond: () => mockResponse({ json: { latest: '0.1.2' } }) },
    { match: GITHUB_RESOLVER, respond: () => mockResponse({}) },
  ]);
  const { errors, notes } = await runOnlineChecks(catalog, { fetchImpl, githubToken: '' });
  assert.deepEqual(errors, []);
  assert.ok(notes.includes('dsh-element-picker: 未登记 version，跳过 npm 在线比对'), notes.join('\n'));
});

test('npm 响应不是 JSON / 缺 dist-tags.latest → 明确错误', async () => {
  const badJson = makeFetch([
    { match: NPM_ELEMENT, respond: () => mockResponse({ jsonThrows: true }) },
    { match: NPM_RESOLVER, respond: () => mockResponse({ json: {} }) },
    { match: GITHUB_RESOLVER, respond: () => mockResponse({}) },
  ]);
  const { errors } = await runOnlineChecks(loadValidCatalog(), { fetchImpl: badJson, githubToken: '' });
  assertOnlineHasError(errors, /响应不是合法 JSON/);
  assertOnlineHasError(errors, /响应缺少 dist-tags\.latest/);
});

test('npm / GitHub 返回 5xx → 明确 HTTP 状态错误', async () => {
  const fetchImpl = makeFetch([
    { match: NPM_ELEMENT, respond: () => mockResponse({ status: 503 }) },
    { match: NPM_RESOLVER, respond: () => mockResponse({ json: { latest: '0.1.2' } }) },
    { match: GITHUB_RESOLVER, respond: () => mockResponse({ status: 500 }) },
  ]);
  const { errors } = await runOnlineChecks(loadValidCatalog(), { fetchImpl, githubToken: '' });
  assertOnlineHasError(errors, /npm registry 返回 HTTP 503/);
  assertOnlineHasError(errors, /GitHub API 返回 HTTP 500/);
});
