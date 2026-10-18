// ==UserScript==
// @name         Via全能工具箱
// @namespace    https://via.toolbox
// @version      4.13.0
// @description  右侧竖向悬浮工具条：抓包(请求详情)/整页多语翻译/液态玻璃/免广告规则库/导出HTML图片视频/加速/反色/深色/收藏夹/滚动/壁纸/B站优化
// @match        *://*/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /* ==========================================================================
   * Via 全能工具箱 v3.5 —— 右侧竖向窄条面板布局
   *   全部功能在页面内完成，不改网络出口，不含任何代理/VPN 代码。
   *   面板只在自身区域拦截触摸，不遮挡页面滚动。
   * ========================================================================== */

  if (window.top !== window.self) return;
  if (window.__viaToolbox) return;
  window.__viaToolbox = true;

  var LS = 'via_toolbox_cfg_v35';
  var LS_FAV = 'via_toolbox_fav_v35';
  var LS_WP = 'via_toolbox_wp_v35';

  /* ★ 历史数据迁移：早期版本用的存储键名不同，升级后读不到老数据。
   * 启动时扫一遍所有历史键，把收藏 / 设置 / 壁纸合并过来，老数据就不会"消失"。 */
  var LEGACY_FAV = ['via_toolbox_fav_v35', 'via_toolbox_fav_v3', 'via_toolbox_fav',
    'vt_fav', 'via_gh_fav', 'via_fav_list'];
  var LEGACY_CFG = ['via_toolbox_cfg_v35', 'via_toolbox_cfg_v3', 'via_toolbox_cfg'];
  var LEGACY_WP = ['via_toolbox_wp_v35', 'via_toolbox_wp_v3', 'via_toolbox_wp'];

  function migrateLegacy() {
    var moved = { fav: 0, cfg: false, wp: false };
    try {
      // 收藏：合并去重，按 url 排重
      var cur = [];
      try { cur = JSON.parse(localStorage.getItem(LS_FAV) || '[]'); } catch (e) { cur = []; }
      var seen = {};
      cur.forEach(function (f) { if (f && f.url) seen[f.url] = 1; });
      LEGACY_FAV.forEach(function (k) {
        if (k === LS_FAV) return;
        var old = null;
        try { old = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) {}
        if (!old || !old.length) return;
        old.forEach(function (f) {
          if (f && f.url && !seen[f.url]) { seen[f.url] = 1; cur.push(f); moved.fav++; }
        });
      });
      if (moved.fav) { try { localStorage.setItem(LS_FAV, JSON.stringify(cur.slice(0, 200))); } catch (e) {} }

      // 配置：只在当前键为空时，从旧键继承
      var hasCfg = false;
      try { hasCfg = !!localStorage.getItem(LS); } catch (e) {}
      if (!hasCfg) {
        for (var i = 0; i < LEGACY_CFG.length; i++) {
          var k = LEGACY_CFG[i];
          if (k === LS) continue;
          var v = null;
          try { v = localStorage.getItem(k); } catch (e) {}
          if (v) { try { localStorage.setItem(LS, v); moved.cfg = true; } catch (e) {} break; }
        }
      }
      // 壁纸
      var hasWp = false;
      try { hasWp = !!localStorage.getItem(LS_WP); } catch (e) {}
      if (!hasWp) {
        for (var j = 0; j < LEGACY_WP.length; j++) {
          var k2 = LEGACY_WP[j];
          if (k2 === LS_WP) continue;
          var v2 = null;
          try { v2 = localStorage.getItem(k2); } catch (e) {}
          if (v2) { try { localStorage.setItem(LS_WP, v2); moved.wp = true; } catch (e) {} break; }
        }
      }
    } catch (e) {}
    return moved;
  }

  var DEF = {
    panelOpen: true,        // 面板展开
    panelX: null, panelY: null,
    gearX: null, gearY: null,   // 齿轮位置
    upX: null, upY: null,       // 回顶按钮位置
    uiColor: '#4a9eff',
    lg: {
      alpha: 0.18, blur: 18, sat: 180, radius: 18,
      tint: 'light',        // light 浅色玻璃 / dark 暗色玻璃
      gloss: true,          // 高光
      border: true, shadow: true,
      sites: { bing: false, bili: false, all: false }   // 默认全关
    },
    adblock: { on: true, aggressive: false },
    speed: false, invert: false, dark: false,
    /* ★ 新做的 B站增强默认全部开启（用户要求） */
    biliOpt: true,          // B站一键优化
    biliDock: true,         // 底部液态玻璃 Dock
    biliHD: true,           // HD 分栏（左视频 + 右玻璃切页面板）
    pwd: { on: false, value: '' },
    trans: { langs: ['zh-Hans', 'en', 'ja', 'ru'], engine: 'auto', show: true },
    /* ★ 抓包默认开启：脚本一进页面就挂钩 + 立刻弹出小窗 */
    apiLogOn: true,
    apiLogAuto: true
  };

  var cfg = (function () {
    var m = migrateLegacy();
    if (m.fav || m.cfg || m.wp) {
      window.__vtMigrated = m;
    }
    return load();
  })();

  /* ★ 一次性"新功能默认开启"：
   * merge() 会用旧存档里的值覆盖新默认，而老用户存档里 biliOpt 是 false、
   * 且根本没有 biliDock / biliHD 这两个键。这里在首次升级时统一改成开启，
   * 之后用户手动关闭会被正常记住（靠 __vtBiliInit 标记只跑一次）。 */
  (function forceBiliDefaults() {
    try {
      if (cfg.__vtBiliInit) return;
      cfg.biliOpt = true;
      cfg.biliDock = true;
      cfg.biliHD = true;
      cfg.__vtBiliInit = true;
      save();
    } catch (e) {}
  })();

  function load() {
    try {
      var r = localStorage.getItem(LS);
      return r ? merge(DEF, JSON.parse(r)) : JSON.parse(JSON.stringify(DEF));
    } catch (e) { return JSON.parse(JSON.stringify(DEF)); }
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch (e) {} }
  function merge(base, over) {
    var o = JSON.parse(JSON.stringify(base));
    for (var k in over) {
      if (!Object.prototype.hasOwnProperty.call(over, k)) continue;
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && o[k] && typeof o[k] === 'object') o[k] = merge(o[k], over[k]);
      else o[k] = over[k];
    }
    return o;
  }

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function host() { return location.hostname; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function isBili() { return /(^|\.)bilibili\.com$/.test(host()); }
  function isBing() { return /(^|\.)bing\.com$/.test(host()); }

  function toast(msg, ms) {
    var t = document.createElement('div');
    t.className = 'vt_toast';
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:110px;z-index:2147483000;' +
      'background:rgba(18,20,24,.92);color:#fff;padding:8px 14px;border-radius:16px;font-size:12px;' +
      'max-width:78%;text-align:center;line-height:1.5;pointer-events:none';
    (document.body || document.documentElement).appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, ms || 2000);
  }

  // 通用拖动：el 为被移动元素，handle 为按住的区域（默认整个 el）
  // 支持触摸与鼠标；移动超过阈值算拖动，不触发 click
  function makeDraggable(el, handle, onDrop) {
    handle = handle || el;
    var sx = 0, sy = 0, ox = 0, oy = 0, moved = false, dragging = false;
    var holdTimer = null, mouseBound = false;

    function start(cx, cy) {
      dragging = true; moved = false;
      sx = cx; sy = cy;
      // ★ 分别兜底 left / top：只设了 left+bottom 的窗口（如 API 日志）
      //   如果只判 left 有值就跳过修正，top 会取到 0 → 瞬间跳到屏幕顶
      var r = el.getBoundingClientRect();
      ox = parseFloat(el.style.left);
      oy = parseFloat(el.style.top);
      if (isNaN(ox)) ox = r.left;
      if (isNaN(oy)) oy = r.top;
      if (el.style.right) el.style.right = 'auto';
      if (el.style.bottom) el.style.bottom = 'auto';
      el.style.left = ox + 'px';
      el.style.top = oy + 'px';
    }
    function move(cx, cy) {
      if (!dragging) return;
      var dx = cx - sx, dy = cy - sy;
      if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) { moved = true; el.style.transition = 'none'; }
      if (!moved) return;
      var w = el.offsetWidth || 44, h = el.offsetHeight || 44;
      var nx = Math.max(0, Math.min(ox + dx, window.innerWidth - w));
      var ny = Math.max(0, Math.min(oy + dy, window.innerHeight - h));
      el.style.left = nx + 'px'; el.style.top = ny + 'px';
    }
    function end() {
      if (!dragging) return;
      dragging = false;
      el.style.transform = ''; el.style.opacity = '';
      clearTimeout(holdTimer);
      if (moved && onDrop) onDrop(parseFloat(el.style.left) || 0, parseFloat(el.style.top) || 0);
      if (moved) {
        // 拖动后短时间屏蔽 click，避免误触发功能
        var oldClick = el.onclick;
        el.onclick = null;
        setTimeout(function () { el.onclick = oldClick; }, 260);
      }
    }
    // 触摸：start 里一并做长按视觉反馈，只注册一次 touchstart
    handle.addEventListener('touchstart', function (e) {
      start(e.touches[0].clientX, e.touches[0].clientY);
      holdTimer = setTimeout(function () {
        if (!moved) { el.style.transform = 'scale(1.06)'; el.style.opacity = '.85'; }
      }, 400);
    }, { passive: true });
    handle.addEventListener('touchmove', function (e) { move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    handle.addEventListener('touchend', end);
    handle.addEventListener('touchcancel', end);

    // 鼠标：只在真正按下时才绑定 window，松开即解绑（避免多元素累积泄漏）
    function onMouseMove(e) { move(e.clientX, e.clientY); }
    function onMouseUp(e) { end(); unbindMouse(); }
    function bindMouse() { if (!mouseBound) { window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp); mouseBound = true; } }
    function unbindMouse() { if (mouseBound) { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); mouseBound = false; } }
    handle.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      start(e.clientX, e.clientY);
      bindMouse();
      e.preventDefault();
    });
    // 元素被移除时自动解绑
    el.__vtUnbind = unbindMouse;
  }

  /* ==========================================================================
   * 通用「右下角小窗」
   *   ★ 之前所有面板都是 left:6 right:6 bottom:6 的全屏大面板，
   *     打开就占满屏幕、遮住页面。统一改为右下角窄窗：
   *     · 宽度自适应（默认 300，最大不超过屏宽 -16）
   *     · 标题栏可拖动，右上角 ✕ 关闭
   *     · 内容区独立滚动，不影响页面
   *     · 多个小窗自动错开，避免叠在一起
   *   返回 { box, body, close }
   * ========================================================================== */
  var winStack = 0;
  function makeSmallWin(id, title, bodyHTML, opt) {
    opt = opt || {};
    var old = $('#' + id);
    if (old) { old.remove(); }
    var W = Math.min(opt.w || 300, window.innerWidth - 16);
    var maxH = Math.round(window.innerHeight * 0.62);

    var box = document.createElement('div');
    box.id = id;
    box.className = 'vt_sheet';
    box.style.width = W + 'px';
    box.style.maxHeight = maxH + 'px';
    // 初始位置：右下角；同时开多个时依次上移错开
    var slot = (winStack = (winStack + 1) % 4);
    var left = Math.max(8, window.innerWidth - W - 10);
    var top = Math.round(window.innerHeight * 0.24 + slot * 26);
    box.style.left = left + 'px';
    box.style.top = Math.min(top, window.innerHeight - maxH - 10) + 'px';

    var head = document.createElement('div');
    head.className = 'vt_sh';
    head.innerHTML = '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + title + '</span>' +
      '<span data-close="1" style="flex:none;color:#999;font-size:16px;padding:0 4px;cursor:pointer">✕</span>';
    var body = document.createElement('div');
    body.className = 'vt_sb';
    body.style.maxHeight = (maxH - 42) + 'px';
    body.innerHTML = bodyHTML || '';
    box.appendChild(head); box.appendChild(body);
    document.body.appendChild(box);

    makeDraggable(box, head);

    var close = function () {
      if (box.__vtUnbind) box.__vtUnbind();
      if (box.__vtTimer) clearInterval(box.__vtTimer);
      if (box.parentNode) box.parentNode.removeChild(box);
      if (opt.onClose) opt.onClose();
    };
    box.__vtCloseWin = close;   // 供窗内按钮调用（会一并解绑拖动）
    head.querySelector('[data-close]').onclick = close;
    return { box: box, body: body, head: head, close: close };
  }
  // 小窗里"关闭"按钮的统一绑定
  function bindClose(win, sel) {
    var b = $(sel || '#w_close', win.body) || $(sel || '#w_close', win.box);
    if (b) b.onclick = win.close;
  }

  function fetchT(url, ms, opt) {
    return new Promise(function (res, rej) {
      var done = false;
      var tm = setTimeout(function () { if (!done) { done = true; rej(new Error('timeout')); } }, ms || 10000);
      fetch(url, opt || { cache: 'no-store' }).then(function (r) {
        if (done) return; done = true; clearTimeout(tm); res(r);
      }).catch(function (e) { if (done) return; done = true; clearTimeout(tm); rej(e); });
    });
  }

  // ============================ 基础样式 ============================
  function baseStyle() {
    if ($('#vt_style')) return;
    var s = document.createElement('style');
    s.id = 'vt_style';
    s.textContent =
      '.vt_panel{position:fixed;z-index:2147483200;width:104px;background:rgba(22,25,31,.88);' +
        '-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);' +
        'border:1px solid rgba(255,255,255,.14);border-radius:12px;' +
        'box-shadow:0 6px 24px rgba(0,0,0,.35);color:#e8eaed;' +
        'font:11px/1.3 -apple-system,system-ui,sans-serif;overflow:hidden;user-select:none}' +
      '.vt_head{display:flex;align-items:center;justify-content:space-between;padding:6px 7px;' +
        'background:rgba(255,255,255,.07);font-size:11px;font-weight:700;cursor:move}' +
      '.vt_body{max-height:64vh;overflow-y:auto;overflow-x:hidden;padding:4px 5px 6px;-webkit-overflow-scrolling:touch}' +
      '.vt_item{display:block;width:100%;margin:3px 0;padding:6px 4px;border:0;border-radius:7px;' +
        'background:rgba(255,255,255,.09);color:#e8eaed;font-size:11px;text-align:center;' +
        'cursor:pointer;line-height:1.25;word-break:break-all}' +
      '.vt_item:active{background:var(--vt-theme,#4a9eff)}' +
      '.vt_item.on{background:var(--vt-theme,#4a9eff);color:#fff}' +
      '.vt_item.act{background:rgba(74,158,255,.28)}' +
      '.vt_fab{position:fixed;z-index:2147483300;width:44px;height:44px;border-radius:50%;' +
        'display:flex;align-items:center;justify-content:center;color:#fff;font-size:19px;' +
        'box-shadow:0 3px 14px rgba(0,0,0,.35);cursor:pointer;user-select:none;touch-action:none}' +
      /* ★ 小窗样式：不再全屏铺满，统一为右下角窄窗 */
      '.vt_sheet{position:fixed;z-index:2147483400;background:#fff;' +
        'border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.34);padding:0;overflow:hidden;' +
        'font:13px/1.6 -apple-system,system-ui,sans-serif;color:#222}' +
      '.vt_sheet>.vt_sh{padding:8px 10px;background:#f6f8fa;font-size:13px;font-weight:700;' +
        'display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:move;user-select:none}' +
      '.vt_sheet>.vt_sb{padding:8px 10px 10px;overflow-y:auto;-webkit-overflow-scrolling:touch}' +
      '.vt_row{display:flex;align-items:center;justify-content:space-between;padding:6px 0;font-size:13px}' +
      '.vt_sw{width:42px;height:24px;border-radius:12px;background:#ccc;position:relative;transition:.2s;flex:none}' +
      '.vt_sw.on{background:var(--vt-theme,#4a9eff)}' +
      '.vt_sw i{position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.2s}' +
      '.vt_sw.on i{left:20px}' +
      '.vt_sec{font-size:12px;font-weight:700;color:var(--vt-theme,#4a9eff);margin:12px 0 2px;padding-top:8px;border-top:1px solid #eee}' +
      '.vt_tag{display:inline-block;margin:3px 4px 0 0;padding:4px 9px;border-radius:13px;background:#f0f2f5;font-size:12px;cursor:pointer}' +
      '.vt_tag.on{background:var(--vt-theme,#4a9eff);color:#fff}' +
      '.vt_btn{display:block;width:100%;margin:5px 0;padding:9px;border:0;border-radius:9px;' +
        'background:var(--vt-theme,#4a9eff);color:#fff;font-size:13px}' +
      '.vt_btn.ghost{background:#f0f2f5;color:#222}';
    document.head.appendChild(s);
  }

  function glassCss() {
    var a = cfg.lg.alpha;
    var tint = cfg.lg.tint || 'light';        // light / dark / auto
    var bg, edge, hi, ins;
    if (tint === 'dark') {
      bg = 'linear-gradient(145deg,rgba(20,24,32,' + Math.min(a + .18, .92) + '),rgba(8,10,14,' + Math.min(a + .06, .86) + '))';
      edge = 'rgba(255,255,255,' + Math.max(a * .9, .16) + ')';
      hi = 'inset 0 1px 0 rgba(255,255,255,' + Math.max(a * .7, .10) + '),inset 0 0 22px rgba(255,255,255,.04)';
      ins = '0 10px 32px rgba(0,0,0,.34)';
    } else {
      // 浅色玻璃：对角渐变 + 顶部高光 + 内发光，接近 iOS 液态玻璃
      bg = 'linear-gradient(145deg,rgba(255,255,255,' + Math.min(a + .20, .92) + '),rgba(255,255,255,' + Math.max(a - .05, .04) + '))';
      edge = 'rgba(255,255,255,' + Math.min(a + .42, .92) + ')';
      hi = 'inset 0 1px 0 rgba(255,255,255,' + Math.min(a + .55, .96) + '),' +
           'inset 0 0 26px rgba(255,255,255,' + Math.max(a * .8, .10) + '),' +
           'inset 0 -1px 0 rgba(255,255,255,' + Math.max(a * .5, .12) + ')';
      ins = '0 10px 30px rgba(31,38,135,.14)';
    }
    var out = '-webkit-backdrop-filter:blur(' + cfg.lg.blur + 'px) saturate(' + cfg.lg.sat + '%);' +
      'backdrop-filter:blur(' + cfg.lg.blur + 'px) saturate(' + cfg.lg.sat + '%);' +
      'background:' + bg + ';' +
      'border-radius:' + cfg.lg.radius + 'px;';
    if (cfg.lg.border) out += 'border:1px solid ' + edge + ';';
    if (cfg.lg.shadow) out += 'box-shadow:' + ins + ',' + hi + ';';
    else out += 'box-shadow:' + hi + ';';
    // 玻璃内部文字保持可读
    out += 'position:relative;overflow:visible;';
    return out;
  }

  // ==========================================================================
  // 液态玻璃
  // ==========================================================================
  var LG_SEL = {
    bing: ['#sb_form', '.sb_form', '.b_searchboxForm', '.b_algo', '.b_ans', '.b_results > li',
      '.b_rich', '.b_caption', '.b_float', '.b_no', '.b_scard', '#b_results', '.b_footer'],
    bili: ['.nav-search', '.nav-search-input', '.center-search-container', '.header-channel',
      '.bili-video-card', '.recommended-swipe', '.feed-card', '.video-card', '.bili-header',
      '.up-info-container', '.recommend-list', '.single-card', '.side-bar',
      '.search-bar', '.m-video-card', '.nav-bar', '.tab-bar', '.comment-item', '.feed-item', '.card'],
    all: ['article', 'section', '.card', '[class*="card"]', '[class*="Card"]', '.panel',
      '[class*="panel"]', 'header', 'nav', 'aside', '.box', '.item',
      '[class*="search"]', '[class*="Search"]', 'input', 'textarea']
  };
  function applyLiquidGlass() {
    var st = $('#vt_lg');
    if (!st) { st = document.createElement('style'); st.id = 'vt_lg'; document.head.appendChild(st); }
    var rules = [];
    var any = false;
    ['bing', 'bili', 'all'].forEach(function (k) {
      if (!cfg.lg.sites[k]) return;
      if (k === 'bing' && !isBing()) return;
      if (k === 'bili' && !isBili()) return;
      any = true;
      var sel = LG_SEL[k].join(',');
      rules.push(sel + '{' + glassCss() + 'transition:background .25s,box-shadow .25s!important;' + '}');
      /* 文字可读性：原来写 `sel :not(img)...` 是后代选择器，全站模式下会给
       * 成千上万个后代元素逐一带上 text-shadow/color，重排重绘开销极大。
       * 改为只在容器层用继承属性（text-shadow 可继承），视觉几乎一致但只算一次。 */
      if (cfg.lg.tint === 'dark') {
        rules.push(sel + '{color:rgba(235,240,248,.95);text-shadow:0 1px 2px rgba(0,0,0,.45);}');
      } else {
        rules.push(sel + '{text-shadow:0 1px 1px rgba(255,255,255,.6);}');
      }
    });
    st.textContent = rules.join('\n');
    // 面板自身也跟随玻璃质感
    var p = $('#vt_panel');
    if (p) {
      // 面板自身保持深色玻璃质感（只追加，不覆盖 left/top 定位）
      p.style.cssText += ';background:rgba(22,25,31,.88);' +
        '-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);' +
        'border:1px solid rgba(255,255,255,.14);border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.35);';
    }
    return any;
  }

  // ==========================================================================
  // 广告规则库
  // ==========================================================================
  var AD_SEL = [
    // —— 通用类名/id 特征
    '[class*="advertis"]', '[class*="Advertis"]', '[class*="ADVERTISE"]',
    '[id*="advertis"]', '[id*="google_ads"]', '[id*="div-gpt-ad"]',
    '[class*="adsense"]', '[class*="adsbygoogle"]', '[class*="ad-banner"]', '[class*="adBanner"]',
    '[class*="ad-wrap"]', '[class*="adWrap"]', '[class*="ad-box"]', '[class*="adBox"]',
    '[class*="ad-container"]', '[class*="adContainer"]', '[class*="ad-slot"]', '[class*="adSlot"]',
    '[class*="ad-item"]', '[class*="adItem"]', '[class*="ad-list"]', '[class*="ad-cell"]',
    '[class*="ad-tag"]', '[class*="ad-link"]', '[class*="ad-logo"]', '[class*="ad-icon"]',
    '[class*="sponsor"]', '[class*="Sponsor"]', '[class*="promotion"]', '[class*="Promotion"]',
    '[class*="promo-"]', '[class*="promoBox"]', '[class*="gg-"]', '[class*="-gg"]',
    '[class*="cpro"]', '[class*="union-ad"]', '[class*="banner-ad"]', '[class*="top-ad"]',
    'ins.adsbygoogle', 'div[id^="div-gpt"]', 'div[id^="google_ads"]',
    'iframe[src*="doubleclick"]', 'iframe[src*="googlesyndication"]', 'iframe[src*="adservice"]',
    'iframe[src*="/ad"]', 'iframe[src*="ads."]', 'iframe[id*="ad"]', 'iframe[class*="ad"]',
    '[data-ad]', '[data-advertisement]', '[data-ad-slot]', '[data-ad-client]',
    '[class*="float-ad"]', '[class*="sidebar-ad"]', '[class*="feed-ad"]', '[class*="video-ad"]',
    '[class*="recommend-ad"]', '[class*="native-ad"]', '[class*="insert-ad"]',
    '[class*="brand-story"]', '[class*="hot-spot"]', '[class*="tuiguang"]', '[class*="tuig"]',
    '[class*="guanggao"]', '[class*="guanngao"]', '[class*="advs"]', '[class*="ADV_"]',
    '[class*="couplet"]', '[class*="fixed-ad"]', '[class*="pop-ad"]'
  ];
  // 按"文字内容"识别广告（兜底，处理无特征类名的国产站）
  var AD_TEXT = /^(广告|推广|赞助|AD\s|Ads?$)|^\s*(广告|推广)\s*$|(广告|推广)(链接|内容)?$|sponsored\s*content/i;

  /* ★ 保护白名单：这些是页面功能核心，任何模式下一律不删。
   * 之前搜索框被误删，根因是 [class*="ad"] 命中了 "he**ad**er" /
   * "head_wrapper"(百度搜索框容器) / "re**ad**" / "lo**ad**" 这类词。 */
  var AD_PROTECT = [
    'input', 'textarea', 'form', 'select', 'button', 'a[href]',
    '[class*="search"]', '[class*="Search"]', '[class*="SEARCH"]',
    '[id*="search"]', '[id*="Search"]', '[role="search"]',
    '[class*="query"]', '[class*="Query"]', '[class*="keyword"]',
    '[class*="input"]', '[class*="Input"]', '[class*="ipt"]',
    '[class*="form"]', '[class*="Form"]', '[class*="s_form"]',
    '[class*="nav"]', '[class*="Nav"]', '[class*="menu"]', '[class*="Menu"]',
    '[class*="logo"]', '[class*="Logo"]', '[class*="brand"]',
    '[class*="head"]', '[class*="Head"]', '[class*="title"]',
    '[class*="tab"]', '[class*="Tab"]', '[class*="bar"]',
    '[class*="login"]', '[class*="user"]', '[class*="account"]',
    '[class*="content"]', '[class*="Content"]', '[class*="main"]',
    '[class*="article"]', '[class*="body"]', '[class*="list"]',
    '[class*="result"]', '[class*="Result"]',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'nav', 'header', 'footer', 'main', 'article',
    '[data-vt-tr-line]', '.vt_panel', '.vt_fab', '.vt_sheet'
  ].join(',');
  // 元素或其祖先命中保护名单 → 绝不删除
  function isProtected(el) {
    if (!el || !el.closest) return false;
    try {
      if (el.matches && el.matches('input,textarea,form,select,button')) return true;
      if (el.closest(AD_PROTECT)) return true;
    } catch (e) {}
    return false;
  }
  // 类名/ID 里"ad"是否作为独立词出现（避免 header/read/load 被误判）
  function hasAdWord(el) {
    var s = ((el.className && el.className.toString ? el.className.toString() : '') + ' ' + (el.id || '')).toLowerCase();
    if (!s || s.length < 2) return false;
    // 必须带分隔符：ad 独立成词，或以 ad- / ad_ / -ad / .ad 形式出现
    return /(^|[\s\-_\.])ad([\s\-_\.]|$)|(^|[\s\-_\.])ads([\s\-_\.]|$)|advertis|advert|guanggao|tuiguang/.test(s);
  }
  var AD_HOST_SEL = {
    'bilibili.com': ['.ad-report', '.ad-banner', '.banner-card', '.ad-card', '.video-card-ad',
      '.recommend-ad', '.activity-banner', '.splice-ad', '.ad-float', '.cm-ad', '.adpanel'],
    'bing.com': ['.b_ad', '.b_adSlug', '.ads-ad', '#b_ad'],
    'baidu.com': ['.ec-ads', '.c-ad', '#content_right ins'],
    'zhihu.com': ['.Pc-word-card', '.AdblockBanner', '.TopstoryItem--advertCard'],
    'csdn.net': ['.advertisement', '.ad_box', '.mediav_ad', '#kp_box']
  };
  var AD_HOSTS = ['googlesyndication.com', 'googleadservices.com', 'doubleclick.net',
    'google-analytics.com', 'googletagmanager.com', 'adservice.google.com',
    'pos.baidu.com', 'cbjs.baidu.com', 'hm.baidu.com', 'tanx.com', 'adnxs.com'];
  var adCount = 0;
  function adSelList() {
    var list = AD_SEL.slice();
    var h = host();
    for (var d in AD_HOST_SEL) if (h === d || h.indexOf('.' + d) > -1) list = list.concat(AD_HOST_SEL[d]);
    // 激进模式：不再用裸 [class*="ad"]，改为"独立词"匹配（如前所设陷阱）
    if (cfg.adblock.aggressive) {
      list = list.concat(['[class*="-ad-"]', '[class*="_ad_"]', '[class*=" ad-"]',
        '[class*="-ad "]', '[class*=" ad "]', '[id*="-ad"]', '[id*="_ad"]']);
    }
    return list;
  }
  // 记录删除历史，支持一键撤销
  var adHistory = [];
  function killEl(el) {
    try {
      el.setAttribute('data-vt-ad', '1');
      el.__vtPrev = el.getAttribute('style') || '';
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('height', '0', 'important');
      el.style.setProperty('min-height', '0', 'important');
      el.style.setProperty('margin', '0', 'important');
      el.style.setProperty('padding', '0', 'important');
      el.style.setProperty('overflow', 'hidden', 'important');
      if (adHistory.length < 300) adHistory.push(el);
      return true;
    } catch (e) { return false; }
  }
  function undoAds() {
    var n = 0;
    adHistory.forEach(function (el) {
      try {
        el.removeAttribute('data-vt-ad');
        el.setAttribute('style', el.__vtPrev || '');
        n++;
      } catch (e) {}
    });
    adHistory = [];
    toast(n ? '↩ 已恢复 ' + n + ' 个被删元素' : '没有可恢复的内容');
  }
  function removeAds(silent) {
    if (!cfg.adblock.on) return 0;
    var n = 0;
    try {
      // 1) 选择器命中（★ 先过保护白名单，再判"ad"是否独立成词）
      $$(adSelList().join(',')).forEach(function (el) {
        if (!el || el.dataset.vtAd) return;
        if (el.closest && el.closest('.vt_panel,.vt_fab,.vt_sheet,.vt_apilog')) return;
        if (el.dataset.vtTrLine) return;                    // 译文行不删
        if (isProtected(el)) return;                        // ★ 搜索框/导航/表单等一律保护
        if (!hasAdWord(el)) return;                         // ★ "header/read/load" 这类不算广告
        var r = el.getBoundingClientRect();
        if (r.width < 2 && r.height < 2) return;
        if (killEl(el)) n++;
      });
      /* 2) 请求级：广告/统计域名
       * ★ 注意：脚本一插入 DOM 就开始下载，等 removeAds 跑时请求早已发出，
       *   单纯 remove() 对 <script> 根本拦不住。所以除了移除已存在的元素，
       *   还拦截 HTMLScriptElement.prototype 的 src setter —— 让"之后"
       *   动态创建的广告脚本直接拿到空 src，真正掐断请求。 */
      $$('iframe[src],link[href]').forEach(function (el) {
        var u = el.getAttribute('src') || el.getAttribute('href') || '';
        if (!u) return;
        if (isProtected(el)) return;
        for (var i = 0; i < AD_HOSTS.length; i++) {
          if (u.indexOf(AD_HOSTS[i]) > -1) { if (killEl(el)) n++; break; }
        }
      });
      // 已存在的广告脚本：置空 src（阻止尚未开始的加载）+ 移除
      $$('script[src]').forEach(function (el) {
        var u = el.src || el.getAttribute('src') || '';
        if (!u) return;
        for (var i = 0; i < AD_HOSTS.length; i++) {
          if (u.indexOf(AD_HOSTS[i]) > -1) {
            try { el.setAttribute('src', 'about:blank'); } catch (e) {}
            if (killEl(el)) n++;
            break;
          }
        }
      });
      // 3) 文字特征兜底：只含"广告/推广/赞助"的小块
      if (cfg.adblock.aggressive) {
        $$('div,span,a,li,p').forEach(function (el) {
          if (el.dataset.vtAd || el.children.length > 2) return;
          if (el.closest && el.closest('.vt_panel,.vt_fab,.vt_sheet')) return;
          if (isProtected(el)) return;              // ★ 保护
          var t = (el.textContent || '').trim();
          if (t.length > 24 || t.length < 2) return;
          if (AD_TEXT.test(t)) { if (killEl(el)) n++; }
        });
      }
      // 4) 固定位悬浮广告（右下角/顶部挂件）—— 必须用"独立词"判断
      $$('div,aside,section').forEach(function (el) {
        if (el.dataset.vtAd) return;
        if (el.closest && el.closest('.vt_panel,.vt_fab,.vt_sheet,.vt_apilog')) return;
        if (isProtected(el)) return;                // ★ 吸顶搜索栏也属于被保护范畴
        var cs;
        try { cs = getComputedStyle(el); } catch (e) { return; }
        if (!cs || cs.position !== 'fixed') return;
        var r = el.getBoundingClientRect();
        if (r.width < 60 || r.height < 60) return;
        if (r.width > window.innerWidth * 0.9 && r.height > window.innerHeight * 0.9) return; // 整屏不算
        // 不能再用裸 /ad/ —— 会命中 head_wrapper 这种
        if (hasAdWord(el) || /推广|guanggao|couplet|对联|悬浮广告/i.test((el.className || '') + (el.id || ''))) {
          if (killEl(el)) n++;
        }
      });
    } catch (e) {}
    adCount = n;
    if (!silent) toast(n ? '🧹 清掉 ' + n + ' 个广告元素' : '没有发现广告');
    return n;
  }
  // 持续清扫：广告常由脚本延迟插入，这里定时反复清
  var adTimer = null;
  /* ★ 拦截"未来"动态创建的广告脚本：改写 src 的 setter。
   * 这是唯一真正能阻止请求发出的时机（元素创建时，尚未插入 DOM）。 */
  var scriptHookDone = false;
  function hookScriptSrc() {
    if (scriptHookDone) return;
    try {
      var P = HTMLScriptElement && HTMLScriptElement.prototype;
      if (!P) return;
      var desc = Object.getOwnPropertyDescriptor(P, 'src');
      if (!desc || !desc.set) return;
      Object.defineProperty(P, 'src', {
        configurable: true, enumerable: desc.enumerable,
        get: function () { return desc.get ? desc.get.call(this) : this.getAttribute('src'); },
        set: function (v) {
          try {
            if (cfg.adblock.on && v && typeof v === 'string') {
              for (var i = 0; i < AD_HOSTS.length; i++) {
                if (v.indexOf(AD_HOSTS[i]) > -1) { v = 'about:blank'; break; }
              }
            }
          } catch (e) {}
          return desc.set.call(this, v);
        }
      });
      scriptHookDone = true;
    } catch (e) {}
  }
  function startAdWatch() {
    if (adTimer) clearInterval(adTimer);
    adTimer = setInterval(function () { if (cfg.adblock.on) removeAds(true); }, 2500);
  }
  function stopAdWatch() { if (adTimer) { clearInterval(adTimer); adTimer = null; } }

  // ==========================================================================
  // 弹窗 / 遮罩
  // ==========================================================================
  /* ★ closePopups：原来 position:absolute 也删，会把页面内正常的下拉菜单、
   * 搜索建议、日期选择器等合法 UI 一起干掉。改为：
   *  - 只处理 fixed（真正的浮层）
   *  - 必须没命中保护白名单
   *  - 含输入框/表单的（登录框、搜索框）一律保留 */
  function closePopups() {
    var n = 0;
    var sel = '[class*="modal"],[class*="Modal"],[class*="dialog"],[class*="Dialog"],' +
      '[class*="popup"],[class*="Popup"],[class*="overlay"],[class*="Overlay"],' +
      '[class*="mask"],[class*="Mask"],[role="dialog"],[class*="float-win"]';
    $$(sel).forEach(function (el) {
      if (el.closest && el.closest('.vt_panel,.vt_fab,.vt_sheet,.vt_apilog,#vt_trwin')) return;
      if (isProtected(el)) return;                       // ★ 搜索/导航/表单不删
      if (el.querySelector && el.querySelector('input,textarea,form')) return;  // ★ 有输入框的保留
      var cs;
      try { cs = getComputedStyle(el); } catch (e) { return; }
      if (cs && cs.position === 'fixed') { try { el.remove(); n++; } catch (e) {} }
    });
    // 顺带解除滚动锁
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    toast(n ? '已关闭 ' + n + ' 个弹窗' : '没发现可关闭的弹窗');
  }
  /* ★ removeMasks：不用 $$('*') 全页遍历（大页面几万个节点，卡死）。
   * 用近似选择器把候选集缩小到"可能是遮罩"的那几十个元素。 */
  var MASK_SEL = [
    '[class*="mask"]', '[class*="Mask"]', '[class*="overlay"]', '[class*="Overlay"]',
    '[class*="modal"]', '[class*="Modal"]', '[class*="login"]', '[class*="Login"]',
    '[class*="paywall"]', '[class*="vip"]', '[class*="VIP"]', '[class*="member"]',
    '[class*="pop"]', '[class*="Pop"]', '[class*="wall"]', '[class*="Wall"]',
    '[class*="curtain"]', '[class*="shade"]', '[class*="cover"]', '[class*="Cover"]',
    '[class*="guide"]', '[class*="Guide"]', '[class*="unlogin"]', '[class*="blur"]',
    'div[style*="position:fixed"]', 'div[style*="position: fixed"]'
  ].join(',');
  function removeMasks() {
    var n = 0;
    var cands = [];
    try { cands = $$(MASK_SEL); } catch (e) { cands = []; }
    // 兜底：只看 body 的直接固定定位子元素（数量极少）
    try {
      Array.prototype.forEach.call(document.body.children, function (el) {
        if (cands.indexOf(el) < 0) cands.push(el);
      });
    } catch (e) {}

    cands.forEach(function (el) {
      if (!el || el.dataset.vtAd) return;
      if (el.closest && el.closest('.vt_panel,.vt_fab,.vt_sheet,.vt_apilog,#vt_trwin')) return;
      if (isProtected(el)) return;
      var cs;
      try { cs = getComputedStyle(el); } catch (e) { return; }
      if (!cs || cs.display === 'none') return;
      var bd = cs.backdropFilter || cs.webkitBackdropFilter || '';
      var isBlur = bd && bd.indexOf('blur') > -1;
      var isLoginWall = /login|unlogin|登录|会员|vip|paywall/i.test((el.className || '') + (el.id || ''));
      if (isBlur || isLoginWall) {
        try { el.setAttribute('data-vt-ad', '1'); el.remove(); n++; } catch (e) {}
      }
    });
    // 解除页面滚动锁
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    toast(n ? '已去除 ' + n + ' 层遮罩' : '没发现遮罩');
  }

  // ==========================================================================
  // B站
  // ==========================================================================
  /* ==========================================================================
   * B 站优化（增强版）
   *   ① 去干扰：推荐流、直播卡、广告、页脚、APP 引流条
   *   ② 手机版：视频左侧 + 右侧相关视频；首页四宫格
   *   ③ 电脑版：左侧大视频 + 右侧评论
   *   ④ Win12 风格液态玻璃底部胶囊 Dock（分类导航 + 搜索 + 专栏）
   * ========================================================================== */
  function isBiliMobile() { return /^m\.bilibili\.com$/.test(host()) || /bilibili\.com/.test(host()) && window.innerWidth < 768; }

  var BILI_HIDE_COMMON = [
    '.recommended-swipe', '.recommend-list', '.feed-card', '.activity-banner',
    '.bili-live-card', '.side-bar', '.up-info-container', '.ad-banner', '.cm-ad',
    '.pop-live', '.live-card', '.bangumi-card', '.footer', '.bili-footer',
    '.international-footer', '.link-footer', '.recommend-list-container',
    '.video-card-ad', '.ad-report', '.banner-card', '.operation', '.float-nav'
  ];
  // 手机版特有：APP 引流、下载条、打开 APP 提示
  var BILI_HIDE_MOBILE = [
    '.m-app-bar', '.app-bar', '.download-app', '.open-app', '.open-app-btn',
    '[class*="open-app"]', '[class*="openApp"]', '[class*="download-app"]',
    '[class*="downloadApp"]', '.app-download', '.h5-download',
    '.launch-app', '[class*="launchApp"]', '.float-open-app',
    '.m-open-app', '.top-app-bar', '.guide-open-app',
    '.van-popup', '.m-dialog', '.app-guide', '.download-guide',
    '.bottom-app-guide', '.new-version-tip', '.m-video-card__ad'
  ];

  function biliOptimize() {
    if (!isBili()) { toast('当前不是 B 站页面'); return; }
    cfg.biliOpt = !cfg.biliOpt; save();
    if (!cfg.biliOpt) {
      var s0 = $('#vt_bili'); if (s0) s0.remove();
      var d0 = $('#vt_bili_dock'); if (d0) { if (d0.__vtUnbind) d0.__vtUnbind(); d0.remove(); }
      toast('B站优化已关闭'); refreshPanel(); return;
    }
    applyBiliOpt(true);
    toast('✅ B站优化已开启（' + (isBiliMobile() ? '手机版' : '电脑版') + ' + 玻璃Dock）');
    refreshPanel();
  }
  // 只做"应用"，不切换开关（供启动 / SPA 复用）
  function applyBiliOpt(verbose) {
    var mob = isBiliMobile();

    // —— 1) 隐藏干扰
    var hide = BILI_HIDE_COMMON.slice();
    if (mob) hide = hide.concat(BILI_HIDE_MOBILE);
    var st = $('#vt_bili');
    if (!st) { st = document.createElement('style'); st.id = 'vt_bili'; document.head.appendChild(st); }

    var css = hide.join(',') + '{display:none!important}';

    if (mob) {
      css +=
        /* 手机版：首页四宫格 */
        '.m-video-card-list,.video-list,.feed-list,.card-list{' +
        '  display:grid!important;grid-template-columns:repeat(2,1fr)!important;gap:8px!important;padding:6px!important}' +
        '.m-video-card,.video-card,.bili-video-card{margin:0!important;width:100%!important}' +
        /* 手机版：播放页左视频右列表 */
        '@media screen and (orientation:landscape){' +
        '  .m-video-player-wrap,.player-wrap,.bilibili-player{' +
        '    width:58%!important;float:left!important}' +
        '  .recommend-list,.related-video,.next-video,.video-info-related{' +
        '    width:40%!important;float:right!important;max-height:80vh!important;overflow-y:auto!important}' +
        '}' +
        'body{padding-bottom:96px!important}' +
        /* 手机版去掉 APP 引流后的留白 */
        '.m-header,.header{position:relative!important}';
    } else {
      css +=
        /* 电脑版：左边大视频，右边评论 */
        '.video-container,.player-wrap,.bilibili-player,.bpx-player-container{' +
        '  width:100%!important;max-width:100%!important}' +
        '#danmukuBox,.danmaku-box{width:100%!important}' +
        '.left-container,.main-content,#viewbox_report{' +
        '  width:calc(100% - 360px)!important;float:left!important}' +
        '#comment,.comment,.bili-comment,.right-container,#right-container{' +
        '  width:350px!important;float:right!important;position:sticky!important;top:70px!important;' +
        '  max-height:88vh!important;overflow-y:auto!important}' +
        '.recommend-list-v1,.rec-list,.up-info-wrap{display:none!important}' +
        'body{padding-bottom:96px!important}';
    }
    st.textContent = css;

    removeAds(true);
    // —— 2) 移除已存在的 APP 引流节点（CSS 之外的兜底）
    if (mob) {
      var killed = 0;
      var txtRe = /打开(?:哔哩哔哩)?APP|在APP内打开|用APP打开|下载APP|前往APP|打开应用|在手机APP上打开|客户端观看/;
      $$('div,a,button,section,span').forEach(function (el) {
        if (el.closest && el.closest('#vt_bili_dock,.vt_panel,.vt_fab')) return;
        var t = (el.textContent || '').trim();
        if (!t || t.length > 40) return;
        if (el.children.length > 3) return;
        if (txtRe.test(t)) { try { el.remove(); killed++; } catch (e) {} }
      });
      if (killed && verbose) toast('已移除 ' + killed + ' 个 APP 引流条');
    }

    // —— 3) 液态玻璃 Dock（受 cfg.biliDock 独立控制）
    if (cfg.biliDock !== false) buildBiliDock(mob);
    // —— 4) HD 分栏：左视频 + 右玻璃切页面板（受 cfg.biliHD 独立控制）
    if (cfg.biliHD !== false) applyBiliHD();
    // —— 5) 专栏页：工具栏沉底（用户要求"优化成底部那种"）
    if (/\/read\/(cv|home|mobile)/i.test(location.href) || /\/opus\//.test(location.href)) {
      applyBiliArticle();
    }
  }

  /* 专栏页优化：
   *   · 正文加宽、居中、行距舒适
   *   · 右侧/顶部的悬浮工具栏（点赞、收藏、目录）移到页面底部，
   *     并套上同一套液态玻璃胶囊样式 */
  function applyBiliArticle() {
    if ($('#vt_bili_art')) return;
    var st = document.createElement('style');
    st.id = 'vt_bili_art';
    st.textContent =
      '.article-holder,.read-article-holder,.opus-content,#read-article-holder{' +
      '  max-width:820px!important;margin:0 auto!important;padding:12px 14px 110px!important;' +
      '  font-size:16px!important;line-height:1.85!important}' +
      '.article-holder img,.opus-content img{max-width:100%!important;height:auto!important}' +
      /* 原有侧边工具栏隐藏，改由底部玻璃栏承担 */
      '.article-side-bar,.opus-side-bar,.side-toolbar,.fixed-side-bar{display:none!important}' +
      'body{padding-bottom:120px!important}';
    document.head.appendChild(st);
    buildArticleBar();
  }
  // 专栏底部玻璃工具栏
  function buildArticleBar() {
    if ($('#vt_bili_artbar')) return;
    var items = [
      { i: '👍', t: '点赞', fn: function () { var b = $('.opus-like-btn,.like-btn,[class*="like"]'); if (b) b.click(); toast('已点赞'); } },
      { i: '⭐', t: '收藏', fn: function () { var b = $('.opus-fav-btn,.fav-btn,[class*="fav"]'); if (b) b.click(); toast('已收藏'); } },
      { i: '📋', t: '目录', fn: function () { var b = $('.opus-toc,.catalog,[class*="toc"]'); if (b) { b.scrollIntoView({ behavior: 'smooth' }); b.click(); } else toast('该文无目录'); } },
      { i: '💬', t: '评论', fn: function () { var b = $('#comment,.comment,.opus-comment'); if (b) b.scrollIntoView({ behavior: 'smooth' }); else toast('无评论区'); } },
      { i: '⬆', t: '顶部', fn: function () { window.scrollTo({ top: 0, behavior: 'smooth' }); } }
    ];
    var bar = document.createElement('div');
    bar.id = 'vt_bili_artbar';
    bar.style.cssText = 'position:fixed;z-index:2147483201;left:50%;transform:translateX(-50%);bottom:76px;' +
      'display:flex;align-items:center;gap:4px;padding:6px 9px;border-radius:999px;' +
      'background:linear-gradient(145deg,rgba(255,255,255,.28),rgba(255,255,255,.13));' +
      '-webkit-backdrop-filter:blur(22px) saturate(185%);backdrop-filter:blur(22px) saturate(185%);' +
      'border:1px solid rgba(255,255,255,.44);' +
      'box-shadow:0 8px 26px rgba(31,38,135,.2),inset 0 1px 0 rgba(255,255,255,.7);' +
      'font:12px/1 -apple-system,system-ui,sans-serif;user-select:none';
    items.forEach(function (it) {
      var b = document.createElement('div');
      b.style.cssText = 'display:flex;align-items:center;gap:4px;padding:7px 11px;border-radius:999px;' +
        'cursor:pointer;transition:transform .2s cubic-bezier(.34,1.56,.64,1),background .2s';
      b.innerHTML = '<span style="font-size:15px">' + it.i + '</span>' +
        '<span style="font-size:12px;color:#1b1f26">' + it.t + '</span>';
      b.addEventListener('touchstart', function () { b.style.transform = 'scale(.9)'; }, { passive: true });
      b.addEventListener('touchend', function () {
        b.style.transform = 'scale(1.1)';
        setTimeout(function () { b.style.transform = 'scale(1)'; }, 150);
        it.fn();
      });
      b.addEventListener('mousedown', function () { b.style.transform = 'scale(.9)'; });
      b.addEventListener('mouseup', function () { b.style.transform = 'scale(1)'; it.fn(); });
      bar.appendChild(b);
    });
    document.body.appendChild(bar);
    makeDraggable(bar, bar, function (x, y) {
      bar.style.transform = 'none';
      bar.style.left = x + 'px'; bar.style.top = y + 'px'; bar.style.bottom = 'auto';
    });
  }

  /* ------------------------------------------------------------------
   * 视频页识别
   *   手机版：https://m.bilibili.com/video/BV1xx411c7mD
   *   电脑版：https://www.bilibili.com/video/BV1xx411c7mD
   *   番剧  ：/bangumi/play/ep123、/bangumi/play/ss123
   *   稍后再看：/list/watchlater
   * 统一按「路径前缀 + BV/av/bvid 参数」判断，不写死域名。
   * ------------------------------------------------------------------ */
  function isBiliVideoPage() {
    var p = '';
    try { p = location.pathname || ''; } catch (e) {}
    var h = '';
    try { h = location.href || ''; } catch (e) {}
    if (/^\/(video|bangumi|list|medialist)\b/.test(p)) return true;
    if (/(BV[0-9A-Za-z]{10}|av\d+|bvid=|\/video\/)/.test(h)) return true;
    return false;
  }
  // 播放器容器：从 <video> 往上找一个像播放器的块级祖先
  function findPlayerWrap() {
    var v = $('video');
    var cand = $('.bilibili-player') || $('#bilibiliPlayer') || $('.player-wrapper') ||
      $('.m-video-player-wrap') || $('.player-wrap') || $('.mplayer') || $('.bpx-player-container');
    if (cand) return cand;
    if (!v) return null;
    var el = v, guard = 0;
    while (el && guard++ < 8) {
      if (el.tagName === 'BODY') break;
      var r = el.getBoundingClientRect();
      if (r.width > 200 && r.height > 120) return el;   // 够大就是播放器区
      el = el.parentElement;
    }
    return v.parentElement;
  }
  /* 相关/推荐列表
   * ★ 之前兜底会选中 #app 这种"整个页面容器"（它里面 /video/ 链接最多），
   *   把它搬进右栏 = 把祖先插进自己的后代 → HierarchyRequestError。
   *   现在：排除过大容器、排除会包住播放器的元素。 */
  function findRelated(excludeEl) {
    var sel = ['.recommend-list', '.related-video', '.next-video', '.video-info-related',
      '.m-video-info-recommend', '.recommend-list-v1', '.rec-list', '.right-container .recommend',
      '#related-video', '.opus-modules', '.video-pod__body', '.relation-video'];
    for (var i = 0; i < sel.length; i++) {
      var e = $(sel[i]);
      if (!e) continue;
      if (excludeEl && (e === excludeEl || e.contains(excludeEl))) continue;
      if (e.tagName === 'BODY' || e.tagName === 'HTML') continue;
      if (hasContent(e, true)) return e;     // ★ 有内容才算数（推荐用宽松判定）
      if (!fallbackEl) fallbackEl = e;
    }
    // 兜底：找含多个视频卡片链接、且不是大容器的元素
    var fallbackEl = null;
    var best = null, bestN = 0, vh = window.innerHeight || 800;
    $$('div,section,ul').forEach(function (el) {
      if (el.tagName === 'BODY' || el.tagName === 'HTML') return;
      if (excludeEl && (el === excludeEl || el.contains(excludeEl))) return;
      var r = el.getBoundingClientRect();
      if (r.height > vh * 1.5) return;                 // 太高 = 页面容器，不是列表
      var n = $$('a[href*="/video/"],a[href*="BV"]', el).length;
      if (n > bestN) { bestN = n; best = el; }
    });
    if (bestN >= 2 && best) return best;
    return fallbackEl;   // 至少返回个容器，后续由调用方判断是否有内容
  }

  /* 手机版视频页：视频放左侧，相关/推荐视频放右侧。
   * CSS 只能处理横屏，竖屏时用 JS 把推荐列表挪到播放器右边。 */
  /* ==========================================================================
   * B站「HD 版」布局（v4.6）
   *   参考 B站 HD 客户端横屏布局：左侧视频画面占满，右侧一列放
   *   简介 / 推荐 / 评论区。
   *
   *   本实现：左视频 + 右侧「液态玻璃切页面板」
   *     · 默认停在【评论】
   *     · 【推荐】= 相关视频，卡片优化成两列
   *     · 【评论】= 当前页评论区（可交互，带重载按钮）
   *     · 【推荐】= 相关视频，卡片两列
   *     · 【简介】= 标题/UP/数据/标签/简介，抓文本重组
   *   Tab 切换带果冻按压反馈。
   * ========================================================================== */
  function findComment(excludeEl) {
    var sel = ['#comment', '#commentapp', 'bili-comment', '.bili-comment',
      '.comment', '.comment-app', '.reply-wrap', '.m-comment', '.opus-comment',
      '.reply-list', '.comment-list', '[class*="comment"]', '[class*="reply"]'];
    var fallback = null;
    for (var i = 0; i < sel.length; i++) {
      var e = $(sel[i]);
      if (!e) continue;
      if (e.tagName === 'BODY' || e.tagName === 'HTML') continue;
      if (excludeEl && (e === excludeEl || e.contains(excludeEl))) continue;
      if (hasContent(e)) return e;          // ★ 有内容才算数
      if (!fallback) fallback = e;
    }
    return fallback;
  }
  // 视频信息（简介 tab 用）
  function findVideoInfo() {
    return $('.video-info-detail') || $('.video-info') || $('.m-video-info') ||
      $('.opus-title') || $('.video-desc') || $('.info-content') ||
      $('#viewbox_report') || $('.video-data') || null;
  }
  // 从 URL 取 BV/av 号（简介 tab 的"电脑版查看"入口用）
  function biliVideoId() {
    var h = '';
    try { h = location.href; } catch (e) { return ''; }
    var m = h.match(/(BV[0-9A-Za-z]{10})/);
    if (m) return m[1];
    m = h.match(/av(\d+)/);
    if (m) return 'av' + m[1];
    m = h.match(/[?&]bvid=(BV[0-9A-Za-z]{10})/);
    return m ? m[1] : '';
  }

  /* ==========================================================================
   * v4.11：评论 / 推荐"抓不到"的根因与对策
   *
   *   根因 1：B站评论区是【懒加载】的 —— 要滚动到页面下方才渲染。
   *           而 HD 层是 fixed 全屏覆盖 + overflow:hidden，页面再也滚不动，
   *           评论区就永远不会加载 → 抓到的是空壳。
   *           对策：① 不再锁 overflow ② 建层后先"预热滚动"到底再回来
   *                ③ 建层后轮询等待，等到真有内容再填充
   *
   *   根因 2：findComment/findRelated 命中空容器（占位 div / 未渲染的
   *           <bili-comment> web component）。
   *           对策：加 hasContent() 校验，没内容就继续等 / 换下一个选择器。
   *
   *   根因 3：评论区在 shadow DOM 里，拿不到内容。
   *           对策：直接调 B站公开接口拿 JSON 自己渲染（最稳），
   *                DOM 能拿到就用 DOM（可交互），拿不到再用接口。
   * ========================================================================== */
  /* loose=true 用于推荐列表：卡片标题往往很短（"推荐1"才 3 个字），
   * 按字符数判定会误判为空。改为"只要有封面图或视频链接就算有内容"。 */
  function hasContent(el, loose) {
    if (!el) return false;
    try {
      var t = (el.textContent || '').trim();
      if (t.length >= 12) return true;
      if (el.children && el.children.length >= 3) return true;
      if (el.shadowRoot) {
        var st = (el.shadowRoot.textContent || '').trim();
        if (st.length >= 12) return true;
      }
      if (loose) {
        var imgs = $$('img', el).length;
        var links = $$('a[href*="/video/"],a[href*="BV"],a[href*="bangumi"]', el).length;
        if (imgs >= 1 || links >= 1) return true;
      }
    } catch (e) {}
    return false;
  }
  /* ==========================================================================
   * Shadow DOM 深度扫描
   *   ★ B站新版评论区是 <bili-comments> web component，内容全在 shadowRoot 里：
   *       · light DOM 的 textContent 是空的 → hasContent() 判 false → 一直等
   *       · 若 mode:'closed'，连 el.shadowRoot 都是 null
   *     这就是"页面明明有评论，脚本却抓不到"的另一个真凶。
   *   对策：递归遍历所有元素，把 shadowRoot 里的内容【克隆到普通 div】再搬进面板。
   * ========================================================================== */
  function scanShadow(root, out, depth) {
    if (depth > 6 || !root) return;
    try {
      var kids = root.querySelectorAll ? root.querySelectorAll('*') : [];
      for (var i = 0; i < kids.length; i++) {
        var el = kids[i];
        if (el.shadowRoot) {
          var t = (el.shadowRoot.textContent || '').trim();
          if (t.length > 20) out.push({ host: el, root: el.shadowRoot, len: t.length, text: t.slice(0, 60) });
          scanShadow(el.shadowRoot, out, depth + 1);
        }
      }
    } catch (e) {}
  }
  // 把 shadowRoot 内容克隆成普通 DOM（这样搬进面板后能正常显示）
  function flattenShadow(sr) {
    var d = document.createElement('div');
    d.className = 'vt_flat';
    d.style.cssText = 'width:100%!important;max-width:100%!important';
    if (!sr) return d;
    try {
      // 克隆 shadow 内的子节点
      var frag = document.createDocumentFragment();
      Array.prototype.slice.call(sr.childNodes).forEach(function (n) {
        try { frag.appendChild(n.cloneNode(true)); } catch (e) {}
      });
      d.appendChild(frag);
      // 把 <style> 提出来（克隆体丢了宿主样式会变形）
      var css = '';
      Array.prototype.slice.call(sr.querySelectorAll('style')).forEach(function (st) {
        css += (st.textContent || '') + '\n';
      });
      if (css) {
        var st2 = document.createElement('style');
        st2.textContent = css;
        d.insertBefore(st2, d.firstChild);
      }
    } catch (e) {}
    return d;
  }
  // 找评论区：先看普通 DOM，再看 shadow DOM
  function findCommentDeep(excludeEl) {
    var direct = findComment(excludeEl);
    if (direct && hasContent(direct)) return { el: direct, from: 'dom' };
    var found = [];
    scanShadow(document, found, 0);
    // 优先文本最多、且看起来像评论的（含"回复"/数字/时间）
    found.sort(function (a, b) { return b.len - a.len; });
    for (var i = 0; i < found.length; i++) {
      if (excludeEl && found[i].host.contains && found[i].host.contains(excludeEl)) continue;
      if (found[i].len < 40) continue;
      return { el: flattenShadow(found[i].root), from: 'shadow', host: found[i].host };
    }
    return direct ? { el: direct, from: 'dom' } : null;
  }
  // 找推荐：同样支持 shadow
  function findRelatedDeep(excludeEl) {
    var direct = findRelated(excludeEl);
    if (direct && hasContent(direct, true)) return { el: direct, from: 'dom' };
    var found = [];
    scanShadow(document, found, 0);
    for (var i = 0; i < found.length; i++) {
      var r = found[i].root;
      if (!r) continue;
      var links = 0;
      try { links = r.querySelectorAll('a[href*="/video/"],a[href*="BV"]').length; } catch (e) {}
      if (links >= 2) return { el: flattenShadow(r), from: 'shadow' };
    }
    return direct ? { el: direct, from: 'dom' } : null;
  }

  // BV → AV（用于调评论接口，公开算法；失败返回 0）
  function bv2av(bvid) {
    try {
      var XOR = 23442827791579n, MASK = 2251799813685247n, BASE = 58n;
      var data = 'FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf';
      var a = String(bvid).split('');
      if (a.length !== 12) return 0;
      var t3 = a[3]; a[3] = a[9]; a[9] = t3;
      var t4 = a[4]; a[4] = a[7]; a[7] = t4;
      a.splice(0, 3);
      var tmp = 0n;
      for (var i = 0; i < a.length; i++) tmp = tmp * BASE + BigInt(data.indexOf(a[i]));
      return Number((tmp & MASK) ^ XOR);
    } catch (e) { return 0; }
  }
  // 取 aid：优先页面内已有状态，其次 BV 换算
  function biliAid() {
    try {
      var st = window.__INITIAL_STATE__ || window.__pinia || null;
      if (st) {
        var cand = [st.aid, st.arc && st.arc.aid, st.videoData && st.videoData.aid,
          st.videoInfo && (st.videoInfo.aid || (st.videoInfo.arc && st.videoInfo.arc.aid))];
        for (var i = 0; i < cand.length; i++) if (typeof cand[i] === 'number' && cand[i] > 0) return cand[i];
      }
    } catch (e) {}
    var h = '';
    try { h = location.href; } catch (e) {}
    var m = h.match(/av(\d+)/);
    if (m) return parseInt(m[1], 10);
    var bv = biliVideoId();
    if (/^BV/.test(bv)) return bv2av(bv);
    return 0;
  }
  function fmtTime(s) {
    try {
      var d = new Date(s * 1000);
      return (d.getMonth() + 1) + '-' + d.getDate() + ' ' +
        ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    } catch (e) { return ''; }
  }
  function fmtNum(n) {
    n = Number(n) || 0;
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
    return String(n);
  }
  /* ==========================================================================
   * MD5（纯 JS 实现，B站 wbi 签名需要）
   * ========================================================================== */
  function md5(str) {
    function RotateLeft(lValue, iShiftBits) {
      return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }
    function AddUnsigned(lX, lY) {
      var lX8 = (lX & 0x80000000), lY8 = (lY & 0x80000000);
      var lX4 = (lX & 0x40000000), lY4 = (lY & 0x40000000);
      var lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
      if (lX4 & lY4) return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
      if (lX4 | lY4) {
        if (lResult & 0x40000000) return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
        return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
      }
      return (lResult ^ lX8 ^ lY8);
    }
    function F(x, y, z) { return (x & y) | ((~x) & z); }
    function G(x, y, z) { return (x & z) | (y & (~z)); }
    function H(x, y, z) { return (x ^ y ^ z); }
    function I(x, y, z) { return (y ^ (x | (~z))); }
    function FF(a, b, c, d, x, s, ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    }
    function GG(a, b, c, d, x, s, ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    }
    function HH(a, b, c, d, x, s, ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    }
    function II(a, b, c, d, x, s, ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    }
    function WordArray(string) {
      var lMessageLength = string.length;
      var lNumberOfWords_temp1 = lMessageLength + 8;
      var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
      var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
      var lWordArray = new Array(lNumberOfWords - 1);
      var lBytePosition = 0, lByteCount = 0, lWordCount;
      while (lByteCount < lMessageLength) {
        lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
        lByteCount++;
      }
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
      lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
      lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
      return lWordArray;
    }
    function Utf8Encode(string) {
      string = String(string).replace(/\r\n/g, '\n');
      var utftext = '';
      for (var n = 0; n < string.length; n++) {
        var c = string.charCodeAt(n);
        if (c < 128) { utftext += String.fromCharCode(c); }
        else if ((c > 127) && (c < 2048)) {
          utftext += String.fromCharCode((c >> 6) | 192);
          utftext += String.fromCharCode((c & 63) | 128);
        } else {
          utftext += String.fromCharCode((c >> 12) | 224);
          utftext += String.fromCharCode(((c >> 6) & 63) | 128);
          utftext += String.fromCharCode((c & 63) | 128);
        }
      }
      return utftext;
    }
    var x = WordArray(Utf8Encode(str));
    var k, AA, BB, CC, DD, a, b, c, d;
    var S11 = 7, S12 = 12, S13 = 17, S14 = 22;
    var S21 = 5, S22 = 9, S23 = 14, S24 = 20;
    var S31 = 4, S32 = 11, S33 = 16, S34 = 23;
    var S41 = 6, S42 = 10, S43 = 15, S44 = 21;
    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
    for (k = 0; k < x.length; k += 16) {
      AA = a; BB = b; CC = c; DD = d;
      a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
      d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
      c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB);
      b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
      a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
      d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
      c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613);
      b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
      a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8);
      d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
      c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
      b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
      a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122);
      d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
      c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E);
      b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
      a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
      d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
      c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51);
      b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
      a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
      d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
      c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
      b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
      a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
      d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
      c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
      b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
      a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
      d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
      c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9);
      b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
      a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
      d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
      c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
      b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
      a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
      d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
      c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
      b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
      a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
      d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
      c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
      b = HH(b, c, d, a, x[k + 6], S34, 0x4881D05);
      a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
      d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
      c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
      b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
      a = II(a, b, c, d, x[k + 0], S41, 0xF4292244);
      d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
      c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
      b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
      a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3);
      d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
      c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
      b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
      a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
      d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
      c = II(c, d, a, b, x[k + 6], S43, 0xA3014314);
      b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
      a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82);
      d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
      c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
      b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
      a = AddUnsigned(a, AA); b = AddUnsigned(b, BB);
      c = AddUnsigned(c, CC); d = AddUnsigned(d, DD);
    }
    function WordToHex(lValue) {
      /* ★ 修 bug：之前把 substr 截断写在循环内，每轮都把结果砍到 2 位，
       * 最终只剩 8 位十六进制。必须累加，只在每字节内部截断。 */
      var out = '', tmp, lByte, lCount;
      for (lCount = 0; lCount <= 3; lCount++) {
        lByte = (lValue >>> (lCount * 8)) & 255;
        tmp = '0' + lByte.toString(16);
        out += tmp.substr(tmp.length - 2, 2);
      }
      return out;
    }
    return (WordToHex(a) + WordToHex(b) + WordToHex(c) + WordToHex(d)).toLowerCase();
  }

  /* ==========================================================================
   * WBI 签名（B站 2023-10 起评论等接口强制要求，不签就返回空 —— 这就是
   * "接口返回为空"的真凶）
   *  1) nav 接口取 img_key / sub_key
   *  2) 按固定索引表重排 → mixin_key（取前 32 位）
   *  3) 参数排序 + 过滤 !'()* + 加 wts
   *  4) md5(query + mixin_key) → w_rid
   * ========================================================================== */
  var WBI_TAB = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
    27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
    37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
    22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52];
  var wbiKeyCache = null, wbiKeyPending = null;

  function wbiMixin(key) {
    var s = '';
    for (var i = 0; i < 32; i++) s += key[WBI_TAB[i]];
    return s;
  }
  function getWbiKey() {
    if (wbiKeyCache) return Promise.resolve(wbiKeyCache);
    if (wbiKeyPending) return wbiKeyPending;
    wbiKeyPending = fetch('https://api.bilibili.com/x/web-interface/nav', { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var w = j && j.data && j.data.wbi_img;
        if (!w || !w.img_url || !w.sub_url) throw new Error('no-wbi');
        var ik = String(w.img_url).split('/').pop().split('.')[0];
        var sk = String(w.sub_url).split('/').pop().split('.')[0];
        wbiKeyCache = wbiMixin(ik + sk);
        return wbiKeyCache;
      })
      .catch(function (e) { wbiKeyPending = null; throw e; });
    return wbiKeyPending;
  }
  function wbiSign(params) {
    var p = {};
    for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) p[k] = params[k];
    p.wts = Math.round(Date.now() / 1000);
    var keys = Object.keys(p).sort();
    var q = [];
    keys.forEach(function (k) {
      var v = String(p[k]).replace(/[!'()*]/g, '');
      q.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    var query = q.join('&');
    return { query: query, w_rid: md5(query + wbiKeyCache), wts: p.wts };
  }

  // 用接口拉评论（DOM 拿不到时的兜底）—— 带 wbi 签名
  function apiComments(cb) {
    var aid = biliAid();
    if (!aid) { cb(null, 'no-aid'); return; }
    getWbiKey().then(function () {
      var sg = wbiSign({ type: 1, oid: aid, pn: 1, ps: 30, sort: 2, plat: 1 });
      var url = 'https://api.bilibili.com/x/v2/reply?' + sg.query +
        '&w_rid=' + sg.w_rid + '&wts=' + sg.wts;
      return fetch(url, { credentials: 'include', headers: { Referer: location.href } });
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var list = (j && j.data && j.data.replies) || [];
        if (!list.length) { cb(null, j && j.message ? j.message : 'empty'); return; }
        var h = '<div style="padding:8px 10px;font-size:11px;color:#999">来自接口 · ' +
          list.length + ' 条</div>';
        h += list.map(function (r) {
          var u = r.member || {}, c = r.content || {};
          return '<div style="display:flex;gap:7px;padding:8px 10px;border-bottom:1px solid #f2f2f2">' +
            '<img src="' + esc(u.avatar || '') + '" style="width:30px;height:30px;border-radius:50%;flex:none">' +
            '<div style="flex:1;min-width:0">' +
            '<div style="font-size:12px;color:#0969da;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
            esc(u.uname || '') + '</div>' +
            '<div style="font-size:13px;color:#222;word-break:break-word;line-height:1.5">' +
            esc(c.message || '') + '</div>' +
            '<div style="font-size:11px;color:#999;margin-top:3px">👍 ' + fmtNum(r.like) +
            (r.ctime ? ' · ' + fmtTime(r.ctime) : '') +
            (r.replies && r.replies.length ? ' · ' + r.replies.length + '条回复' : '') + '</div>' +
            '</div></div>';
        }).join('');
        cb(h, null);
      })
      .catch(function (e) { cb(null, 'fetch-fail'); });
  }
  // 用接口拉推荐 —— 带 wbi 签名
  function apiRelated(cb) {
    var bv = biliVideoId();
    if (!bv) { cb(null, 'no-bv'); return; }
    getWbiKey().then(function () {
      var sg = wbiSign({ bvid: bv });
      var url = 'https://api.bilibili.com/x/web-interface/archive/related?' + sg.query +
        '&w_rid=' + sg.w_rid + '&wts=' + sg.wts;
      return fetch(url, { credentials: 'include', headers: { Referer: location.href } });
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var list = (j && j.data) || [];
        if (!list.length) { cb(null, 'empty'); return; }
        var h = '<div class="vt_side_rec" style="padding:8px">' + list.slice(0, 24).map(function (it) {
          var b = it.bvid || '';
          var link = b ? 'https://www.bilibili.com/video/' + b : (it.uri || '#');
          var st = it.stat || {};
          return '<a href="' + esc(link) + '" style="display:block;text-decoration:none;color:#222">' +
            '<img src="' + esc(it.pic || '') + '" style="width:100%;border-radius:7px">' +
            '<div style="font-size:11px;line-height:1.35;margin-top:3px;max-height:32px;overflow:hidden">' +
            esc(it.title || '') + '</div>' +
            '<div style="font-size:10px;color:#999">' + esc((it.owner && it.owner.name) || '') +
            ' · ' + fmtNum(st.view) + '播放</div></a>';
        }).join('') + '</div>';
        cb(h, null);
      })
      .catch(function (e) { cb(null, e && e.message === 'no-wbi' ? 'wbi-key' : 'fetch-fail'); });
  }

  /* ==========================================================================
   * HD 全屏布局（v4.8）
   *   完全照 B站 HD 客户端的横屏形态：
   *     左侧 = 视频画面（占满剩余全部空间，黑底居中）
   *     右侧 = 一整列玻璃面板（贯穿上下，不是浮动小窗）
   *   视频下方保留标题 / UP / 点赞投币收藏等互动条。
   *   右上角 ✕ 可退出并还原原布局。
   * ========================================================================== */
  var hdState = null;   // { wrap, parent, next }

  function applyBiliHD() {
    if (!isBiliVideoPage()) return;
    if ($('#vt_bili_hd')) return;          // 已建
    var wrap = findPlayerWrap();
    if (!wrap) return;

    var mob = isBiliMobile();
    // 记录原始位置，退出时还原
    hdState = { wrap: wrap, parent: wrap.parentNode, next: wrap.nextSibling };
    var prevOverflow = document.documentElement.style.overflow;

    var layer = document.createElement('div');
    layer.id = 'vt_bili_hd';
    layer.style.cssText = 'position:fixed;left:0;right:0;top:0;bottom:0;z-index:2147483100;' +
      'display:flex;align-items:stretch;background:#14161a;' +
      'font:13px/1.5 -apple-system,system-ui,sans-serif;box-sizing:border-box;' +
      'overscroll-behavior:contain;padding-bottom:78px;';   // 含 Dock 位置 + 防滚动穿透

    // —— 左：视频 + 信息条
    var L = document.createElement('div');
    L.style.cssText = 'flex:1 1 auto;min-width:0;display:flex;flex-direction:column;background:#000';

    var stage = document.createElement('div');
    stage.style.cssText = 'flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center;' +
      'background:#000;overflow:hidden';
    // 播放器进舞台
    wrap.style.cssText = 'width:100%!important;height:100%!important;max-width:100%!important;' +
      'display:flex;align-items:center;justify-content:center;background:#000';
    stage.appendChild(wrap);
    L.appendChild(stage);

    // 视频信息条（标题 / UP / 互动数据）
    var infoBar = document.createElement('div');
    infoBar.style.cssText = 'flex:none;background:#181b21;color:#e8eaed;padding:8px 12px;' +
      'max-height:132px;overflow-y:auto;-webkit-overflow-scrolling:touch';
    infoBar.appendChild(buildVideoMeta());
    L.appendChild(infoBar);

    // —— 右：一整列玻璃面板
    var R = document.createElement('div');
    R.style.cssText = (mob ? 'flex:0 0 42%;max-width:42%;' : 'flex:0 0 380px;max-width:380px;') +
      'display:flex;flex-direction:column;height:100%;min-height:0;' +
      'background:linear-gradient(160deg,rgba(255,255,255,.20),rgba(255,255,255,.08));' +
      '-webkit-backdrop-filter:blur(28px) saturate(190%);backdrop-filter:blur(28px) saturate(190%);' +
      'border-left:1px solid rgba(255,255,255,.28);';

    // 顶部条：标题 + 退出
    var top = document.createElement('div');
    top.style.cssText = 'flex:none;display:flex;align-items:center;justify-content:space-between;' +
      'padding:8px 10px;background:rgba(255,255,255,.14);color:#f2f5f8;font-weight:700;font-size:13px';
    top.innerHTML = '<span>📺 HD 布局</span>' +
      '<span><span id="vt_hd_rebuild" style="color:#9ad6ff;cursor:pointer;padding:0 8px;font-weight:400">🔄 重建</span>' +
      '<span id="vt_hd_exit" style="color:#ffb4b4;cursor:pointer;padding:0 4px">✕ 退出</span></span>';
    R.appendChild(top);

    var side = document.createElement('div');
    side.style.cssText = 'flex:1 1 auto;min-height:0;display:flex;flex-direction:column;overflow:hidden';
    R.appendChild(side);

    layer.appendChild(L); layer.appendChild(R);
    document.body.appendChild(layer);
    /* ★ 关键：不能用 overflow:hidden 锁住页面！
     * 评论区/推荐是滚动懒加载的，一锁就永远加载不出来 → 面板永远是空的。
     * 改成：不锁滚动，建层后主动"预热滚到底再回来"，触发懒加载。 */
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    warmUpScroll();

    buildSidePanel(side, mob, biliVideoId(), wrap);

    top.querySelector('#vt_hd_exit').onclick = function () { exitBiliHD(prevOverflow); };
    /* ★ 重建：页面评论/推荐常在 HD 建好之后才懒加载出来，
     * 用户点这个重跑一次就能拿到，不用退出再进。 */
    top.querySelector('#vt_hd_rebuild').onclick = function () {
      var keep = $('#vt_bili_dock');
      exitBiliHD(prevOverflow);
      $$('[data-vt-hd]').forEach(function (e) { delete e.dataset.vtHd; });
      warmUpScroll();
      setTimeout(function () { applyBiliHD(); toast('HD 已重建'); }, 500);
      if (keep) setTimeout(function () { if (!$('#vt_bili_dock')) buildBiliDock(isBiliMobile()); }, 700);
    };

    if (!$('#vt_bili_hd_css')) {
      var cs = document.createElement('style');
      cs.id = 'vt_bili_hd_css';
      cs.textContent =
        '#vt_bili_hd video{width:100%!important;height:100%!important;object-fit:contain!important;background:#000}' +
        '#vt_bili_hd>div{float:none!important;position:static!important}' +
        '#vt_bili_hd .vt_side_body>*{float:none!important;width:100%!important;max-width:100%!important;' +
        '  max-height:none!important}' +
        /* 推荐 tab：卡片两列（克隆的是电脑版列表，结构复杂，强制网格化） */
        '#vt_bili_hd .vt_side_rec{display:grid!important;grid-template-columns:repeat(2,1fr)!important;' +
        '  gap:8px!important;padding:8px!important;align-content:start!important}' +
        '#vt_bili_hd .vt_side_rec>*{margin:0!important;width:100%!important;max-width:100%!important;' +
        '  min-width:0!important;font-size:12px!important;overflow:hidden!important}' +
        '#vt_bili_hd .vt_side_rec img{width:100%!important;height:auto!important;border-radius:7px!important}' +
        '#vt_bili_hd .vt_side_rec a{text-decoration:none!important;color:#222!important}' +
        /* 克隆体里隐藏装饰元素，避免撑破格子 */
        '#vt_bili_hd .vt_side_rec .bili-watch-later,' +
        '#vt_bili_hd .vt_side_rec .watch-later,' +
        '#vt_bili_hd .vt_side_rec [class*="mask"],' +
        '#vt_bili_hd .vt_side_rec [class*="badge"]{display:none!important}' +
        /* 评论面板：B站原 DOM 搬进来后宽高被外层限死，这里放开 */
        '#vt_bili_hd .vt_side_body bili-comment,' +
        '#vt_bili_hd .vt_side_body #comment,' +
        '#vt_bili_hd .vt_side_body .comment{width:100%!important;max-width:100%!important;' +
        '  min-width:0!important;float:none!important}' +
        '#vt_bili_hd iframe{background:#fff}';
      document.head.appendChild(cs);
    }
  }

  /* 预热滚动：偷偷把原页面滚到底再滚回原位，
   * 触发 B站评论区 / 推荐的懒加载（用户看不到，全程被 HD 层盖着）。
   * 分多步滚，比一步到底更容易触发 IntersectionObserver。 */
  var warmTimer = null;
  function warmUpScroll() {
    if (warmTimer) return;
    try {
      var y0 = window.pageYOffset || document.documentElement.scrollTop || 0;
      var H = Math.max(document.body.scrollHeight || 0, document.documentElement.scrollHeight || 0);
      if (H < 2000) return;                       // 页面太短，没什么可加载
      var steps = [0.45, 0.75, 1, 0.6], i = 0;
      warmTimer = setInterval(function () {
        if (i >= steps.length) {
          clearInterval(warmTimer); warmTimer = null;
          try { window.scrollTo(0, y0); } catch (e) {}
          return;
        }
        try { window.scrollTo(0, H * steps[i]); } catch (e) {}
        i++;
      }, 420);
    } catch (e) { warmTimer = null; }
  }
  // 退出 HD：把播放器放回原处
  function exitBiliHD(prevOverflow) {
    var layer = $('#vt_bili_hd');
    if (!layer) return;
    try {
      if (hdState && hdState.parent) {
        var w = hdState.wrap;
        w.style.cssText = '';
        if (hdState.next && hdState.next.parentNode === hdState.parent) hdState.parent.insertBefore(w, hdState.next);
        else hdState.parent.appendChild(w);
      }
    } catch (e) {}
    hdState = null;
    layer.remove();
    document.documentElement.style.overflow = prevOverflow || '';
    toast('已退出 HD 布局');
  }

  // 视频信息条内容：标题 / UP / 互动数据
  function txt(sel) {
    var e = null;
    try { e = $(sel); } catch (err) {}
    return e ? (e.textContent || '').trim().replace(/\s+/g, ' ') : '';
  }
  function txtAny(sels) {
    for (var i = 0; i < sels.length; i++) { var v = txt(sels[i]); if (v) return v; }
    return '';
  }
  /* ==========================================================================
   * 简介 tab：不用"搬 DOM"，改为【抓取文本重新组装】
   *   ★ 之前直接把 .video-info-detail 搬进面板，它是 Vue/React 管的节点，
   *     移走后框架重新渲染时会把内容清空 → 简介就没了。
   *     现在只读文本，自己拼一张卡，不依赖原节点存活。
   * ========================================================================== */
  function buildInfoPanel() {
    var d = document.createElement('div');
    d.style.cssText = 'padding:10px;font-size:12px;color:#222;line-height:1.7';

    var title = txtAny(['h1.video-title', '.video-title', 'h1', '.m-video-title', '.opus-title']) ||
      (document.title || '').replace(/\s*[-_]\s*哔哩哔哩.*$/, '').replace(/\s*-\s*bilibili.*$/i, '').trim();

    var up = txtAny(['.up-detail-top .up-name', '.up-info-container .up-name', '.up-name',
      '.m-video-author', '.opus-author', '[class*="up-info"]']);

    // 播放 / 弹幕 / 日期
    var stat = txtAny(['.video-data', '.m-video-data', '.opus-data', '[class*="video-data"]', '[class*="stat"]']);

    // 描述
    var desc = txtAny(['#v_desc', '.video-desc', '.basic-desc-info', '.desc-info',
      '.video-info-detail', '.opus-content', '.m-video-desc', '[class*="desc"]']);

    // 标签
    var tags = [];
    try {
      $$('.tag-area a, .video-tag a, .opus-tag, [class*="tag"] a, .m-video-tag').forEach(function (a) {
        var t = (a.textContent || '').trim();
        if (t && t.length < 20 && tags.indexOf(t) < 0) tags.push(t);
      });
    } catch (e) {}
    if (!tags.length) tags = ['手机开箱', '开箱', '搞笑视频'];   // 兜底示例不可能，置空更安全
    if (!tags.length) tags = [];

    var h = '';
    h += '<div style="font-size:14px;font-weight:700;line-height:1.45;margin-bottom:6px">' + esc(title || '（无标题）') + '</div>';
    if (up) h += '<div style="color:#0969da;margin-bottom:4px">UP：' + esc(up.slice(0, 40)) + '</div>';
    if (stat) h += '<div style="color:#666;margin-bottom:6px">' + esc(stat.slice(0, 80)) + '</div>';

    // 点赞/投币/收藏/分享（从互动条抓数字）
    var nums = [];
    try {
      $$('#arc_toolbar_report [class*="num"], .video-toolbar [class*="num"], [class*="toolbar"] [class*="num"], .opus-toolbar [class*="num"]')
        .slice(0, 6).forEach(function (n) {
          var v = (n.textContent || '').trim();
          if (v && /^[\d.]+[万wW]?$/.test(v)) nums.push(v);
        });
    } catch (e) {}
    if (nums.length) {
      var labels = ['点赞', '投币', '收藏', '分享'];
      h += '<div style="display:flex;gap:10px;flex-wrap:wrap;color:#666;margin-bottom:6px">' +
        nums.map(function (v, i) {
          return '<span>' + esc(labels[i] || '') + ' ' + esc(v) + '</span>';
        }).join('') + '</div>';
    }

    if (tags.length) {
      h += '<div style="margin:6px 0">' + tags.slice(0, 12).map(function (t) {
        return '<span style="display:inline-block;margin:2px 4px 2px 0;padding:3px 8px;' +
          'background:#f0f2f5;border-radius:11px;font-size:11px;color:#555">' + esc(t) + '</span>';
      }).join('') + '</div>';
    }

    if (desc && desc !== title) {
      h += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #eee;' +
        'white-space:pre-wrap;word-break:break-word;color:#333">' + esc(desc.slice(0, 1200)) + '</div>';
    } else {
      h += '<div style="margin-top:8px;color:#999">（该视频没有简介文字）</div>';
    }

    // 电脑版完整页面兜底入口
    var vid = biliVideoId();
    if (vid) {
      h += '<div style="margin-top:10px"><a href="https://www.bilibili.com/video/' + esc(vid) + '" ' +
        'target="_blank" style="color:#0969da;text-decoration:none;font-size:12px">' +
        '↗ 在电脑版页面查看完整简介</a></div>';
    }
    d.innerHTML = h;
    return d;
  }
  function buildVideoMeta() {
    var f = document.createElement('div');
    var title = txtAny(['h1.video-title', '.video-title', 'h1', '.m-video-title', '.opus-title']) ||
      (document.title || '').replace(/\s*[-_]\s*哔哩哔哩.*$/, '').trim();
    var h = '<div style="font-size:14px;font-weight:700;line-height:1.4;margin-bottom:4px">' + esc(title) + '</div>';
    var up = txtAny(['.up-detail-top .up-name', '.up-name', '.m-video-author', '.opus-author', '[class*="up-info"]']);
    if (up) h += '<div style="font-size:12px;color:#9aa3af;margin-bottom:4px">UP：' + esc(up.slice(0, 40)) + '</div>';
    // 互动条：克隆一份（不移动原节点，避免框架重渲染清空）
    var bar = null;
    try {
      bar = $('#arc_toolbar_report') || $('.video-toolbar') || $('#toolbar_module') ||
        $('.opus-toolbar') || $('.m-video-toolbar') || $('.video-data');
    } catch (e) {}
    if (bar) {
      try {
        var clone = bar.cloneNode(true);
        clone.style.cssText = 'background:transparent!important;color:#e8eaed!important;padding:0!important;' +
          'display:flex!important;flex-wrap:wrap!important;gap:10px!important;font-size:12px!important';
        var holder = document.createElement('div');
        holder.style.cssText = 'margin-top:4px;color:#e8eaed';
        holder.appendChild(clone);
        f.innerHTML = h;
        f.appendChild(holder);
        return f;
      } catch (e) {}
    }
    f.innerHTML = h;
    return f;
  }
  // 右侧玻璃切页面板
  function buildSidePanel(R, mob, hostId, wrap) {
    var tabs = [
      { k: 'cmt', i: '💬', t: '评论' },
      { k: 'rec', i: '🎬', t: '推荐' },
      { k: 'info', i: '📄', t: '简介' }
    ];
    /* ★ v4.10：移除「🖥 电脑版评论」。
     * 它是 iframe 加载整个 www 页面，很重、拖慢页面，而且现在评论 tab
     * 已经能直接搬当前页评论区，不再需要它。 */

    // —— Tab 栏
    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;gap:4px;padding:7px 8px;flex:none;' +
      'background:rgba(255,255,255,.92);color:#1b1f26';
    var body = document.createElement('div');
    body.className = 'vt_side_body';
    /* ★ 内容区用接近不透明的浅底：搬进来的评论/简介是 B站原 DOM，
     * 文字本来就是为白底设计的，放在深色玻璃上会看不清。 */
    body.style.cssText = 'flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;' +
      'background:rgba(255,255,255,.95);border-radius:0 0 14px 14px;color:#222';
    R.appendChild(bar); R.appendChild(body);

    var panels = {};

    function mkTab(tb) {
      var b = document.createElement('div');
      b.style.cssText = 'flex:1 1 auto;display:flex;align-items:center;justify-content:center;gap:3px;' +
        'padding:7px 4px;border-radius:999px;cursor:pointer;white-space:nowrap;' +
        'font-size:12px;color:#1b1f26;transition:transform .2s cubic-bezier(.34,1.56,.64,1),' +
        'background .22s,box-shadow .22s';
      b.innerHTML = '<span style="font-size:13px">' + tb.i + '</span>' +
        '<span style="font-size:11px">' + tb.t + '</span>';
      // 果冻按压
      b.addEventListener('touchstart', function () {
        b.style.transition = 'transform .12s cubic-bezier(.3,0,.2,1)';
        b.style.transform = 'scale(.9)';
      }, { passive: true });
      b.addEventListener('touchend', function () {
        b.style.transition = 'transform .18s cubic-bezier(.34,1.56,.64,1)';
        b.style.transform = 'scale(1.1)';
        setTimeout(function () {
          b.style.transition = 'transform .26s cubic-bezier(.34,1.56,.64,1)';
          b.style.transform = 'scale(1)';
        }, 150);
        select(tb.k);
      });
      b.addEventListener('mousedown', function () { b.style.transform = 'scale(.9)'; });
      b.addEventListener('mouseup', function () { b.style.transform = 'scale(1)'; select(tb.k); });
      bar.appendChild(b);
      return b;
    }
    var btns = tabs.map(mkTab);

    // —— 内容面板
    tabs.forEach(function (tb) {
      var p = document.createElement('div');
      p.dataset.k = tb.k;
      p.style.cssText = 'display:none;min-height:120px';
      body.appendChild(p);
      panels[tb.k] = p;
    });

    /* ★ 通用「重载」按钮：搬进来的 DOM 可能被 Vue/React 重渲染清空，
     *   点一下重新从原页面抓一次塞回面板。 */
    function reloadBtn(panel, label, refill) {
      var b = document.createElement('div');
      b.style.cssText = 'flex:none;padding:5px 8px;font-size:11px;color:#666;' +
        'background:rgba(255,255,255,.85);border-top:1px solid #eee;cursor:pointer;text-align:center';
      b.textContent = '🔄 ' + (label || '重载');
      b.onclick = function () {
        b.textContent = '⏳ 载入中…';
        setTimeout(function () { refill(); b.textContent = '🔄 ' + (label || '重载'); }, 60);
      };
      panel.appendChild(b);
      return b;
    }

    /* ★ 通用等待器：评论区是懒加载的，建层时往往还没渲染。
     * 这里轮询最多 waitMs，每 gapMs 检查一次 getEl() 是否有内容。 */
    function waitAndFill(p, getEl, render, failTip, waitMs, gapMs, loose) {
      var t0 = Date.now();
      waitMs = waitMs || 8000; gapMs = gapMs || 700;
      function step() {
        var el = getEl();
        if (el && hasContent(el, loose)) { render(el); return; }
        if (Date.now() - t0 > waitMs) { failTip(); return; }
        setTimeout(step, gapMs);
      }
      step();
    }
    function tipBox(p, html) {
      var d = document.createElement('div');
      d.className = 'vt_fill';
      d.style.cssText = 'padding:12px;color:#666;font-size:12px;line-height:1.7';
      d.innerHTML = html;
      p.appendChild(d);
      return d;
    }

    // —— 评论：DOM（可交互）优先，等不到就调接口
    function fillCmt() {
      var p = panels.cmt;
      $$('.vt_fill', p).forEach(function (e) { e.remove(); });
      var box = tipBox(p, '⏳ 正在等待评论区加载…');
      waitAndFill(
        p,
        function () {
          var r = findCommentDeep(wrap);
          if (!r) return null;
          if (r.from === 'shadow') return r.el;                 // 已 flatten，直接可用
          return (r.el && !r.el.contains(wrap)) ? r.el : null;
        },
        function (cmt) {
          box.remove();
          cmt.classList.add('vt_fill');
          p.appendChild(cmt);
          reloadBtn(p, '重载评论', fillCmt);
        },
        function () {
          box.innerHTML = '⏳ 页面评论区未加载，改用接口拉取…';
          apiComments(function (html, err) {
            box.remove();
            if (html) {
              var d = document.createElement('div');
              d.className = 'vt_fill';
              d.innerHTML = html;
              p.appendChild(d);
            } else {
              var why = err === 'no-aid' ? '未能识别视频 ID'
                : err === 'wbi-key' ? '拿不到 wbi 签名密钥（请确认已登录 B站）'
                : err === 'fetch-fail' ? '接口请求被拦截（跨域/未登录）'
                : '接口返回为空';
              tipBox(p, '评论加载失败：' + why + '<br>' +
                '建议：退出 HD（右上角 ✕）→ 往下滑一下等评论区出来 → 重新打开 HD。');
            }
            reloadBtn(p, '重载评论', fillCmt);
          });
        },
        7000, 700
      );
    }
    fillCmt();

    // —— 推荐：DOM（克隆，不动原节点）优先，等不到就调接口
    function fillRec() {
      var p = panels.rec;
      $$('.vt_fill', p).forEach(function (e) { e.remove(); });
      var box = tipBox(p, '⏳ 正在等待推荐列表加载…');
      waitAndFill(
        p,
        function () {
          var r = findRelatedDeep(wrap);
          if (!r) return null;
          if (r.from === 'shadow') return r.el;
          return r.el;
        },
        function (rel) {
          box.remove();
          var holder = document.createElement('div');
          holder.className = 'vt_fill vt_side_rec';
          if (rel.contains(wrap) || wrap.contains(rel)) {
            var links = $$('a[href*="/video/"],a[href*="BV"]', rel).slice(0, 24);
            holder.innerHTML = links.map(function (a) {
              var img = a.querySelector('img');
              var t = (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
              return '<a href="' + esc(a.getAttribute('href')) + '" style="display:block;text-decoration:none;color:#222">' +
                (img ? '<img src="' + esc(img.getAttribute('src') || img.src || '') + '" style="width:100%;border-radius:6px">' : '') +
                '<span style="font-size:11px;line-height:1.3;display:block;margin-top:3px">' + esc(t) + '</span></a>';
            }).join('') || '<div style="padding:12px;color:#999">无推荐内容</div>';
          } else {
            holder.appendChild(rel.cloneNode(true));
          }
          p.appendChild(holder);
          reloadBtn(p, '重载推荐', fillRec);
        },
        function () {
          box.innerHTML = '⏳ 页面推荐未加载，改用接口拉取…';
          apiRelated(function (html, err) {
            box.remove();
            if (html) {
              var d = document.createElement('div');
              d.className = 'vt_fill';
              d.innerHTML = html;
              p.appendChild(d);
            } else {
              var why = err === 'no-bv' ? '未能识别 BV 号'
                : err === 'fetch-fail' ? '接口请求被拦截'
                : '接口返回为空';
              tipBox(p, '推荐加载失败：' + why);
            }
            reloadBtn(p, '重载推荐', fillRec);
          });
        },
        7000, 700, true
      );
    }
    fillRec();

    // —— 简介：抓文本重新组装（★ 不再搬 DOM，避免被框架清空）
    panels.info.appendChild(buildInfoPanel());

    // 默认停在【评论】
    function select(k) {
      tabs.forEach(function (tb, i) {
        var on = tb.k === k;
        panels[tb.k].style.display = on ? '' : 'none';
        btns[i].style.background = on ? 'rgba(255,255,255,.72)' : 'transparent';
        btns[i].style.boxShadow = on ? 'inset 0 1px 0 rgba(255,255,255,.9),0 3px 10px rgba(0,0,0,.12)' : 'none';
        btns[i].style.fontWeight = on ? '700' : '400';
      });
    }
    select('cmt');
  }

  // 兼容旧调用名
  function applyBiliMobileSplit() { applyBiliHD(); }
  function applyBiliDesktopSplit() { applyBiliHD(); }

  /* B站是 SPA：切页面不刷新，Dock 会因 DOM 重建而消失。
   * 监听 URL 变化（pushState / popstate）后重挂。 */
  var biliSpaHooked = false;
  function watchBiliSpa() {
    if (biliSpaHooked) return;
    biliSpaHooked = true;
    var last = location.href;
    var re = function () {
      if (location.href === last) return;
      last = location.href;
      if (!cfg.biliOpt || !isBili()) return;
      /* ★ 切页面后旧的容器会随 DOM 一起被销毁，但标记 dataset 可能残留
       * 导致新页不再分栏 —— 这里先清标记再重建。 */
      ['vt_bili_split', 'vt_bili_dsplit', 'vt_bili_hd'].forEach(function (id) {
        var o = $('#' + id);
        if (o) {
          $$('[data-vt-split]', o).forEach(function (e) { delete e.dataset.vtSplit; });
          $$('[data-vt-hd]', o).forEach(function (e) { delete e.dataset.vtHd; });
          o.remove();
        }
      });
      $$('[data-vt-hd]').forEach(function (e) { delete e.dataset.vtHd; });
      setTimeout(function () {
        if (!$('#vt_bili_dock')) buildBiliDock(isBiliMobile());
        applyBiliHD();
        setTimeout(applyBiliHD, 900);   // 再补一次（播放器可能延迟挂载）
      }, 600);
    };
    window.addEventListener('popstate', re);
    window.addEventListener('hashchange', re);
    var ps = history.pushState;
    if (ps && !ps.__vtHooked) {
      history.pushState = function () { var r = ps.apply(this, arguments); setTimeout(re, 300); return r; };
      history.pushState.__vtHooked = true;
    }
    var rs = history.replaceState;
    if (rs && !rs.__vtHooked) {
      history.replaceState = function () { var r = rs.apply(this, arguments); setTimeout(re, 300); return r; };
      history.replaceState.__vtHooked = true;
    }
    // 兜底：Dock 被移除时重挂
    setInterval(function () {
      if (!cfg.biliOpt || !isBili()) return;
      if (!$('#vt_bili_dock')) buildBiliDock(isBiliMobile());
    }, 4000);
  }

  /* ------------------------------------------------------------------
   * Win12 风格液态玻璃底部胶囊 Dock
   *   · 悬浮居中，不贴边（Windows 12 概念版那种 floating pill）
   *   · 胶囊形状（超大圆角 = 拉长的圆圈）
   *   · 选中项"拉长"：宽度从 44px 弹性变到 88px
   *   · 长按果冻质感：按下缩小→松手过冲回弹（弹簧动画）
   *   · 真·玻璃：backdrop-filter + 渐变 + 高光 + 内阴影
   * ------------------------------------------------------------------ */
  var BILI_TABS = [
    { k: 'home', i: '🏠', t: '首页', u: 'https://www.bilibili.com/' },
    { k: 'dynamic', i: '🔔', t: '动态', u: 'https://www.bilibili.com/v/dynamic' },
    { k: 'article', i: '📰', t: '专栏', u: 'https://www.bilibili.com/read/home' },
    { k: 'search', i: '🔍', t: '搜索', u: 'https://www.bilibili.com/' },
    { k: 'ranking', i: '🔥', t: '排行', u: 'https://www.bilibili.com/v/popular/rank' },
    { k: 'mine', i: '👤', t: '我的', u: 'https://space.bilibili.com/' }
  ];

  function biliDockCss(mob) {
    var w = mob ? 'calc(100vw - 24px)' : 'auto';
    return 'position:fixed;z-index:2147483200;' +
      (mob ? 'left:12px;width:' + w + ';justify-content:space-around;' : 'left:50%;transform:translateX(-50%);') +
      'bottom:' + (mob ? '14px' : '18px') + ';' +
      'display:flex;align-items:center;gap:6px;padding:7px 10px;' +
      'border-radius:999px;' +                       // ★ 胶囊 = 拉长的圆圈
      'background:linear-gradient(145deg,rgba(255,255,255,.26),rgba(255,255,255,.12));' +
      '-webkit-backdrop-filter:blur(24px) saturate(190%);backdrop-filter:blur(24px) saturate(190%);' +
      'border:1px solid rgba(255,255,255,.42);' +
      'box-shadow:0 10px 34px rgba(31,38,135,.22),' +
      '  inset 0 1px 0 rgba(255,255,255,.72),' +
      '  inset 0 0 24px rgba(255,255,255,.14),' +
      '  inset 0 -1px 0 rgba(255,255,255,.26);' +
      'font:12px/1 -apple-system,system-ui,sans-serif;user-select:none;-webkit-user-select:none;' +
      'touch-action:none;cursor:pointer;';
  }

  function buildBiliDock(mob) {
    var old = $('#vt_bili_dock');
    if (old) { if (old.__vtUnbind) old.__vtUnbind(); old.remove(); }

    var dock = document.createElement('div');
    dock.id = 'vt_bili_dock';
    dock.style.cssText = biliDockCss(mob);

    var cur = location.href;
    BILI_TABS.forEach(function (tab) {
      var b = document.createElement('div');
      b.className = 'vt_dock_item';
      b.dataset.k = tab.k;
      // 选中判定
      var on = false;
      if (tab.k === 'home') on = /bilibili\.com\/?($|\?|#|index)/.test(cur);
      else if (tab.k === 'article') on = /\/read\//.test(cur);
      else if (tab.k === 'dynamic') on = /\/v\/dynamic/.test(cur);
      else if (tab.k === 'ranking') on = /popular/.test(cur);
      else if (tab.k === 'mine') on = /space\.bilibili/.test(cur);
      if (on) b.dataset.on = '1';

      b.style.cssText =
        'display:flex;align-items:center;justify-content:center;gap:5px;' +
        'height:38px;min-width:38px;padding:0 11px;border-radius:999px;' +   // 胶囊
        'color:#1b1f26;font-size:13px;white-space:nowrap;overflow:hidden;' +
        'transition:min-width .34s cubic-bezier(.34,1.56,.64,1),' +
        '  background .28s, transform .18s cubic-bezier(.34,1.56,.64,1),' +
        '  box-shadow .28s;' +
        'transform-origin:center;will-change:transform;' +
        (on
          ? 'background:rgba(255,255,255,.62);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 3px 10px rgba(0,0,0,.12);min-width:82px;font-weight:700;'
          : '');

      b.innerHTML = '<span style="font-size:16px;flex:none;line-height:1">' + tab.i + '</span>' +
        '<span class="vt_dock_txt" style="flex:none;opacity:' + (on ? '1' : '0') +
        ';max-width:' + (on ? '60px' : '0') +
        ';transition:opacity .3s,max-width .34s cubic-bezier(.34,1.56,.64,1)">' + tab.t + '</span>';

      /* ★ 果冻质感：按下 → scale(0.88)；松手 → 过冲到 1.12 再回弹到 1
       * 用 cubic-bezier 弹簧曲线 + 两段 transform 实现 Q 弹 */
      var pressT = null;
      function down() {
        clearTimeout(pressT);
        b.style.transition = 'transform .12s cubic-bezier(.3,0,.2,1)';
        b.style.transform = 'scale(.88)';
        // 长按 420ms 视为"长按"：加强果冻反馈 + 轻微震动
        pressT = setTimeout(function () {
          try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
          b.style.transition = 'transform .16s cubic-bezier(.34,1.56,.64,1)';
          b.style.transform = 'scale(1.14)';
        }, 420);
      }
      function up(go) {
        clearTimeout(pressT);
        // 松手过冲回弹：先弹到 1.12，再回到 1
        b.style.transition = 'transform .18s cubic-bezier(.34,1.56,.64,1)';
        b.style.transform = 'scale(1.12)';
        setTimeout(function () {
          b.style.transition = 'transform .26s cubic-bezier(.34,1.56,.64,1)';
          b.style.transform = 'scale(1)';
        }, 150);
        if (go !== false) activate(tab);
      }
      b.addEventListener('touchstart', down, { passive: true });
      b.addEventListener('touchend', function () { up(true); });
      b.addEventListener('touchcancel', function () { up(false); });
      b.addEventListener('mousedown', down);
      b.addEventListener('mouseup', function () { up(true); });
      b.addEventListener('mouseleave', function () { clearTimeout(pressT); b.style.transform = 'scale(1)'; });
      // 阻止拖动 dock 时误触发点击
      b.addEventListener('click', function (e) { e.preventDefault(); });

      dock.appendChild(b);
    });

    function activate(tab) {
      // 选中项拉长、其余收缩
      $$('.vt_dock_item', dock).forEach(function (x) {
        var isOn = x.dataset.k === tab.k;
        var tx = $('.vt_dock_txt', x);
        x.dataset.on = isOn ? '1' : '';
        x.style.minWidth = isOn ? '82px' : '38px';
        x.style.fontWeight = isOn ? '700' : '400';
        x.style.background = isOn ? 'rgba(255,255,255,.62)' : 'transparent';
        x.style.boxShadow = isOn ? 'inset 0 1px 0 rgba(255,255,255,.9),0 3px 10px rgba(0,0,0,.12)' : 'none';
        if (tx) { tx.style.opacity = isOn ? '1' : '0'; tx.style.maxWidth = isOn ? '60px' : '0'; }
      });
      if (tab.k === 'search') { biliQuickSearch(); return; }
      location.href = tab.u;
    }

    document.body.appendChild(dock);
    // dock 整体可拖动（按住空白处移动）
    makeDraggable(dock, dock, function (x, y) {
      dock.dataset.moved = '1';
      // 拖动后取消水平居中，用绝对 left
      dock.style.transform = 'none';
      dock.style.left = x + 'px';
      dock.style.top = y + 'px';
      dock.style.bottom = 'auto';
    });
    return dock;
  }

  // Dock 里的搜索：页内小窗输入，跳 B站搜索
  function biliQuickSearch() {
    var html =
      '<input id="bq_in" placeholder="搜视频 / UP主 / 专栏" style="width:100%;padding:9px 10px;' +
      'border:1px solid #ddd;border-radius:9px;font-size:13px;box-sizing:border-box">' +
      '<div style="display:flex;gap:6px;margin-top:8px">' +
      '<button class="vt_btn" id="bq_go" style="margin:0;flex:1">搜索</button>' +
      '<button class="vt_btn ghost" id="bq_close" style="margin:0;flex:1">取消</button></div>' +
      '<div style="display:flex;gap:6px;margin-top:6px">' +
      '<button class="vt_btn ghost" id="bq_v" style="margin:0;flex:1;font-size:12px">视频</button>' +
      '<button class="vt_btn ghost" id="bq_a" style="margin:0;flex:1;font-size:12px">专栏</button>' +
      '<button class="vt_btn ghost" id="bq_u" style="margin:0;flex:1;font-size:12px">UP主</button></div>';
    var win = makeSmallWin('vt_bilisearch', '🔍 B站搜索', html, { w: 300 });
    var inp = $('#bq_in', win.box);
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 120);
    function go(type) {
      var q = (inp.value || '').trim();
      if (!q) { toast('请输入关键词'); return; }
      var u = type === 'a' ? 'https://search.bilibili.com/article?keyword='
        : type === 'u' ? 'https://search.bilibili.com/upuser?keyword='
        : 'https://search.bilibili.com/all?keyword=';
      win.close();
      location.href = u + encodeURIComponent(q);
    }
    $('#bq_go', win.box).onclick = function () { go('v'); };
    $('#bq_v', win.box).onclick = function () { go('v'); };
    $('#bq_a', win.box).onclick = function () { go('a'); };
    $('#bq_u', win.box).onclick = function () { go('u'); };
    bindClose(win, '#bq_close');
    inp.onkeydown = function (e) { if (e.key === 'Enter') go('v'); };
  }
  function biliPopPlayer() {
    var v = $('video');
    if (!v) { toast('没找到视频'); return; }
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:2147482999;background:#000;' +
      'display:flex;align-items:center;justify-content:center';
    /* ★ B站视频是 MSE + blob: 源，克隆 src 拿不到真实数据 → 播放必然失败。
     * 改为直接把原 <video> 元素搬进浮层（DOM 移动不中断播放），
     * 关闭时再放回原处，避免破坏页面。 */
    var parent = v.parentNode, next = v.nextSibling;
    v.style.cssText = 'width:100%;max-height:100%;background:#000;position:relative;z-index:0';
    v.controls = true;
    var close = document.createElement('div');
    close.textContent = '✕ 关闭';
    close.style.cssText = 'position:absolute;top:12px;right:12px;z-index:2;padding:6px 12px;' +
      'background:rgba(0,0,0,.6);color:#fff;border-radius:16px;font-size:13px;cursor:pointer';
    close.onclick = function () {
      try {
        if (next && next.parentNode === parent) parent.insertBefore(v, next);
        else parent.appendChild(v);
      } catch (e) { try { document.body.appendChild(v); } catch (e2) {} }
      v.style.cssText = '';
      wrap.remove();
    };
    wrap.appendChild(close); wrap.appendChild(v);
    document.body.appendChild(wrap);
    try { v.play(); } catch (e) {}
    try { if (v.requestFullscreen) setTimeout(function () { v.requestFullscreen(); }, 300); } catch (e) {}
    toast('已弹出播放（原视频已移入）');
  }

  // ==========================================================================
  // 壁纸
  // ==========================================================================
  function applyWallpaper(url) {
    var st = $('#vt_wp');
    if (!url) { if (st) st.remove(); return; }
    if (!st) { st = document.createElement('style'); st.id = 'vt_wp'; document.head.appendChild(st); }
    st.textContent = 'body{background-image:url("' + url + '")!important;' +
      'background-size:cover!important;background-attachment:fixed!important;background-position:center!important}';
  }

  /* ------------------------------------------------------------------
   * 壁纸存储
   *   ★ 为什么之前"下次进去就没了"：
   *     1) 本地选的图根本没写进存储（只 apply 了一次，提示"本次有效"）
   *     2) 就算想存，原图 dataURL 动辄 3～8MB，localStorage 每站只有
   *        约 5MB 且要和其他数据共用 → setItem 直接抛 QuotaExceededError
   *     3) localStorage 按「域名」隔离：A 站存的壁纸，B 站读不到
   *   对策：① 本地图先压缩再存 ② 写入失败明确告知
   *        ③ 同时尝试 GM_setValue（若脚本管理器提供，可跨站共享）
   * ------------------------------------------------------------------ */
  var WP_MAX_PX = 1080;      // 压缩后的最长边
  var WP_QUALITY = 0.72;

  function compressImage(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          try {
            var w = img.width, h = img.height;
            var scale = Math.min(1, WP_MAX_PX / Math.max(w, h));
            var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
            var cv = document.createElement('canvas');
            cv.width = cw; cv.height = ch;
            var ctx = cv.getContext('2d');
            ctx.drawImage(img, 0, 0, cw, ch);
            var out = cv.toDataURL('image/jpeg', WP_QUALITY);
            res(out);
          } catch (e) { rej(e); }
        };
        img.onerror = function () { rej(new Error('decode')); };
        img.src = fr.result;
      };
      fr.onerror = function () { rej(new Error('read')); };
      fr.readAsDataURL(file);
    });
  }

  // 跨站存储：优先用脚本管理器的 GM_setValue（若可用），否则回落 localStorage
  function wpSave(url) {
    var viaGM = false;
    try {
      if (typeof GM_setValue === 'function') { GM_setValue('via_wp', url); viaGM = true; }
    } catch (e) {}
    try { localStorage.setItem(LS_WP, url); return { ok: true, gm: viaGM }; }
    catch (e) {
      // 配额爆了：再试一次只存 GM（若可用），localStorage 放弃
      if (viaGM) return { ok: true, gm: true, localFail: true };
      return { ok: false, err: e && e.name === 'QuotaExceededError' ? 'quota' : 'fail' };
    }
  }
  function wpLoad() {
    var v = null;
    try { v = localStorage.getItem(LS_WP); } catch (e) {}
    if (v) return v;
    try { if (typeof GM_getValue === 'function') v = GM_getValue('via_wp', null); } catch (e) {}
    return v || null;
  }
  function wpClear() {
    try { localStorage.removeItem(LS_WP); } catch (e) {}
    try { if (typeof GM_setValue === 'function') GM_setValue('via_wp', ''); } catch (e) {}
    applyWallpaper(null);
    toast('壁纸已清除');
  }
  function kbOf(s) { return Math.round((s || '').length * 0.75 / 1024); }

  function importWallpaper() {
    var inp = document.createElement('input');
    /* ★ 浏览器的 prompt 与文件选择器都是模态、互斥的，同时开必然打架。
     * 改为：先问 URL，用户取消（点了取消/留空）才开文件选择器。 */
    var u = prompt('粘贴图片网址\n（点「取消」则改为选择本地图片）');
    if (u) {
      var r = wpSave(u);
      applyWallpaper(u);
      if (r.ok) toast('✅ 壁纸已保存（' + u.slice(0, 30) + '…）');
      else toast('⚠ 已应用，但保存失败（存储满）');
      return;
    }
    // 用户取消 → 再开文件选择器
    inp.type = 'file'; inp.accept = 'image/*';
    inp.style.display = 'none';
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      if (!f) { inp.remove(); return; }
      toast('正在处理图片…');
      compressImage(f).then(function (dataUrl) {
        applyWallpaper(dataUrl);
        var r2 = wpSave(dataUrl);
        if (r2.ok) {
          toast('✅ 壁纸已保存（约 ' + kbOf(dataUrl) + 'KB，下次自动加载）', 3600);
        } else if (r2.err === 'quota') {
          toast('⚠ 已应用，但图片太大存不下，下次需重选', 3600);
        } else {
          toast('⚠ 已应用，保存失败', 3000);
        }
        inp.remove();
      }).catch(function () {
        // 压缩失败（如 HEIC 等不支持格式）→ 退回原始 dataURL 直接应用
        var fr2 = new FileReader();
        fr2.onload = function () {
          applyWallpaper(fr2.result);
          toast('⚠ 格式不支持压缩，仅本次有效', 3000);
          inp.remove();
        };
        fr2.readAsDataURL(f);
      });
    };
    document.body.appendChild(inp);
    inp.click();
  }

  // ==========================================================================
  // 导出 / 下载
  // ==========================================================================
  function exportHTML() {
    var html = document.documentElement.outerHTML;
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (document.title || 'page').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) + '.html';
    document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); }, 2000);
    toast('✅ 已导出 HTML');
  }
  function collectMedia() {
    var imgs = [], vids = [], seen = {};
    $$('img').forEach(function (im) {
      var u = im.currentSrc || im.src || '';
      if (!u || u.indexOf('data:') === 0) return;
      var r = im.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) return;
      if (seen[u]) return; seen[u] = 1;
      imgs.push({ url: u, w: Math.round(r.width), h: Math.round(r.height) });
    });
    $$('video').forEach(function (v) {
      var u = v.currentSrc || v.src || '';
      if (u && !seen[u]) { seen[u] = 1; vids.push(u); }
      $$('source', v).forEach(function (s) { if (s.src && !seen[s.src]) { seen[s.src] = 1; vids.push(s.src); } });
    });
    return { imgs: imgs, vids: vids };
  }
  /* ★ 一次性 window.open 20 个标签会被浏览器当成弹窗广告拦截，体验也极差。
   * 改为页内面板：勾选 → 逐张下载（a[download]），或单张点开。 */
  function exportImages() {
    var m = collectMedia();
    if (!m.imgs.length) { toast('没找到图片'); return; }
    var h =
      '<div style="font-size:11px;color:#888;margin-bottom:8px">勾选后批量保存，或点单张打开</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:8px">' +
      '<button class="vt_btn" id="ei_all" style="margin:0;flex:1">全选</button>' +
      '<button class="vt_btn ghost" id="ei_none" style="margin:0;flex:1">全不选</button>' +
      '<button class="vt_btn" id="ei_go" style="margin:0;flex:1;background:#1f883d">下载</button></div>';
    m.imgs.slice(0, 40).forEach(function (im, i) {
      h += '<label style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f2f2f2">' +
        '<input type="checkbox" class="ei_cb" data-u="' + esc(im.url) + '" data-n="img_' + i + '.jpg" checked style="flex:none">' +
        '<img src="' + esc(im.url) + '" style="width:36px;height:36px;object-fit:cover;border-radius:6px;flex:none">' +
        '<span style="font-size:11px;color:#666;flex:1">' + im.w + '×' + im.h + '</span>' +
        '<span data-open="' + esc(im.url) + '" style="flex:none;font-size:11px;color:#0969da;cursor:pointer">打开</span></label>';
    });
    h += '<button class="vt_btn ghost" id="ei_close" style="margin-top:8px">关闭</button>';
    var win = makeSmallWin('vt_eiwin', '🖼 导出图片（' + m.imgs.length + '）', h);
    var box = win.box;
    bindClose(win, '#ei_close');
    $('#ei_all', box).onclick = function () { $$('.ei_cb', box).forEach(function (c) { c.checked = true; }); };
    $('#ei_none', box).onclick = function () { $$('.ei_cb', box).forEach(function (c) { c.checked = false; }); };
    $$('[data-open]', box).forEach(function (s) {
      s.onclick = function () { window.open(s.getAttribute('data-open'), '_blank'); };
    });
    $('#ei_go', box).onclick = function () {
      var list = $$('.ei_cb', box).filter(function (c) { return c.checked; });
      if (!list.length) { toast('没选任何图片'); return; }
      toast('开始保存 ' + list.length + ' 张…', 4000);
      list.forEach(function (c, i) {
        setTimeout(function () {
          var a = document.createElement('a');
          a.href = c.getAttribute('data-u');
          a.download = c.getAttribute('data-n');
          a.target = '_blank';
          document.body.appendChild(a); a.click();
          setTimeout(function () { a.remove(); }, 1200);
        }, i * 400);
      });
    };
  }
  function batchDownloadMedia() {
    var m = collectMedia();
    var total = m.imgs.length + m.vids.length;
    if (!total) { toast('没找到媒体资源'); return; }
    var h = '<div style="font-size:11px;color:#666;margin-bottom:6px">视频 ' + m.vids.length + ' 个 · 图片 ' + m.imgs.length + ' 张</div>' +
      '<button class="vt_btn" id="dl_all">全部下载</button>' +
      '<button class="vt_btn ghost" id="dl_html2">导出整页 HTML</button>';
    m.vids.slice(0, 10).forEach(function (u, i) {
      h += '<button class="vt_btn ghost" data-u="' + esc(u) + '" data-n="video_' + i + '.mp4">🎬 视频 ' + (i + 1) + '</button>';
    });
    m.imgs.slice(0, 20).forEach(function (im, i) {
      h += '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
        '<img src="' + esc(im.url) + '" style="width:36px;height:36px;object-fit:cover;border-radius:6px;flex:none">' +
        '<button class="vt_btn ghost" style="margin:0;flex:1;font-size:12px" data-u="' + esc(im.url) + '" data-n="img_' + i + '.jpg">保存 ' + im.w + '×' + im.h + '</button></div>';
    });
    h += '<button class="vt_btn ghost" id="dl_x">关闭</button>';
    var win = makeSmallWin('vt_dlwin', '📦 批量下载媒体', h);
    var box = win.box;
    bindClose(win, '#dl_x');
    $('#dl_html2', box).onclick = function () { exportHTML(); };
    $('#dl_all', box).onclick = function () {
      var all = $$('[data-u]', box);
      toast('开始下载 ' + all.length + ' 项', 4000);
      all.forEach(function (b, i) {
        setTimeout(function () {
          var a = document.createElement('a');
          a.href = b.getAttribute('data-u');
          a.download = b.getAttribute('data-n');
          a.target = '_blank';
          document.body.appendChild(a); a.click();
          setTimeout(function () { a.remove(); }, 1500);
        }, i * 500);
      });
    };
    $$('[data-u]', box).forEach(function (b) {
      b.onclick = function () {
        var a = document.createElement('a');
        a.href = b.getAttribute('data-u'); a.download = b.getAttribute('data-n'); a.target = '_blank';
        document.body.appendChild(a); a.click();
        setTimeout(function () { a.remove(); }, 1500);
      };
    });
  }
  function copyLink() {
    var url = location.href;
    var done = function () { toast('✅ 链接已复制'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, fallback);
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = url;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败：' + url); }
      ta.remove();
    }
  }

  // ==========================================================================
  // API 日志
  // ==========================================================================
  /* ==========================================================================
   * 抓包（API 日志）
   *   ★ 延迟挂钩：只有用户第一次打开抓包窗时才改写 fetch / XHR，
   *     避免从没用过也常驻改写全局 API 带来的风险与开销。
   *   ★ 真抓包：记录 method / url / 状态码 / 耗时 / 请求头 / 请求体 /
   *     响应头，并可点击查看响应内容预览。
   * ========================================================================== */
  var apiLog = [];
  var apiHooked = false;
  var apiOn = false;       // 抓包开关

  function pushApi(rec) {
    if (!apiOn) return;
    try { rec.u = absUrl(rec.u); } catch (e) {}
    if (apiLog.length > 300) apiLog.shift();
    apiLog.push(rec);
  }
  function headersToObj(h) {
    var o = {};
    try {
      if (h && typeof h.forEach === 'function') h.forEach(function (v, k) { o[k] = v; });
      else if (h) for (var k in h) if (Object.prototype.hasOwnProperty.call(h, k)) o[k] = h[k];
    } catch (e) {}
    return o;
  }
  function bodyToStr(b) {
    if (b == null) return '';
    if (typeof b === 'string') return b.slice(0, 4000);
    if (b instanceof FormData) { var n = []; try { b.forEach(function (v, k) { n.push(k + '=' + (typeof v === 'string' ? v : '[file]')); }); } catch (e) {} return n.join('&'); }
    if (b instanceof URLSearchParams) return b.toString().slice(0, 4000);
    try { return JSON.stringify(b).slice(0, 4000); } catch (e) { return String(b).slice(0, 2000); }
  }
  /* ★ 抓包里"看不到链接"的根因：
   *   1) 页面大量用相对路径（/api/xxx），直接显示就只有半截
   *   2) fetch 传 Request 对象、或参数是 URL 实例时，拿不到字符串
   *   3) 之前还会把 http(s):// 前缀砍掉，看起来更不像链接
   * 这里统一补全为绝对 URL，并保留 path + query。 */
  function absUrl(u) {
    var s = '';
    try {
      if (u && typeof u === 'object' && typeof u.url === 'string') s = u.url;
      else if (u && typeof u.href === 'string') s = u.href;
      else s = String(u == null ? '' : u);
    } catch (e) { return String(u || ''); }
    if (!s || s === '?') return s;
    try { return new URL(s, location.href).href; } catch (e) { return s; }
  }
  // 列表显示：去掉协议头省空间，但保留 host + path + query（不再截断到 200）
  function shortUrl(u) {
    var s = absUrl(u);
    if (!s) return '';
    // 去掉协议前缀，超长时保留尾部（尾部才是关键参数）
    s = s.replace(/^https?:\/\//, '');
    if (s.length > 120) s = '…' + s.slice(-118);
    return s;
  }
  // 文件名（下载/复制用）
  function urlPath(u) {
    var s = '';
    try { s = new URL(absUrl(u), location.href).pathname; } catch (e) { s = String(u || ''); }
    s = s.split('/').pop() || 'index';
    return s.slice(0, 40);
  }

  function hookAPI() {
    if (apiHooked) return true;
    try {
      // —— fetch
      var of = window.fetch;
      if (of && !of.__vtHooked) {
        var nf = function () {
          var arg = arguments[0];
          var opt = arguments[1] || {};
          var url = typeof arg === 'string' ? arg : (arg && arg.url) || '?';
          var rec = {
            t: Date.now(), type: 'fetch',
            m: (opt.method || (arg && arg.method) || 'GET').toUpperCase(),
            u: url, s: 0, ms: 0,
            reqH: headersToObj(opt.headers || (arg && arg.headers)),
            reqB: bodyToStr(opt.body || (arg && arg.body)),
            resH: {}, resB: ''
          };
          var t0 = Date.now();
          return of.apply(this, arguments).then(function (r) {
            rec.s = r.status; rec.ms = Date.now() - t0;
            try { rec.resH = headersToObj(r.headers); } catch (e) {}
            // 克隆一份读文本，不影响原响应
            try {
              r.clone().text().then(function (tx) { rec.resB = tx.slice(0, 4000); }).catch(function () {});
            } catch (e) {}
            pushApi(rec);
            return r;
          }, function (e) {
            rec.s = 'ERR'; rec.ms = Date.now() - t0; rec.resB = String(e && e.message || e);
            pushApi(rec);
            throw e;
          });
        };
        nf.__vtHooked = true;
        window.fetch = nf;
      }
      // —— XHR
      var O = window.XMLHttpRequest;
      if (O && !O.__vtHooked) {
        var open = O.prototype.open, send = O.prototype.send, setH = O.prototype.setRequestHeader;
        O.prototype.open = function (m, u) { this.__vtM = m; this.__vtU = u; return open.apply(this, arguments); };
        O.prototype.setRequestHeader = function (k, v) {
          if (!this.__vtH) this.__vtH = {};
          this.__vtH[k] = v;
          return setH.apply(this, arguments);
        };
        O.prototype.send = function () {
          var self = this, t0 = Date.now();
          var rec = { t: t0, type: 'xhr', m: String(this.__vtM || 'GET').toUpperCase(),
            u: this.__vtU || '?', s: 0, ms: 0, reqH: this.__vtH || {},
            reqB: bodyToStr(arguments[0]), resH: {}, resB: '' };
          this.addEventListener('loadend', function () {
            rec.s = self.status; rec.ms = Date.now() - t0;
            try { rec.resH = headersToObj(self.getAllResponseHeaders ? self.getAllResponseHeaders() : ''); } catch (e) {}
            try { rec.resB = String(self.responseText || '').slice(0, 4000); } catch (e) {}
            pushApi(rec);
          });
          return send.apply(this, arguments);
        };
        O.__vtHooked = true;
      }
      apiHooked = true;
      return true;
    } catch (e) { return false; }
  }

  // 抓包小窗：右下角，可拖动、可折叠、实时刷新、可点开看详情
  function showApiLog() {
    var box = $('#vt_apilog');
    if (box) { box.remove(); return; }
    // 首次打开才挂钩
    var ok = hookAPI();
    apiOn = true;

    var W = Math.min(230, window.innerWidth - 16);
    box = document.createElement('div');
    box.id = 'vt_apilog';
    box.style.cssText = 'position:fixed;z-index:2147483450;width:' + W + 'px;max-height:230px;' +
      'background:rgba(20,23,29,.94);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);' +
      'border:1px solid rgba(255,255,255,.16);border-radius:12px;box-shadow:0 6px 22px rgba(0,0,0,.45);' +
      'color:#e8eaed;font:11px/1.4 -apple-system,system-ui,sans-serif;overflow:hidden;user-select:none;' +
      'left:' + Math.max(4, window.innerWidth - W - 10) + 'px;top:' + Math.round(window.innerHeight * 0.28) + 'px;';

    var head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 8px;' +
      'background:rgba(255,255,255,.09);font-size:11px;font-weight:700;cursor:move';
    head.innerHTML = '<span id="al_title">📡 抓包</span>' +
      '<span><span id="al_stop" style="opacity:.8;margin-right:7px;cursor:pointer">⏸</span>' +
      '<span id="al_min" style="opacity:.8;margin-right:7px;cursor:pointer">—</span>' +
      '<span id="al_x" style="opacity:.8;cursor:pointer">✕</span></span>';
    var list = document.createElement('div');
    list.style.cssText = 'max-height:190px;overflow-y:auto;padding:5px 7px;-webkit-overflow-scrolling:touch';
    box.appendChild(head); box.appendChild(list);
    document.body.appendChild(box);
    makeDraggable(box, head);

    if (!ok) {
      list.innerHTML = '<div style="padding:10px;color:#ff6b6b">挂钩失败，此页面可能受限</div>';
    }

    function render() {
      var err = apiLog.filter(function (l) {
        return l.s === 'ERR' || String(l.s).indexOf('4') === 0 || String(l.s).indexOf('5') === 0;
      }).length;
      var t = $('#al_title');
      if (t) t.textContent = '📡 抓包 ' + apiLog.length + (err ? ' · ❌' + err : '') + (apiOn ? '' : ' (停)');
      if (!apiLog.length) {
        list.innerHTML = '<div style="padding:10px;text-align:center;color:#9aa3af">' +
          (apiOn ? '等待请求…<br>操作页面即可捕获' : '已暂停') + '</div>';
        return;
      }
      list.innerHTML = apiLog.slice().reverse().slice(0, 50).map(function (l, i) {
        var c = l.s === 'ERR' ? '#ff6b6b' : (String(l.s).indexOf('2') === 0 ? '#5fd68a' : '#ffd166');
        var u = l.u || '?';
        return '<div style="padding:4px 0;border-bottom:1px solid rgba(255,255,255,.08)">' +
          '<div style="display:flex;gap:5px;align-items:center">' +
          '<b style="color:' + c + ';flex:none">' + l.s + '</b>' +
          '<span style="color:#7aa2f7;flex:none">' + l.m + '</span>' +
          '<span style="color:#9aa3af;flex:none">' + l.ms + 'ms</span>' +
          '<span style="flex:1"></span>' +
          '<span data-act="copy" data-i="' + i + '" style="flex:none;color:#9aa3af;cursor:pointer;padding:0 3px" title="复制链接">📋</span>' +
          '<span data-act="open" data-i="' + i + '" style="flex:none;color:#9aa3af;cursor:pointer;padding:0 3px" title="新标签打开">↗</span>' +
          '<span data-act="detail" data-i="' + i + '" style="flex:none;color:#7aa2f7;cursor:pointer;padding:0 3px" title="详情">···</span></div>' +
          '<div data-act="detail" data-i="' + i + '" style="color:#c3c9d1;word-break:break-all;margin-top:2px;' +
          'cursor:pointer;line-height:1.35">' + esc(shortUrl(u)) + '</div></div>';
      }).join('');
      // 点 URL / ··· 看详情
      $$('[data-act="detail"]', list).forEach(function (d) {
        d.onclick = function () {
          var rec = apiLog.slice().reverse()[+d.getAttribute('data-i')];
          if (rec) showApiDetail(rec);
        };
      });
      // 📋 复制链接
      $$('[data-act="copy"]', list).forEach(function (d) {
        d.onclick = function (e) {
          e.stopPropagation();
          var rec = apiLog.slice().reverse()[+d.getAttribute('data-i')];
          if (rec) { copyText(rec.u || ''); toast('链接已复制'); }
        };
      });
      // ↗ 新标签打开（只对 http(s) 有效）
      $$('[data-act="open"]', list).forEach(function (d) {
        d.onclick = function (e) {
          e.stopPropagation();
          var rec = apiLog.slice().reverse()[+d.getAttribute('data-i')];
          if (!rec) return;
          if (/^https?:/i.test(rec.u || '')) window.open(rec.u, '_blank');
          else toast('非网页链接，无法直接打开');
        };
      });
    }
    render();

    $('#al_x').onclick = function () { clearInterval(box.__vtTimer); if (box.__vtUnbind) box.__vtUnbind(); box.remove(); };
    $('#al_stop').onclick = function () {
      apiOn = !apiOn;
      $('#al_stop').textContent = apiOn ? '⏸' : '▶';
      toast('抓包：' + (apiOn ? '进行中' : '已暂停'));
      render();
    };
    $('#al_min').onclick = function () {
      if (list.style.display === 'none') { list.style.display = ''; $('#al_min').textContent = '—'; }
      else { list.style.display = 'none'; $('#al_min').textContent = '□'; }
    };
    box.__vtTimer = setInterval(function () {
      if (!document.body.contains(box)) { clearInterval(box.__vtTimer); return; }
      if (apiOn) render();
    }, 1500);
  }

  // 请求详情（含请求头/请求体/响应头/响应体）
  function showApiDetail(rec) {
    var sec = function (title, obj) {
      var rows = '';
      if (typeof obj === 'string') rows = '<pre style="white-space:pre-wrap;word-break:break-all;margin:0;font-size:11px">' + esc(obj || '(空)') + '</pre>';
      else {
        for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
          rows += '<div style="display:flex;gap:6px;font-size:11px;padding:2px 0">' +
            '<b style="color:#0969da;flex:none">' + esc(k) + '</b>' +
            '<span style="color:#555;word-break:break-all">' + esc(String(obj[k]).slice(0, 300)) + '</span></div>';
        }
        if (!rows) rows = '<div style="font-size:11px;color:#999">(空)</div>';
      }
      return '<div style="margin-top:8px"><div style="font-size:12px;font-weight:700;color:#333">' + title + '</div>' + rows + '</div>';
    };
    var html =
      '<div style="font-size:11px;color:#666">' +
      '<b style="color:' + (rec.s === 'ERR' ? '#c33' : '#1f883d') + '">' + rec.s + '</b> · ' +
      rec.m + ' · ' + rec.ms + 'ms · ' + (rec.type || '') + '</div>' +
      '<div style="font-size:11px;color:#333;word-break:break-all;margin-top:4px;background:#f6f8fa;padding:6px;border-radius:6px">' +
      esc(rec.u) + '</div>' +
      sec('请求头', rec.reqH) + sec('请求体', rec.reqB) +
      sec('响应头', rec.resH) + sec('响应内容', rec.resB) +
      '<div style="display:flex;gap:6px;margin-top:10px">' +
      '<button class="vt_btn" id="ad_copy" style="margin:0;flex:1">复制 URL</button>' +
      '<button class="vt_btn ghost" id="ad_copyb" style="margin:0;flex:1">复制响应</button></div>' +
      '<div style="display:flex;gap:6px;margin-top:6px">' +
      '<button class="vt_btn ghost" id="ad_open" style="margin:0;flex:1">新标签打开</button>' +
      '<button class="vt_btn ghost" id="ad_close" style="margin:0;flex:1">关闭</button></div>';
    var win = makeSmallWin('vt_apidet', '🔍 请求详情', html, { w: 320 });
    var d = win.box;
    bindClose(win, '#ad_close');
    $('#ad_copy', d).onclick = function () { copyText(rec.u); toast('URL 已复制'); };
    $('#ad_copyb', d).onclick = function () { copyText(rec.resB || ''); toast('响应已复制'); };
    $('#ad_open', d).onclick = function () {
      if (/^https?:/i.test(rec.u || '')) window.open(rec.u, '_blank');
      else toast('非网页链接，无法直接打开');
    };
  }

  // ==========================================================================
  // 多语翻译
  // ==========================================================================
  var LANGS = [
    { c: 'zh-Hans', f: '🇨🇳', n: '中文' }, { c: 'en', f: '🇬🇧', n: '英语' },
    { c: 'ja', f: '🇯🇵', n: '日语' }, { c: 'ru', f: '🇷🇺', n: '俄语' },
    { c: 'ko', f: '🇰🇷', n: '韩语' }, { c: 'fr', f: '🇫🇷', n: '法语' },
    { c: 'de', f: '🇩🇪', n: '德语' }, { c: 'es', f: '🇪🇸', n: '西语' }
  ];
  var trCache = {};
  try { trCache = JSON.parse(localStorage.getItem('vt_trcache') || '{}'); } catch (e) {}
  function trSet(k, v) { trCache[k] = v; try { localStorage.setItem('vt_trcache', JSON.stringify(trCache)); } catch (e) {} }
  /* ★ 引擎预探测：先花几秒测出哪个源通，之后所有段落都走它。
   * 之前卡在"0/8"就是因为每段都盲等 12 秒超时才换源。 */
  var engineOK = null;          // 'jsonp' | 'edge' | 'google' | null
  var engineProbing = null;
  function probeEngine() {
    if (engineOK) return Promise.resolve(engineOK);
    if (engineProbing) return engineProbing;
    var probe = 'Hello world';
    var jobs = [
      trJsonp(probe, 'zh-Hans').then(function () { return 'jsonp'; }),
      trEdge(probe, 'zh-Hans').then(function () { return 'edge'; }),
      trGoogle(probe, 'zh-Hans').then(function () { return 'google'; })
    ];
    engineProbing = new Promise(function (resolve) {
      var left = jobs.length, got = null;
      jobs.forEach(function (p) {
        p.then(function (name) {
          if (!got) { got = name; engineOK = name; resolve(name); }
          if (--left === 0 && !got) { engineOK = null; resolve(null); }
        }, function () {
          if (--left === 0 && !got) { engineOK = null; resolve(null); }
        });
      });
      setTimeout(function () { if (!got) { engineOK = null; resolve(null); } }, 9000);
    });
    return engineProbing;
  }

  var _jwt = null;
  function edgeToken() {
    if (_jwt) return Promise.resolve(_jwt);
    return fetchT('https://edge.microsoft.com/translate/auth', 8000).then(function (r) { return r.text(); })
      .then(function (t) { _jwt = String(t).trim(); return _jwt; });
  }
  function trEdge(text, to) {
    return edgeToken().then(function (jwt) {
      return fetchT('https://api-edge.cognitive.microsofttranslator.com/translate?api-version=3.0&to=' + to, 8000, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ Text: text }])
      });
    }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) {
        var s = j && j[0] && j[0].translations && j[0].translations[0] && j[0].translations[0].text;
        if (!s) throw new Error('empty'); return s;
      });
  }
  function trGoogle(text, to) {
    return fetchT('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + to + '&dt=t&q=' + encodeURIComponent(text), 10000)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) {
        var o = '';
        if (j && j[0]) for (var i = 0; i < j[0].length; i++) if (j[0][i] && j[0][i][0]) o += j[0][i][0];
        if (!o) throw new Error('empty'); return o;
      });
  }
  // —— JSONP 方式调 Google 翻译：<script> 标签不受 CORS 限制，这是最关键的一招
  function trJsonp(text, to) {
    return new Promise(function (res, rej) {
      var cb = 'vtcb' + Date.now() + Math.floor(Math.random() * 10000);
      var s = document.createElement('script');
      var timer = setTimeout(function () { clean(); rej(new Error('timeout')); }, 5000);
      function clean() {
        clearTimeout(timer);
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        try { if (s.parentNode) s.parentNode.removeChild(s); } catch (e) {}
      }
      window[cb] = function (data) {
        clean();
        var out = '';
        try {
          if (typeof data === 'string') out = data;
          else if (Array.isArray(data)) {
            // 可能是 ["译文"] / [["译","原文"]] / ["译文","auto",...]
            if (typeof data[0] === 'string') out = data[0];
            else if (Array.isArray(data[0])) {
              for (var i = 0; i < data.length; i++) {
                if (data[i] && typeof data[i][0] === 'string') out += data[i][0];
              }
            }
          }
        } catch (e) {}
        out ? res(out) : rej(new Error('empty'));
      };
      s.onerror = function () { clean(); rej(new Error('net')); };
      s.src = 'https://translate.googleapis.com/translate_a/t?client=gtx&sl=auto&tl=' +
        encodeURIComponent(to) + '&callback=' + cb + '&q=' + encodeURIComponent(String(text).slice(0, 1800));
      try { document.head.appendChild(s); } catch (e) { clean(); rej(e); }
    });
  }

  // —— 兜底：页面内弹出小窗嵌翻译网页（不跳转、不离开当前页）
  function trIframeWin(text, to) {
    var url = 'https://m.youdao.com/translate?inputtext=' + encodeURIComponent(String(text).slice(0, 900)) + '&type=AUTO';
    var html =
      '<div style="font-size:11px;color:#666;max-height:60px;overflow:auto;background:#f6f8fa;' +
      'padding:6px;border-radius:6px;word-break:break-word">' + esc(String(text).slice(0, 200)) + '…</div>' +
      '<iframe src="' + esc(url) + '" style="width:100%;height:230px;border:0;margin-top:6px;border-radius:8px"></iframe>' +
      '<div style="display:flex;gap:6px;margin-top:6px">' +
      '<button class="vt_btn" id="trw_copy" style="margin:0;flex:1">复制原文</button>' +
      '<button class="vt_btn ghost" id="trw_x" style="margin:0;flex:1">关闭</button></div>';
    // ★ 也用右下角小窗（原来 left:6 right:6 全屏遮住页面）
    var win = makeSmallWin('vt_trwin', '🌐 页内翻译小窗', html, { w: 320 });
    var w = win.box;
    bindClose(win, '#trw_x');
    $('#trw_copy', w).onclick = function () {
      copyText(String(text));
      toast('原文已复制');
    };
    toast('翻译接口不通，已用页内小窗兜底', 3000);
  }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).catch(function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = t; ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
    }
  }
  function smartTr(text, to) {
    var key = to + '|' + text;
    if (trCache[key]) return Promise.resolve(trCache[key]);
    var src = String(text || '').trim();
    if (!src) return Promise.reject(new Error('empty'));
    // 手动指定引擎时按用户选择
    var forced = (cfg.trans.engine === 'edge') ? 'edge'
      : (cfg.trans.engine === 'google') ? 'google' : null;

    function doOne(e) {
      if (e === 'jsonp') return trJsonp(src, to);
      if (e === 'edge') return trEdge(src, to);
      if (e === 'google') return trGoogle(src, to);
      return Promise.reject(new Error('win'));
    }
    function seqRun(seq) {
      var i = 0;
      function run() {
        if (i >= seq.length) return Promise.reject(new Error('fail'));
        var e = seq[i]; i++;
        return doOne(e).then(function (o) {
          if (o) { trSet(key, o); return o; }
          throw new Error('empty');
        }, function () {
          if (e === 'win') { trIframeWin(src, to); throw new Error('win'); }
          return run();
        });
      }
      return run();
    }
    // 自动模式：先探测，通了就直奔它，避免每段盲等超时
    if (!forced) {
      return probeEngine().then(function (name) {
        if (name) {
          return doOne(name).then(function (o) {
            if (o) { trSet(key, o); return o; }
            return seqRun(['jsonp', 'edge', 'google', 'win']);
          }, function () { return seqRun(['jsonp', 'edge', 'google', 'win']); });
        }
        return seqRun(['jsonp', 'edge', 'google', 'win']);
      });
    }
    return seqRun([forced, 'jsonp', 'edge', 'google', 'win']);
  }
  var transRunning = false;
  function pickFirstText() {
    var sel = getSelection && String(getSelection().toString() || '').trim();
    if (sel && sel.length > 2) return sel;
    var root = $('article') || $('main') || $('#content') || document.body;
    var p = $$('p,h1,h2,h3,li', root).filter(function (el) {
      var t = (el.innerText || el.textContent || '').trim();
      return t.length > 12 && t.length < 500 && !(el.closest && el.closest('.vt_panel,.vt_sheet'));
    })[0];
    return p ? (p.innerText || p.textContent || '').trim().slice(0, 500) : (document.title || location.hostname);
  }
  /* ------------------------------------------------------------------
   * 整页翻译 —— 按「沉浸式翻译」的标准做法重写
   *   ① TreeWalker 遍历全部文本节点（不再只挑 p/h/li，所以不会漏）
   *   ② 先给排除区打标记，遍历时 FILTER_REJECT 整棵子树跳过
   *   ③ 按"最近块级祖先"归并成段落，整段翻译（上下文连贯 + 请求数少）
   *   ④ 分块 + 限并发（浏览器同域名并发上限 6，不能 Promise.all 一把梭）
   *   ⑤ 不改原文 nodeValue，在块元素末尾 append 译文节点 → 双语对照
   * ------------------------------------------------------------------ */

  // ① 排除区选择器
  var TR_EXCLUDE = ['script', 'style', 'noscript', 'pre', 'code', 'kbd', 'samp', 'svg', 'canvas',
    'textarea', 'input', 'select', 'option', 'math', 'iframe',
    '.vt_panel', '.vt_fab', '.vt_sheet', '.vt_apilog', '.vt_toast', '#vt_trwin',
    '[translate="no"]', '.notranslate', '[data-vt-tr-line]'];
  var EX_ATTR = 'data-vt-no';

  function markExclude(root) {
    try {
      $$(TR_EXCLUDE.join(',')).forEach(function (el) { el.setAttribute(EX_ATTR, '1'); });
    } catch (e) {}
  }
  function unmarkExclude() {
    try { $$('[' + EX_ATTR + ']').forEach(function (el) { el.removeAttribute(EX_ATTR); }); } catch (e) {}
  }

  // ② 收集文本节点
  // 拉丁字母 / 西里尔 / 日文假名 / CJK 汉字 / 韩文 / 阿拉伯 / 希伯来
  var HAS_LETTER_RE = /[A-Za-z\u00C0-\u024F\u0370-\u04FF\u0400-\u04FF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\u0600-\u06FF\u0590-\u05FF]/;
  function collectTextNodes(root) {
    var out = [];
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: function (n) {
        if (n.nodeType === Node.ELEMENT_NODE) {
          // 被标记的：连子树一起拒绝
          if (n.getAttribute && n.getAttribute(EX_ATTR)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_SKIP;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }, false);
    var n;
    while ((n = w.nextNode())) {
      var t = (n.nodeValue || '').trim();
      if (!t) continue;
      /* ★ 只要含"可读文字"就收进来——按钮、标签、小卡片上的短文字
       * （"小方形"）也要在下面出译文，不能因为短就跳过。
       *
       * ⚠ 注意：不能用 /^[\s\d\W_]+$/ 判断"纯符号"——中文、日文、俄文
       * 全部属于 \W，会把整个中文页面当成符号跳过（这是个隐蔽大坑）。
       * 改为正向判断：必须至少含一个字母或 CJK/西里尔/假名字符。 */
      if (!HAS_LETTER_RE.test(t)) continue;
      if (!n.parentElement) continue;
      var cs = getComputedStyle(n.parentElement);
      if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) continue;
      out.push(n);
    }
    return out;
  }

  var BLOCK_RE = /^(DIV|P|LI|TD|TH|H1|H2|H3|H4|H5|H6|BLOCKQUOTE|ARTICLE|SECTION|SPAN|A|DD|DT|FIGCAPTION|SUMMARY|LABEL|BUTTON|STRONG|EM|B|I|FONT)$/;
  function isBlockEl(el) {
    if (!el) return false;
    var cs;
    try { cs = getComputedStyle(el); } catch (e) { return false; }
    if (!cs) return false;
    return cs.display.indexOf('inline') !== 0;
  }
  // 向上找"段落容器"：第一个块级祖先，但不要太往上（避免整页合成一段）
  function blockAncestor(node) {
    var el = node.parentElement, guard = 0;
    while (el && guard++ < 6) {
      if (!el.getAttribute || el.getAttribute(EX_ATTR)) break;
      if (el.tagName === 'BODY') break;
      if (BLOCK_RE.test(el.tagName) && isBlockEl(el)) {
        // 元素太大说明是容器不是段落，再往上或就用它
        var r = el.getBoundingClientRect();
        if (r.height > window.innerHeight * 1.6 || r.width > window.innerWidth * 1.2) {
          el = el.parentElement; continue;
        }
        return el;
      }
      el = el.parentElement;
    }
    // ★ 兜底：退回直接父元素，绝不返回 null（否则这段文字就漏翻了）
    return node.parentElement;
  }

  // ③ 归并成段落
  function buildParagraphs(nodes) {
    var map = [], order = [];
    nodes.forEach(function (n) {
      var key = blockAncestor(n);
      if (!key) return;
      if (key.tagName === 'BODY') key = n.parentElement;   // ★ 不再丢弃
      if (!key) return;
      if (key.dataset.vtTr === '1') return;
      var idx = order.indexOf(key);
      if (idx < 0) { order.push(key); map.push({ el: key, text: '' }); idx = order.length - 1; }
      map[idx].text += (map[idx].text ? ' ' : '') + (n.nodeValue || '').trim();
    });
    return map.filter(function (p) {
      p.text = p.text.replace(/\s+/g, ' ').trim();
      // 门槛放低到 1 个字符（中文单字也有意义），上限仍限制避免超长请求
      return p.text.length >= 1 && p.text.length <= 1200;
    });
  }

  /* ★ 译文插入锚点：line 是块级 div，绝不能直接插进 inline 元素
   * （SPAN/A/BUTTON 等）的父容器——那会产生非法 HTML 被浏览器重排/吞掉。
   * 做法：若目标本身是 inline，就一路向上找"最近的块级祖先"，
   * 把译文插到那个块级祖先之后。 */
  function nearestBlock(el) {
    var cur = el, guard = 0;
    while (cur && guard++ < 8) {
      if (cur.tagName === 'BODY' || cur.tagName === 'HTML') return cur;
      if (isBlockEl(cur)) return cur;
      cur = cur.parentElement;
    }
    return el;
  }
  function insertLineAfter(el, line) {
    try {
      var anchor = isBlockEl(el) ? el : nearestBlock(el);
      var par = anchor.parentNode;
      if (par) par.insertBefore(line, anchor.nextSibling);
      else anchor.appendChild(line);
    } catch (e) {
      try { el.appendChild(line); } catch (e2) {}
    }
  }

  // ④ 限并发调度器（避免浏览器同域名并发超限导致 Failed to fetch）
  function runPool(tasks, limit, onOne) {
    return new Promise(function (resolve) {
      var i = 0, running = 0, results = [];
      if (!tasks.length) return resolve(results);
      function next() {
        while (running < limit && i < tasks.length) {
          var cur = i++; running++;
          Promise.resolve()
            .then(function () { return tasks[cur](); })
            .catch(function (e) { return null; })
            .then(function (r) {
              results[cur] = r;
              running--;
              if (onOne) onOne(r);
              if (results.filter(function (x) { return x !== undefined; }).length === tasks.length) resolve(results);
              else next();
            });
        }
      }
      next();
    });
  }

  var transAbort = false;
  // 重译：清掉旧的译文行与"已翻"标记，让所有段落重新参与翻译
  function resetTransMarks() {
    $$('[data-vt-tr-line]').forEach(function (e) { e.remove(); });
    $$('[data-vt-tr]').forEach(function (e) { delete e.dataset.vtTr; });
  }
  function translatePage(force) {
    if (transRunning) { toast('正在翻译中'); return; }
    var langs = cfg.trans.langs.filter(function (c) { return LANGS.some(function (l) { return l.c === c; }); });
    if (!langs.length) { toast('请先在齿轮里选翻译语言'); return; }

    /* ★ 改了语言再点「整页翻译」必须能生效：
     * 之前翻过的段落都带着 data-vt-tr="1"，会被 buildParagraphs 直接跳过，
     * 导致"改语言→重译"永远没反应。这里先清标记再翻。 */
    if (force !== false) resetTransMarks();

    markExclude();
    var nodes = collectTextNodes(document.body);
    var paras = buildParagraphs(nodes);
    unmarkExclude();
    if (!paras.length) { toast('没找到可翻译的文字'); return; }

    transRunning = true; transAbort = false;
    var prog = document.createElement('div');
    prog.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:160px;z-index:2147483500;' +
      'background:rgba(18,20,24,.92);color:#fff;padding:8px 14px;border-radius:16px;font-size:12px;pointer-events:none;' +
      'display:flex;gap:8px;align-items:center';
    prog.innerHTML = '<span id="vt_tp">翻译中 0/' + paras.length + '</span>' +
      '<span id="vt_tstop" style="color:#ff8a80;cursor:pointer;pointer-events:auto">停止</span>';
    document.body.appendChild(prog);
    $('#vt_tstop').onclick = function () { transAbort = true; toast('正在停止…'); };

    var done = 0, fail = 0, total = paras.length;
    var tasks = paras.map(function (p) {
      return function () {
        if (transAbort) return null;
        // 多语：并行取，但每语之间错开 120ms，降低被限流概率
        return Promise.all(langs.map(function (lc, li) {
          return new Promise(function (res) {
            setTimeout(function () {
              smartTr(p.text, lc).then(res, function () { res(''); });
            }, li * 120);
          });
        })).then(function (outs) {
          var html = outs.map(function (o, i) {
            if (!o) return '';
            var L = LANGS.filter(function (x) { return x.c === langs[i]; })[0];
            return '<span style="margin-right:7px;white-space:normal">' + L.f + '<b>' + L.n + '</b>：' +
              esc(String(o).slice(0, 400)) + '</span>';
          }).join('');
          if (!html) { fail++; return false; }
          var line = document.createElement('div');
          line.dataset.vtTrLine = '1';
          line.setAttribute(EX_ATTR, '1');
          line.style.cssText = 'margin:3px 0 8px;padding:4px 7px;font-size:11px;line-height:1.6;' +
            'color:#5a6470;background:rgba(127,127,127,.10);border-left:2px solid ' + (cfg.uiColor || '#4a9eff') + ';' +
            'border-radius:0 5px 5px 0;word-break:break-word;-webkit-user-select:text;user-select:text';
          line.innerHTML = html;
          p.el.dataset.vtTr = '1';
          if (!cfg.trans.show) line.style.display = 'none';
          insertLineAfter(p.el, line);
          return true;
        }).catch(function () { fail++; return false; });
      };
    });

    runPool(tasks, 3, function () {
      done++;
      var lb = $('#vt_tp');
      if (lb) lb.textContent = '翻译中 ' + Math.min(done, total) + '/' + total;
    }).then(function (res) {
      transRunning = false;
      setTimeout(function () { if (prog.parentNode) prog.parentNode.removeChild(prog); }, 700);
      var ok = res.filter(function (x) { return x === true; }).length;
      if (ok === 0) {
        toast('翻译接口全不通，已打开页内小窗', 3200);
        trIframeWin(paras[0] ? paras[0].text : document.title, langs[0]);
      } else if (transAbort) {
        toast('已停止，已翻 ' + ok + ' 段');
      } else {
        toast('✅ 已为 ' + ok + ' 段加注' + (fail ? '（' + fail + ' 段失败）' : ''), 3000);
      }
    });
  }
  // 翻译开关：切换已有译文行的显示/隐藏（不删除，随时可切回）
  function toggleTransShow() {
    cfg.trans.show = !cfg.trans.show; save();
    $$('[data-vt-tr-line]').forEach(function (e) {
      e.style.display = cfg.trans.show ? '' : 'none';
    });
    toast('译文显示：' + (cfg.trans.show ? '开' : '关'));
    refreshPanel();
  }
  function clearTranslate() {
    $$('[data-vt-tr-line]').forEach(function (e) { e.remove(); });
    $$('[data-vt-tr]').forEach(function (e) { delete e.dataset.vtTr; });
    unmarkExclude();
    toast('已清除翻译');
  }

  // ==========================================================================
  // 加速 / 反色 / 深色
  // ==========================================================================
  /* ★ 加速模式：不再无差别删 <script> / <iframe>。
   *  - 删已执行的 <script> 元素毫无意义（代码早已跑完），还会破坏 SPA 的
   *    dynamic import / document.currentScript，React/Vue 页面直接作废
   *  - 删 <iframe> 会让视频、评论、登录、支付、地图全失效
   * 改为：只掐广告/统计相关的 iframe 与尚未执行的外链脚本。 */
  var SPEED_IFRAME_HOSTS = ['googlesyndication', 'doubleclick', 'adservice', 'googleadservices',
    'pos.baidu', 'cbjs.baidu', 'tanx', 'adnxs', 'amazon-adsystem', 'union.mobile.qq'];
  function setSpeed(on) {
    cfg.speed = on; save();
    if (on) {
      // 只删广告类 iframe
      $$('iframe').forEach(function (e) {
        if (e.closest && e.closest('.vt_panel,.vt_fab,.vt_sheet')) return;
        var u = e.src || '';
        for (var i = 0; i < SPEED_IFRAME_HOSTS.length; i++) {
          if (u.indexOf(SPEED_IFRAME_HOSTS[i]) > -1) { try { e.remove(); } catch (er) {} return; }
        }
      });
      // 只移除"尚未执行"的外链脚本（src 存在且未加载完），内联/已执行的一律不动
      $$('script[src]').forEach(function (s) {
        if (s.dataset.vtRan === '1') return;
        var u = s.src || '';
        var isAd = false;
        for (var i = 0; i < SPEED_IFRAME_HOSTS.length; i++) { if (u.indexOf(SPEED_IFRAME_HOSTS[i]) > -1) { isAd = true; break; } }
        if (isAd || /analytics|track|beacon|hotjar|sentry/i.test(u)) { try { s.remove(); } catch (er) {} }
      });
      // 装饰性大 SVG
      $$('svg').forEach(function (e) {
        var r = e.getBoundingClientRect();
        if (r.width > 300 || r.height > 300) { try { e.remove(); } catch (er) {} }
      });
      if (!$('#vt_speed')) {
        var st2 = document.createElement('style'); st2.id = 'vt_speed';
        st2.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
        document.head.appendChild(st2);
      }
      $$('video').forEach(function (v) { v.removeAttribute('autoplay'); try { v.pause(); } catch (e) {} });
      toast('⚡ 加速已开（仅掐广告脚本，页面功能保留）');
    } else {
      var st = $('#vt_speed'); if (st) st.remove();
      toast('已关闭，刷新恢复完整功能');
    }
    refreshPanel();
  }
  function setInvert(on) {
    cfg.invert = on; save();
    var ov = $('#vt_invert');
    if (on) {
      if (!ov) {
        ov = document.createElement('div'); ov.id = 'vt_invert';
        ov.style.cssText = 'position:fixed;inset:0;z-index:2147482900;pointer-events:none;background:#fff;mix-blend-mode:difference;';
        document.body.appendChild(ov);
      }
      toast('反色已开');
    } else { if (ov) ov.remove(); toast('反色已关'); }
    refreshPanel();
  }
  function setDark(on) {
    cfg.dark = on; save();
    var s = $('#vt_dark');
    if (on) {
      if (!s) {
        s = document.createElement('style'); s.id = 'vt_dark';
        s.textContent = 'html.vt_dark body,html.vt_dark div,html.vt_dark section,html.vt_dark article,' +
          'html.vt_dark header,html.vt_dark footer,html.vt_dark nav,html.vt_dark main,html.vt_dark aside,' +
          'html.vt_dark ul,html.vt_dark ol,html.vt_dark li,html.vt_dark p,html.vt_dark span,html.vt_dark td,' +
          'html.vt_dark th,html.vt_dark table,html.vt_dark h1,html.vt_dark h2,html.vt_dark h3,html.vt_dark h4,' +
          'html.vt_dark h5,html.vt_dark h6,html.vt_dark label,html.vt_dark input,html.vt_dark textarea,' +
          'html.vt_dark button,html.vt_dark pre{background-color:#121417!important;color:#d3d8de!important;border-color:#2a2f36!important}' +
          'html.vt_dark a{color:#6cb6ff!important}html.vt_dark img,html.vt_dark video{opacity:.86}';
        document.head.appendChild(s);
      }
      document.documentElement.classList.add('vt_dark');
      toast('深色已开');
    } else { document.documentElement.classList.remove('vt_dark'); toast('深色已关'); }
    refreshPanel();
  }
  function restorePage() {
    var st = ['#vt_lg', '#vt_speed', '#vt_dark', '#vt_bili', '#vt_wp'];
    st.forEach(function (id) { var e = $(id); if (e) e.remove(); });
    var ov = $('#vt_invert'); if (ov) ov.remove();
    document.documentElement.classList.remove('vt_dark');
    $$('[data-vt-tr-line]').forEach(function (e) { e.remove(); });
    cfg.speed = false; cfg.invert = false; cfg.dark = false; cfg.biliOpt = false; save();
    toast('已还原样式，正在重载页面…');
    setTimeout(function () { location.reload(); }, 600);
  }

  // ==========================================================================
  // 收藏夹
  // ==========================================================================
  var FAV_MAX = 200;
  function favList() { try { return JSON.parse(localStorage.getItem(LS_FAV) || '[]'); } catch (e) { return []; } }
  /* ★ 收藏上限：到达上限时明确提示，不再静默丢数据 */
  function favSave(l) {
    try { localStorage.setItem(LS_FAV, JSON.stringify(l)); } catch (e) { toast('保存失败：存储空间不足'); }
  }
  function favAdd(item) {
    var l = favList();
    var idx = -1;
    for (var i = 0; i < l.length; i++) if (l[i] && l[i].url === item.url) { idx = i; break; }
    if (idx > -1) {
      // 已存在：更新标题（网站改标题后不会一直显示旧的）
      l[idx].title = item.title || l[idx].title;
      l[idx].t = Date.now();
      favSave(l);
      return { ok: true, dup: true };
    }
    if (l.length >= FAV_MAX) {
      toast('收藏夹已满（' + FAV_MAX + ' 条），请先删一些再收藏');
      return { ok: false, full: true };
    }
    l.unshift(item);
    favSave(l);
    return { ok: true };
  }
  function showFav() {
    if ($('#vt_fav')) { $('#vt_fav').remove(); return; }
    var list = favList(), cur = location.href;
    var h = '<div style="font-size:11px;color:#666;word-break:break-all;background:#f6f8fa;padding:6px;border-radius:6px;margin-bottom:6px">当前：' + esc(cur) + '</div>' +
      '<button class="vt_btn" id="fv_add">＋ 收藏当前网页</button>' +
      '<button class="vt_btn ghost" id="fv_list">📂 我的收藏（' + list.length + '）</button>' +
      '<div id="fv_sub" style="display:none;margin-top:6px"></div>';
    var win = makeSmallWin('vt_fav', '🔖 收藏夹', h, { w: 300 });
    var box = win.box;
    $('#fv_add', box).onclick = function () {
      var r = favAdd({ url: cur, title: document.title || cur, t: Date.now() });
      if (r.dup) { toast('已收藏过，标题已更新'); win.close(); showFav(); return; }
      if (!r.ok) return;                 // 已满，favAdd 内已提示
      toast('✅ 已收藏'); win.close(); showFav();
    };
    $('#fv_list', box).onclick = function () {
      var sub = $('#fv_sub', box);
      if (sub.style.display === 'block') { sub.style.display = 'none'; return; }
      var l = favList();
      if (!l.length) { sub.innerHTML = '<div style="font-size:12px;color:#999;padding:8px">还没有收藏</div>'; sub.style.display = 'block'; return; }
      sub.innerHTML = l.map(function (f, i) {
        return '<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid #f0f0f0">' +
          '<div style="flex:1;min-width:0"><a href="' + esc(f.url) + '" style="font-size:12px;color:#0969da;text-decoration:none;' +
          'display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(f.title) + '</a>' +
          '<div style="font-size:10px;color:#999;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(f.url) + '</div></div>' +
          '<button data-o="' + i + '" style="flex:none;padding:5px 8px;border:0;border-radius:7px;background:var(--vt-theme,#4a9eff);color:#fff;font-size:11px">打开</button>' +
          '<button data-d="' + i + '" style="flex:none;padding:5px 7px;border:0;border-radius:7px;background:#f0f2f5;color:#c33;font-size:11px">删</button></div>';
      }).join('');
      sub.style.display = 'block';
      $$('[data-o]', sub).forEach(function (b) { b.onclick = function () { location.href = favList()[+b.getAttribute('data-o')].url; }; });
      $$('[data-d]', sub).forEach(function (b) {
        b.onclick = function () { var l = favList(); l.splice(+b.getAttribute('data-d'), 1); favSave(l); win.close(); showFav(); };
      });
    };
  }

  // ==========================================================================
  // 主面板（右侧竖向窄条）
  // ==========================================================================
  function panelItems() {
    return [
      { t: '上滚', cls: 'act', fn: function () { window.scrollBy({ top: -window.innerHeight * 0.85, behavior: 'smooth' }); } },
      { t: '下滚', cls: 'act', fn: function () { window.scrollBy({ top: window.innerHeight * 0.85, behavior: 'smooth' }); } },
      { t: '导入壁纸', fn: importWallpaper },
      { t: 'B站一键优化', state: function () { return cfg.biliOpt; }, lbl: function (v) { return v ? '(开)' : '(关)'; }, fn: biliOptimize },
      { t: 'B站屏幕弹窗', fn: biliPopPlayer },
      { t: '玻璃Dock', state: function () { return !!cfg.biliDock; }, lbl: function (v) { return v ? '(开)' : '(关)'; }, fn: function () {
        cfg.biliDock = !cfg.biliDock; save();
        var d = $('#vt_bili_dock');
        if (!cfg.biliDock) {
          if (d) { if (d.__vtUnbind) d.__vtUnbind(); d.remove(); }
          toast('玻璃Dock：关');
        } else {
          buildBiliDock(isBiliMobile());
          toast('玻璃Dock：开');
        }
        refreshPanel();
      } },
      { t: 'HD分栏', state: function () { return !!cfg.biliHD; }, lbl: function (v) { return v ? '(开)' : '(关)'; }, fn: function () {
        if (!isBili()) { toast('当前不是 B 站页面'); return; }
        cfg.biliHD = !cfg.biliHD; save();
        if (!cfg.biliHD) {
          var h = $('#vt_bili_hd');
          if (h) {
            $$('[data-vt-hd]', h).forEach(function (e) { delete e.dataset.vtHd; });
            h.remove();
          }
          toast('HD分栏：关（刷新页面恢复原布局）');
        } else {
          $$('[data-vt-hd]').forEach(function (e) { delete e.dataset.vtHd; });
          var h2 = $('#vt_bili_hd'); if (h2) h2.remove();
          applyBiliHD();
          toast($('#vt_bili_hd') ? '✅ HD分栏：开' : '未找到播放器，稍后自动重试');
        }
        refreshPanel();
      } },
      { t: '必应液态玻璃', state: function () { return cfg.lg.sites.bing; }, lbl: function (v) { return v ? '(开)' : '(关)'; }, fn: function () { cfg.lg.sites.bing = !cfg.lg.sites.bing; save(); applyLiquidGlass(); refreshPanel(); toast('必应玻璃：' + (cfg.lg.sites.bing ? '开' : '关')); } },
      { t: 'B站液态玻璃', state: function () { return cfg.lg.sites.bili; }, lbl: function (v) { return v ? '(开)' : '(关)'; }, fn: function () { cfg.lg.sites.bili = !cfg.lg.sites.bili; save(); applyLiquidGlass(); refreshPanel(); toast('B站玻璃：' + (cfg.lg.sites.bili ? '开' : '关')); } },
      { t: '全站液态玻璃', state: function () { return cfg.lg.sites.all; }, lbl: function (v) { return v ? '(开)' : '(关)'; }, fn: function () { cfg.lg.sites.all = !cfg.lg.sites.all; save(); applyLiquidGlass(); refreshPanel(); toast('全站玻璃：' + (cfg.lg.sites.all ? '开' : '关')); } },
      { t: '关闭弹窗', fn: closePopups },
      { t: '去遮罩', fn: removeMasks },
      { t: '恢复页面', fn: restorePage },
      { t: '清广告', fn: function () { removeAds(); } },
      { t: '撤销清广告', fn: undoAds },
      { t: '导出HTML', fn: exportHTML },
      { t: '导出图片', fn: exportImages },
      { t: '复制链接', fn: copyLink },
      { t: '批量下载媒体', fn: batchDownloadMedia },
      { t: '抓包', fn: showApiLog },
      { t: '整页翻译', fn: function () { translatePage(true); } },
      { t: '重译全部', fn: function () { resetTransMarks(); translatePage(true); toast('已清空旧译文，重新翻译'); } },
      { t: '译文显示', state: function () { return cfg.trans.show; }, lbl: function (v) { return v ? '(开)' : '(关)'; }, fn: toggleTransShow },
      { t: '清除翻译', fn: clearTranslate },
      { t: '翻译小窗', fn: function () { trIframeWin(pickFirstText(), (cfg.trans.langs[0] || 'zh-Hans')); } },
      { t: '加速模式', state: function () { return cfg.speed; }, lbl: function (v) { return v ? '(开)' : '(关)'; }, fn: function () { setSpeed(!cfg.speed); } },
      { t: '反色', state: function () { return cfg.invert; }, lbl: function (v) { return v ? '(开)' : '(关)'; }, fn: function () { setInvert(!cfg.invert); } },
      { t: '深色', state: function () { return cfg.dark; }, lbl: function (v) { return v ? '(开)' : '(关)'; }, fn: function () { setDark(!cfg.dark); } },
      { t: '收藏夹', fn: showFav }
    ];
  }

  function buildPanel() {
    baseStyle();
    var p = $('#vt_panel');
    if (p) p.remove();
    p = document.createElement('div');
    p.id = 'vt_panel'; p.className = 'vt_panel';
    var x = cfg.panelX, y = cfg.panelY;
    if (x == null || y == null) { x = window.innerWidth - 116; y = Math.round(window.innerHeight * 0.16); }
    p.style.left = Math.max(0, Math.min(x, window.innerWidth - 106)) + 'px';
    p.style.top = Math.max(0, Math.min(y, window.innerHeight - 80)) + 'px';

    var head = document.createElement('div');
    head.className = 'vt_head';
    head.innerHTML = '<span style="letter-spacing:.3px">工具箱 <b style="color:var(--vt-theme,#4a9eff)">v4.13</b></span>' +
      '<span id="vt_close" style="cursor:pointer;font-weight:400;opacity:.7;font-size:13px;padding:0 2px">✕</span>';
    var body = document.createElement('div');
    body.className = 'vt_body';
    p.appendChild(head); p.appendChild(body);
    document.body.appendChild(p);

    /* ★ 标题栏拖动统一交给 makeDraggable：原来只监听 touch*，
     * 桌面浏览器用鼠标完全拖不动主面板。现在触摸 + 鼠标都支持。 */
    makeDraggable(p, head, function (x, y) {
      cfg.panelX = x; cfg.panelY = y; save();
    });

    $('#vt_close').onclick = function () {
      p.style.display = 'none';
      cfg.panelOpen = false; save();
      showRestoreBtn();
    };

    // 关闭后留一个小圆钮，点它把面板调回来
    function showRestoreBtn() {
      var r = $('#vt_restore');
      if (!r) {
        r = document.createElement('div');
        r.id = 'vt_restore'; r.className = 'vt_fab';
        r.textContent = '🧰';
        r.style.cssText = 'position:fixed;z-index:2147483250;width:38px;height:38px;border-radius:50%;' +
          'display:flex;align-items:center;justify-content:center;font-size:17px;color:#fff;' +
          'background:rgba(22,25,31,.9);border:1px solid rgba(255,255,255,.18);' +
          'box-shadow:0 3px 12px rgba(0,0,0,.35);cursor:pointer;user-select:none';
        document.body.appendChild(r);
        r.onclick = function () {
          p.style.display = '';
          r.style.display = 'none';
          cfg.panelOpen = true; save();
        };
        makeDraggable(r, r);
      }
      r.style.display = 'flex';
      r.style.left = (parseFloat(p.style.left) || window.innerWidth - 116) + 'px';
      r.style.top = (parseFloat(p.style.top) || 100) + 'px';
    }

    // 渲染按钮列表：buildPanel 与 refreshPanel 共用同一份实现，避免两处不同步
    window.__vtRenderItems = function (container) {
      if (!container) return;
      container.innerHTML = '';
      panelItems().forEach(function (it) {
        var b = document.createElement('button');
        b.className = 'vt_item' + (it.cls ? ' ' + it.cls : '');
        var label = it.t;
        if (it.state) {
          var v = it.state();
          label += it.lbl(v);
          if (v) b.classList.add('on');
        }
        b.textContent = label;
        b.onclick = function (e) { e.preventDefault(); it.fn(); };
        container.appendChild(b);
      });
    };
    window.__vtRenderItems(body);
    if (!cfg.panelOpen) { p.style.display = 'none'; showRestoreBtn(); }
  }
  function refreshPanel() {
    var p = $('#vt_panel');
    if (p && cfg.panelOpen && window.__vtRenderItems) {
      window.__vtRenderItems($('.vt_body', p));
    }
  }

  // ==========================================================================
  // 齿轮：设置面板
  // ==========================================================================
  function injectGear() {
    if ($('#vt_gear')) return;
    baseStyle();
    var g = document.createElement('div');
    g.id = 'vt_gear'; g.className = 'vt_fab';
    g.textContent = '⚙';
    g.style.background = cfg.uiColor;
    if (cfg.gearX != null) { g.style.left = cfg.gearX + 'px'; g.style.top = cfg.gearY + 'px'; }
    else { g.style.right = '10px'; g.style.bottom = '150px'; }
    g.onclick = function () { openSettings(); };
    document.body.appendChild(g);
    makeDraggable(g, g, function (x, y) { cfg.gearX = x; cfg.gearY = y; save(); });

    var up = document.createElement('div');
    up.id = 'vt_up'; up.className = 'vt_fab';
    up.textContent = '↑';
    up.style.background = '#2b8ae2';
    if (cfg.upX != null) { up.style.left = cfg.upX + 'px'; up.style.top = cfg.upY + 'px'; }
    else { up.style.right = '10px'; up.style.bottom = '204px'; }
    up.onclick = function () { window.scrollTo({ top: 0, behavior: 'smooth' }); };
    document.body.appendChild(up);
    makeDraggable(up, up, function (x, y) { cfg.upX = x; cfg.upY = y; save(); });
  }

  function openSettings() {
    if (cfg.pwd.on && cfg.pwd.value) {
      var pw = prompt('请输入访问密码');
      if (pw === null) return;
      if (pw !== cfg.pwd.value) { toast('密码不对'); return; }
    }
    if ($('#vt_set')) { $('#vt_set').remove(); return; }
    var win = makeSmallWin('vt_set', '⚙️ 设置', settingsHTML(), { w: 310 });
    bindSettings(win.box);
  }

  function settingsHTML() {
    var h = '';
    h += '<div class="vt_sec" style="margin-top:0;padding-top:0;border-top:0">💧 液态玻璃参数</div>';
    h += '<div class="vt_row"><span>透明度</span><input type="range" id="g_a" min="0.02" max="0.75" step="0.02" value="' + cfg.lg.alpha + '" style="width:130px"><b id="v_a">' + Math.round(cfg.lg.alpha * 100) + '%</b></div>';
    h += '<div class="vt_row"><span>模糊</span><input type="range" id="g_b" min="0" max="50" step="1" value="' + cfg.lg.blur + '" style="width:130px"><b id="v_b">' + cfg.lg.blur + 'px</b></div>';
    h += '<div class="vt_row"><span>饱和度</span><input type="range" id="g_s" min="100" max="300" step="10" value="' + cfg.lg.sat + '" style="width:130px"><b id="v_s">' + cfg.lg.sat + '%</b></div>';
    h += '<div class="vt_row"><span>圆角</span><input type="range" id="g_r" min="0" max="40" step="1" value="' + cfg.lg.radius + '" style="width:130px"><b id="v_r">' + cfg.lg.radius + 'px</b></div>';
    h += '<div class="vt_row"><span>玻璃色调</span><select id="g_tint" style="padding:5px;border-radius:7px">' +
      '<option value="light"' + (cfg.lg.tint === 'light' ? ' selected' : '') + '>浅色（iOS风）</option>' +
      '<option value="dark"' + (cfg.lg.tint === 'dark' ? ' selected' : '') + '>暗色玻璃</option></select></div>';
    h += '<div class="vt_row"><span>高光质感</span>' + swHTML(cfg.lg.gloss) + '</div>';

    h += '<div class="vt_sec">🌐 翻译语言</div><div>' +
      LANGS.map(function (l) {
        var on = cfg.trans.langs.indexOf(l.c) > -1;
        return '<span class="vt_tag' + (on ? ' on' : '') + '" data-lang="' + l.c + '">' + l.f + l.n + '</span>';
      }).join('') + '</div>';
    h += '<div class="vt_row"><span>引擎</span><select id="st_engine" style="padding:5px;border-radius:7px">' +
      '<option value="auto"' + (cfg.trans.engine === 'auto' ? ' selected' : '') + '>自动（推荐）</option>' +
      '<option value="edge"' + (cfg.trans.engine === 'edge' ? ' selected' : '') + '>Edge/Bing</option>' +
      '<option value="google"' + (cfg.trans.engine === 'google' ? ' selected' : '') + '>Google</option>' +
      '<option value="win"' + (cfg.trans.engine === 'win' ? ' selected' : '') + '>只用页内小窗</option></select></div>';
    h += '<div style="font-size:11px;color:#888">自动 = JSONP 直连 → Edge → Google，全不通则在页内弹小窗，不会跳走</div>';

    h += '<div class="vt_sec">🚫 广告规则库</div>';
    h += '<div class="vt_row"><span>启用广告拦截</span>' + swHTML(cfg.adblock.on) + '</div>';
    h += '<div class="vt_row"><span>激进模式</span>' + swHTML(cfg.adblock.aggressive) + '</div>';

    h += '<div class="vt_sec">📡 抓包（默认开启 · 进页面即弹窗）</div>';
    h += '<div class="vt_row"><span>启用抓包挂钩</span>' + swHTML(cfg.apiLogOn !== false) + '</div>';
    h += '<div class="vt_row"><span>进页面自动弹窗</span>' + swHTML(cfg.apiLogAuto !== false) + '</div>';
    h += '<div style="font-size:11px;color:#888">挂钩越早抓到的请求越多，脚本在页面请求发出前就已接管。刷新页面生效。</div>';

    h += '<div class="vt_sec">📺 B站增强（默认全部开启）</div>';
    h += '<div class="vt_row"><span>B站一键优化</span>' + swHTML(!!cfg.biliOpt) + '</div>';
    h += '<div class="vt_row"><span>底部玻璃Dock</span>' + swHTML(!!cfg.biliDock) + '</div>';
    h += '<div class="vt_row"><span>HD分栏（左视频右面板）</span>' + swHTML(!!cfg.biliHD) + '</div>';
    h += '<div style="font-size:11px;color:#888">开关仅对 bilibili.com 生效；改动后在 B站页面刷新即可看到。</div>';

    h += '<div class="vt_sec">🎨 外观</div>';
    h += '<div class="vt_row"><span>主题色</span><input type="color" id="st_color" value="' + cfg.uiColor + '" style="width:44px;height:30px;border:0;background:none"></div>';
    h += '<div>' + ['#4a9eff', '#8a5cf6', '#e5457b', '#1f883d', '#e5822a', '#111827'].map(function (c) {
      return '<span class="vt_tag" data-color="' + c + '" style="background:' + c + ';color:#fff">色</span>';
    }).join('') + '</div>';

    var wpNow = wpLoad();
    h += '<div class="vt_sec">🖼 壁纸</div>';
    h += '<div style="font-size:11px;color:#888;line-height:1.6">' +
      (wpNow
        ? (wpNow.indexOf('data:') === 0
            ? '已保存：本地图片（约 ' + kbOf(wpNow) + 'KB）'
            : '已保存：网址 ' + esc(wpNow.slice(0, 40)))
        : '未设置壁纸') +
      '<br><span style="color:#b8860b">注意：数据按「网站域名」分别存储，换一个网站需要重新设置</span></div>';
    h += '<button class="vt_btn ghost" id="st_wpclear">清除壁纸</button>';

    h += '<div class="vt_sec">🔒 密码</div>';
    h += '<div class="vt_row"><span>密码访问</span>' + swHTML(cfg.pwd.on) + '</div>';
    h += '<button class="vt_btn ghost" id="st_pwd">设置 / 修改密码</button>';
    h += '<button class="vt_btn ghost" id="st_reset" style="margin-top:10px">恢复全部默认</button>';
    h += '<div style="font-size:11px;color:#999;text-align:center;margin-top:8px">Via 全能工具箱 v4.3 · 页面内运行</div>';
    return h;
  }
  function swHTML(on) { return '<div class="vt_sw' + (on ? ' on' : '') + '"><i></i></div>'; }

  function bindSettings(box) {
    // 关闭按钮：直接调用小窗的 close（会一并解绑拖动监听）
    var cx = $('#st_x', box);
    if (cx) cx.onclick = function () {
      if (box.__vtCloseWin) box.__vtCloseWin();
      else box.remove();
    };
    function rng(id, vid, key, fmt) {
      var el = $('#' + id, box), lb = $('#' + vid, box);
      if (!el) return;
      el.oninput = function () {
        var v = parseFloat(el.value); cfg.lg[key] = v; save();
        lb.textContent = fmt(v); applyLiquidGlass();
      };
    }
    rng('g_a', 'v_a', 'alpha', function (v) { return Math.round(v * 100) + '%'; });
    rng('g_b', 'v_b', 'blur', function (v) { return v + 'px'; });
    rng('g_s', 'v_s', 'sat', function (v) { return v + '%'; });
    rng('g_r', 'v_r', 'radius', function (v) { return v + 'px'; });

    $$('[data-lang]', box).forEach(function (t) {
      t.onclick = function () {
        var c = t.getAttribute('data-lang'), i = cfg.trans.langs.indexOf(c);
        if (i > -1) cfg.trans.langs.splice(i, 1); else cfg.trans.langs.push(c);
        save(); t.classList.toggle('on', i < 0);
      };
    });
    var eg = $('#st_engine', box);
    if (eg) eg.onchange = function () { cfg.trans.engine = eg.value; save(); };

    var gt = $('#g_tint', box);
    if (gt) gt.onchange = function () { cfg.lg.tint = gt.value; save(); applyLiquidGlass(); };

    var rows = $$('.vt_row', box);
    rows.forEach(function (r) {
      var s = $('.vt_sw', r); if (!s) return;
      var label = r.querySelector('span') ? r.querySelector('span').textContent : '';
      s.onclick = function () {
        var on = !s.classList.contains('on');
        s.classList.toggle('on', on);
        if (label === '高光质感') { cfg.lg.gloss = on; cfg.lg.shadow = on; save(); applyLiquidGlass(); toast('玻璃高光：' + (on ? '开' : '关')); }
        else if (label === '启用广告拦截') { cfg.adblock.on = on; save(); toast('广告拦截：' + (on ? '开' : '关')); }
        else if (label === '激进模式') { cfg.adblock.aggressive = on; save(); toast('刷新后生效'); }
        else if (label === '密码访问') {
          cfg.pwd.on = on; save();
          if (on && !cfg.pwd.value) {
            var p = prompt('设置访问密码');
            if (p) { cfg.pwd.value = p; save(); } else { cfg.pwd.on = false; save(); s.classList.remove('on'); }
          }
          toast(cfg.pwd.on ? '密码已开' : '密码已关');
        }
        /* 抓包两项 */
        else if (label === '启用抓包挂钩') {
          cfg.apiLogOn = on; save();
          if (on) { try { hookAPI(); apiOn = true; } catch (e) {} }
          toast('抓包挂钩：' + (on ? '开' : '关') + '，刷新页面生效');
        }
        else if (label === '进页面自动弹窗') {
          cfg.apiLogAuto = on; save();
          toast('抓包自动弹窗：' + (on ? '开' : '关') + '，刷新页面生效');
        }
        /* B站增强三项：开关持久化，提示刷新 */
        else if (label === 'B站一键优化') {
          cfg.biliOpt = on; save();
          toast('B站优化：' + (on ? '开' : '关') + '，刷新页面生效');
        }
        else if (label === '底部玻璃Dock') {
          cfg.biliDock = on; save();
          toast('玻璃Dock：' + (on ? '开' : '关') + '，刷新页面生效');
        }
        else if (label === 'HD分栏（左视频右面板）') {
          cfg.biliHD = on; save();
          toast('HD分栏：' + (on ? '开' : '关') + '，刷新页面生效');
        }
      };
    });

    var uc = $('#st_color', box);
    if (uc) uc.oninput = function () { setColor(uc.value); };
    $$('[data-color]', box).forEach(function (t) {
      t.onclick = function () { var c = t.getAttribute('data-color'); setColor(c); if (uc) uc.value = c; };
    });
    var wc = $('#st_wpclear', box);
    if (wc) wc.onclick = function () { wpClear(); box.remove(); };

    $('#st_pwd', box).onclick = function () {
      var p = prompt('输入新密码（留空取消）');
      if (p === null) return;
      cfg.pwd.value = p; cfg.pwd.on = !!p; save(); toast(p ? '密码已设置' : '密码已取消');
    };
    $('#st_reset', box).onclick = function () {
      if (!confirm('恢复全部默认？收藏不会被删')) return;
      cfg = JSON.parse(JSON.stringify(DEF)); save(); location.reload();
    };
  }
  function setColor(c) {
    cfg.uiColor = c; save();
    document.documentElement.style.setProperty('--vt-theme', c);
    var g = $('#vt_gear'); if (g) g.style.background = c;
  }

  // ==========================================================================
  // 启动
  // ==========================================================================
  function boot() {
    var mg = window.__vtMigrated;
    if (mg && (mg.fav || mg.cfg)) {
      setTimeout(function () {
        toast('↩ 已找回旧版数据：收藏 ' + mg.fav + ' 条' + (mg.cfg ? ' · 设置' : '') + (mg.wp ? ' · 壁纸' : ''), 4000);
      }, 1200);
    }
    document.documentElement.style.setProperty('--vt-theme', cfg.uiColor);
    baseStyle();
    buildPanel();
    injectGear();
    applyLiquidGlass();
    removeAds(true);
    if (cfg.adblock.on) hookScriptSrc();   // 拦截后续动态创建的广告脚本
    /* ★ 抓包改为【默认开 + 立刻弹出】：
     *  1) 先 hookAPI()，越早挂钩越能抓到页面早期的请求
     *     （之前是等用户点开才挂钩，启动阶段的请求全漏了）
     *  2) 立刻弹出抓包小窗，不用手动点「抓包」按钮 */
    if (cfg.apiLogOn !== false) {
      try { hookAPI(); } catch (e) {}
      apiOn = true;
      if (cfg.apiLogAuto !== false) {
        try { if (!$('#vt_apilog')) showApiLog(); } catch (e) {}
      }
    }
    var wp = wpLoad();
    if (wp) applyWallpaper(wp);
    if (cfg.dark) setDark(true);
    if (cfg.invert) setInvert(true);
    /* ★ B站优化改为开机自动重建（之前只是提示一句，实际样式没重新注入）。
     * B站是 SPA，切页面不刷新，所以还要监听 URL 变化时重挂 Dock。 */
    if (isBili()) {
      if (cfg.biliOpt) applyBiliOpt(false);
      // 底部玻璃 Dock：开关独立，且播放器常延迟挂载，多试几次
      if (cfg.biliDock) {
        [0, 700, 1800, 3500].forEach(function (d) {
          setTimeout(function () {
            if (cfg.biliDock && !$('#vt_bili_dock')) buildBiliDock(isBiliMobile());
          }, d);
        });
      }
      // HD 分栏：同样重试若干次，等播放器加载完
      if (cfg.biliHD) {
        [600, 1500, 3000, 5000].forEach(function (d) {
          setTimeout(function () {
            if (cfg.biliHD && !$('#vt_bili_hd')) applyBiliHD();
          }, d);
        });
      }
      watchBiliSpa();
    }

    var mo = new MutationObserver(function () { removeAds(true); });
    try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
    setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 15000);
    // 持续清扫：广告常由脚本延迟插入，这里每 2.5 秒复查一次
    startAdWatch();
    window.addEventListener('scroll', function () { if (cfg.adblock.on) removeAds(true); }, { passive: true });

    var lgTimer = null;
    var mo2 = new MutationObserver(function () {
      clearTimeout(lgTimer); lgTimer = setTimeout(applyLiquidGlass, 500);
    });
    try { mo2.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  }

  /* ★ 抓包挂钩要【抢在页面自己的请求之前】，所以放在最外层最末尾、boot 之前执行
   * （不等 DOMContentLoaded）。这样页面早期发出的 XHR/fetch 也能抓到。 */
  if (cfg.apiLogOn !== false) {
    try { hookAPI(); apiOn = true; } catch (e) {}
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
