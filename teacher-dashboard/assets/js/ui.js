/* ==========================================================================
   ui.js — 共用介面工具（側邊欄、圖示、提示、模組視窗、日期工具）
   --------------------------------------------------------------------------
   每個 HTML 頁面只要：
     1. 放一個 <div id="layout" class="layout"></div>（見各頁 HTML）
     2. 呼叫 UI.renderShell('index.html')  ← 傳入目前頁面檔名
   側邊欄就會自動長出來。要新增頁面：在下面 NAV 陣列加一筆即可。
   ========================================================================== */

const UI = (function () {
  'use strict';

  /* ============ 1. 導覽設定：新增頁面就改這裡 ============ */
  const NAV = [
    { file: 'index.html',     label: '儀表板',     icon: 'grid' },
    { file: 'lessons.html',   label: '課程與備課', icon: 'book' },
    { file: 'classes.html',   label: '班級與學生', icon: 'users' },
    { file: 'contact.html',   label: '親師溝通',   icon: 'chat' },
    { file: 'scifair.html',   label: '科展管理',   icon: 'flask' },
    { file: 'reflect.html',   label: '教師反思',   icon: 'loop' },
    { file: 'growth.html',    label: '專業成長',   icon: 'chart' },
    { file: 'resources.html', label: '資源中心',   icon: 'bookmark' }
  ];

  /* ============ 2. 圖示庫（inline SVG，不用 emoji、不用圖示字型） ============ */
  // 用法：UI.icon('book')、UI.icon('book', 20)
  const ICON_PATHS = {
    grid:      '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    book:      '<path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z"/><path d="M8 3v15"/>',
    users:     '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16.5 5.3A3.2 3.2 0 0117 11.6"/><path d="M18 14.8c2 .7 3.5 2.5 3.5 5.2"/>',
    chat:      '<path d="M20 12.5c0 3.9-3.6 7-8 7-1 0-2-.2-2.9-.5L4 21l1.4-3.6A6.6 6.6 0 014 12.5c0-3.9 3.6-7 8-7s8 3.1 8 7z"/><path d="M9 11h6M9 14h4"/>',
    flask:     '<path d="M9 3h6"/><path d="M10 3v5.5L4.8 18A2 2 0 006.6 21h10.8a2 2 0 001.8-3L14 8.5V3"/><path d="M7.2 14h9.6"/>',
    loop:      '<path d="M20 11.5A8 8 0 006.5 6.2L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 12.5A8 8 0 0017.5 17.8L20 15.5"/><path d="M20 20v-4.5h-4.5"/>',
    chart:     '<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7.5" y="12" width="3.2" height="5" rx="1"/><rect x="13" y="8" width="3.2" height="9" rx="1"/>',
    bookmark:  '<path d="M6.5 3.5h11a1 1 0 011 1V21l-6.5-4-6.5 4V4.5a1 1 0 011-1z"/>',
    cog:       '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1"/>',
    plus:      '<path d="M12 5v14M5 12h14"/>',
    menu:      '<path d="M4 7h16M4 12h16M4 17h16"/>',
    x:         '<path d="M6 6l12 12M18 6L6 18"/>',
    edit:      '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M14.5 5.5l4 4"/>',
    trash:     '<path d="M4 7h16"/><path d="M9 7V4.5h6V7"/><path d="M6 7l1 13h10l1-13"/>',
    copy:      '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 5.5H6.5a2 2 0 00-2 2v9"/>',
    print:     '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="2"/><path d="M7 14h10v6H7z"/>',
    download:  '<path d="M12 4v11"/><path d="M8 11l4 4 4-4"/><path d="M4 19h16"/>',
    upload:    '<path d="M12 16V5"/><path d="M8 9l4-4 4 4"/><path d="M4 19h16"/>',
    check:     '<path d="M5 13l4.5 4.5L19 7"/>',
    alert:     '<path d="M12 4.5L21 19H3z"/><path d="M12 10v4"/><path d="M12 16.6v.1"/>',
    info:      '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path d="M12 8v.1"/>',
    clock:     '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    calendar:  '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8.5 3.5v3M15.5 3.5v3"/>',
    link:      '<path d="M10.5 13.5a4 4 0 015.7 0l2.3-2.3a4 4 0 00-5.7-5.7L11 7.8"/><path d="M13.5 10.5a4 4 0 01-5.7 0L5.5 12.8a4 4 0 005.7 5.7L13 16.2"/>',
    note:      '<path d="M5 4.5h9L19 9.5V20H5z"/><path d="M14 4.5v5h5"/><path d="M8.5 13h7M8.5 16.5h5"/>',
    target:    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor"/>',
    star:      '<path d="M12 4l2.4 5.1 5.6.7-4.1 3.8 1.1 5.5L12 16.4 6.9 19.1 8 13.6 4 9.8l5.6-.7z"/>',
    heart:     '<path d="M12 20s-7-4.4-7-9.2A3.9 3.9 0 0112 8.2 3.9 3.9 0 0119 10.8C19 15.6 12 20 12 20z"/>',
    inbox:     '<path d="M3.5 12.5h4l1.5 3h6l1.5-3h4"/><path d="M3.5 12.5L6 5h12l2.5 7.5V19h-17z"/>',
    search:    '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    box:       '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
    beaker:    '<path d="M6 4h12"/><path d="M8 4v6l-3 8h14l-3-8V4"/>'
  };

  function icon(name, size) {
    const s = size || 18;
    const p = ICON_PATHS[name] || ICON_PATHS.info;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }

  /* ============ 3. 自製 logo（幾何：方格中的葉芽＝成長／探究） ============ */
  function logoSVG(size) {
    const s = size || 30;
    return '<svg class="logo-mark" width="' + s + '" height="' + s + '" viewBox="0 0 32 32" fill="none" ' +
      'role="img" aria-label="新手老師成長儀表板標誌">' +
      '<rect x="2.6" y="2.6" width="26.8" height="26.8" rx="7.5" stroke="currentColor" stroke-width="2.2"/>' +
      '<path d="M16 24.4V14.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path d="M15.6 14.2c0-3.4-2.5-5.9-5.9-6.2.2 3.4 2.6 6 5.9 6.2z" fill="currentColor"/>' +
      '<path d="M16.4 17.1c3.3-.2 5.7-2.6 5.9-6-3.4.3-5.9 2.8-5.9 6z" fill="currentColor"/>' +
      '</svg>';
  }

  /* ============ 4. 小工具函式 ============ */

  // 把使用者輸入的文字轉成安全的 HTML（防止版面被打壞）
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];

  // 2026-08-05 → 「8 月 5 日（三）」
  function formatDate(iso, withYear) {
    if (!iso) return '';
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
    if (isNaN(d)) return iso;
    const base = (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日（' + WEEKDAY[d.getDay()] + '）';
    return withYear ? d.getFullYear() + ' 年 ' + base : base;
  }

  function todayISO() { return Store.toISODate(new Date()); }

  // 兩個日期相差幾天（b - a）
  function daysBetween(a, b) {
    const d1 = new Date(a + 'T00:00:00'), d2 = new Date(b + 'T00:00:00');
    return Math.round((d2 - d1) / 86400000);
  }

  // 取得本週一的日期字串（週一為一週之始）
  function mondayOf(iso) {
    const d = new Date((iso || todayISO()) + 'T00:00:00');
    const shift = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - shift);
    return Store.toISODate(d);
  }

  /* ============ 5. 骨架渲染 ============ */
  function renderShell(currentFile, opts) {
    opts = opts || {};
    const layout = document.getElementById('layout');
    if (!layout) return;

    const st = Store.settings();
    const nav = NAV.map(function (n) {
      const active = (n.file === currentFile) ? ' is-active' : '';
      return '<a class="nav-item' + active + '" href="' + n.file + '">' + icon(n.icon) + '<span>' + n.label + '</span></a>';
    }).join('');

    const settingsActive = currentFile === 'settings.html' ? ' is-active' : '';
    const now = new Date();

    const sidebar =
      '<aside class="sidebar" id="sidebar">' +
        '<div class="sidebar-brand">' + logoSVG(30) +
          '<div class="sidebar-brand-text">' +
            '<div class="sidebar-brand-title">成長儀表板</div>' +
            '<div class="sidebar-brand-sub">' + esc(st.teacherName || '新手老師') + ' · 自然科任</div>' +
          '</div>' +
        '</div>' +
        '<nav class="sidebar-nav" aria-label="主導覽">' +
          '<div class="sidebar-nav-label">每日工作台</div>' + nav +
        '</nav>' +
        '<div class="sidebar-foot">' +
          '<a class="nav-item' + settingsActive + '" href="settings.html">' + icon('cog') + '<span>設定與備份</span></a>' +
        '</div>' +
      '</aside>';

    const topbar =
      '<header class="topbar">' +
        '<button class="btn btn-icon menu-toggle" id="menuToggle" type="button" aria-label="開啟選單">' + icon('menu', 20) + '</button>' +
        '<div>' +
          '<div class="topbar-date">' + formatDate(todayISO(), true) + '</div>' +
          '<div class="topbar-sub">' + semesterHint() + '</div>' +
        '</div>' +
        '<div class="topbar-spacer"></div>' +
        '<a class="btn btn-sm" href="reflect.html#quick">' + icon('loop', 16) + '<span class="hide-sm">2 分鐘速記</span></a>' +
        '<button class="btn btn-primary btn-sm" id="quickAddBtn" type="button">' + icon('plus', 16) + '<span class="hide-sm">快速新增待辦</span></button>' +
      '</header>';

    // 瀏覽器不允許儲存時（隱私模式、嵌入式預覽），提示使用者資料不會保留
    const storageNotice = Store.isPersistent() ? '' :
      '<div class="storage-notice">' + icon('alert', 16) +
      '<span>這個瀏覽環境不允許本機儲存，目前是<strong>試用模式</strong>：所有功能都能操作，' +
      '但關閉頁面後資料不會保留。下載原始檔並直接開啟 index.html 就會正常存檔。</span></div>';

    // 把原本寫在 HTML 裡的 .content 內容保留下來，包進 main
    const existing = layout.innerHTML;
    layout.innerHTML = sidebar + '<div class="main">' + topbar +
      '<div class="content">' + storageNotice + existing + '</div></div>';

    // 手機版選單開合
    const toggle = document.getElementById('menuToggle');
    if (toggle) {
      toggle.addEventListener('click', function () { document.body.classList.toggle('nav-open'); });
    }
    document.body.addEventListener('click', function (e) {
      if (document.body.classList.contains('nav-open') &&
          !e.target.closest('#sidebar') && !e.target.closest('#menuToggle')) {
        document.body.classList.remove('nav-open');
      }
    });

    // 頂部「快速新增待辦」（每一頁都能用）
    const qa = document.getElementById('quickAddBtn');
    if (qa) qa.addEventListener('click', quickAddTodo);

    // 提示容器
    if (!document.getElementById('toastWrap')) {
      const tw = document.createElement('div');
      tw.className = 'toast-wrap'; tw.id = 'toastWrap';
      document.body.appendChild(tw);
    }
    void now;
    void opts;
  }

  /* 快速新增待辦：任何頁面都可呼叫，存進 todos */
  function quickAddTodo() {
    modal({
      title: '快速新增待辦',
      bodyHTML:
        '<div class="field"><label for="qaText">待辦內容</label>' +
        '<input type="text" id="qaText" placeholder="例：檢查酒精燈存量"></div>' +
        '<div class="field mb-0"><label for="qaScope">歸類</label>' +
        '<select id="qaScope"><option value="today">今天</option><option value="week">這週</option>' +
        '<option value="term">這學期</option></select></div>',
      okText: '新增',
      onOK: function (m) {
        const text = m.querySelector('#qaText').value.trim();
        if (!text) { toast('請先輸入待辦內容'); return false; }
        Store.add('todos', {
          text: text, scope: m.querySelector('#qaScope').value,
          done: false, createdAt: todayISO()
        });
        toast('已新增待辦');
        if (typeof window.onDataChanged === 'function') window.onDataChanged();
        return true;
      }
    });
  }

  // 頂部的學期進度提示
  function semesterHint() {
    const st = Store.settings();
    if (!st.semesterStart || !st.semesterEnd) return '尚未設定學期起訖日';
    const total = daysBetween(st.semesterStart, st.semesterEnd);
    const passed = daysBetween(st.semesterStart, todayISO());
    if (total <= 0) return '學期設定有誤';
    if (passed < 0) return '距離開學還有 ' + (-passed) + ' 天';
    if (passed > total) return '本學期已結束，記得更新學期起訖日';
    const week = Math.floor(passed / 7) + 1;
    return '本學期第 ' + week + ' 週 · 剩 ' + (total - passed) + ' 天';
  }

  /* ============ 6. 提示訊息 ============ */
  function toast(msg) {
    const wrap = document.getElementById('toastWrap');
    if (!wrap) { console.log(msg); return; }
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }

  /* ============ 7. 模組視窗（Modal） ============
     用法：
       UI.modal({ title:'新增待辦', bodyHTML:'…', okText:'儲存', onOK: function(modalEl){ … return true; } });
     onOK 回傳 false 就不關閉（例如驗證沒過）。
  */
  function modal(cfg) {
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML =
      '<div class="modal' + (cfg.wide ? ' modal-wide' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="modal-head"><h3>' + esc(cfg.title || '') + '</h3>' +
          '<button class="btn btn-icon btn-ghost" data-close type="button" aria-label="關閉">' + icon('x', 18) + '</button></div>' +
        '<div class="modal-body">' + (cfg.bodyHTML || '') + '</div>' +
        '<div class="modal-foot">' +
          (cfg.hideCancel ? '' : '<button class="btn" data-close type="button">取消</button>') +
          (cfg.okText === null ? '' : '<button class="btn btn-primary" data-ok type="button">' + esc(cfg.okText || '儲存') + '</button>') +
        '</div>' +
      '</div>';
    document.body.appendChild(back);

    function close() { back.remove(); }
    back.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', close); });
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
    });
    const okBtn = back.querySelector('[data-ok]');
    if (okBtn) {
      okBtn.addEventListener('click', function () {
        if (!cfg.onOK || cfg.onOK(back) !== false) close();
      });
    }
    if (cfg.onOpen) cfg.onOpen(back);
    const first = back.querySelector('input, textarea, select');
    if (first) first.focus();
    return { el: back, close: close };
  }

  // 刪除確認
  function confirmDelete(msg, onYes) {
    modal({
      title: '確認刪除',
      bodyHTML: '<p>' + esc(msg) + '</p><p class="small muted mb-0">刪除後無法復原。若想保險，可先到「設定與備份」匯出 JSON。</p>',
      okText: '刪除',
      onOK: function () { onYes(); return true; }
    });
  }

  /* ============ 8. 空狀態 ============ */
  function empty(iconName, title, desc, actionHTML) {
    return '<div class="empty">' + icon(iconName || 'inbox', 34) +
      '<div class="empty-title">' + esc(title) + '</div>' +
      '<div class="empty-desc">' + esc(desc) + '</div>' +
      (actionHTML || '') + '</div>';
  }

  /* ============ 9. 其他 ============ */
  // 複製到剪貼簿（含舊瀏覽器備援）
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { toast('已複製到剪貼簿'); },
        function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('已複製到剪貼簿'); }
      catch (e) { toast('複製失敗，請手動選取文字'); }
      ta.remove();
    }
  }

  // 產生環形進度 SVG
  function ringSVG(percent, label) {
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    const r = 24, c = 2 * Math.PI * r;
    return '<div class="ring">' +
      '<svg class="ring-svg" viewBox="0 0 62 62" role="img" aria-label="' + esc(label) + ' 完成度 ' + p + '%">' +
        '<circle class="ring-track" cx="31" cy="31" r="' + r + '" fill="none" stroke-width="6"/>' +
        '<circle class="ring-fill" cx="31" cy="31" r="' + r + '" fill="none" stroke-width="6" ' +
          'stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - p / 100)).toFixed(1) + '"/>' +
        '<text class="ring-text" x="31" y="36" text-anchor="middle">' + p + '</text>' +
      '</svg>' +
      '<div class="ring-label">' + esc(label) + '</div></div>';
  }

  // 下載檔案（匯出用）
  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type: type || 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  return {
    NAV: NAV, icon: icon, logoSVG: logoSVG, esc: esc,
    formatDate: formatDate, todayISO: todayISO, daysBetween: daysBetween,
    mondayOf: mondayOf, WEEKDAY: WEEKDAY,
    renderShell: renderShell, semesterHint: semesterHint,
    toast: toast, modal: modal, confirmDelete: confirmDelete,
    empty: empty, copyText: copyText, ringSVG: ringSVG, downloadFile: downloadFile,
    quickAddTodo: quickAddTodo
  };
})();
