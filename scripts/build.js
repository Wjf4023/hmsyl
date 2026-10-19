#!/usr/bin/env node
/**
 * 构建脚本：content/*.md -> dist/index.html（零依赖）
 *
 * - 读取 content/meta.json（标题/副标题/作者/年份/占位标记）
 * - 读取 content/chapters/*.md（按文件名排序，首个 "# " 行为章节标题）
 * - 解析 Markdown 子集：标题/段落/列表/引用/分割线/行内样式
 * - 将 HTML 骨架 src/template.html 与 style.css / reader.js 合成单文件
 * - 输出 dist/index.html，可直接双击打开或整体托管
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content");
const CHAPTERS_DIR = path.join(CONTENT_DIR, "chapters");
const SRC_DIR = path.join(ROOT, "src");
const OUT_DIR = path.join(ROOT, "dist");

/* ---------- 工具 ---------- */
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(s) {
  s = escapeHtml(s);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
  return s;
}

/** Markdown 子集 -> HTML（块级） */
function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let para = [];
  let quote = [];

  function flushPara() {
    if (para.length) {
      out.push("<p>" + para.map(inline).join("<br>") + "</p>");
      para = [];
    }
  }
  function flushQuote() {
    if (quote.length) {
      out.push("<blockquote>" + quote.map(function (t) { return "<p>" + inline(t) + "</p>"; }).join("") + "</blockquote>");
      quote = [];
    }
  }

  // 简化状态机：列表用栈深度 1 处理
  let inUl = false, inOl = false;
  function closeLists() {
    if (inUl) { out.push("</ul>"); inUl = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const t = line.trim();

    if (!t) { flushPara(); closeLists(); flushQuote(); continue; }

    if (/^---+$/.test(t)) { flushPara(); closeLists(); flushQuote(); out.push("<hr>"); continue; }

    const h = t.match(/^(#{2,4})\s+(.*)$/);
    if (h) {
      flushPara(); closeLists(); flushQuote();
      const level = h[1].length; // 2 -> h3（h2 已用于章节标题）
      out.push("<h" + level + ">" + inline(h[2]) + "</h" + level + ">");
      continue;
    }

    if (/^>\s?/.test(t)) {
      flushPara(); closeLists();
      quote.push(t.replace(/^>\s?/, ""));
      continue;
    }

    if (/^[-*]\s+/.test(t)) {
      flushPara(); flushQuote();
      if (!inUl) { closeLists(); out.push("<ul>"); inUl = true; }
      out.push("<li>" + inline(t.replace(/^[-*]\s+/, "")) + "</li>");
      continue;
    }

    if (/^\d+[.、]\s*/.test(t)) {
      flushPara(); flushQuote();
      if (!inOl) { closeLists(); out.push("<ol>"); inOl = true; }
      out.push("<li>" + inline(t.replace(/^\d+[.、]\s*/, "")) + "</li>");
      continue;
    }

    // 普通段落行
    if (inUl || inOl) { closeLists(); }
    if (quote.length) { flushQuote(); }
    para.push(t);
  }

  flushPara();
  closeLists();
  flushQuote();
  return out.join("\n");
}

/* ---------- 读取内容 ---------- */
const meta = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, "meta.json"), "utf8"));

const chapterFiles = fs.readdirSync(CHAPTERS_DIR)
  .filter(function (f) { return /\.md$/i.test(f); })
  .sort();

const chapters = chapterFiles.map(function (file, idx) {
  const raw = fs.readFileSync(path.join(CHAPTERS_DIR, file), "utf8");
  const m = raw.match(/^#\s+(.+)$/m);
  const title = m ? m[1].trim() : file.replace(/\.md$/i, "");
  const bodyMd = raw.replace(/^#\s+.+$/m, "");
  return {
    id: "ch-" + (idx + 1),
    title: title,
    html: mdToHtml(bodyMd.trim())
  };
});

/* ---------- 组装页面 ---------- */
let toc = "";
let body = "";

chapters.forEach(function (ch, i) {
  toc += '<li><a href="#' + ch.id + '">' + escapeHtml(ch.title) + "</a></li>";

  const prev = i > 0 ? chapters[i - 1] : null;
  const next = i < chapters.length - 1 ? chapters[i + 1] : null;

  body += [
    '<section class="chapter" id="' + ch.id + '" data-title="' + escapeHtml(ch.title) + '">',
    '  <h2 class="chapter__title">' + escapeHtml(ch.title) + "</h2>",
    '  <div class="chapter__body">',
    ch.html,
    "  </div>",
    '  <nav class="chapternav" aria-label="章节导航">',
    prev
      ? '    <button class="btn" data-goto="' + prev.id + '">&#8592; ' + escapeHtml(prev.title) + "</button>"
      : '    <button class="btn" disabled>&#8592; 没有上一章了</button>',
    next
      ? '    <button class="btn" data-goto="' + next.id + '">' + escapeHtml(next.title) + " &#8594;</button>"
      : '    <button class="btn" disabled>已是最后一章 &#8594;</button>',
    "  </nav>",
    "</section>",
    ""
  ].join("\n");
});

const banner = meta.placeholder
  ? '<p class="banner">占位内容 &middot; 待替换为正式文本</p>'
  : "";

let template = fs.readFileSync(path.join(SRC_DIR, "template.html"), "utf8");
const css = fs.readFileSync(path.join(SRC_DIR, "css", "style.css"), "utf8");
const js = fs.readFileSync(path.join(SRC_DIR, "js", "reader.js"), "utf8");

/* 全局替换（占位符在模板中可能出现多次） */
const vars = {
  TITLE: escapeHtml(meta.title || "未命名文集"),
  SUBTITLE: escapeHtml(meta.subtitle || ""),
  AUTHOR: escapeHtml(meta.author || "佚名"),
  YEAR: String(meta.year || new Date().getFullYear()),
  BANNER: banner,
  TOC: toc,
  CHAPTERS: body.trimEnd()
};

template = template.replace(/\{\{(TITLE|SUBTITLE|AUTHOR|YEAR|BANNER|TOC|CHAPTERS)\}\}/g, function (_, key) {
  return vars[key];
});

/* CSS / JS 注入 */
template = template
  .replace("/*__CSS__*/", function () { return css; })
  .replace("/*__JS__*/", function () { return js; });

/* ---------- 输出 ---------- */
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "index.html"), template, "utf8");

console.log("build ok -> dist/index.html");
console.log("  chapters: " + chapters.length + " (" + chapterFiles.join(", ") + ")");
console.log("  size: " + (Buffer.byteLength(template) / 1024).toFixed(1) + " KB");
