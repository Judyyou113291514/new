/* ==========================================================================
   scifair.js — 科展管理（scifair.html）
   --------------------------------------------------------------------------
   功能：分組 CRUD、研究設計欄位（問題／自變項／控制變項／依變項／預期）、
         8 週進度勾選、卡關點與下次任務、材料清單、報告檢核清單、落後標紅。
   ========================================================================== */

(function () {
  'use strict';

  UI.renderShell('scifair.html');

  const iconFlask = document.getElementById('icon-flask');
  if (iconFlask) iconFlask.innerHTML = UI.icon('flask', 20);

  const WEEK_TITLES = Store.sciFairWeekTitles();

  // 目前應該進行到第幾週（1–8；還沒開始回傳 0）
  function currentWeek() {
    const start = Store.settings().sciFairStart;
    if (!start) return 0;
    const d = UI.daysBetween(start, UI.todayISO());
    if (d < 0) return 0;
    return Math.min(Math.floor(d / 7) + 1, 8);
  }

  /* ====================== 總覽 ====================== */
  function renderOverview() {
    const groups = Store.list('groups');
    const cw = currentWeek();
    const box = document.getElementById('overview');
    const start = Store.settings().sciFairStart;

    if (!groups.length) {
      box.innerHTML = UI.empty('flask', '還沒有科展分組',
        '先建立一組就好。研究問題不用一開始就完美，第一週的任務只是「選題」。',
        '<button class="btn btn-primary" id="ovNewBtn" type="button">新增第一組</button>');
      const b = document.getElementById('ovNewBtn');
      if (b) b.addEventListener('click', function () { openForm(null); });
      return;
    }

    const late = groups.filter(function (g) { return (g.weeks || []).filter(Boolean).length < cw; });

    box.innerHTML =
      '<div class="grid grid-4 mb-4">' +
        statCard('目前進度', cw ? '第 ' + cw + ' 週' : '未開始', cw ? WEEK_TITLES[cw - 1] : '起始日：' + (start ? UI.formatDate(start) : '未設定')) +
        statCard('分組數', groups.length + ' 組', '共 ' + groups.reduce(function (s, g) {
          return s + (g.members ? g.members.split(/[、,，]/).filter(Boolean).length : 0); }, 0) + ' 位學生') +
        statCard('進度落後', late.length + ' 組', late.length ? late.map(function (g) { return g.name.split('·').pop().trim(); }).join('、') : '全部跟上進度') +
        statCard('材料待補', groups.reduce(function (s, g) {
          return s + (g.materials || []).filter(function (m) { return !m.ready; }).length; }, 0) + ' 項', '未備齊的材料總數') +
      '</div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>組別</th>' +
        WEEK_TITLES.map(function (t, i) { return '<th class="cell-center">W' + (i + 1) + '<br><span class="xsmall">' + t + '</span></th>'; }).join('') +
        '<th class="cell-center">狀態</th></tr></thead><tbody>' +
      groups.map(function (g) {
        const done = (g.weeks || []).filter(Boolean).length;
        const isLate = done < cw;
        return '<tr><td class="nowrap"><a href="#' + g.id + '">' + UI.esc(g.name) + '</a></td>' +
          WEEK_TITLES.map(function (t, i) {
            const on = (g.weeks || [])[i];
            const cur = (i + 1) === cw;
            return '<td class="cell-center" style="' + (on ? 'color:var(--c-primary)' : (cur ? 'background:var(--c-primary-tint)' : 'color:var(--c-text-faint)')) + '">' +
              (on ? '●' : '○') + '</td>';
          }).join('') +
          '<td class="cell-center">' + (isLate
            ? '<span class="tag tag-danger">落後 ' + (cw - done) + ' 週</span>'
            : '<span class="tag tag-success">正常</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function statCard(label, value, hint) {
    return '<div class="card card-tight stat">' +
      '<span class="stat-label">' + UI.esc(label) + '</span>' +
      '<span class="stat-value">' + UI.esc(value) + '</span>' +
      '<span class="stat-hint">' + UI.esc(hint) + '</span></div>';
  }

  /* ====================== 分組卡 ====================== */
  function renderGroups() {
    const cw = currentWeek();
    const groups = Store.list('groups');
    const box = document.getElementById('groupList');
    if (!groups.length) { box.innerHTML = ''; return; }

    box.innerHTML = groups.map(function (g) {
      const done = (g.weeks || []).filter(Boolean).length;
      const isLate = done < cw;
      const mats = g.materials || [];
      const rep = g.report || [];

      return '<section class="card" id="' + g.id + '">' +
        '<div class="card-head">' +
          '<span class="card-icon">' + UI.icon('beaker', 20) + '</span>' +
          '<h3>' + UI.esc(g.name) +
            (isLate ? ' <span class="tag tag-danger">落後 ' + (cw - done) + ' 週</span>'
                    : ' <span class="tag tag-success">進度正常</span>') + '</h3>' +
          '<button class="btn btn-sm" data-block="' + g.id + '" type="button">記卡關點</button>' +
          '<button class="btn btn-sm" data-edit="' + g.id + '" type="button">編輯</button>' +
          '<button class="btn btn-sm btn-danger" data-del="' + g.id + '" type="button" aria-label="刪除分組">' + UI.icon('trash', 15) + '</button>' +
        '</div>' +

        '<div class="grid grid-2 mb-4">' +
          '<div>' +
            '<div class="field-label mb-2">主題與成員</div>' +
            '<p class="mb-2"><strong>' + UI.esc(g.topic || '（未定主題）') + '</strong></p>' +
            '<p class="small muted">成員：' + UI.esc(g.members || '未填') + '</p>' +
            '<div class="field-label mb-2 mt-4">研究問題</div>' +
            '<p class="pre-wrap">' + UI.esc(g.question || '（未填）') + '</p>' +
          '</div>' +
          '<div>' +
            '<div class="field-label mb-2">變項設計</div>' +
            '<div class="table-wrap"><table class="data"><tbody>' +
              '<tr><th style="width:88px">自變項</th><td>' + UI.esc(g.iv || '—') + '</td></tr>' +
              '<tr><th>控制變項</th><td>' + UI.esc(g.cv || '—') + '</td></tr>' +
              '<tr><th>依變項</th><td>' + UI.esc(g.dv || '—') + '</td></tr>' +
              '<tr><th>預期結果</th><td>' + UI.esc(g.expect || '—') + '</td></tr>' +
            '</tbody></table></div>' +
          '</div>' +
        '</div>' +

        '<div class="field-label mb-2">8 週進度（點格子切換完成）</div>' +
        '<div class="week-grid mb-2">' + WEEK_TITLES.map(function (t, i) {
          const on = (g.weeks || [])[i];
          const cur = (i + 1) === cw;
          const lateCell = !on && (i + 1) < cw;
          return '<button class="week-cell' + (on ? ' is-done' : '') + (cur ? ' is-current' : '') +
            (lateCell ? ' is-late' : '') + '" data-week="' + g.id + ':' + i + '" type="button" ' +
            'title="第 ' + (i + 1) + ' 週：' + t + '">' + (i + 1) + '<br>' + t.slice(0, 2) + '</button>';
        }).join('') + '</div>' +
        '<div class="week-legend mb-4">' +
          '<span><i style="background:var(--c-primary)"></i>已完成</span>' +
          '<span><i style="background:var(--c-danger-tint);border:1px solid #EFC9CB"></i>應完成但未完成</span>' +
          '<span><i style="background:var(--c-primary-tint)"></i>本週</span>' +
        '</div>' +

        '<div class="grid grid-2">' +
          '<div>' +
            '<div class="field-label mb-2">材料清單（勾＝已備齊）</div>' +
            (mats.length ? mats.map(function (m, i) {
              return '<label class="check check-plain mb-2"><input type="checkbox" data-mat="' + g.id + ':' + i + '"' +
                (m.ready ? ' checked' : '') + '><span class="check-text">' + UI.esc(m.name) + '</span></label>';
            }).join('') : '<p class="small faint">（未填材料）</p>') +
          '</div>' +
          '<div>' +
            '<div class="field-label mb-2">報告檢核清單</div>' +
            (rep.length ? rep.map(function (r, i) {
              return '<label class="check check-plain mb-2"><input type="checkbox" data-rep="' + g.id + ':' + i + '"' +
                (r.done ? ' checked' : '') + '><span class="check-text">' + UI.esc(r.item) + '</span></label>';
            }).join('') : '<p class="small faint">（未建立）</p>') +
          '</div>' +
        '</div>' +

        ((g.blockers || []).length ? '<div class="divider"></div>' +
          '<div class="field-label mb-2">卡關點與下次任務</div>' +
          '<ul class="timeline">' + g.blockers.slice().reverse().map(function (b, idx) {
            const realIdx = g.blockers.length - 1 - idx;
            return '<li><div class="timeline-date">第 ' + b.week + ' 週 · ' + (WEEK_TITLES[b.week - 1] || '') + '</div>' +
              '<div class="timeline-body"><strong>卡關：</strong>' + UI.esc(b.block) + '<br>' +
              '<strong>下次任務：</strong>' + UI.esc(b.next || '未指定') + '</div>' +
              '<button class="btn btn-sm btn-ghost" data-bdel="' + g.id + ':' + realIdx + '" type="button">刪除</button></li>';
          }).join('') + '</ul>' : '') +
        '</section>';
    }).join('');

    bindGroupEvents();

    if (location.hash.length > 1) {
      const t = document.getElementById(location.hash.slice(1));
      if (t) t.scrollIntoView({ block: 'center' });
    }
  }

  function bindGroupEvents() {
    const box = document.getElementById('groupList');

    box.querySelectorAll('[data-week]').forEach(function (b) {
      b.addEventListener('click', function () {
        const p = b.dataset.week.split(':');
        const g = Store.find('groups', p[0]);
        if (!g.weeks) g.weeks = [false, false, false, false, false, false, false, false];
        g.weeks[Number(p[1])] = !g.weeks[Number(p[1])];
        Store.commit(); refresh();
      });
    });
    box.querySelectorAll('[data-mat]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        const p = cb.dataset.mat.split(':');
        const g = Store.find('groups', p[0]);
        g.materials[Number(p[1])].ready = cb.checked;
        Store.commit(); renderOverview();
      });
    });
    box.querySelectorAll('[data-rep]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        const p = cb.dataset.rep.split(':');
        const g = Store.find('groups', p[0]);
        g.report[Number(p[1])].done = cb.checked;
        Store.commit();
      });
    });
    box.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { openForm(b.dataset.edit); });
    });
    box.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        const g = Store.find('groups', b.dataset.del);
        UI.confirmDelete('要刪除「' + g.name + '」嗎？', function () {
          Store.remove('groups', b.dataset.del); UI.toast('已刪除'); refresh();
        });
      });
    });
    box.querySelectorAll('[data-block]').forEach(function (b) {
      b.addEventListener('click', function () { addBlocker(b.dataset.block); });
    });
    box.querySelectorAll('[data-bdel]').forEach(function (b) {
      b.addEventListener('click', function () {
        const p = b.dataset.bdel.split(':');
        const g = Store.find('groups', p[0]);
        g.blockers.splice(Number(p[1]), 1);
        Store.commit(); UI.toast('已刪除'); refresh();
      });
    });
  }

  /* ====================== 卡關點 ====================== */
  function addBlocker(gid) {
    const g = Store.find('groups', gid);
    const cw = currentWeek() || 1;
    UI.modal({
      title: '記下卡關點（' + g.name + '）',
      bodyHTML:
        '<div class="field"><label for="bWeek">第幾週</label><select id="bWeek">' +
          WEEK_TITLES.map(function (t, i) {
            return '<option value="' + (i + 1) + '"' + (cw === i + 1 ? ' selected' : '') + '>第 ' + (i + 1) + ' 週 · ' + t + '</option>';
          }).join('') + '</select></div>' +
        '<div class="field"><label for="bBlock">卡在哪裡</label>' +
          '<textarea id="bBlock" placeholder="例：「氣味」是主觀的，不知道怎麼量化"></textarea></div>' +
        '<div class="field mb-0"><label for="bNext">下次任務（要具體到學生知道要做什麼）</label>' +
          '<textarea id="bNext" placeholder="例：設計 1–5 分評分表，找 5 位同學盲測平均"></textarea></div>',
      onOK: function (m) {
        const block = m.querySelector('#bBlock').value.trim();
        if (!block) { UI.toast('請填卡關內容'); return false; }
        if (!g.blockers) g.blockers = [];
        g.blockers.push({
          week: Number(m.querySelector('#bWeek').value),
          block: block,
          next: m.querySelector('#bNext').value.trim()
        });
        Store.commit(); UI.toast('已記錄'); refresh(); return true;
      }
    });
  }

  /* ====================== 分組表單 ====================== */
  function openForm(id) {
    const g = id ? Store.find('groups', id) : null;
    const mats = (g && g.materials) || [{ name: '', ready: false }];

    UI.modal({
      title: g ? '編輯分組' : '新增分組',
      wide: true,
      bodyHTML:
        '<div class="field-row">' +
          '<div class="field"><label for="gName">組名</label>' +
            '<input type="text" id="gName" value="' + UI.esc(g ? g.name : '') + '" placeholder="例：第 1 組 · 涼快小屋"></div>' +
          '<div class="field"><label for="gMembers">成員（用、分隔）</label>' +
            '<input type="text" id="gMembers" value="' + UI.esc(g ? g.members : '') + '" placeholder="例：楊承翰、簡佩蓉"></div>' +
        '</div>' +
        '<div class="field"><label for="gTopic">研究主題</label>' +
          '<input type="text" id="gTopic" value="' + UI.esc(g ? g.topic : '') + '" placeholder="例：不同屋頂材質對室內降溫的效果"></div>' +
        '<div class="field"><label for="gQuestion">研究問題（要能用實驗回答）</label>' +
          '<textarea id="gQuestion" style="min-height:60px">' + UI.esc(g ? g.question : '') + '</textarea></div>' +
        '<div class="field-row">' +
          '<div class="field"><label for="gIV">自變項（我要改變的）</label>' +
            '<input type="text" id="gIV" value="' + UI.esc(g ? g.iv : '') + '"></div>' +
          '<div class="field"><label for="gDV">依變項（我要測量的）</label>' +
            '<input type="text" id="gDV" value="' + UI.esc(g ? g.dv : '') + '"></div>' +
        '</div>' +
        '<div class="field"><label for="gCV">控制變項（要固定不變的，越完整越好）</label>' +
          '<textarea id="gCV" style="min-height:60px">' + UI.esc(g ? g.cv : '') + '</textarea></div>' +
        '<div class="field"><label for="gExpect">預期結果與理由</label>' +
          '<textarea id="gExpect" style="min-height:60px">' + UI.esc(g ? g.expect : '') + '</textarea></div>' +
        '<div class="divider"></div>' +
        '<div class="field"><span class="field-label">材料清單</span><div id="gMats"></div>' +
          '<button class="btn btn-sm mt-3" id="addMatBtn" type="button">＋ 加一項材料</button></div>' +
        (g ? '' : '<p class="small muted mb-0">新增後會自動附上標準的報告檢核清單（研究動機、文獻、方法、數據、圖表、結論、參考資料）。</p>'),
      okText: g ? '儲存' : '新增分組',
      onOpen: function (m) {
        const wrap = m.querySelector('#gMats');
        function addRow(name, ready) {
          const row = document.createElement('div');
          row.className = 'row mb-2';
          row.innerHTML =
            '<label class="check check-plain nowrap"><input type="checkbox" class="mat-ready"' + (ready ? ' checked' : '') + '>' +
            '<span class="check-text small">備齊</span></label>' +
            '<input type="text" class="mat-name grow" value="' + UI.esc(name || '') + '" placeholder="例：溫度計 4 支">' +
            '<button class="btn btn-icon btn-ghost mat-del" type="button" aria-label="移除">' + UI.icon('x', 16) + '</button>';
          row.querySelector('.mat-del').addEventListener('click', function () { row.remove(); });
          wrap.appendChild(row);
        }
        mats.forEach(function (x) { addRow(x.name, x.ready); });
        m.querySelector('#addMatBtn').addEventListener('click', function () { addRow('', false); });
      },
      onOK: function (m) {
        const name = m.querySelector('#gName').value.trim();
        if (!name) { UI.toast('請填組名'); return false; }
        const rec = {
          name: name,
          members: m.querySelector('#gMembers').value.trim(),
          topic: m.querySelector('#gTopic').value.trim(),
          question: m.querySelector('#gQuestion').value.trim(),
          iv: m.querySelector('#gIV').value.trim(),
          cv: m.querySelector('#gCV').value.trim(),
          dv: m.querySelector('#gDV').value.trim(),
          expect: m.querySelector('#gExpect').value.trim(),
          materials: []
        };
        m.querySelectorAll('#gMats .row').forEach(function (row) {
          const n = row.querySelector('.mat-name').value.trim();
          if (n) rec.materials.push({ name: n, ready: row.querySelector('.mat-ready').checked });
        });
        if (g) { Store.update('groups', g.id, rec); UI.toast('已更新'); }
        else {
          rec.weeks = [false, false, false, false, false, false, false, false];
          rec.blockers = [];
          rec.report = Store.reportChecklist([]);
          rec.createdAt = UI.todayISO();
          Store.add('groups', rec); UI.toast('已新增分組');
        }
        refresh(); return true;
      }
    });
  }

  document.getElementById('newGroupBtn').addEventListener('click', function () { openForm(null); });

  function refresh() { renderOverview(); renderGroups(); }
  window.onDataChanged = refresh;
  refresh();
})();
