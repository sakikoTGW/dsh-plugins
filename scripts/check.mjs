#!/usr/bin/env node
/**
 * 校验 catalog.json（schema）与 README.md（目录段一致性）。
 *
 * 零依赖、纯 ESM、node >= 20。
 *
 * 用法：
 *   node scripts/check.mjs             # 离线校验：schema + README 一致性
 *   node scripts/check.mjs --online    # 追加 npm registry / GitHub API 在线校验
 *   node scripts/check.mjs --root DIR  # 指定仓库根目录（默认脚本所在仓库）
 *
 * 每条错误按 `文件: 原因` 打印；全部通过时打印含插件数的 OK 摘要。退出码 0/1。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  START_MARKER,
  END_MARKER,
  STATUS_LABELS,
  firstDifferingLine,
  locateMarkers,
  normalizeNewlines,
  replaceCatalogSection,
} from './render.mjs';

export const GITHUB_OWNER = 'sakikoTGW';
export const NPM_REGISTRY = 'https://registry.npmjs.org';
export const GITHUB_API = 'https://api.github.com';

const NAME_RE = /^dsh-[a-z0-9][a-z0-9-]*$/;
// SemVer 2.0.0 官方正则（不接受前置 v）
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES = Object.freeze(Object.keys(STATUS_LABELS));
const REQUIRED_VERSION_STATUSES = new Set(['live', 'beta']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function issue(file, reason) {
  return { file, reason };
}

/**
 * 纯函数：校验 catalog 对象，返回错误数组（元素形如 { file, reason }）。
 * 不读文件、不发网络。
 */
export function validateCatalog(catalog) {
  const errors = [];
  const add = (reason) => errors.push(issue('catalog.json', reason));

  if (!isObject(catalog)) {
    add('顶层必须是 JSON 对象');
    return errors;
  }

  if (catalog.schemaVersion !== 1) {
    add(`schemaVersion 必须为 1（当前 ${JSON.stringify(catalog.schemaVersion)}）`);
  }
  if (!isNonEmptyString(catalog.owner)) add('owner 不能为空');
  if (!isNonEmptyString(catalog.maintainer)) add('maintainer 不能为空');
  if (typeof catalog.updated !== 'string' || !DATE_RE.test(catalog.updated)) {
    add(`updated 必须是 YYYY-MM-DD（当前 ${JSON.stringify(catalog.updated)}）`);
  }

  // ---- categories ----
  const categoryIds = new Set();
  const categoriesIsArray = Array.isArray(catalog.categories);
  if (!categoriesIsArray) {
    add('categories 必须是非空数组');
  } else if (catalog.categories.length === 0) {
    add('categories 必须是非空数组');
  }
  if (categoriesIsArray) {
    catalog.categories.forEach((category, index) => {
      const label = `categories[${index}]`;
      if (!isObject(category)) {
        add(`${label} 必须是对象`);
        return;
      }
      if (!isNonEmptyString(category.id)) {
        add(`${label}.id 不能为空`);
      } else if (categoryIds.has(category.id)) {
        add(`${label}.id 重复：${category.id}`);
      } else {
        categoryIds.add(category.id);
      }
      if (!isNonEmptyString(category.title)) add(`${label}.title 不能为空`);
      if (!isNonEmptyString(category.blurb)) add(`${label}.blurb 不能为空`);
    });
  }

  // ---- plugins ----
  if (!Array.isArray(catalog.plugins)) {
    add('plugins 必须是数组');
    return errors;
  }

  const pluginIds = new Set();
  const pluginNames = new Set();
  catalog.plugins.forEach((plugin, index) => {
    const label = `plugins[${index}]`;
    if (!isObject(plugin)) {
      add(`${label} 必须是对象`);
      return;
    }
    const name = plugin.name;

    if (!isNonEmptyString(plugin.id)) {
      add(`${label}.id 不能为空`);
    } else if (pluginIds.has(plugin.id)) {
      add(`${label}.id 重复：${plugin.id}`);
    } else {
      pluginIds.add(plugin.id);
    }

    if (!isNonEmptyString(name)) {
      add(`${label}.name 不能为空`);
    } else {
      if (!NAME_RE.test(name)) {
        add(`${label}.name 不符合 ^dsh-[a-z0-9][a-z0-9-]*$：${JSON.stringify(name)}`);
      }
      if (pluginNames.has(name)) add(`${label}.name 重复：${name}`);
      else pluginNames.add(name);
    }

    if (categoriesIsArray && categoryIds.size > 0 && !categoryIds.has(plugin.category)) {
      add(`${label}.category 未定义：${JSON.stringify(plugin.category)}`);
    }

    if (!VALID_STATUSES.includes(plugin.status)) {
      add(`${label}.status 非法：${JSON.stringify(plugin.status)}（允许：${VALID_STATUSES.join('|')}）`);
    }

    if (!isNonEmptyString(plugin.summary)) add(`${label}.summary 不能为空`);

    if (!isNonEmptyString(plugin.install)) {
      add(`${label}.install 不能为空`);
    } else if (isNonEmptyString(name) && !plugin.install.includes(name)) {
      add(`${label}.install 必须包含插件名 ${name}`);
    }

    if (!isObject(plugin.engines) || !isNonEmptyString(plugin.engines.dsh)) {
      add(`${label}.engines.dsh 不能为空`);
    }

    if (!isNonEmptyString(plugin.license)) add(`${label}.license 不能为空`);

    if (plugin.repo !== null) {
      const expected = `https://github.com/${GITHUB_OWNER}/${isNonEmptyString(name) ? name : '<name>'}`;
      if (typeof plugin.repo !== 'string' || plugin.repo !== expected) {
        add(`${label}.repo 必须是 null 或 ${expected}（当前 ${JSON.stringify(plugin.repo)}）`);
      }
    }

    if (REQUIRED_VERSION_STATUSES.has(plugin.status)) {
      if (typeof plugin.version !== 'string' || !SEMVER_RE.test(plugin.version)) {
        add(`${label}.version 在 status=${plugin.status} 时必须是 semver（当前 ${JSON.stringify(plugin.version)}）`);
      }
      if (!isNonEmptyString(plugin.npm) && plugin.repo === null) {
        add(`${label} 在 status=${plugin.status} 时至少要有 npm 或 repo`);
      }
    }
  });

  return errors;
}

/**
 * 纯函数：校验 README 中两个 marker 各恰好一次，且渲染结果与磁盘内容完全一致。
 * 换行先统一成 LF 再比较：Windows core.autocrlf=true 的 CRLF 工作区不应假失败。
 * 返回错误数组（元素形如 { file, reason }）。
 */
export function checkReadme(catalog, readmeText) {
  const errors = [];
  const add = (reason) => errors.push(issue('README.md', reason));

  if (typeof readmeText !== 'string') {
    add('无法读取内容');
    return errors;
  }
  const normalized = normalizeNewlines(readmeText);
  const markers = locateMarkers(normalized);
  if (markers.startCount !== 1) {
    add(`${START_MARKER} 必须恰好出现一次（当前 ${markers.startCount} 次）`);
  }
  if (markers.endCount !== 1) {
    add(`${END_MARKER} 必须恰好出现一次（当前 ${markers.endCount} 次）`);
  }
  if (markers.startCount === 1 && markers.endCount === 1 && !markers.ordered) {
    add(`${START_MARKER} 必须位于 ${END_MARKER} 之前`);
  }
  if (markers.startCount !== 1 || markers.endCount !== 1 || !markers.ordered) return errors;

  let expected;
  try {
    expected = replaceCatalogSection(normalized, catalog);
  } catch (error) {
    add(`无法按 catalog.json 渲染目录段：${error instanceof Error ? error.message : String(error)}`);
    return errors;
  }
  if (expected !== normalized) {
    add(`渲染结果与 README 不一致（从第 ${firstDifferingLine(expected, normalized)} 行开始；运行 npm run render 重新生成）`);
  }
  return errors;
}

function describeReadError(error) {
  if (error && error.code === 'ENOENT') return '文件不存在';
  return `无法读取：${error instanceof Error ? error.message : String(error)}`;
}

/**
 * 读取仓库根目录下的 catalog.json + README.md 并做离线校验。
 * 返回 { errors, catalog, pluginCount, categoryCount, catalogErrors, readmeErrors }。
 */
export function checkRepository(root) {
  const result = {
    errors: [],
    catalog: undefined,
    pluginCount: 0,
    categoryCount: 0,
    catalogErrors: [],
    readmeErrors: [],
  };

  try {
    result.catalog = JSON.parse(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8'));
  } catch (error) {
    const reason = error instanceof SyntaxError
      ? `JSON 解析失败：${error.message}`
      : describeReadError(error);
    result.errors.push(issue('catalog.json', reason));
    return result;
  }

  if (Array.isArray(result.catalog.plugins)) result.pluginCount = result.catalog.plugins.length;
  if (Array.isArray(result.catalog.categories)) result.categoryCount = result.catalog.categories.length;
  result.catalogErrors = validateCatalog(result.catalog);

  let readmeText;
  try {
    // core.autocrlf=true 的 Windows 工作区是 CRLF：读入先统一成 LF 再比较。
    readmeText = normalizeNewlines(fs.readFileSync(path.join(root, 'README.md'), 'utf8'));
  } catch (error) {
    result.errors.push(issue('README.md', describeReadError(error)));
  }
  if (readmeText !== undefined) result.readmeErrors = checkReadme(result.catalog, readmeText);

  result.errors.push(...result.catalogErrors, ...result.readmeErrors);
  return result;
}

// ---------------------------------------------------------------------------
// --online：npm registry 的 dist-tags.latest + GitHub API 可达性
// ---------------------------------------------------------------------------

function timeoutSignal(timeoutMs) {
  if (typeof AbortSignal === 'undefined' || typeof AbortSignal.timeout !== 'function') return undefined;
  return AbortSignal.timeout(timeoutMs);
}

function describeNetworkError(error) {
  if (!error) return '未知网络错误';
  if (error.name === 'TimeoutError' || error.name === 'AbortError') {
    return '请求超时';
  }
  const cause = error.cause && (error.cause.code || error.cause.message);
  const detail = error.message || error.name || String(error);
  return cause ? `网络错误：${detail}（${cause}）` : `网络错误：${detail}`;
}

async function request(fetchImpl, url, headers, timeoutMs) {
  try {
    const response = await fetchImpl(url, {
      headers,
      redirect: 'follow',
      signal: timeoutSignal(timeoutMs),
    });
    return { response };
  } catch (error) {
    return { error };
  }
}

/**
 * 在线校验：npm dist-tags.latest 必须等于 catalog version；repo 非 null 时 GitHub API 必须可达。
 * 网络失败不抛异常，收集成明确错误。fetch 可注入（测试用）。
 *
 * @returns {Promise<{ errors: Array<{file: string, reason: string}>, notes: string[] }>}
 */
export async function runOnlineChecks(catalog, options = {}) {
  const {
    fetchImpl = globalThis.fetch,
    githubToken = process.env.GITHUB_TOKEN,
    timeoutMs = 15_000,
  } = options;
  const errors = [];
  const notes = [];
  const add = (reason) => errors.push(issue('catalog.json', reason));

  if (typeof fetchImpl !== 'function') {
    add('当前 node 没有可用的 fetch，无法执行 --online 检查（需要 node >= 20）');
    return { errors, notes };
  }

  const plugins = isObject(catalog) && Array.isArray(catalog.plugins) ? catalog.plugins : [];

  for (const plugin of plugins) {
    if (!isObject(plugin)) continue;
    const name = isNonEmptyString(plugin.name) ? plugin.name : String(plugin.id ?? '未命名插件');

    // ---- npm registry ----
    if (isNonEmptyString(plugin.npm)) {
      const npmName = plugin.npm;
      if (!isNonEmptyString(plugin.version)) {
        notes.push(`${name}: 未登记 version，跳过 npm 在线比对`);
      } else {
        const url = `${NPM_REGISTRY}/-/package/${npmName.replace(/\//g, '%2F')}/dist-tags`;
        const { response, error } = await request(
          fetchImpl,
          url,
          { accept: 'application/json', 'user-agent': 'dsh-plugins-catalog-check' },
          timeoutMs,
        );
        if (error) {
          add(`npm 在线检查失败（${npmName}）：npm registry 不可达，${describeNetworkError(error)}`);
        } else if (response.status === 404) {
          add(`npm 在线检查失败（${npmName}）：npm registry 上找不到该包（HTTP 404）`);
        } else if (!response.ok) {
          add(`npm 在线检查失败（${npmName}）：npm registry 返回 HTTP ${response.status}`);
        } else {
          let distTags;
          let parseError;
          try {
            distTags = await response.json();
          } catch (caught) {
            parseError = caught;
          }
          if (parseError) {
            add(`npm 在线检查失败（${npmName}）：npm registry 响应不是合法 JSON（${parseError.message}）`);
          } else {
            const latest = distTags && typeof distTags === 'object' ? distTags.latest : undefined;
            if (!isNonEmptyString(latest)) {
              add(`npm 在线检查失败（${npmName}）：响应缺少 dist-tags.latest`);
            } else if (latest !== plugin.version) {
              add(
                `npm 在线检查失败（${npmName}）：npm 最新版本 ${latest} 与 catalog version ${plugin.version} 不一致` +
                  `（先 npm view ${npmName} version 核对，再决定发版或改 catalog）`,
              );
            } else {
              notes.push(`npm ${npmName}@${latest}`);
            }
          }
        }
      }
    }

    // ---- GitHub repo ----
    if (plugin.repo !== null && plugin.repo !== undefined) {
      const repoUrl = `${GITHUB_API}/repos/${GITHUB_OWNER}/${name}`;
      const headers = {
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'dsh-plugins-catalog-check',
      };
      if (isNonEmptyString(githubToken)) headers.authorization = `Bearer ${githubToken}`;

      const { response, error } = await request(fetchImpl, repoUrl, headers, timeoutMs);
      if (error) {
        add(`GitHub 在线检查失败（${plugin.repo}）：GitHub API 不可达，${describeNetworkError(error)}`);
      } else if (response.status === 404) {
        add(`GitHub 在线检查失败（${plugin.repo}）：仓库不可达（HTTP 404，检查仓库是否已创建或公开）`);
      } else if (response.status === 401 || response.status === 403) {
        const hint = isNonEmptyString(githubToken) ? '' : '（可能是速率限制，可设置 GITHUB_TOKEN）';
        add(`GitHub 在线检查失败（${plugin.repo}）：GitHub API 返回 HTTP ${response.status}${hint}`);
      } else if (!response.ok) {
        add(`GitHub 在线检查失败（${plugin.repo}）：GitHub API 返回 HTTP ${response.status}`);
      } else {
        notes.push(`GitHub ${GITHUB_OWNER}/${name}`);
      }
    }
  }

  return { errors, notes };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE = `用法：
  node scripts/check.mjs             # 离线校验 catalog.json + README.md
  node scripts/check.mjs --online    # 追加 npm registry / GitHub API 在线校验
  node scripts/check.mjs --root DIR  # 指定仓库根目录（默认脚本所在仓库）
`;

function parseArgs(argv) {
  const options = { online: false, root: null, help: false };
  for (let k = 0; k < argv.length; k += 1) {
    const arg = argv[k];
    if (arg === '--online') options.online = true;
    else if (arg === '--root') {
      k += 1;
      if (k >= argv.length) throw new Error('--root 需要一个目录参数');
      options.root = path.resolve(argv[k]);
    } else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`未知参数：${arg}（可用：--online、--root <dir>、--help）`);
  }
  return options;
}

export async function main(argv = process.argv.slice(2), io = console) {
  const options = parseArgs(argv);
  if (options.help) {
    io.log(USAGE.trimEnd());
    return 0;
  }
  const root = options.root ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const result = checkRepository(root);
  const errors = result.errors;
  let notes = [];

  if (options.online) {
    if (result.catalog === undefined) {
      errors.push(issue('catalog.json', 'catalog.json 无法读取或解析，无法执行 --online 检查'));
    } else {
      const online = await runOnlineChecks(result.catalog);
      errors.push(...online.errors);
      notes = online.notes;
    }
  }

  if (notes.length > 0) {
    io.log('在线检查：');
    for (const note of notes) io.log(`  ✓ ${note}`);
  }
  if (errors.length > 0) {
    for (const error of errors) io.error(`${error.file}: ${error.reason}`);
    io.error(`✗ 校验失败：共 ${errors.length} 个错误（${result.pluginCount} 个插件、${result.categoryCount} 个分类）`);
    return 1;
  }

  io.log(`OK: catalog.json / README.md 校验通过（${result.pluginCount} 个插件、${result.categoryCount} 个分类）。`);
  if (options.online) io.log(`OK: 在线检查通过（${notes.length} 项）。`);
  return 0;
}

const isMain =
  typeof process.argv[1] === 'string' &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`check.mjs: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
}
