/* ==========================================================================
   resources.js — 資源中心（resources.html）
   --------------------------------------------------------------------------
   三個分頁：常用連結（分類收藏）、檢核清單（可勾選、可自建）、教學筆記（純文字）。
   ========================================================================== */

(function () {
  'use strict';

  UI.renderShell('resources.html');

  [['icon-link', 'link'], ['icon-check', 'check'], ['icon-note', 'note']].forEach(function (p) {
    const el = document.getElementById(p[0]);
    if (el) el.innerHTML = UI.icon(p[1], 20);
  });

  // 預設分類；自己加新分類就改這個陣列（既有資料的分類也會自動出現在篩選器）
  const CATEGORIES = ['課綱與教材', '實驗安全', '科展', '班級經營', '研習平台', '其他'];

  let tab = 'links';
  let filterCat = '';
  let noteQuery = '';

  /* ====================== 分頁切換 ====================== */
  function showTab(name) {
    tab = name;
    document.querySelectorAll('#mainTabs .tab').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.tab === name);
    });
    ['links', 'checklists', 'notes'].forEach(function (k) {
      document.getElementById('panel-' + k).hidden = (k !== name);
    });
  }
  document.querySelectorAll('#mainTabs .tab').forEach(function (b) {
    b.addEventListener('click', function () { showTab(b.dataset.tab); });
  });

  /* ====================== 常用連結 ====================== */
  function allCategories() {
    const used = Store.list('links').map(function (l) { return l.category; });
    return CATEGORIES.concat(used.filter(function (c) { return c && CATEGORIES.indexOf(c) < 0; }))
      .filter(function (c, i, a) { return a.indexOf(c) === i; });
  }

  function renderCatFilter() {
    document.getElementById('filterCat').innerHTML = '<option value="">全部分類</option>' +
      allCategories().map(function (c) {
        return '<option value="' + UI.esc(c) + '"' + (filterCat === c ? ' selected' : '') + '>' + UI.esc(c) + '</option>';
      }).join('');
  }

  function renderLinks() {
    const all = Store.list('links');
    const box = document.getElementById('linkList');

    if (!all.length) {
      box.innerHTML = UI.empty('link', '還沒有收藏任何連結',
        '把課綱、實驗安全法規、研習平台放進來，需要時不用再翻瀏覽器書籤。',
        '<button class="btn btn-primary" id="linkEmptyBtn" type="button">新增第一個連結</button>');
      const b = document.getElementById('linkEmptyBtn');
      if (b) b.addEventListener('click', function () { editLink(null); });
      return;
    }

    const cats = allCategories().filter(function (c) {
      if (filterCat && c !== filterCat) return false;
      return all.some(function (l) { return l.category === c; });
    });

    box.innerHTML = cats.map(function (c) {
      const items = all.filter(function (l) { return l.category === c; });
      return '<h4 class="mb-2 mt-4">' + UI.esc(c) + ' <span class="small muted">' + items.length + '</span></h4>' +
        items.map(function (l) {
          return '<div class="link-item">' +
            '<span class="card-icon" style="width:32px;height:32px;flex:0 0 32px">' + UI.icon('link', 15) + '</span>' +
            '<div class="link-body">' +
              '<a href="' + UI.esc(l.url) + '" target="_blank" rel="noopener"><strong>' + UI.esc(l.title) + '</strong></a>' +
              (l.note ? '<div class="small muted">' + UI.esc(l.note) + '</div>' : '') +
              '<div class="link-url">' + UI.esc(l.url) + '</div>' +
            '</div>' +
            '<div class="row" style="gap:4px">' +
              '<button class="btn btn-icon btn-ghost" data-lcopy="' + l.id + '" type="button" aria-label="複製網址">' + UI.icon('copy', 15) + '</button>' +
              '<button class="btn btn-icon btn-ghost" data-ledit="' + l.id + '" type="button" aria-label="編輯">' + UI.icon('edit', 15) + '</button>' +
              '<button class="btn btn-icon btn-ghost" data-ldel="' + l.id + '" type="button" aria-label="刪除">' + UI.icon('trash', 15) + '</button>' +
            '</div></div>';
        }).join('');
    }).join('') || UI.empty('search', '這個分類還沒有連結', '換一個分類，或直接新增。');

    box.querySelectorAll('[data-lcopy]').forEach(function (b) {
      b.addEventListener('click', function () { UI.copyText(Store.find('links', b.dataset.lcopy).url); });
    });
    box.querySelectorAll('[data-ledit]').forEach(function (b) {
      b.addEventListener('click', function () { editLink(b.dataset.ledit); });
    });
    box.querySelectorAll('[data-ldel]').forEach(function (b) {
      b.addEventListener('click', function () {
        UI.confirmDelete('要刪除這個連結嗎？', function () {
          Store.remove('links', b.dataset.ldel); UI.toast('已刪除'); renderCatFilter(); renderLinks();
        });
      });
    });
  }

  function editLink(id) {
    const l = id ? Store.find('links', id) : null;
    UI.modal({
      title: l ? '編輯連結' : '新增連結',
      bodyHTML:
        '<div class="field"><label for="lkTitle">名稱</label>' +
          '<input type="text" id="lkTitle" value="' + UI.esc(l ? l.title : '') + '"></div>' +
        '<div class="field"><label for="lkUrl">網址</label>' +
          '<input type="url" id="lkUrl" value="' + UI.esc(l ? l.url : '') + '" placeholder="https://"></div>' +
        '<div class="field"><label for="lkCat">分類</label><select id="lkCat">' +
          allCategories().map(function (c) {
            return '<option value="' + UI.esc(c) + '"' + (l && l.category === c ? ' selected' : '') + '>' + UI.esc(c) + '</option>';
          }).join('') + '</select></div>' +
        '<div class="field mb-0"><label for="lkNote">備註（這個連結什麼時候會用到）</label>' +
          '<input type="text" id="lkNote" value="' + UI.esc(l ? l.note : '') + '"></div>',
      onOK: function (m) {
        const title = m.querySelector('#lkTitle').value.trim();
        let url = m.querySelector('#lkUrl').value.trim();
        if (!title || !url) { UI.toast('名稱與網址都要填'); return false; }
        if (!/^https?:\/\//.test(url)) url = 'https://' + url;
        const rec = { title: title, url: url, category: m.querySelector('#lkCat').value, note: m.querySelector('#lkNote').value.trim() };
        if (l) { Store.update('links', l.id, rec); UI.toast('已更新'); }
        else { Store.add('links', rec); UI.toast('已新增連結'); }
        renderCatFilter(); renderLinks(); return true;
      }
    });
  }

  document.getElementById('filterCat').addEventListener('change', function (e) {
    filterCat = e.target.value; renderLinks();
  });
  document.getElementById('newLinkBtn').addEventListener('click', function () { editLink(null); });

  /* ====================== 檢核清單 ====================== */
  function renderChecklists() {
    const list = Store.list('checklists');
    const box = document.getElementById('clList');

    if (!list.length) {
      box.innerHTML = UI.empty('check', '還沒有檢核清單',
        '把「每次都會忘記」的事寫成清單。忘記靠清單解決，不要靠記性。',
        '<button class="btn btn-primary" id="clEmptyBtn" type="button">新增清單</button>');
      const b = document.getElementById('clEmptyBtn');
      if (b) b.addEventListener('click', function () { editChecklist(null); });
      return;
    }

    box.innerHTML = list.map(function (cl) {
      const done = cl.items.filter(function (i) { return i.done; }).length;
      const pct = cl.items.length ? Math.round(done / cl.items.length * 100) : 0;
      return '<section class="card">' +
        '<div class="card-head">' +
          '<span class="card-icon">' + UI.icon('check', 20) + '</span>' +
          '<h3>' + UI.esc(cl.title) + '</h3>' +
          (cl.builtin ? '<span class="tag tag-info">內建</span>' : '') +
          '<span class="grow"></span>' +
          '<span class="small muted nowrap">' + done + ' / ' + cl.items.length + '</span>' +
          '<button class="btn btn-sm btn-ghost" data-clreset="' + cl.id + '" type="button">重設</button>' +
          '<button class="btn btn-icon btn-ghost" data-cledit="' + cl.id + '" type="button" aria-label="編輯">' + UI.icon('edit', 15) + '</button>' +
          '<button class="btn btn-icon btn-ghost" data-cldel="' + cl.id + '" type="button" aria-label="刪除">' + UI.icon('trash', 15) + '</button>' +
        '</div>' +
        (cl.desc ? '<p class="small muted">' + UI.esc(cl.desc) + '</p>' : '') +
        '<div class="bar' + (pct === 100 ? ' bar-accent' : '') + ' mb-4"><span style="width:' + pct + '%"></span></div>' +
        cl.items.map(function (it, i) {
          return '<label class="check"><input type="checkbox" data-cl="' + cl.id + '" data-i="' + i + '"' +
            (it.done ? ' checked' : '') + '><span class="check-text">' + UI.esc(it.text) + '</span></label>';
        }).join('') +
      '</section>';
    }).join('');

    box.querySelectorAll('[data-cl]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        const cl = Store.find('checklists', cb.dataset.cl);
        cl.items[Number(cb.dataset.i)].done = cb.checked;
        Store.commit(); renderChecklists();
      });
    });
    box.querySelectorAll('[data-clreset]').forEach(function (b) {
      b.addEventListener('click', function () {
        const cl = Store.find('checklists', b.dataset.clreset);
        cl.items.forEach(function (i) { i.done = false; });
        Store.commit(); UI.toast('已全部取消勾選'); renderChecklists();
      });
    });
    box.querySelectorAll('[data-cledit]').forEach(function (b) {
      b.addEventListener('click', function () { editChecklist(b.dataset.cledit); });
    });
    box.querySelectorAll('[data-cldel]').forEach(function (b) {
      b.addEventListener('click', function () {
        UI.confirmDelete('要刪除整份清單嗎？內建清單可以在設定頁重新載入示範資料取回。', function () {
          Store.remove('checklists', b.dataset.cldel); UI.toast('已刪除'); renderChecklists();
        });
      });
    });
  }

  function editChecklist(id) {
    const cl = id ? Store.find('checklists', id) : null;
    UI.modal({
      title: cl ? '編輯清單' : '新增清單',
      wide: true,
      bodyHTML:
        '<div class="field"><label for="clTitle">清單名稱</label>' +
          '<input type="text" id="clTitle" value="' + UI.esc(cl ? cl.title : '') + '" placeholder="例：戶外教學前一天檢查"></div>' +
        '<div class="field"><label for="clDesc">說明</label>' +
          '<input type="text" id="clDesc" value="' + UI.esc(cl ? cl.desc : '') + '"></div>' +
        '<div class="field mb-0"><label for="clItems">項目（一行一項）</label>' +
          '<textarea id="clItems" style="min-height:180px">' +
          UI.esc(cl ? cl.items.map(function (i) { return i.text; }).join('\n') : '') + '</textarea>' +
          '<span class="field-hint">編輯後已勾選的狀態會依「行的順序」保留。</span></div>',
      onOK: function (m) {
        const title = m.querySelector('#clTitle').value.trim();
        const lines = m.querySelector('#clItems').value.split('\n')
          .map(function (s) { return s.trim(); }).filter(Boolean);
        if (!title || !lines.length) { UI.toast('清單名稱與至少一個項目'); return false; }
        const items = lines.map(function (t, i) {
          const old = cl && cl.items[i];
          return { text: t, done: old ? !!old.done : false };
        });
        if (cl) { Store.update('checklists', cl.id, { title: title, desc: m.querySelector('#clDesc').value.trim(), items: items }); UI.toast('已更新'); }
        else { Store.add('checklists', { title: title, desc: m.querySelector('#clDesc').value.trim(), builtin: false, items: items }); UI.toast('已新增清單'); }
        renderChecklists(); return true;
      }
    });
  }

  document.getElementById('newClBtn').addEventListener('click', function () { editChecklist(null); });

  /* ====================== 教學筆記 ====================== */
  function renderNotes() {
    let list = Store.list('notes').slice().sort(function (a, b) {
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });
    if (noteQuery) {
      const q = noteQuery.toLowerCase();
      list = list.filter(function (n) {
        return (n.title + ' ' + n.body).toLowerCase().indexOf(q) >= 0;
      });
    }
    const box = document.getElementById('noteList');

    if (!list.length) {
      box.innerHTML = UI.empty('note', noteQuery ? '找不到符合的筆記' : '還沒有筆記',
        '每個單元的「學生卡在哪裡」寫一則，明年的你會非常感謝現在的你。',
        '<button class="btn btn-primary" id="noteEmptyBtn" type="button">新增筆記</button>');
      const b = document.getElementById('noteEmptyBtn');
      if (b) b.addEventListener('click', function () { editNote(null); });
      return;
    }

    box.innerHTML = list.map(function (n) {
      return '<details class="fold"><summary>' +
        '<span class="nowrap small muted">' + UI.formatDate(n.updatedAt) + '</span>' +
        '<span class="grow"><strong>' + UI.esc(n.title) + '</strong></span></summary>' +
        '<div class="fold-body">' +
        '<p class="pre-wrap">' + UI.esc(n.body) + '</p>' +
        '<div class="row mt-3">' +
          '<button class="btn btn-sm" data-nedit="' + n.id + '" type="button">編輯</button>' +
          '<button class="btn btn-sm btn-ghost" data-ncopy="' + n.id + '" type="button">複製內容</button>' +
          '<button class="btn btn-sm btn-danger" data-ndel="' + n.id + '" type="button">刪除</button>' +
        '</div></div></details>';
    }).join('');

    box.querySelectorAll('[data-nedit]').forEach(function (b) {
      b.addEventListener('click', function () { editNote(b.dataset.nedit); });
    });
    box.querySelectorAll('[data-ncopy]').forEach(function (b) {
      b.addEventListener('click', function () {
        const n = Store.find('notes', b.dataset.ncopy);
        UI.copyText(n.title + '\n\n' + n.body);
      });
    });
    box.querySelectorAll('[data-ndel]').forEach(function (b) {
      b.addEventListener('click', function () {
        UI.confirmDelete('要刪除這則筆記嗎？', function () {
          Store.remove('notes', b.dataset.ndel); UI.toast('已刪除'); renderNotes();
        });
      });
    });
  }

  function editNote(id) {
    const n = id ? Store.find('notes', id) : null;
    UI.modal({
      title: n ? '編輯筆記' : '新增筆記',
      wide: true,
      bodyHTML:
        '<div class="field"><label for="ntTitle">標題</label>' +
          '<input type="text" id="ntTitle" value="' + UI.esc(n ? n.title : '') + '" placeholder="例：六年級「電磁鐵」卡點筆記"></div>' +
        '<div class="field mb-0"><label for="ntBody">內容</label>' +
          '<textarea id="ntBody" style="min-height:220px">' + UI.esc(n ? n.body : '') + '</textarea>' +
          '<span class="field-hint">純文字，換行會保留。</span></div>',
      onOK: function (m) {
        const title = m.querySelector('#ntTitle').value.trim();
        if (!title) { UI.toast('請填標題'); return false; }
        const rec = { title: title, body: m.querySelector('#ntBody').value, updatedAt: UI.todayISO() };
        if (n) { Store.update('notes', n.id, rec); UI.toast('已更新'); }
        else { Store.add('notes', rec); UI.toast('已新增筆記'); }
        renderNotes(); return true;
      }
    });
  }

  document.getElementById('newNoteBtn').addEventListener('click', function () { editNote(null); });
  document.getElementById('noteSearch').addEventListener('input', function (e) {
    noteQuery = e.target.value.trim(); renderNotes();
  });

  /* ====================== 啟動 ====================== */
  function refresh() {
    renderCatFilter(); renderLinks(); renderChecklists(); renderNotes();
  }
  window.onDataChanged = refresh;
  refresh();

  // 支援用網址 hash 直接開分頁，例如 resources.html#checklists
  const h = location.hash.replace('#', '');
  if (['links', 'checklists', 'notes'].indexOf(h) >= 0) showTab(h);
})();
