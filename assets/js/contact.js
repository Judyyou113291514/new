/* ==========================================================================
   contact.js — 親師溝通（contact.html）
   --------------------------------------------------------------------------
   功能：模板庫（新增／編輯／刪除）、帶入變數產生訊息、一鍵複製、
         聯繫紀錄 CRUD、待追蹤清單勾選。
   模板變數：{{student}} {{class}} {{parent}} {{teacher}} {{unit}}
   ========================================================================== */

(function () {
  'use strict';

  UI.renderShell('contact.html');

  [['icon-inbox', 'inbox'], ['icon-chat', 'chat'], ['icon-note', 'note']].forEach(function (p) {
    const el = document.getElementById(p[0]);
    if (el) el.innerHTML = UI.icon(p[1], 20);
  });

  const METHODS = ['訊息（導師轉達）', '電話', '面談（放學後）', '聯絡簿', 'Email', '班親會'];

  let activeTplId = null;
  let filterClassId = '';

  /* ====================== 模板庫 ====================== */
  function renderTemplates() {
    const list = Store.list('templates');
    const box = document.getElementById('tplGrid');
    if (!list.length) {
      box.innerHTML = UI.empty('chat', '模板庫是空的',
        '模板可以省下每次重寫的時間。按右上「新增模板」建立第一個，或到設定頁還原示範資料。');
      return;
    }
    box.innerHTML = list.map(function (t) {
      return '<button class="tpl-card' + (activeTplId === t.id ? ' is-active' : '') + '" data-tpl="' + t.id + '" type="button">' +
        '<h4>' + UI.esc(t.title) + '</h4>' +
        '<span class="tag">' + UI.esc(t.category) + '</span>' +
        '<p>' + UI.esc(t.body.replace(/\{\{\w+\}\}/g, '＿')) + '</p>' +
        '<span class="row" style="gap:4px;margin-top:2px">' +
          '<span class="btn btn-sm btn-ghost" data-tedit="' + t.id + '" role="button">編輯</span>' +
          '<span class="btn btn-sm btn-ghost" data-tdel="' + t.id + '" role="button">刪除</span>' +
        '</span></button>';
    }).join('');

    box.querySelectorAll('[data-tpl]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        if (e.target.closest('[data-tedit]')) { editTemplate(b.dataset.tpl); return; }
        if (e.target.closest('[data-tdel]')) { delTemplate(b.dataset.tpl); return; }
        activeTplId = b.dataset.tpl;
        renderTemplates();
        generate();
      });
    });
  }

  function editTemplate(id) {
    const t = id ? Store.find('templates', id) : null;
    UI.modal({
      title: t ? '編輯模板' : '新增模板',
      wide: true,
      bodyHTML:
        '<div class="field-row">' +
          '<div class="field"><label for="tTitle">模板名稱</label>' +
            '<input type="text" id="tTitle" value="' + UI.esc(t ? t.title : '') + '" placeholder="例：實驗器材提醒"></div>' +
          '<div class="field"><label for="tCat">分類</label>' +
            '<input type="text" id="tCat" value="' + UI.esc(t ? t.category : '') + '" placeholder="例：課前準備"></div>' +
        '</div>' +
        '<div class="field mb-0"><label for="tBody">內容</label>' +
          '<span class="field-hint">可用變數：{{student}} 學生姓名、{{class}} 班級、{{parent}} 家長稱謂、{{teacher}} 老師姓名、{{unit}} 單元或事件。</span>' +
          '<textarea id="tBody" style="min-height:180px">' + UI.esc(t ? t.body : '') + '</textarea></div>',
      onOK: function (m) {
        const title = m.querySelector('#tTitle').value.trim();
        const body = m.querySelector('#tBody').value.trim();
        if (!title || !body) { UI.toast('名稱與內容都要填'); return false; }
        const rec = { title: title, category: m.querySelector('#tCat').value.trim() || '未分類', body: body };
        if (t) { Store.update('templates', t.id, rec); UI.toast('已更新模板'); }
        else { rec.builtin = false; const n = Store.add('templates', rec); activeTplId = n.id; UI.toast('已新增模板'); }
        renderTemplates(); generate(); return true;
      }
    });
  }

  function delTemplate(id) {
    const t = Store.find('templates', id);
    UI.confirmDelete('要刪除模板「' + t.title + '」嗎？', function () {
      Store.remove('templates', id);
      if (activeTplId === id) { activeTplId = null; document.getElementById('genText').value = ''; }
      UI.toast('已刪除'); renderTemplates();
    });
  }

  /* ====================== 產生訊息 ====================== */
  function generate() {
    const t = activeTplId ? Store.find('templates', activeTplId) : null;
    if (!t) return;
    const sid = document.getElementById('varStudent').value;
    const s = Store.student(sid);
    const map = {
      student: s ? s.name : '＿＿＿',
      'class': s ? Store.className(s.classId) : '＿＿＿',
      parent: document.getElementById('varParent').value.trim() || '家長',
      teacher: Store.settings().teacherName || '老師',
      unit: document.getElementById('varUnit').value.trim() || '＿＿＿'
    };
    document.getElementById('genText').value = t.body.replace(/\{\{(\w+)\}\}/g, function (all, key) {
      return map[key] != null ? map[key] : all;
    });
  }

  ['varStudent', 'varParent', 'varUnit'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', generate);
    document.getElementById(id).addEventListener('change', generate);
  });

  document.getElementById('copyBtn').addEventListener('click', function () {
    const txt = document.getElementById('genText').value.trim();
    if (!txt) { UI.toast('還沒有內容可複製'); return; }
    UI.copyText(txt);
  });
  document.getElementById('clearGenBtn').addEventListener('click', function () {
    document.getElementById('genText').value = '';
    activeTplId = null; renderTemplates();
  });
  document.getElementById('saveAsRecordBtn').addEventListener('click', function () {
    const txt = document.getElementById('genText').value.trim();
    if (!txt) { UI.toast('還沒有內容'); return; }
    editContact(null, txt);
  });

  /* ====================== 聯繫紀錄 ====================== */
  function renderContacts() {
    let list = Store.list('contacts').slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    if (filterClassId) list = list.filter(function (c) { return c.classId === filterClassId; });
    const box = document.getElementById('contactList');

    if (!list.length) {
      box.innerHTML = UI.empty('note', '還沒有聯繫紀錄',
        '每一次和家長的接觸都留一行紀錄。將來要談就有依據，也保護自己。',
        '<button class="btn btn-primary" id="ctEmptyBtn" type="button">新增第一筆</button>');
      const b = document.getElementById('ctEmptyBtn');
      if (b) b.addEventListener('click', function () { editContact(null); });
      return;
    }

    box.innerHTML = '<div class="list">' + list.map(function (c) {
      return '<div class="list-item">' +
        '<div class="list-item-body">' +
          '<div class="list-item-title"><strong>' + UI.esc(Store.studentLabel(c.studentId)) + '</strong> ' +
            '<span class="tag">' + UI.esc(c.method) + '</span></div>' +
          '<div class="list-item-meta">' + UI.formatDate(c.date, true) + '</div>' +
          '<div class="small pre-wrap mt-3" style="margin-top:5px">' + UI.esc(c.content) + '</div>' +
          (c.followUp ? '<div class="small" style="margin-top:5px">' +
            '<span class="tag ' + (c.followDone ? 'tag-success' : 'tag-warn') + '">' +
            (c.followDone ? '已完成' : '待追蹤') + '</span> ' + UI.esc(c.followUp) + '</div>' : '') +
        '</div>' +
        '<div class="list-item-actions">' +
          '<button class="btn btn-icon btn-ghost" data-cedit="' + c.id + '" type="button" aria-label="編輯">' + UI.icon('edit', 16) + '</button>' +
          '<button class="btn btn-icon btn-ghost" data-cdel="' + c.id + '" type="button" aria-label="刪除">' + UI.icon('trash', 16) + '</button>' +
        '</div></div>';
    }).join('') + '</div>';

    box.querySelectorAll('[data-cedit]').forEach(function (b) {
      b.addEventListener('click', function () { editContact(b.dataset.cedit); });
    });
    box.querySelectorAll('[data-cdel]').forEach(function (b) {
      b.addEventListener('click', function () {
        UI.confirmDelete('要刪除這筆聯繫紀錄嗎？', function () {
          Store.remove('contacts', b.dataset.cdel); UI.toast('已刪除'); refresh();
        });
      });
    });
  }

  function editContact(id, presetContent) {
    const c = id ? Store.find('contacts', id) : null;
    const students = Store.list('students');
    if (!students.length) { UI.toast('請先到「班級與學生」建立學生'); return; }
    const preSid = c ? c.studentId : document.getElementById('varStudent').value;

    UI.modal({
      title: c ? '編輯聯繫紀錄' : '新增聯繫紀錄',
      wide: true,
      bodyHTML:
        '<div class="field-row">' +
          '<div class="field"><label for="cStu">學生</label><select id="cStu">' +
            students.map(function (s) {
              return '<option value="' + s.id + '"' + (preSid === s.id ? ' selected' : '') + '>' +
                UI.esc(Store.studentLabel(s.id)) + '</option>';
            }).join('') + '</select></div>' +
          '<div class="field"><label for="cDate">日期</label>' +
            '<input type="date" id="cDate" value="' + (c ? c.date : UI.todayISO()) + '"></div>' +
        '</div>' +
        '<div class="field"><label for="cMethod">聯繫方式</label><select id="cMethod">' +
          METHODS.map(function (m2) {
            return '<option value="' + m2 + '"' + (c && c.method === m2 ? ' selected' : '') + '>' + m2 + '</option>';
          }).join('') + '</select></div>' +
        '<div class="field"><label for="cContent">內容</label>' +
          '<textarea id="cContent" style="min-height:120px">' + UI.esc(c ? c.content : (presetContent || '')) + '</textarea></div>' +
        '<div class="field"><label for="cFollow">後續待辦（沒有就留空）</label>' +
          '<input type="text" id="cFollow" value="' + UI.esc(c ? c.followUp : '') + '" placeholder="例：下週回報是否改善"></div>' +
        '<label class="check check-plain mb-0"><input type="checkbox" id="cDone"' + (c && c.followDone ? ' checked' : '') + '>' +
          '<span class="check-text">後續待辦已完成</span></label>',
      onOK: function (m) {
        const content = m.querySelector('#cContent').value.trim();
        if (!content) { UI.toast('請填內容'); return false; }
        const sid = m.querySelector('#cStu').value;
        const rec = {
          studentId: sid,
          classId: (Store.student(sid) || {}).classId,
          date: m.querySelector('#cDate').value || UI.todayISO(),
          method: m.querySelector('#cMethod').value,
          content: content,
          followUp: m.querySelector('#cFollow').value.trim(),
          followDone: m.querySelector('#cDone').checked
        };
        if (c) { Store.update('contacts', c.id, rec); UI.toast('已更新'); }
        else { Store.add('contacts', rec); UI.toast('已新增聯繫紀錄'); }
        refresh(); return true;
      }
    });
  }

  /* ====================== 待追蹤清單 ====================== */
  function renderFollowups() {
    const list = Store.list('contacts').filter(function (c) { return c.followUp && !c.followDone; })
      .sort(function (a, b) { return a.date.localeCompare(b.date); });
    const box = document.getElementById('followList');
    document.getElementById('followCount').textContent = list.length ? list.length + ' 件未完成' : '';

    if (!list.length) {
      box.innerHTML = '<div class="alert alert-success">' + UI.icon('check', 18) +
        '<div class="alert-body"><div class="alert-title">沒有待追蹤事項</div>' +
        '<div class="alert-desc">所有親師聯繫的後續都處理完了。</div></div></div>';
      return;
    }

    box.innerHTML = '<div class="list">' + list.map(function (c) {
      const days = UI.daysBetween(c.date, UI.todayISO());
      return '<div class="list-item">' +
        '<label class="check grow check-plain">' +
          '<input type="checkbox" data-fdone="' + c.id + '">' +
          '<span class="check-text"><strong>' + UI.esc(c.followUp) + '</strong>' +
            '<span class="list-item-meta">' + UI.esc(Store.studentLabel(c.studentId)) + ' · ' +
            UI.formatDate(c.date) + '（已過 ' + days + ' 天）</span></span>' +
        '</label>' +
        (days >= 7 ? '<span class="tag tag-danger">超過一週</span>' : '') +
        '</div>';
    }).join('') + '</div>';

    box.querySelectorAll('[data-fdone]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        Store.update('contacts', cb.dataset.fdone, { followDone: true });
        UI.toast('已標記完成'); refresh();
      });
    });
  }

  /* ====================== 下拉選單與篩選 ====================== */
  function renderSelectors() {
    const students = Store.list('students');
    const sel = document.getElementById('varStudent');
    const keep = sel.value;
    sel.innerHTML = students.length
      ? students.map(function (s) { return '<option value="' + s.id + '">' + UI.esc(Store.studentLabel(s.id)) + '</option>'; }).join('')
      : '<option value="">（還沒有學生）</option>';
    if (keep) sel.value = keep;

    document.getElementById('filterClass').innerHTML = '<option value="">全部班級</option>' +
      Store.classes().map(function (c) {
        return '<option value="' + c.id + '"' + (filterClassId === c.id ? ' selected' : '') + '>' + UI.esc(c.name) + '</option>';
      }).join('');
  }

  document.getElementById('filterClass').addEventListener('change', function (e) {
    filterClassId = e.target.value; renderContacts();
  });
  document.getElementById('newTplBtn').addEventListener('click', function () { editTemplate(null); });
  document.getElementById('newContactBtn').addEventListener('click', function () { editContact(null); });

  function refresh() {
    renderSelectors();
    renderTemplates();
    renderContacts();
    renderFollowups();
  }
  window.onDataChanged = refresh;

  refresh();
})();
