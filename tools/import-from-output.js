#!/usr/bin/env node
/**
 * 导入脚本：output/第XX章_章名.md -> content/chapters/NN-章名.md
 *
 * 用法：
 *   node tools/import-from-output.js --all       导入 ../output 下全部 第XX章_*.md
 *   node tools/import-from-output.js 第04章_瓦市  导入指定章节（可多个，省略 .md）
 *
 * 转换规则（只做"#剥离去向"的最小清洗，正文一字不改）：
 *   1. 保留首个 "# " 行作为章名（站点由此生成目录与章标题）
 *   2. 删除文首写作批注块：章名后第一个 --- 之前、以 > 开头的连续行，连同该 --- 一并删除
 *   3. 删除文末"**【章末钩子】**"段：自该行起至文末全部删除
 *   4. 其余内容（含场景分隔线 ---）原样保留
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.resolve(ROOT, "..", "output");
const DEST = path.join(ROOT, "content", "chapters");

function transform(raw) {
  const lines = raw.split(/\r?\n/);

  // 3. 文末钩子段：自该行起全部删除
  const hook = lines.findIndex((l) => /^\*\*【章末钩子】/.test(l.trim()));
  const kept = hook >= 0 ? lines.slice(0, hook) : lines.slice();

  // 去掉尾部空行
  while (kept.length && !kept[kept.length - 1].trim()) kept.pop();

  // 1. 章名必须是首个 # 行
  const titleIdx = kept.findIndex((l) => /^#\s+/.test(l));
  if (titleIdx < 0) throw new Error("未找到章名行（# 开头）");

  // 2. 文首批注块：章名后第一个 --- 之前、以 > 开头的行，连同该 --- 删除
  let firstHr = -1;
  for (let i = titleIdx + 1; i < kept.length; i++) {
    if (/^---+\s*$/.test(kept[i].trim())) { firstHr = i; break; }
  }
  let removed = 0;
  if (firstHr > titleIdx) {
    let metaStart = -1;
    for (let i = titleIdx + 1; i < firstHr; i++) {
      if (/^>\s?/.test(kept[i].trim())) { metaStart = i; break; }
      if (kept[i].trim()) break; // 章名与批注之间只容忍空行
    }
    if (metaStart >= 0) {
      kept.splice(metaStart, firstHr - metaStart + 1);
      removed = firstHr - metaStart + 1;
    }
  }

  // 收尾：章名 + 单个空行 + 正文
  const title = kept[0].trim();
  let body = kept.slice(1).join("\n").replace(/^\s+/, "");
  return { title: title, body: title + "\n\n" + body.trimEnd() + "\n", removed: removed };
}

function destName(base) {
  const m = base.match(/第(\d+)章[_\s-]*(.+)$/);
  return m ? m[1] + "-" + m[2] + ".md" : base + ".md";
}

const args = process.argv.slice(2);
let inputs = [];
if (args.includes("--all")) {
  inputs = fs.readdirSync(SRC).filter((f) => /^第\d+章.*\.md$/i.test(f)).sort();
} else {
  for (const a of args) inputs.push(a.endsWith(".md") ? a : a + ".md");
}
if (!inputs.length) {
  console.error("用法：node tools/import-from-output.js --all | 第XX章_章名 ...");
  process.exit(1);
}

fs.mkdirSync(DEST, { recursive: true });
for (const f of inputs) {
  const src = path.join(SRC, f);
  if (!fs.existsSync(src)) { console.error("跳过（不存在）：" + src); continue; }
  const r = transform(fs.readFileSync(src, "utf8"));
  const out = path.join(DEST, destName(f.replace(/\.md$/i, "")));
  fs.writeFileSync(out, r.body, "utf8");
  console.log("import ok: " + f + " -> content/chapters/" + path.basename(out)
    + "  [" + r.title + "，剥离批注 " + r.removed + " 行]");
}
console.log("done: " + inputs.length + " 章");
