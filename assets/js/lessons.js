/* ==========================================================================
   lessons.js — 課程與備課（lessons.html）
   --------------------------------------------------------------------------
   功能：備課單新增／編輯／刪除／複製到其他班、器材備齊勾選、列印教案。
   ========================================================================== */

(function () {
  'use strict';

  UI.renderShell('lessons.html');

  /* ---------- 108 課綱自然領域「學習表現」代碼（第三學習階段常用）----------
     想增減選項只要改這個陣列。格式：[代碼, 說明] */
  const CODES = [
    ['po-Ⅲ-1', '能從日常經驗、學習活動中，對自然現象產生好奇'],
    ['po-Ⅲ-2', '能辨別適合科學探究或適合以科學方式尋求解決的問題'],
    ['pe-Ⅲ-1', '能了解自變項、應變項與控制變項，並規劃簡單的探究活動'],
    ['pe-Ⅲ-2', '能正確安全操作器材，並運用文字、圖表紀錄過程與現象'],
    ['pa-Ⅲ-1', '能分析比較、製作圖表，並運用簡單數學方法整理資料'],
    ['pa-Ⅲ-2', '能運用簡單的科學知識形成解釋，並提出可能的證據'],
    ['pc-Ⅲ-1', '能與同儕合作，並適當分工完成探究任務'],
    ['pc-Ⅲ-2', '能利用口語、繪圖、文字表達探究過程與結果'],
    ['tr-Ⅲ-1', '能將所學應用於生活情境，解決簡單問題'],
    ['tm-Ⅲ-1', '能經由觀察建立模型，並用模型解釋現象'],
    ['ai-Ⅲ-1', '能參與科學活動並樂於分享，展現對科學的興趣'],
    ['ah-Ⅲ-1', '能養成愛護生物、尊重生命與環境的態度'],
    ['an-Ⅲ-1', '知道科學史上重要發現是眾人合作累積的成果']
  ];

  /* ---------- 教學流程四段（含建議時間）---------- */
  const FLOW_STEPS = [
    ['motivate', '引起動機', 5,  '用一個現象或提問勾住好奇心，先不解釋原理'],
    ['inquiry', '探究活動', 20, '學生動手的主場；先講清指令再發器材'],
    ['integrate', '統整', 8,  '各組結果放在一起比較，導出說法'],
    ['wrapup', '收尾', 7,  '含收拾時間（科任一定要預留 5–8 分鐘）']
  ];

  let filterClassId = '';

  /* ====================== 列表 ====================== */
  function renderList() {
    const box = document.getElementById('lessonList');
    let list = Store.list('lessons').slice().sort(function (a, b) {
      return String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt));
    });
    if (filterClassId) list = list.filter(function (l) { return l.classId === filterClassId; });

    const all = Store.list('lessons');
    let mTotal = 0, mReady = 0;
    all.forEach(function (l) { (l.materials || []).forEach(function (m) { mTotal++; if (m.ready) mReady++; }); });
    document.getElementById('lessonStats').textContent =
      '共 ' + all.length + ' 份備課單 · 器材備齊 ' + mReady + '／' + mTotal + ' 項';

    if (!list.length) {
      box.innerHTML = UI.empty('book',
        filterClassId ? '這個班還沒有備課單' : '還沒有備課單',
        '從最近要上的那一課開始就好。填完「器材清單」和「預期卡點與備案」，上課當天會輕鬆很多。',
        '<button class="btn btn-primary" id="emptyNewBtn" type="button">新增第一份備課單</button>');
      const b = document.getElementById('emptyNewBtn');
      if (b) b.addEventListener('click', function () { openForm(null); });
      return;
    }

    box.innerHTML = list.map(cardHTML).join('');
    bindCardEvents();

    // 從其他頁用 #id 連過來時，捲動並highlight
    if (location.hash.length > 1) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) {
        target.scrollIntoView({ block: 'center' });
        target.style.borderColor = 'var(--c-primary)';
      }
    }
  }

  function cardHTML(l) {
    const mats = l.materials || [];
    const ready = mats.filter(function (m) { return m.ready; }).length;
    const pct = mats.length ? Math.round(ready / mats.length * 100) : 0;
    const totalMin = FLOW_STEPS.reduce(function (s, f) {
      return s + (Number((l.flow && l.flow[f[0]] && l.flow[f[0]].min) || 0));
    }, 0);

    return '<section class="card" id="' + l.id + '">' +
      '<div class="card-head">' +
        '<span class="card-icon">' + UI.icon('book', 20) + '</span>' +
        '<h3>' + UI.esc(l.unit) + ' <span class="tag tag-primary">' + UI.esc(Store.className(l.classId)) + '</span></h3>' +
        '<button class="btn btn-sm" data-print="' + l.id + '" type="button">' + UI.icon('print', 15) + '列印教案</button>' +
        '<button class="btn btn-sm" data-copy="' + l.id + '" type="button">' + UI.icon('copy', 15) + '複製到其他班</button>' +
        '<button class="btn btn-sm" data-edit="' + l.id + '" type="button">' + UI.icon('edit', 15) + '編輯</button>' +
        '<button class="btn btn-sm btn-danger" data-del="' + l.id + '" type="button" aria-label="刪除備課單">' + UI.icon('trash', 15) + '</button>' +
      '</div>' +

      '<div class="grid grid-2">' +
        '<div>' +
          '<div class="field-label mb-2">學習目標</div>' +
          '<p class="pre-wrap">' + UI.esc(l.goals || '（未填）') + '</p>' +
          '<div class="field-label mb-2 mt-4">學習表現代碼</div>' +
          '<div class="row" style="gap:6px">' + ((l.codes || []).length
            ? l.codes.map(function (c) { return '<span class="tag tag-info">' + UI.esc(c) + '</span>'; }).join('')
            : '<span class="small faint">（未選）</span>') + '</div>' +
        '</div>' +
        '<div>' +
          '<div class="field-label mb-2">器材清單（勾選＝已備齊）</div>' +
          (mats.length ? mats.map(function (m, i) {
            return '<label class="check check-plain mb-2"><input type="checkbox" data-mat="' + l.id + ':' + i + '"' +
              (m.ready ? ' checked' : '') + '><span class="check-text">' + UI.esc(m.name) + '</span></label>';
          }).join('') : '<p class="small faint">（未填器材）</p>') +
          (mats.length ? '<div class="bar mt-3' + (pct === 100 ? ' bar-accent' : (pct < 50 ? ' bar-warn' : '')) + '">' +
            '<span style="width:' + pct + '%"></span></div>' +
            '<div class="small muted" style="margin-top:4px">備齊 ' + ready + '／' + mats.length + ' 項</div>' : '') +
        '</div>' +
      '</div>' +

      '<details class="fold mt-4"><summary>' + UI.icon('clock', 16) + '教學流程（合計 ' + totalMin + ' 分鐘）</summary>' +
        '<div class="fold-body">' +
          '<div class="table-wrap"><table class="data"><thead><tr><th>階段</th><th class="cell-center">分鐘</th><th>做法</th></tr></thead><tbody>' +
          FLOW_STEPS.map(function (f) {
            const step = (l.flow && l.flow[f[0]]) || {};
            return '<tr><td class="nowrap"><strong>' + f[1] + '</strong></td>' +
              '<td class="cell-center num">' + UI.esc(step.min || 0) + '</td>' +
              '<td class="pre-wrap">' + UI.esc(step.text || '—') + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
        '</div></details>' +

      '<div class="grid grid-2 mt-3">' +
        '<div class="alert alert-warn">' + UI.icon('alert', 18) +
          '<div class="alert-body"><div class="alert-title">預期卡點</div>' +
          '<div class="alert-desc pre-wrap">' + UI.esc(l.obstacles || '（未填）') + '</div></div></div>' +
        '<div class="alert alert-info">' + UI.icon('info', 18) +
          '<div class="alert-body"><div class="alert-title">備案</div>' +
          '<div class="alert-desc pre-wrap">' + UI.esc(l.backup || '（未填）') + '</div></div></div>' +
      '</div>' +
      '</section>';
  }

  function bindCardEvents() {
    const box = document.getElementById('lessonList');
    box.querySelectorAll('[data-mat]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        const parts = cb.dataset.mat.split(':');
        const l = Store.find('lessons', parts[0]);
        if (!l) return;
        l.materials[Number(parts[1])].ready = cb.checked;
        Store.commit();
        renderList();
      });
    });
    box.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { openForm(b.dataset.edit); });
    });
    box.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        const l = Store.find('lessons', b.dataset.del);
        UI.confirmDelete('要刪除「' + (l ? l.unit : '') + '」這份備課單嗎？', function () {
          Store.remove('lessons', b.dataset.del); UI.toast('已刪除'); renderList();
        });
      });
    });
    box.querySelectorAll('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () { duplicate(b.dataset.copy); });
    });
    box.querySelectorAll('[data-print]').forEach(function (b) {
      b.addEventListener('click', function () { printLesson(b.dataset.print); });
    });
  }

  /* ====================== 新增／編輯表單 ====================== */
  function openForm(id) {
    const l = id ? Store.find('lessons', id) : null;
    const classes = Store.classes();
    if (!classes.length) {
      UI.modal({ title: '還沒有班級', hideCancel: true, okText: null,
        bodyHTML: '<p>請先到「班級與學生」建立班級，備課單才能對應到班。</p>' +
          '<a class="btn btn-primary" href="classes.html">前往班級與學生</a>' });
      return;
    }

    const flow = (l && l.flow) || {};
    const mats = (l && l.materials) || [{ name: '', ready: false }];

    const body =
      '<div class="field-row">' +
        '<div class="field"><label for="fClass">班級</label><select id="fClass">' +
          classes.map(function (c) {
            return '<option value="' + c.id + '"' + (l && l.classId === c.id ? ' selected' : '') + '>' + UI.esc(c.name) + '</option>';
          }).join('') + '</select></div>' +
        '<div class="field"><label for="fUnit">單元名稱</label>' +
          '<input type="text" id="fUnit" value="' + UI.esc(l ? l.unit : '') + '" placeholder="例：熱的傳導與保溫"></div>' +
      '</div>' +

      '<div class="field"><label for="fGoals">學習目標</label>' +
        '<textarea id="fGoals" placeholder="學生上完這堂課「能做到什麼」，用可觀察的動詞寫。">' + UI.esc(l ? l.goals : '') + '</textarea></div>' +

      '<div class="field"><span class="field-label">對應學習表現代碼（可多選）</span>' +
        '<div class="check-grid" id="fCodes">' + CODES.map(function (c) {
          const on = l && (l.codes || []).indexOf(c[0]) >= 0;
          return '<label class="check check-plain"><input type="checkbox" value="' + c[0] + '"' + (on ? ' checked' : '') + '>' +
            '<span class="check-text"><strong>' + c[0] + '</strong><br><span class="xsmall muted">' + UI.esc(c[1]) + '</span></span></label>';
        }).join('') + '</div></div>' +

      '<div class="divider"></div>' +
      '<div class="field-label mb-2">教學流程與時間分配</div>' +
      FLOW_STEPS.map(function (f) {
        const s = flow[f[0]] || {};
        return '<div class="field">' +
          '<label for="fFlow_' + f[0] + '">' + f[1] +
            ' <span class="field-hint">（' + f[3] + '）</span></label>' +
          '<div class="row" style="align-items:flex-start">' +
            '<textarea id="fFlow_' + f[0] + '" class="grow" style="min-height:60px">' + UI.esc(s.text || '') + '</textarea>' +
            '<input type="number" id="fMin_' + f[0] + '" min="0" max="60" style="width:78px" ' +
              'value="' + (s.min != null ? s.min : f[2]) + '" aria-label="' + f[1] + '分鐘數">' +
          '</div></div>';
      }).join('') +

      '<div class="divider"></div>' +
      '<div class="field"><span class="field-label">器材清單</span>' +
        '<div id="fMats"></div>' +
        '<button class="btn btn-sm mt-3" id="addMatBtn" type="button">＋ 加一項器材</button></div>' +

      '<div class="field"><label for="fObstacles">預期卡點</label>' +
        '<textarea id="fObstacles" placeholder="學生最可能在哪裡卡住？（概念混淆、器材操作、秩序）">' + UI.esc(l ? l.obstacles : '') + '</textarea></div>' +
      '<div class="field mb-0"><label for="fBackup">備案</label>' +
        '<textarea id="fBackup" placeholder="卡住時怎麼辦？器材不足怎麼辦？時間不夠砍哪一段？">' + UI.esc(l ? l.backup : '') + '</textarea></div>';

    UI.modal({
      title: l ? '編輯備課單' : '新增備課單',
      wide: true,
      bodyHTML: body,
      okText: '儲存備課單',
      onOpen: function (m) {
        // 器材列（可動態增減）
        const wrap = m.querySelector('#fMats');
        function addRow(name, ready) {
          const row = document.createElement('div');
          row.className = 'row mb-2';
          row.innerHTML =
            '<label class="check check-plain nowrap"><input type="checkbox" class="mat-ready"' + (ready ? ' checked' : '') + '>' +
            '<span class="check-text small">備齊</span></label>' +
            '<input type="text" class="mat-name grow" value="' + UI.esc(name || '') + '" placeholder="例：溫度計 8 支">' +
            '<button class="btn btn-icon btn-ghost mat-del" type="button" aria-label="移除這項">' + UI.icon('x', 16) + '</button>';
          row.querySelector('.mat-del').addEventListener('click', function () { row.remove(); });
          wrap.appendChild(row);
        }
        mats.forEach(function (x) { addRow(x.name, x.ready); });
        m.querySelector('#addMatBtn').addEventListener('click', function () { addRow('', false); });
      },
      onOK: function (m) {
        const unit = m.querySelector('#fUnit').value.trim();
        if (!unit) { UI.toast('請填單元名稱'); return false; }

        const rec = {
          classId: m.querySelector('#fClass').value,
          unit: unit,
          goals: m.querySelector('#fGoals').value.trim(),
          codes: Array.prototype.slice.call(m.querySelectorAll('#fCodes input:checked')).map(function (i) { return i.value; }),
          flow: {},
          materials: [],
          obstacles: m.querySelector('#fObstacles').value.trim(),
          backup: m.querySelector('#fBackup').value.trim(),
          updatedAt: UI.todayISO()
        };
        FLOW_STEPS.forEach(function (f) {
          rec.flow[f[0]] = {
            text: m.querySelector('#fFlow_' + f[0]).value.trim(),
            min: Number(m.querySelector('#fMin_' + f[0]).value) || 0
          };
        });
        m.querySelectorAll('#fMats .row').forEach(function (row) {
          const name = row.querySelector('.mat-name').value.trim();
          if (name) rec.materials.push({ name: name, ready: row.querySelector('.mat-ready').checked });
        });

        if (l) { Store.update('lessons', l.id, rec); UI.toast('已更新備課單'); }
        else { rec.createdAt = UI.todayISO(); Store.add('lessons', rec); UI.toast('已新增備課單'); }
        renderList(); renderFilter(); return true;
      }
    });
  }

  /* ====================== 複製到其他班 ====================== */
  function duplicate(id) {
    const l = Store.find('lessons', id);
    if (!l) return;
    const others = Store.classes();
    UI.modal({
      title: '複製備課單到其他班',
      bodyHTML: '<p class="small muted">會整份複製（含器材與備案），器材的「備齊」狀態會重設為未備齊，因為每個班要各自準備。</p>' +
        '<div class="field mb-0"><label for="dupClass">複製到</label><select id="dupClass">' +
        others.map(function (c) { return '<option value="' + c.id + '">' + UI.esc(c.name) + '</option>'; }).join('') +
        '</select></div>',
      okText: '複製',
      onOK: function (m) {
        const copy = JSON.parse(JSON.stringify(l));
        delete copy.id;
        copy.classId = m.querySelector('#dupClass').value;
        copy.materials = (copy.materials || []).map(function (x) { return { name: x.name, ready: false }; });
        copy.createdAt = UI.todayISO(); copy.updatedAt = UI.todayISO();
        Store.add('lessons', copy);
        UI.toast('已複製到 ' + Store.className(copy.classId));
        renderList(); return true;
      }
    });
  }

  /* ====================== 列印教案 ====================== */
  function printLesson(id) {
    const l = Store.find('lessons', id);
    if (!l) return;
    const st = Store.settings();
    const area = document.getElementById('printArea');
    area.innerHTML =
      '<div class="print-sheet">' +
        '<h1>教學設計簡案：' + UI.esc(l.unit) + '</h1>' +
        '<p class="small">' + UI.esc(Store.className(l.classId)) + '　教師：' + UI.esc(st.teacherName || '＿＿＿') +
          '　' + UI.esc(st.school || '') + '　列印日期：' + UI.formatDate(UI.todayISO(), true) + '</p>' +
        '<table class="data"><tbody>' +
        '<tr><th style="width:120px">學習目標</th><td class="pre-wrap">' + UI.esc(l.goals) + '</td></tr>' +
        '<tr><th>學習表現</th><td>' + UI.esc((l.codes || []).join('、') || '—') + '</td></tr>' +
        FLOW_STEPS.map(function (f) {
          const s = (l.flow && l.flow[f[0]]) || {};
          return '<tr><th>' + f[1] + '（' + (s.min || 0) + ' 分）</th><td class="pre-wrap">' + UI.esc(s.text || '') + '</td></tr>';
        }).join('') +
        '<tr><th>器材</th><td>' + (l.materials || []).map(function (m) {
          return (m.ready ? '☑ ' : '☐ ') + UI.esc(m.name);
        }).join('<br>') + '</td></tr>' +
        '<tr><th>預期卡點</th><td class="pre-wrap">' + UI.esc(l.obstacles) + '</td></tr>' +
        '<tr><th>備案</th><td class="pre-wrap">' + UI.esc(l.backup) + '</td></tr>' +
        '<tr><th>課後反思</th><td style="height:80px"></td></tr>' +
        '</tbody></table>' +
      '</div>';
    document.body.classList.add('print-lesson');
    window.print();
    setTimeout(function () { document.body.classList.remove('print-lesson'); }, 500);
  }

  /* ====================== 班級篩選 ====================== */
  function renderFilter() {
    const sel = document.getElementById('filterClass');
    sel.innerHTML = '<option value="">全部班級</option>' +
      Store.classes().map(function (c) {
        return '<option value="' + c.id + '"' + (filterClassId === c.id ? ' selected' : '') + '>' + UI.esc(c.name) + '</option>';
      }).join('');
  }

  document.getElementById('filterClass').addEventListener('change', function (e) {
    filterClassId = e.target.value; renderList();
  });
  document.getElementById('newLessonBtn').addEventListener('click', function () { openForm(null); });

  renderFilter();
  renderList();
})();
