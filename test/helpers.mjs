/**
 * node:test 共用的小工具：fixture 读取、临时仓库、CLI 调用。
 * 本文件不是测试文件（不以 .test.mjs 结尾），不会被 node --test 当用例执行。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(TEST_DIR, '..');
export const FIXTURE_DIR = path.join(TEST_DIR, 'fixtures', 'valid');
export const RENDER_SCRIPT = path.join(REPO_ROOT, 'scripts', 'render.mjs');
export const CHECK_SCRIPT = path.join(REPO_ROOT, 'scripts', 'check.mjs');

export function loadValidCatalog() {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'catalog.json'), 'utf8'));
}

export function loadValidReadme() {
  return fs.readFileSync(path.join(FIXTURE_DIR, 'README.md'), 'utf8');
}

/** 把合法 fixture 复制到系统临时目录，返回可随意改写的仓库根目录；t.after 自动清理。 */
export function makeTempRepo(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-plugins-test-'));
  fs.cpSync(FIXTURE_DIR, dir, { recursive: true });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

export function runCli(script, args, options = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    ...options,
  });
}

export function combinedOutput(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

export function errorLines(result) {
  return String(result.stderr ?? '')
    .split('\n')
    .filter(Boolean);
}
