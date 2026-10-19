/* ============================================================
 * 响应式阅读页 · 交互脚本
 * 功能：阅读进度、位置记忆与恢复、目录抽屉+滚动高亮、
 *       字号调节、深浅色主题、连续滚动/逐屏切换、上一章/下一章
 * 无依赖，编译期内联进单个 HTML（dist/index.html 可直接双击打开）
 * ============================================================ */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;

  /* ---------- localStorage 安全封装（隐私模式下不报错） ---------- */
  function lsGet(key, fallback) {
    try { var v = localStorage.getItem(key); return v === null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* 忽略 */ }
  }

  var KEY = {
    theme: "reader:theme",
    scale: "reader:fontScale",
    view:  "reader:viewMode",
    pos:   "reader:scrollY",
    chap:  "reader:lastChapter"
  };

  function $(id) { return doc.getElementById(id); }

  var els = {
    progressBar: $("progressBar"),
    toTop: $("toTop"),
    tocBtn: $("tocBtn"),
    tocClose: $("tocClose"),
    overlay: $("overlay"),
    toc: $("toc"),
    tocLinks: Array.prototype.slice.call(doc.querySelectorAll("#tocList a")),
    chapters: Array.prototype.slice.call(doc.querySelectorAll(".chapter")),
    chapterNow: $("chapterNow"),
    themeBtn: $("themeBtn"),
    viewBtn: $("viewBtn"),
    fontUp: $("fontUp"),
    fontDown: $("fontDown"),
    snapNav: $("snapNav"),
    snapPrev: $("snapPrev"),
    snapNext: $("snapNext"),
    main: $("content")
  };

  var savedScrollY = parseInt(lsGet(KEY.pos, "0"), 10) || 0;
  var savedChapter = lsGet(KEY.chap, "");

  /* ============================================================
   * 1. 阅读进度条 + 位置记忆（节流保存）
   * ============================================================ */
  var ticking = false;
  var saveTimer = null;

  function updateProgress() {
    var h = root;
    var max = h.scrollHeight - h.clientHeight;
    var pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
    els.progressBar.style.width = pct.toFixed(2) + "%";
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(function () {
        updateProgress();
        els.toTop.classList.toggle("show", window.scrollY > 500);
        ticking = false;
      });
    }
    if (saveTimer) { window.clearTimeout(saveTimer); }
    saveTimer = window.setTimeout(function () {
      lsSet(KEY.pos, String(Math.round(window.scrollY)));
    }, 250);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", updateProgress, { passive: true });

  /* ---------- 恢复上次阅读位置（优先锚点） ---------- */
  function showChip(text) {
    var old = doc.querySelector(".chip");
    if (old) { old.remove(); }
    var chip = doc.createElement("div");
    chip.className = "chip";
    chip.setAttribute("role", "status");
    chip.textContent = text;
    doc.body.appendChild(chip);
    window.setTimeout(function () {
      chip.style.opacity = "0";
      window.setTimeout(function () { chip.remove(); }, 400);
    }, 3600);
  }

  function restorePosition() {
    if (location.hash) {
      var target = doc.getElementById(location.hash.slice(1));
      if (target) { target.scrollIntoView(); return; }
    }
    if (savedScrollY > 80) {
      window.scrollTo(0, savedScrollY);
      showChip("已回到上次阅读位置" + (savedChapter ? "：" + savedChapter : ""));
    }
  }

  window.addEventListener("load", function () {
    restorePosition();
    updateProgress();
  });

  /* ============================================================
   * 2. 目录：抽屉开合（小屏）/ 滚动高亮（全屏）
   * ============================================================ */
  function setDrawer(open) {
    doc.body.classList.toggle("toc-open", open);
    els.overlay.hidden = !open;
    els.tocBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  els.tocBtn.addEventListener("click", function () { setDrawer(true); });
  els.tocClose.addEventListener("click", function () { setDrawer(false); });
  els.overlay.addEventListener("click", function () { setDrawer(false); });
  doc.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { setDrawer(false); }
  });

  /* 点击目录项后，小屏自动收起抽屉 */
  els.tocLinks.forEach(function (link) {
    link.addEventListener("click", function () { setDrawer(false); });
  });

  /* 窗口放大到 PC 尺寸时自动收抽屉 */
  var mqDesktop = window.matchMedia("(min-width: 1024px)");
  var onMq = function (e) { if (e.matches) { setDrawer(false); } };
  if (mqDesktop.addEventListener) { mqDesktop.addEventListener("change", onMq); }
  else if (mqDesktop.addListener) { mqDesktop.addListener(onMq); }

  /* 滚动高亮当前章节（IntersectionObserver，降级为兜底逻辑） */
  var activeLink = null;
  function setActive(id, title) {
    if (activeLink && activeLink.hash === "#" + id) { return; }
    els.tocLinks.forEach(function (a) {
      var on = a.getAttribute("href") === "#" + id;
      a.classList.toggle("active", on);
      if (on) { activeLink = a; }
    });
    els.chapterNow.textContent = title || "";
    if (title) { lsSet(KEY.chap, title); }
  }

  if ("IntersectionObserver" in window && els.chapters.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          setActive(entry.target.id, entry.target.getAttribute("data-title"));
        }
      });
    }, { rootMargin: "-15% 0px -70% 0px", threshold: 0 });
    els.chapters.forEach(function (ch) { io.observe(ch); });
  }

  /* ============================================================
   * 3. 上一章 / 下一章
   * ============================================================ */
  function goToChapter(btn) {
    var id = btn.getAttribute("data-goto");
    var target = id ? doc.getElementById(id) : null;
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.setAttribute("tabindex", "-1");
      window.setTimeout(function () { target.focus({ preventScroll: true }); }, 450);
    }
  }
  Array.prototype.forEach.call(doc.querySelectorAll("[data-goto]"), function (btn) {
    btn.addEventListener("click", function () { goToChapter(btn); });
  });

  /* ============================================================
   * 4. 字体大小（4 档，写入 CSS 变量 --font-scale）
   * ============================================================ */
  var SCALE_MIN = 0.85, SCALE_MAX = 1.4, SCALE_STEP = 0.075;
  var currentScale = parseFloat(lsGet(KEY.scale, "1")) || 1;

  function applyScale(v) {
    currentScale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, v));
    root.style.setProperty("--font-scale", String(currentScale.toFixed(3)));
    lsSet(KEY.scale, currentScale.toFixed(3));
  }
  applyScale(currentScale);
  els.fontUp.addEventListener("click", function () { applyScale(currentScale + SCALE_STEP); });
  els.fontDown.addEventListener("click", function () { applyScale(currentScale - SCALE_STEP); });

  /* ============================================================
   * 5. 深浅色主题（默认跟随系统）
   * ============================================================ */
  function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    els.themeBtn.innerHTML = theme === "dark" ? "&#9788;" : "&#9790;";
    var meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) { meta.setAttribute("content", theme === "dark" ? "#17171a" : "#faf9f7"); }
  }
  var storedTheme = lsGet(KEY.theme, "");
  var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(storedTheme || (prefersDark ? "dark" : "light"));

  els.themeBtn.addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    setTheme(next);
    lsSet(KEY.theme, next);
  });

  /* ============================================================
   * 6. 连续滚动 / 逐屏切换
   * ============================================================ */
  function applyView(mode) {
    var snap = mode === "snap";
    root.classList.toggle("view-snap", snap);
    els.snapNav.hidden = !snap;
    els.viewBtn.textContent = snap ? "连续" : "逐屏";
    els.viewBtn.setAttribute("aria-pressed", snap ? "true" : "false");
    els.viewBtn.setAttribute("title", snap ? "当前：逐屏模式，点击切回连续滚动" : "当前：连续滚动，点击切换逐屏");
  }
  var viewMode = lsGet(KEY.view, "continuous");
  applyView(viewMode);

  els.viewBtn.addEventListener("click", function () {
    viewMode = viewMode === "snap" ? "continuous" : "snap";
    applyView(viewMode);
    lsSet(KEY.view, viewMode);
  });

  /* 逐屏翻页：一屏 = 一个可视高度（避开顶栏） */
  function pageStep(dir) {
    var topbarH = parseInt(getComputedStyle(root).getPropertyValue("--topbar-h"), 10) || 56;
    window.scrollBy({ top: dir * (window.innerHeight - topbarH - 8), behavior: "smooth" });
  }
  els.snapNext.addEventListener("click", function () { pageStep(1); });
  els.snapPrev.addEventListener("click", function () { pageStep(-1); });

  doc.addEventListener("keydown", function (e) {
    if (viewMode !== "snap" || e.metaKey || e.ctrlKey || e.altKey) { return; }
    var tag = (doc.activeElement && doc.activeElement.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") { return; }
    if (e.key === "ArrowDown" || e.key === "PageDown") {
      e.preventDefault(); pageStep(1);
    } else if (e.key === "ArrowUp" || e.key === "PageUp") {
      e.preventDefault(); pageStep(-1);
    }
  });

  /* ============================================================
   * 7. 回到顶部
   * ============================================================ */
  els.toTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* 离开页面前兜底保存一次 */
  window.addEventListener("pagehide", function () {
    lsSet(KEY.pos, String(Math.round(window.scrollY)));
  });
})();
