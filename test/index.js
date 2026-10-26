/**
 * `node --test test/` 的跨 Node 版本兼容入口（零依赖）。
 *
 * 背景：Node 20 的 `--test` 文档明确支持目录参数，会递归执行 test/ 下的测试文件；
 * 较新的 Node（>=22）文档只承诺位置参数是 glob 模式，本机 Node 24 实测目录不再展开，
 * `node --test test/` 会把 `test/` 当成模块入口执行（有 index.js 才不报 MODULE_NOT_FOUND）。
 * CI 固定 Node 20，本地可能是更高版本，两种行为都要能跑，所以：
 *
 * - 被当作目录入口执行（argv[1] === test/ 目录）：导入全部 *.test.mjs，等同于跑完整测试集。
 * - 被 Node 20 的目录扫描当成一个普通测试文件执行（argv[1] === 本文件）：什么都不做，
 *   以免测试被执行两遍。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const entry = typeof process.argv[1] === 'string' ? path.resolve(process.argv[1]) : '';

if (entry === testDir) {
  const testFiles = fs
    .readdirSync(testDir)
    .filter((name) => name.endsWith('.test.mjs'))
    .sort();
  for (const file of testFiles) {
    await import(pathToFileURL(path.join(testDir, file)).href);
  }
}
