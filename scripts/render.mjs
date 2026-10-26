#!/usr/bin/env node
/**
 * 从 catalog.json 生成 README.md 的目录段（两个 marker 之间）。
 *
 * 零依赖、纯 ESM、node >= 20。
 *
 * 用法：
 *   node scripts/render.mjs             # 重写 README.md 的目录段
 *   node scripts/render.mjs --check     # 只比对，不一致打印 diff 并退出码 1
 *   node scripts/render.mjs --root DIR  # 指定仓库根目录（默认脚本所在仓库）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const START_MARKER = '<!-- catalog:start -->';
export const END_MARKER = '<!-- catalog:end -->';
export const GENERATED_NOTE =
  '<!-- 本段由 scripts/render.mjs 从 catalog.json 生成，请勿手改；改完 catalog.json 后运行 npm run render -->';

/** 状态 → README 表格里的展示文案。键集合同时也是 check.mjs 允许的 status 集合。 */
export const STATUS_LABELS = Object.freeze({
  live: '✅ 可用',
  beta: '🧪 Beta',
  wip: '🚧 开发中',
  planned: '📝 计划中',
  archived: '📦 已归档',
});

/** 这些状态在可用时把版本号拼在状态文案后面。 */
const STATUS_WITH_VERSION = new Set(['live', 'beta', 'archived']);

const TABLE_HEADER = ['| 插件 | 一句话 | 安装 | 状态 |', '| --- | --- | --- | --- |'];

/** Markdown 表格单元格转义：竖线会截断列，换行（含 CRLF / 孤立 CR）会截断行。 */
function cell(value) {
  return String(value ?? '')
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\|/g, '\\|');
}

/** 统计子串出现次数（不用 split 以免 marker 含正则特殊字符）。 */
export function countOccurrences(haystack, needle) {
  if (typeof haystack !== 'string' || needle === '') return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return count;
    count += 1;
    from = at + needle.length;
  }
}

/**
 * 统一换行为 LF。
 *
 * Windows 上 core.autocrlf=true 时，clone 出来的 README.md 工作区是 CRLF；
 * 若直接按 '\n' 比较/渲染，贡献者本地会假失败，默认 render 还会写出混合行尾。
 * 读入 README 后先经过这里统一，写盘也只写 LF（顺便兼容历史遗留的孤立 CR）。
 */
export function normalizeNewlines(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * 定位两个 marker。不抛错，把原始信息交给调用方决定怎么报。
 * valid 为 true 才表示可以安全替换。
 */
export function locateMarkers(readmeText) {
  const startCount = countOccurrences(readmeText, START_MARKER);
  const endCount = countOccurrences(readmeText, END_MARKER);
  const start = readmeText.indexOf(START_MARKER);
  const end = readmeText.indexOf(END_MARKER);
  const ordered = start !== -1 && end !== -1 && start < end;
  return {
    start,
    end,
    startCount,
    endCount,
    ordered,
    valid: startCount === 1 && endCount === 1 && ordered,
  };
}

/** 插件在 README 里的链接：有 repo 用 repo，否则用 npm 包页。 */
export function pluginUrl(plugin) {
  if (typeof plugin?.repo === 'string' && plugin.repo !== '') return plugin.repo;
  if (typeof plugin?.npm === 'string' && plugin.npm !== '') {
    return `https://www.npmjs.com/package/${plugin.npm}`;
  }
  return null;
}

/** 状态列文案，例如 `✅ 可用 · 0.2.1`、`🚧 开发中`。 */
export function statusLabel(plugin) {
  const label = STATUS_LABELS[plugin?.status];
  if (!label) {
    throw new Error(`未知 status：${JSON.stringify(plugin?.status)}（插件 ${plugin?.name ?? plugin?.id ?? '?'}）`);
  }
  const version = STATUS_WITH_VERSION.has(plugin.status) && plugin.version ? ` · ${plugin.version}` : '';
  return `${label}${version}`;
}

/** 单个插件的表格行。 */
export function renderPluginRow(plugin) {
  if (!plugin || typeof plugin !== 'object') throw new Error('插件条目必须是对象');
  const name = typeof plugin.name === 'string' ? plugin.name : '';
  if (name === '') throw new Error(`插件条目缺少 name（id=${JSON.stringify(plugin.id)}）`);
  const url = pluginUrl(plugin);
  if (url === null) throw new Error(`插件 ${name} 既无 repo 也无 npm，无法生成链接`);
  const summary = typeof plugin.summary === 'string' ? plugin.summary : '';
  const install = typeof plugin.install === 'string' ? plugin.install : '';
  return `| [${cell(name)}](${url}) | ${cell(summary)} | \`${cell(install)}\` | ${statusLabel(plugin)} |`;
}

/**
 * 生成两个 marker 之间的内容（不含 marker 本身）。
 * 返回值以换行开头（紧接 START_MARKER 之后），以换行结尾（紧接 END_MARKER 之前）。
 */
export function renderCatalogSection(catalog) {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    throw new Error('catalog.json 顶层必须是对象');
  }
  const categories = catalog.categories;
  if (!Array.isArray(categories)) throw new Error('catalog.categories 必须是数组');
  const plugins = catalog.plugins;
  if (!Array.isArray(plugins)) throw new Error('catalog.plugins 必须是数组');

  const byCategory = new Map();
  for (const category of categories) {
    if (!category || typeof category !== 'object') throw new Error('categories 的条目必须是对象');
    const categoryId = category.id;
    if (typeof categoryId !== 'string' || categoryId === '') {
      throw new Error('categories 的条目缺少 id');
    }
    if (byCategory.has(categoryId)) throw new Error(`categories id 重复：${categoryId}`);
    byCategory.set(categoryId, []);
  }
  for (const plugin of plugins) {
    if (!plugin || typeof plugin !== 'object') throw new Error('plugins 的条目必须是对象');
    const list = byCategory.get(plugin.category);
    if (!list) {
      throw new Error(`插件 ${plugin.name ?? plugin.id} 的 category 未在 categories 中定义：${JSON.stringify(plugin.category)}`);
    }
    list.push(plugin);
  }

  const blocks = categories.map((category) => {
    const rows = byCategory.get(category.id).map(renderPluginRow);
    const table = [...TABLE_HEADER, ...rows].join('\n');
    return `### ${cell(category.title)}\n> ${cell(category.blurb)}\n\n${table}`;
  });

  const heading = `\n${GENERATED_NOTE}\n\n当前收录 **${plugins.length}** 个插件，按用途分组：\n`;
  if (blocks.length === 0) return heading;
  return `${heading}\n${blocks.join('\n\n')}\n`;
}

/** 用 catalog 渲染后的目录段替换 README 中的两个 marker 之间内容，返回完整 README（纯 LF）。 */
export function replaceCatalogSection(readmeText, catalog) {
  const normalized = normalizeNewlines(readmeText);
  const markers = locateMarkers(normalized);
  if (markers.startCount !== 1) {
    throw new Error(`${START_MARKER} 必须恰好出现一次（当前 ${markers.startCount} 次）`);
  }
  if (markers.endCount !== 1) {
    throw new Error(`${END_MARKER} 必须恰好出现一次（当前 ${markers.endCount} 次）`);
  }
  if (!markers.ordered) throw new Error('catalog:start 必须位于 catalog:end 之前');
  const section = renderCatalogSection(catalog);
  return (
    normalized.slice(0, markers.start + START_MARKER.length) +
    section +
    normalized.slice(markers.end)
  );
}

/** 逐行 LCS diff（README 只有几百行，DP 足够）。 */
export function diffLines(beforeLines, afterLines) {
  const n = beforeLines.length;
  const m = afterLines.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] = beforeLines[i] === afterLines[j]
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (beforeLines[i] === afterLines[j]) {
      ops.push({ type: 'equal', text: beforeLines[i] });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: 'remove', text: beforeLines[i] });
      i += 1;
    } else {
      ops.push({ type: 'add', text: afterLines[j] });
      j += 1;
    }
  }
  while (i < n) ops.push({ type: 'remove', text: beforeLines[i++] });
  while (j < m) ops.push({ type: 'add', text: afterLines[j++] });
  return ops;
}

function rangeLabel(start, count) {
  if (count === 0) return `${Math.max(0, start - 1)},0`;
  return count === 1 ? String(start) : `${start},${count}`;
}

/**
 * 生成 unified diff 文本（带 3 行上下文）。before = 磁盘上的内容，after = 期望内容。
 * 无差异时返回空字符串。
 */
export function formatUnifiedDiff(before, after, options = {}) {
  const { beforeLabel = '当前', afterLabel = '期望', context = 3 } = options;
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const ops = diffLines(beforeLines, afterLines);
  const aLineAt = new Array(ops.length + 1);
  const bLineAt = new Array(ops.length + 1);
  aLineAt[0] = 0;
  bLineAt[0] = 0;
  for (let k = 0; k < ops.length; k += 1) {
    const op = ops[k];
    aLineAt[k + 1] = aLineAt[k] + (op.type === 'equal' || op.type === 'remove' ? 1 : 0);
    bLineAt[k + 1] = bLineAt[k] + (op.type === 'equal' || op.type === 'add' ? 1 : 0);
  }

  const changeIndexes = [];
  for (let k = 0; k < ops.length; k += 1) {
    if (ops[k].type !== 'equal') changeIndexes.push(k);
  }
  if (changeIndexes.length === 0) return '';

  const hunks = [];
  for (const index of changeIndexes) {
    const last = hunks[hunks.length - 1];
    if (last && index - last.end <= context * 2) last.end = index;
    else hunks.push({ start: index, end: index });
  }

  const out = [`--- ${beforeLabel}`, `+++ ${afterLabel}`];
  for (const hunk of hunks) {
    const from = Math.max(0, hunk.start - context);
    const to = Math.min(ops.length - 1, hunk.end + context);
    const aCount = aLineAt[to + 1] - aLineAt[from];
    const bCount = bLineAt[to + 1] - bLineAt[from];
    out.push(`@@ -${rangeLabel(aLineAt[from] + 1, aCount)} +${rangeLabel(bLineAt[from] + 1, bCount)} @@`);
    for (let k = from; k <= to; k += 1) {
      const op = ops[k];
      const prefix = op.type === 'equal' ? ' ' : op.type === 'remove' ? '-' : '+';
      out.push(prefix + op.text);
    }
  }
  return out.join('\n');
}

/** README 与渲染结果不一致时，返回第一个不同的行号（1 起）；一致返回 0。 */
export function firstDifferingLine(expected, actual) {
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const max = Math.max(expectedLines.length, actualLines.length);
  for (let k = 0; k < max; k += 1) {
    if (expectedLines[k] !== actualLines[k]) return k + 1;
  }
  return 0;
}

function readCatalog(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8'));
}

function readReadmeRaw(root) {
  return fs.readFileSync(path.join(root, 'README.md'), 'utf8');
}

function parseArgs(argv) {
  const options = { check: false, root: null, help: false };
  for (let k = 0; k < argv.length; k += 1) {
    const arg = argv[k];
    if (arg === '--check') options.check = true;
    else if (arg === '--root') {
      k += 1;
      if (k >= argv.length) throw new Error('--root 需要一个目录参数');
      options.root = path.resolve(argv[k]);
    } else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`未知参数：${arg}（可用：--check、--root <dir>、--help）`);
  }
  return options;
}

const USAGE = `用法：
  node scripts/render.mjs             # 用 catalog.json 重写 README.md 的目录段
  node scripts/render.mjs --check     # 只比对；不一致打印 diff 并以退出码 1 结束
  node scripts/render.mjs --root DIR  # 指定仓库根目录（默认脚本所在仓库）
`;

export function main(argv = process.argv.slice(2), io = console) {
  const options = parseArgs(argv);
  if (options.help) {
    io.log(USAGE.trimEnd());
    return 0;
  }
  const root = options.root ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const catalog = readCatalog(root);
  const rawReadme = readReadmeRaw(root);
  const readme = normalizeNewlines(rawReadme);
  const rendered = replaceCatalogSection(rawReadme, catalog);
  const pluginCount = Array.isArray(catalog.plugins) ? catalog.plugins.length : 0;

  if (options.check) {
    if (rendered === readme) {
      io.log(`OK: README.md 与 catalog.json 渲染结果一致（${pluginCount} 个插件）。`);
      return 0;
    }
    const diff = formatUnifiedDiff(readme, rendered, {
      beforeLabel: 'README.md（当前磁盘内容）',
      afterLabel: 'README.md（catalog.json 渲染结果）',
    });
    io.error(`README.md 与 catalog.json 渲染结果不一致（运行 npm run render 重新生成）：`);
    io.error(diff);
    return 1;
  }

  // 默认模式：内容一致且行尾已是 LF 时不写盘；CRLF（或孤立 CR）工作区要归一化重写，
  // 保证写出的 README 一律 LF。
  if (rendered === rawReadme) {
    io.log(`OK: README.md 与 catalog.json 渲染结果一致（${pluginCount} 个插件）。`);
    return 0;
  }
  fs.writeFileSync(path.join(root, 'README.md'), rendered);
  io.log(`README.md 已更新（${pluginCount} 个插件）。`);
  return 0;
}

const isMain =
  typeof process.argv[1] === 'string' &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`render.mjs: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
