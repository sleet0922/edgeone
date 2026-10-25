#!/usr/bin/env node
/**
 * 静态产物构建：把 index.html 与 assets/ 复制到 dist/
 * 无第三方依赖，EdgeOne Pages 构建时直接 `npm run build` 即可。
 */
import { cp, mkdir, rm, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'dist');

const ENTRIES = ['index.html', 'assets', 'robots.txt'];

async function main() {
  if (path.dirname(outDir) !== root) {
    throw new Error(`拒绝清空非项目目录: ${outDir}`);
  }

  const started = Date.now();
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const copied = [];
  for (const name of ENTRIES) {
    const from = path.join(root, name);
    try {
      await stat(from);
    } catch {
      continue; // 可选文件不存在就跳过
    }
    await cp(from, path.join(outDir, name), { recursive: true });
    copied.push(name);
  }

  if (!copied.length) {
    throw new Error('没有找到可构建的文件，请检查项目结构');
  }

  const { files, bytes } = await walk(outDir);
  const kb = (bytes / 1024).toFixed(1);

  console.log('\n  EdgeOne Pages · build');
  console.log('  ─────────────────────────────');
  for (const name of copied) console.log(`  → ${name}`);
  console.log(`  ✓ dist/  ${files} 个文件 · ${kb} KB · ${Date.now() - started} ms\n`);
}

async function walk(dir) {
  let files = 0;
  let bytes = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await walk(full);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files += 1;
      bytes += (await stat(full)).size;
    }
  }
  return { files, bytes };
}

main().catch((err) => {
  console.error('\n  ✗ 构建失败：' + err.message + '\n');
  process.exitCode = 1;
});
