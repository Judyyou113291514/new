/* ==========================================================================
   settings.js — 設定與資料（settings.html）
   --------------------------------------------------------------------------
   功能：基本資料與學期日期、週課表編輯、匯出／匯入 JSON、清除／重載示範資料、
         localStorage 用量顯示、各資料表筆數統計。
   ========================================================================== */

(function () {
  'use strict';

  UI.renderShell('settings.html');

  [['icon-cog', 'cog'], ['icon-calendar', 'calendar'], ['icon-download', 'download'],
   ['icon-box', 'box'], ['icon-chart', 'chart']].forEach(function (p) {
    const el = document.getElementById(p[0]);
    if (el) el.innerHTML = UI.icon(p[1], 20);
  });

  /* ====================== 基本設定欄位 ====================== */
  function fillSettings() {
    const s = Store.settings();
    document.querySelectorAll('[data-k]').forEach(function (el) {
      el.value = s[el.dataset.k] || '';
      // change 事件才存，避免每打一個字就寫一次 localStorage
      el.onchange = function () {
        Store.setSetting(el.dataset.k, el.value);
        UI.toast('已儲存設定');
        renderSemesterInfo();
      };
    });
    document.getElementById('ttPeriods').value = (s.periodLabels || []).join(',');
  }

  function renderSemesterInfo() {
    const s = Store.settings();
    const items = [];
    if (s.semesterStart && s.semesterEnd) {
      const total = UI.daysBetween(s.semesterStart, s.semesterEnd);
      const passed = UI.daysBetween(s.semesterStart, UI.todayISO());
      const pct = total > 0 ? Math.max(0, Math.min(100, Math.round(passed / total * 100))) : 0;
      items.push('<div class="bar-row"><div class="bar-row-head"><span>學期進度</span>' +
        '<b>' + pct + '%（共 ' + total + ' 天）</b></div>' +
        '<div class="bar"><span style="width:' + pct + '%"></span></div></div>');
    }
    if (s.parentMeetingDate) {
      const d = UI.daysBetween(UI.todayISO(), s.parentMeetingDate);
      items.push('<p class="small muted mb-0">班親會：' + UI.formatDate(s.parentMeetingDate, true) +
        (d >= 0 ? '（還有 ' + d + ' 天）' : '（已結束）') + '</p>');
    }
    document.getElementById('semesterInfo').innerHTML = items.join('');
  }

  /* ====================== 週課表 ====================== */
  function renderTimetable() {
    const s = Store.settings();
    const periods = s.periodLabels && s.periodLabels.length ? s.periodLabels : ['1', '2', '3', '4', '5', '6', '7'];
    const tt = s.timetable || {};
    let html = '<table class="timetable"><thead><tr><th>節次</th>' +
      [1, 2, 3, 4, 5].map(function (d) { return '<th>星期' + UI.WEEKDAY[d] + '</th>'; }).join('') +
      '</tr></thead><tbody>';
    periods.forEach(function (p, i) {
      html += '<tr><th>' + UI.esc(p) + '</th>' + [1, 2, 3, 4, 5].map(function (d) {
        const v = (tt[d] || [])[i] || '';
        return '<td><input type="text" data-d="' + d + '" data-p="' + i + '" value="' + UI.esc(v) +
          '" aria-label="星期' + UI.WEEKDAY[d] + '第' + UI.esc(p) + '節"></td>';
      }).join('') + '</tr>';
    });
    html += '</tbody></table>';
    document.getElementById('ttGrid').innerHTML = html;

    document.querySelectorAll('#ttGrid input').forEach(function (inp) {
      inp.addEventListener('change', function () {
        const s2 = Store.settings();
        if (!s2.timetable) s2.timetable = {};
        const d = inp.dataset.d;
        if (!Array.isArray(s2.timetable[d])) s2.timetable[d] = [];
        s2.timetable[d][Number(inp.dataset.p)] = inp.value.trim();
        Store.commit();
        UI.toast('課表已更新');
      });
    });
  }

  document.getElementById('ttPeriods').addEventListener('change', function (e) {
    const labels = e.target.value.split(/[,，]/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (!labels.length) { UI.toast('至少要有一節'); fillSettings(); return; }
    Store.setSetting('periodLabels', labels);
    UI.toast('節次已更新');
    renderTimetable();
  });

  document.getElementById('clearTtBtn').addEventListener('click', function () {
    UI.confirmDelete('要清空整張週課表嗎？（其他資料不受影響）', function () {
      Store.setSetting('timetable', { 1: [], 2: [], 3: [], 4: [], 5: [] });
      UI.toast('課表已清空'); renderTimetable();
    });
  });

  /* ====================== 匯出／匯入 ====================== */
  document.getElementById('exportBtn').addEventListener('click', function () {
    const name = 'teacher-dashboard-backup-' + UI.todayISO() + '.json';
    UI.downloadFile(name, Store.exportJSON(), 'application/json');
    UI.toast('已下載 ' + name);
  });

  document.getElementById('importBtn').addEventListener('click', function () {
    document.getElementById('importFile').click();
  });

  document.getElementById('importFile').addEventListener('change', function (e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () { doImport(String(reader.result)); };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';   // 讓同一個檔案可以再選一次
  });

  document.getElementById('pasteImportBtn').addEventListener('click', function () {
    const text = document.getElementById('pasteArea').value.trim();
    if (!text) { UI.toast('請先貼上 JSON 內容'); return; }
    doImport(text);
  });

  function doImport(text) {
    UI.modal({
      title: '確認匯入',
      bodyHTML: '<p>匯入會<strong>覆蓋目前所有資料</strong>，且無法復原。建議先按「匯出 JSON 備份」保存現況。</p>' +
        '<p class="small muted mb-0">確定要繼續嗎？</p>',
      okText: '確定匯入',
      onOK: function () {
        try {
          Store.importJSON(text);
          UI.toast('匯入成功，已重新載入資料');
          refresh();
          document.getElementById('pasteArea').value = '';
        } catch (err) {
          UI.toast('匯入失敗：' + err.message);
        }
        return true;
      }
    });
  }

  /* ====================== 清除／重載 ====================== */
  document.getElementById('clearBtn').addEventListener('click', function () {
    UI.modal({
      title: '清除全部資料',
      bodyHTML: '<p>這會刪掉所有班級、學生、備課單、反思與筆記，並且<strong>無法復原</strong>。</p>' +
        '<div class="field mb-0"><label for="confirmWord">請輸入「清除」兩個字確認</label>' +
        '<input type="text" id="confirmWord" placeholder="清除"></div>',
      okText: '確定清除',
      onOpen: function (m) { m.querySelector('#confirmWord').focus(); },
      onOK: function (m) {
        if (m.querySelector('#confirmWord').value.trim() !== '清除') { UI.toast('請輸入「清除」才能繼續'); return false; }
        Store.clearAll(false);
        UI.toast('已清除全部資料');
        refresh();
        return true;
      }
    });
  });

  document.getElementById('reseedBtn').addEventListener('click', function () {
    UI.modal({
      title: '重新載入示範資料',
      bodyHTML: '<p>目前資料會被示範資料<strong>取代</strong>。適合想重新看一次完整範例、或內建檢核清單被刪掉想拿回來的時候。</p>',
      okText: '確定重載',
      onOK: function () {
        Store.clearAll(true);
        UI.toast('已重新載入示範資料');
        refresh();
        return true;
      }
    });
  });

  /* ====================== 用量與筆數 ====================== */
  function renderUsage() {
    // 瀏覽器不允許儲存時（隱私模式、嵌入式預覽）改顯示試用模式說明
    if (!Store.isPersistent()) {
      document.getElementById('usageBox').innerHTML =
        '<p class="small mb-0">目前是<b>試用模式</b>（記憶體），這個瀏覽環境不允許本機儲存，' +
        '所以沒有佔用任何空間。下載原始檔後直接開啟 index.html 就會正常存檔。</p>';
      document.getElementById('warnBox').innerHTML = UI.icon('alert', 18) +
        '<div class="alert-body"><div class="alert-title">這個環境不會保留資料</div>' +
        '<div class="alert-desc">所有功能都可以試，但重新整理頁面就會回到示範資料。要真的拿來用，' +
        '請把檔案存到自己電腦再開啟。</div></div>';
      return;
    }
    const bytes = Store.usageBytes();
    const kb = bytes / 1024;
    // 瀏覽器 localStorage 上限通常約 5 MB，這裡用 5120 KB 當分母估算
    const pct = Math.min(100, kb / 5120 * 100);
    document.getElementById('usageBox').innerHTML =
      '<div class="usage"><div class="bar-row"><div class="bar-row-head">' +
      '<span>已使用</span><b>' + kb.toFixed(1) + ' KB / 約 5 MB</b></div>' +
      '<div class="bar' + (pct > 80 ? ' bar-warn' : '') + '"><span style="width:' + Math.max(1, pct) + '%"></span></div>' +
      '</div><p class="xsmall faint mb-0">佔用約 ' + pct.toFixed(2) + '%。純文字資料很省，正常使用幾年都不會滿。</p></div>';

    document.getElementById('warnBox').innerHTML = UI.icon('alert', 18) +
      '<div class="alert-body"><div class="alert-title">資料只存在這個瀏覽器</div>' +
      '<div class="alert-desc">換電腦、換瀏覽器、使用無痕視窗、或清除瀏覽資料時，資料都會不見。請定期匯出備份。</div></div>';
  }

  const COUNT_FIELDS = [
    ['classes', '班級'], ['students', '學生'], ['observations', '觀察紀錄'],
    ['lessons', '備課單'], ['templates', '溝通模板'], ['contacts', '聯繫紀錄'],
    ['groups', '科展分組'], ['reflections', '反思'], ['assessments', '自評'],
    ['goals', '成長目標'], ['milestones', '成長歷程'], ['links', '連結'],
    ['checklists', '檢核清單'], ['notes', '筆記'], ['todos', '待辦']
  ];

  function renderCounts() {
    document.getElementById('countGrid').innerHTML = COUNT_FIELDS.map(function (f) {
      return '<div class="card card-tight stat"><div class="stat-label">' + f[1] + '</div>' +
        '<div class="stat-value">' + Store.list(f[0]).length + '</div></div>';
    }).join('');
  }

  /* ====================== 啟動 ====================== */
  function refresh() {
    fillSettings();
    renderSemesterInfo();
    renderTimetable();
    renderUsage();
    renderCounts();
  }
  window.onDataChanged = refresh;
  refresh();
})();
