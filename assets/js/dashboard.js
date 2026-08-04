/* ==========================================================================
   dashboard.js — 儀表板（index.html）
   --------------------------------------------------------------------------
   內容：今日課表、待辦清單（今天／這週／這學期）、四輪進度、
         推導出來的提醒卡、待關注學生、本週反思摘要。
   ========================================================================== */

(function () {
  'use strict';

  UI.renderShell('index.html');

  // 頂部卡片的小圖示（放在 HTML 裡的空 span，用 JS 填 SVG）
  const ICON_SLOTS = {
    'icon-clock': 'clock', 'icon-check': 'check', 'icon-target': 'target',
    'icon-alert': 'alert', 'icon-users': 'users', 'icon-loop': 'loop'
  };
  Object.keys(ICON_SLOTS).forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = UI.icon(ICON_SLOTS[id], 20);
  });

  let todoScope = 'today';   // 目前選中的待辦分頁

  /* ====================== 今日課表 ====================== */
  function renderToday() {
    const box = document.getElementById('todayPeriods');
    const st = Store.settings();
    const dow = new Date().getDay();             // 0=日 1=一 … 6=六

    if (dow === 0 || dow === 6) {
      box.innerHTML = UI.empty('calendar', '今天是週末',
        '沒有課。若想利用零碎時間，可以到「課程與備課」補下週的備課單。',
        '<a class="btn" href="lessons.html">前往備課</a>');
      return;
    }

    const row = st.timetable[dow] || [];
    const items = row.map(function (name, i) {
      return { period: (st.periodLabels[i] || (i + 1)), name: (name || '').trim() };
    }).filter(function (x) { return x.name; });

    if (!items.length) {
      box.innerHTML = UI.empty('calendar', '今天的課表還是空的',
        '到「設定與備份 → 週課表」把一週的課填進去，之後每天打開就會自動顯示。',
        '<a class="btn btn-primary" href="settings.html#timetable">設定週課表</a>');
      return;
    }

    box.innerHTML = '<div class="period-list">' + items.map(function (x) {
      // 有沒有這個班的備課單？有的話給一個連結
      const cls = Store.classes().find(function (c) { return c.name === x.name; });
      const lesson = cls ? Store.list('lessons').find(function (l) { return l.classId === cls.id; }) : null;
      return '<div class="period">' +
        '<span class="period-no">' + UI.esc(x.period) + '</span>' +
        '<span class="period-name">' + UI.esc(x.name) +
          (lesson ? ' <span class="tag tag-primary">' + UI.esc(lesson.unit) + '</span>' : '') +
        '</span>' +
        (lesson ? '<a class="btn btn-sm" href="lessons.html#' + lesson.id + '">看備課單</a>'
                : (cls ? '<a class="btn btn-sm btn-ghost" href="lessons.html">建備課單</a>' : '')) +
        '</div>';
    }).join('') + '</div>';
  }

  /* ====================== 待辦清單 ====================== */
  const SCOPES = [
    { key: 'today', label: '今天' },
    { key: 'week',  label: '這週' },
    { key: 'term',  label: '這學期' }
  ];

  function renderTodos() {
    const all = Store.list('todos');

    // 分頁按鈕（含未完成數量）
    document.getElementById('todoTabs').innerHTML = SCOPES.map(function (s) {
      const open = all.filter(function (t) { return t.scope === s.key && !t.done; }).length;
      return '<button class="tab' + (todoScope === s.key ? ' is-active' : '') + '" role="tab" ' +
        'data-scope="' + s.key + '" type="button">' + s.label +
        '<span class="tab-badge">' + open + '</span></button>';
    }).join('');

    document.querySelectorAll('#todoTabs .tab').forEach(function (b) {
      b.addEventListener('click', function () { todoScope = b.dataset.scope; renderTodos(); });
    });

    // 清單：未完成排前面
    const list = all.filter(function (t) { return t.scope === todoScope; })
      .sort(function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0); });
    const box = document.getElementById('todoList');

    if (!list.length) {
      box.innerHTML = UI.empty('check', '這個分頁沒有待辦',
        '空的也很好。想到什麼就用上面的輸入框加進來，例如「檢查下週實驗器材」。');
      return;
    }

    box.innerHTML = '<div class="list">' + list.map(function (t) {
      return '<div class="list-item">' +
        '<label class="check grow">' +
          '<input type="checkbox" data-toggle="' + t.id + '"' + (t.done ? ' checked' : '') + '>' +
          '<span class="check-text">' + UI.esc(t.text) + '</span>' +
        '</label>' +
        '<div class="list-item-actions">' +
          '<button class="btn btn-icon btn-ghost" data-edit="' + t.id + '" type="button" aria-label="編輯">' + UI.icon('edit', 16) + '</button>' +
          '<button class="btn btn-icon btn-ghost" data-del="' + t.id + '" type="button" aria-label="刪除">' + UI.icon('trash', 16) + '</button>' +
        '</div></div>';
    }).join('') + '</div>';

    box.querySelectorAll('[data-toggle]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        Store.update('todos', cb.dataset.toggle, { done: cb.checked });
        refresh();
      });
    });
    box.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        const t = Store.find('todos', b.dataset.del);
        UI.confirmDelete('要刪除「' + (t ? t.text : '') + '」嗎？', function () {
          Store.remove('todos', b.dataset.del); UI.toast('已刪除'); refresh();
        });
      });
    });
    box.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { editTodo(b.dataset.edit); });
    });
  }

  function editTodo(id) {
    const t = Store.find('todos', id);
    if (!t) return;
    UI.modal({
      title: '編輯待辦',
      bodyHTML:
        '<div class="field"><label for="etText">內容</label>' +
        '<input type="text" id="etText" value="' + UI.esc(t.text) + '"></div>' +
        '<div class="field mb-0"><label for="etScope">歸類</label><select id="etScope">' +
        SCOPES.map(function (s) {
          return '<option value="' + s.key + '"' + (t.scope === s.key ? ' selected' : '') + '>' + s.label + '</option>';
        }).join('') + '</select></div>',
      onOK: function (m) {
        const text = m.querySelector('#etText').value.trim();
        if (!text) { UI.toast('內容不能空白'); return false; }
        Store.update('todos', id, { text: text, scope: m.querySelector('#etScope').value });
        UI.toast('已更新'); refresh(); return true;
      }
    });
  }

  document.getElementById('addTodoBtn').addEventListener('click', UI.quickAddTodo);

  // 直接輸入新增（Enter 送出，加到目前分頁）
  document.getElementById('inlineTodoForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const input = document.getElementById('inlineTodoText');
    const text = input.value.trim();
    if (!text) return;
    Store.add('todos', { text: text, scope: todoScope, done: false, createdAt: UI.todayISO() });
    input.value = '';
    UI.toast('已新增到「' + SCOPES.find(function (s) { return s.key === todoScope; }).label + '」');
    refresh();
  });

  /* ====================== 四輪進度 ======================
     四輪＝教學／班級／關係／反思。計算方式（想調整就改這個函式）：
       教學：所有備課單的器材備齊比例
       班級：需關注學生中，最近 14 天有觀察紀錄的比例
       關係：親師聯繫的待追蹤事項完成比例
       反思：本週反思篇數 ÷ 3 篇（目標值）
  ==================================================== */
  function calcWheels() {
    const lessons = Store.list('lessons');
    let mTotal = 0, mReady = 0;
    lessons.forEach(function (l) {
      (l.materials || []).forEach(function (m) { mTotal++; if (m.ready) mReady++; });
    });

    const flagged = Store.list('students').filter(function (s) { return (s.tags || []).length; });
    const since = new Date(); since.setDate(since.getDate() - 14);
    const sinceISO = Store.toISODate(since);
    const tracked = flagged.filter(function (s) {
      return Store.list('observations').some(function (o) { return o.studentId === s.id && o.date >= sinceISO; });
    }).length;

    const followUps = Store.list('contacts').filter(function (c) { return c.followUp; });
    const doneFollow = followUps.filter(function (c) { return c.followDone; }).length;

    const weekStart = UI.mondayOf();
    const weekRef = Store.list('reflections').filter(function (r) { return r.date >= weekStart; }).length;

    return [
      { label: '教學', value: mTotal ? mReady / mTotal * 100 : 0,
        note: '器材備齊 ' + mReady + '／' + mTotal + ' 項' },
      { label: '班級', value: flagged.length ? tracked / flagged.length * 100 : 0,
        note: '近兩週追蹤 ' + tracked + '／' + flagged.length + ' 位' },
      { label: '關係', value: followUps.length ? doneFollow / followUps.length * 100 : 0,
        note: '待追蹤已結案 ' + doneFollow + '／' + followUps.length + ' 件' },
      { label: '反思', value: Math.min(weekRef / 3 * 100, 100),
        note: '本週寫了 ' + weekRef + ' 篇（目標 3 篇）' }
    ];
  }

  function renderWheels() {
    const w = calcWheels();
    document.getElementById('wheels').innerHTML = w.map(function (x) {
      return UI.ringSVG(x.value, x.label);
    }).join('');
    document.getElementById('wheelsNote').innerHTML =
      w.map(function (x) { return UI.esc(x.label) + '：' + UI.esc(x.note); }).join('　·　');
  }

  /* ====================== 提醒卡（由其他頁資料推導） ====================== */
  function renderAlerts() {
    const st = Store.settings();
    const out = [];
    const today = UI.todayISO();

    // 1. 器材未備齊
    Store.list('lessons').forEach(function (l) {
      const miss = (l.materials || []).filter(function (m) { return !m.ready; });
      if (miss.length) {
        out.push(['warn', 'box', Store.className(l.classId) + '「' + l.unit + '」還有 ' + miss.length + ' 項器材沒備齊',
          miss.map(function (m) { return m.name; }).join('、'), 'lessons.html#' + l.id, '看備課單']);
      }
    });

    // 2. 需關注但最近沒紀錄的學生
    const since = new Date(); since.setDate(since.getDate() - 14);
    const sinceISO = Store.toISODate(since);
    const stale = Store.list('students').filter(function (s) {
      return (s.tags || []).indexOf('需關注') >= 0 &&
        !Store.list('observations').some(function (o) { return o.studentId === s.id && o.date >= sinceISO; });
    });
    if (stale.length) {
      out.push(['info', 'users', '有 ' + stale.length + ' 位需關注學生近兩週沒有觀察紀錄',
        stale.map(function (s) { return Store.className(s.classId) + ' ' + s.name; }).join('、'),
        'classes.html', '去補紀錄']);
    }

    // 3. 科展進度落後（已完成週數 < 目前應完成週數）
    const curWeek = sciFairWeek();
    if (curWeek >= 1) {
      Store.list('groups').forEach(function (g) {
        const done = (g.weeks || []).filter(Boolean).length;
        if (done < curWeek) {
          out.push(['danger', 'flask', g.name + ' 科展進度落後 ' + (curWeek - done) + ' 週',
            '目前應完成第 ' + curWeek + ' 週（' + (Store.sciFairWeekTitles()[curWeek - 1] || '') + '），實際完成 ' + done + ' 週',
            'scifair.html#' + g.id, '看進度']);
        }
      });
    }

    // 4. 待回覆／待追蹤的親師聯繫
    const pending = Store.list('contacts').filter(function (c) { return c.followUp && !c.followDone; });
    if (pending.length) {
      out.push(['warn', 'chat', '有 ' + pending.length + ' 件親師聯繫還沒追蹤完',
        pending.map(function (c) { return Store.studentLabel(c.studentId).split(' ').pop() + '：' + c.followUp; }).join('；'),
        'contact.html#followups', '去處理']);
    }

    // 5. 班親會倒數
    if (st.parentMeetingDate) {
      const d = UI.daysBetween(today, st.parentMeetingDate);
      if (d >= 0 && d <= 45) {
        out.push([d <= 7 ? 'danger' : 'info', 'calendar',
          d === 0 ? '班親會就是今天' : '班親會倒數 ' + d + ' 天',
          UI.formatDate(st.parentMeetingDate, true) + '．可先用「班親會邀請」模板通知家長',
          'contact.html', '看模板']);
      }
    }

    const box = document.getElementById('alertList');
    if (!out.length) {
      box.innerHTML = '<div class="alert alert-success">' + UI.icon('check', 18) +
        '<div class="alert-body"><div class="alert-title">目前沒有待處理的提醒</div>' +
        '<div class="alert-desc">器材備齊、學生都有追蹤、科展沒落後。今天可以專心把課上好。</div></div></div>';
      return;
    }

    box.innerHTML = out.slice(0, 8).map(function (a) {
      return '<div class="alert alert-' + a[0] + '">' + UI.icon(a[1], 18) +
        '<div class="alert-body grow"><div class="alert-title">' + UI.esc(a[2]) + '</div>' +
        '<div class="alert-desc">' + UI.esc(a[3]) + '</div></div>' +
        '<a class="btn btn-sm" href="' + a[4] + '">' + UI.esc(a[5]) + '</a></div>';
    }).join('');
  }

  // 目前是科展第幾週（1–8；未開始回傳 0）
  function sciFairWeek() {
    const start = Store.settings().sciFairStart;
    if (!start) return 0;
    const d = UI.daysBetween(start, UI.todayISO());
    if (d < 0) return 0;
    return Math.min(Math.floor(d / 7) + 1, 8);
  }

  /* ====================== 待關注學生 ====================== */
  function renderFlagged() {
    const list = Store.list('students').filter(function (s) { return (s.tags || []).indexOf('需關注') >= 0; });
    const box = document.getElementById('flaggedList');
    if (!list.length) {
      box.innerHTML = UI.empty('users', '目前沒有標記為「需關注」的學生',
        '在「班級與學生」頁點學生卡片，加上「需關注」標籤，這裡就會出現。');
      return;
    }
    box.innerHTML = '<div class="list">' + list.map(function (s) {
      const obs = Store.observationsOf(s.id);
      const last = obs[0];
      return '<div class="list-item">' +
        '<div class="list-item-body">' +
          '<div class="list-item-title"><strong>' + UI.esc(s.name) + '</strong> ' +
            '<span class="muted small">' + UI.esc(Store.className(s.classId)) + ' · ' + UI.esc(s.seatNo) + ' 號</span></div>' +
          '<div class="student-tags mt-3" style="margin-top:4px">' + (s.tags || []).map(function (t) {
            return '<span class="tag ' + tagClass(t) + '">' + UI.esc(t) + '</span>';
          }).join('') + '</div>' +
          '<div class="list-item-meta">' + (last
            ? '最近紀錄 ' + UI.formatDate(last.date) + '：' + UI.esc(last.text.slice(0, 40)) + (last.text.length > 40 ? '…' : '')
            : '還沒有觀察紀錄') + '</div>' +
        '</div>' +
        '<a class="btn btn-sm" href="classes.html#' + s.id + '">紀錄</a></div>';
    }).join('') + '</div>';
  }

  // 標籤對應顏色（與 classes.js 共用同一套規則）
  function tagClass(t) {
    if (t === '表現亮點') return 'tag-success';
    if (t === '需關注') return 'tag-warn';
    if (t === '需家長聯繫') return 'tag-info';
    if (t === '情緒波動') return 'tag-danger';
    if (t === '學習吃力') return 'tag-primary';
    return '';
  }

  /* ====================== 本週反思摘要 ====================== */
  function renderReflect() {
    const weekStart = UI.mondayOf();
    const list = Store.list('reflections')
      .filter(function (r) { return r.date >= weekStart; })
      .sort(function (a, b) { return b.date.localeCompare(a.date); });
    const box = document.getElementById('reflectSummary');

    if (!list.length) {
      box.innerHTML = UI.empty('loop', '這週還沒有反思紀錄',
        '下課後兩分鐘、寫三句話就好：發生什麼、有效／無效各一件、明天的一個小改動。');
      return;
    }

    box.innerHTML =
      '<p class="small muted">本週已寫 <strong class="num">' + list.length + '</strong> 篇 ' +
      '（' + ['L1', 'L2', 'L3'].map(function (lv) {
        return lv + ' ' + list.filter(function (r) { return r.level === lv; }).length + ' 篇';
      }).join('、') + '）</p>' +
      '<ul class="timeline">' + list.slice(0, 3).map(function (r) {
        const f = r.fields || {};
        const gist = f.next || f.action || f.core || f.what || f.describe || f.event || '（未填寫）';
        return '<li><div class="timeline-date">' + UI.formatDate(r.date) + ' · ' + r.level +
          (r.unit ? ' · ' + UI.esc(r.unit) : '') + '</div>' +
          '<div class="timeline-body">' + UI.esc(String(gist).slice(0, 70)) + (String(gist).length > 70 ? '…' : '') + '</div></li>';
      }).join('') + '</ul>';
  }

  /* ====================== 統一重畫 ====================== */
  function refresh() {
    renderToday();
    renderTodos();
    renderWheels();
    renderAlerts();
    renderFlagged();
    renderReflect();
  }

  // 讓 ui.js 的快速新增按鈕改完資料後能通知本頁重畫
  window.onDataChanged = refresh;

  refresh();
})();
