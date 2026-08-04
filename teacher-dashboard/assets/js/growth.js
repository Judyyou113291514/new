/* ==========================================================================
   growth.js — 專業成長（growth.html）
   --------------------------------------------------------------------------
   功能：四面向自評量表（1–5 分）→ 雷達圖比較歷次結果、待精進項目→轉成長目標、
         成長目標 CRUD（含進度）、成長歷程時間軸 CRUD。
   ========================================================================== */

(function () {
  'use strict';

  UI.renderShell('growth.html');

  [['icon-chart', 'chart'], ['icon-target', 'target'], ['icon-star', 'star'], ['icon-calendar', 'calendar']]
    .forEach(function (p) {
      const el = document.getElementById(p[0]);
      if (el) el.innerHTML = UI.icon(p[1], 20);
    });

  /* ---------- 自評題目：四面向（想改題目直接改這裡）---------- */
  const DIMENSIONS = [
    { key: 'design', label: '課程設計與教學', items: [
      '我能依課綱學習表現設計探究活動，而不是只照課本走',
      '我的指令清楚，學生聽完就知道要做什麼',
      '我會預先想過學生的迷思概念與可能卡點',
      '我能在時間內完成一堂課並留下收拾時間',
      '我的評量方式（含平時成績）說得清楚、學生也知道'
    ]},
    { key: 'manage', label: '班級經營與輔導', items: [
      '我有固定的注意力召回訊號，不靠嗓門',
      '我有一套器材發放與收尾的固定流程',
      '我能叫出大部分學生的名字',
      '面對行為問題我能先確認事實再處理，不情緒化'
    ]},
    { key: 'research', label: '研究發展與進修', items: [
      '我每學期至少參加一次與自然教學相關的研習或觀課',
      '我會把研習或閱讀所得寫成可用的東西（筆記、教案）',
      '我有固定寫教學反思的習慣',
      '我會主動向資深老師請教並記錄下來'
    ]},
    { key: 'attitude', label: '敬業精神與態度', items: [
      '我準時完成成績登錄與行政事項',
      '我會主動與導師交換學生訊息',
      '我把實驗室安全當成不可妥協的底線',
      '我能對自己的能力邊界誠實，需要時會說出來'
    ]}
  ];

  const MS_TYPES = ['研習', '觀課', '公開課', '閱讀', '會議', '其他'];
  let filterType = '';
  let chart = null;

  /* ====================== 自評量表 ====================== */
  function openAssessment() {
    const last = latestAssessment();
    const body = DIMENSIONS.map(function (d) {
      return '<h4 class="mb-2">' + d.label + '</h4>' +
        '<p class="xsmall muted mb-3">1＝幾乎做不到　3＝有時做到　5＝穩定做到</p>' +
        d.items.map(function (q, i) {
          const prev = last ? (last.scores[d.key] || [])[i] : null;
          return '<div class="likert-item"><span class="likert-q">' + UI.esc(q) +
            (prev ? ' <span class="xsmall faint">（上次 ' + prev + ' 分）</span>' : '') + '</span>' +
            '<span class="likert">' + [1, 2, 3, 4, 5].map(function (n) {
              const checked = prev === n ? ' checked' : (!prev && n === 3 ? ' checked' : '');
              return '<label><input type="radio" name="q_' + d.key + '_' + i + '" value="' + n + '"' + checked +
                '><span>' + n + '</span></label>';
            }).join('') + '</span></div>';
        }).join('') + '<div class="divider"></div>';
    }).join('');

    UI.modal({
      title: '四面向自評（約 5 分鐘）',
      wide: true,
      bodyHTML: '<div class="field"><label for="asDate">日期</label>' +
        '<input type="date" id="asDate" value="' + UI.todayISO() + '" style="max-width:180px"></div>' + body,
      okText: '送出並畫圖',
      onOK: function (m) {
        const scores = {};
        DIMENSIONS.forEach(function (d) {
          scores[d.key] = d.items.map(function (q, i) {
            const sel = m.querySelector('input[name="q_' + d.key + '_' + i + '"]:checked');
            return sel ? Number(sel.value) : 3;
          });
        });
        Store.add('assessments', { date: m.querySelector('#asDate').value || UI.todayISO(), scores: scores });
        UI.toast('已存下這次自評結果');
        refresh(); return true;
      }
    });
  }

  function latestAssessment() {
    const list = Store.list('assessments').slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    return list[list.length - 1] || null;
  }

  function dimAverage(a, key) {
    const arr = (a.scores && a.scores[key]) || [];
    if (!arr.length) return 0;
    return arr.reduce(function (s, x) { return s + x; }, 0) / arr.length;
  }

  /* ====================== 雷達圖 ====================== */
  function renderRadar() {
    const list = Store.list('assessments').slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    const wrap = document.getElementById('radarWrap');
    const fb = document.getElementById('radarFallback');

    if (!list.length) {
      wrap.style.display = 'none';
      fb.innerHTML = UI.empty('chart', '還沒有自評紀錄',
        '做一次自評（約 5 分鐘），之後每學期做一次，就能看到四面向的變化。',
        '<button class="btn btn-primary" id="radarEmptyBtn" type="button">做第一次自評</button>');
      const b = document.getElementById('radarEmptyBtn');
      if (b) b.addEventListener('click', openAssessment);
      return;
    }
    wrap.style.display = '';

    const show = list.slice(-3);   // 最多比較最近三次
    const labels = DIMENSIONS.map(function (d) { return d.label; });
    const colors = ['#C6D0D9', '#2F9E8F', '#0B7285'];

    // 沒載到 Chart.js（例如離線）時，改用條狀圖呈現，功能不會壞掉
    if (typeof Chart === 'undefined') {
      wrap.style.display = 'none';
      fb.innerHTML = '<p class="small muted">（沒有連上網路，Chart.js 未載入，改用長條顯示）</p>' +
        DIMENSIONS.map(function (d) {
          const v = dimAverage(show[show.length - 1], d.key);
          return '<div class="bar-row mb-3"><div class="bar-row-head"><span>' + d.label + '</span>' +
            '<b>' + v.toFixed(1) + ' / 5</b></div>' +
            '<div class="bar"><span style="width:' + (v / 5 * 100) + '%"></span></div></div>';
        }).join('');
      return;
    }
    fb.innerHTML = '';

    if (chart) chart.destroy();
    chart = new Chart(document.getElementById('radarChart'), {
      type: 'radar',
      data: {
        labels: labels,
        datasets: show.map(function (a, i) {
          const c = colors[i + (3 - show.length)] || '#0B7285';
          return {
            label: UI.formatDate(a.date, true),
            data: DIMENSIONS.map(function (d) { return Number(dimAverage(a, d.key).toFixed(2)); }),
            borderColor: c,
            backgroundColor: c + '33',
            pointBackgroundColor: c,
            borderWidth: 2
          };
        })
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { r: { min: 0, max: 5, ticks: { stepSize: 1, backdropColor: 'transparent' },
          pointLabels: { font: { size: 12, family: 'Noto Sans TC' } } } },
        plugins: { legend: { position: 'bottom', labels: { font: { family: 'Noto Sans TC' }, boxWidth: 12 } } }
      }
    });
  }

  function renderAssessList() {
    const list = Store.list('assessments').slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    const box = document.getElementById('assessList');
    if (!list.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="table-wrap"><table class="data"><thead><tr><th>日期</th>' +
      DIMENSIONS.map(function (d) { return '<th class="cell-center">' + d.label + '</th>'; }).join('') +
      '<th></th></tr></thead><tbody>' +
      list.map(function (a) {
        return '<tr><td class="nowrap num">' + UI.esc(a.date) + '</td>' +
          DIMENSIONS.map(function (d) {
            return '<td class="cell-center num">' + dimAverage(a, d.key).toFixed(1) + '</td>';
          }).join('') +
          '<td class="cell-center"><button class="btn btn-sm btn-ghost" data-adel="' + a.id + '" type="button">刪除</button></td></tr>';
      }).join('') + '</tbody></table></div>';

    box.querySelectorAll('[data-adel]').forEach(function (b) {
      b.addEventListener('click', function () {
        UI.confirmDelete('要刪除這次自評結果嗎？', function () {
          Store.remove('assessments', b.dataset.adel); UI.toast('已刪除'); refresh();
        });
      });
    });
  }

  /* ====================== 待精進項目 ====================== */
  function renderWeak() {
    const a = latestAssessment();
    const box = document.getElementById('weakList');
    if (!a) {
      box.innerHTML = UI.empty('target', '還沒有自評資料', '做完一次自評後，低分項目會自動列在這裡。');
      return;
    }
    const weak = [];
    DIMENSIONS.forEach(function (d) {
      d.items.forEach(function (q, i) {
        const v = (a.scores[d.key] || [])[i];
        if (v && v <= 3) weak.push({ dim: d.key, dimLabel: d.label, q: q, v: v });
      });
    });
    weak.sort(function (x, y) { return x.v - y.v; });

    if (!weak.length) {
      box.innerHTML = '<div class="alert alert-success">' + UI.icon('check', 18) +
        '<div class="alert-body"><div class="alert-title">沒有 3 分以下的項目</div>' +
        '<div class="alert-desc">可以挑一個 4 分項往 5 分推，或直接自訂一個成長目標。</div></div></div>';
      return;
    }

    box.innerHTML = '<div class="list">' + weak.map(function (w, i) {
      return '<div class="list-item">' +
        '<div class="list-item-body">' +
          '<div class="list-item-title">' + UI.esc(w.q) + '</div>' +
          '<div class="list-item-meta">' + UI.esc(w.dimLabel) + ' · 自評 ' + w.v + ' 分</div>' +
        '</div>' +
        '<button class="btn btn-sm" data-togoal="' + i + '" type="button">轉為目標</button></div>';
    }).join('') + '</div>';

    box.querySelectorAll('[data-togoal]').forEach(function (b) {
      b.addEventListener('click', function () {
        const w = weak[Number(b.dataset.togoal)];
        editGoal(null, { title: w.q, dimension: w.dim });
      });
    });
  }

  /* ====================== 成長目標 ====================== */
  function renderGoals() {
    const list = Store.list('goals').slice().sort(function (a, b) {
      return (a.done ? 1 : 0) - (b.done ? 1 : 0) || String(a.due).localeCompare(String(b.due));
    });
    const box = document.getElementById('goalList');

    if (!list.length) {
      box.innerHTML = UI.empty('star', '還沒有成長目標',
        '一次只設一到兩個。目標要寫成「可以觀察到的動作」，不是「要更有耐心」。',
        '<button class="btn btn-primary" id="goalEmptyBtn" type="button">新增第一個目標</button>');
      const b = document.getElementById('goalEmptyBtn');
      if (b) b.addEventListener('click', function () { editGoal(null); });
      return;
    }

    box.innerHTML = '<div class="grid grid-2">' + list.map(function (g) {
      const dim = DIMENSIONS.find(function (d) { return d.key === g.dimension; });
      const overdue = !g.done && g.due && g.due < UI.todayISO();
      return '<div class="card card-tight" style="' + (g.done ? 'opacity:.72' : '') + '">' +
        '<div class="row mb-2">' +
          '<span class="tag ' + (g.done ? 'tag-success' : overdue ? 'tag-danger' : 'tag-primary') + '">' +
            (g.done ? '已完成' : overdue ? '已逾期' : '進行中') + '</span>' +
          (dim ? '<span class="tag">' + UI.esc(dim.label) + '</span>' : '') +
          '<span class="grow"></span>' +
          '<button class="btn btn-icon btn-ghost" data-gedit="' + g.id + '" type="button" aria-label="編輯">' + UI.icon('edit', 15) + '</button>' +
          '<button class="btn btn-icon btn-ghost" data-gdel="' + g.id + '" type="button" aria-label="刪除">' + UI.icon('trash', 15) + '</button>' +
        '</div>' +
        '<strong>' + UI.esc(g.title) + '</strong>' +
        '<p class="small muted pre-wrap mt-3">' + UI.esc(g.actions || '（未寫行動方案）') + '</p>' +
        '<div class="small muted mb-2">' +
          (g.partner ? '合作對象：' + UI.esc(g.partner) + '<br>' : '') +
          '完成日期：' + (g.due ? UI.formatDate(g.due, true) : '未設定') + '</div>' +
        '<div class="bar-row">' +
          '<div class="bar-row-head"><span>進度</span><b>' + (g.progress || 0) + '%</b></div>' +
          '<div class="bar' + (g.done ? ' bar-accent' : '') + '"><span style="width:' + (g.progress || 0) + '%"></span></div>' +
        '</div>' +
        '<div class="row mt-3" style="gap:6px">' +
          '<input type="range" min="0" max="100" step="10" value="' + (g.progress || 0) + '" data-gprog="' + g.id + '" ' +
            'style="flex:1 1 auto;min-width:0" aria-label="調整進度">' +
          '<label class="check check-plain nowrap"><input type="checkbox" data-gdone="' + g.id + '"' + (g.done ? ' checked' : '') + '>' +
            '<span class="check-text small">完成</span></label>' +
        '</div></div>';
    }).join('') + '</div>';

    box.querySelectorAll('[data-gprog]').forEach(function (r) {
      r.addEventListener('change', function () {
        Store.update('goals', r.dataset.gprog, { progress: Number(r.value) });
        renderGoals();
      });
    });
    box.querySelectorAll('[data-gdone]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        Store.update('goals', cb.dataset.gdone, { done: cb.checked, progress: cb.checked ? 100 : undefined });
        const g = Store.find('goals', cb.dataset.gdone);
        if (g.progress == null) g.progress = 0;
        Store.commit();
        UI.toast(cb.checked ? '恭喜，目標達成' : '已改回進行中');
        renderGoals();
      });
    });
    box.querySelectorAll('[data-gedit]').forEach(function (b) {
      b.addEventListener('click', function () { editGoal(b.dataset.gedit); });
    });
    box.querySelectorAll('[data-gdel]').forEach(function (b) {
      b.addEventListener('click', function () {
        UI.confirmDelete('要刪除這個成長目標嗎？', function () {
          Store.remove('goals', b.dataset.gdel); UI.toast('已刪除'); renderGoals();
        });
      });
    });
  }

  function editGoal(id, preset) {
    const g = id ? Store.find('goals', id) : null;
    const p = preset || {};
    UI.modal({
      title: g ? '編輯成長目標' : '新增成長目標',
      wide: true,
      bodyHTML:
        '<div class="field"><label for="glTitle">目標</label>' +
          '<input type="text" id="glTitle" value="' + UI.esc(g ? g.title : (p.title || '')) + '" ' +
          'placeholder="例：建立一套固定的實驗收尾流程並在三個班實施"></div>' +
        '<div class="field"><label for="glDim">面向</label><select id="glDim">' +
          DIMENSIONS.map(function (d) {
            const sel = (g ? g.dimension : p.dimension) === d.key ? ' selected' : '';
            return '<option value="' + d.key + '"' + sel + '>' + d.label + '</option>';
          }).join('') + '</select></div>' +
        '<div class="field"><label for="glActions">行動方案（越具體越好）</label>' +
          '<textarea id="glActions">' + UI.esc(g ? g.actions : '') + '</textarea></div>' +
        '<div class="field-row">' +
          '<div class="field"><label for="glPartner">合作對象</label>' +
            '<input type="text" id="glPartner" value="' + UI.esc(g ? g.partner : '') + '" placeholder="例：資深自然老師、導師"></div>' +
          '<div class="field"><label for="glDue">完成日期</label>' +
            '<input type="date" id="glDue" value="' + UI.esc(g ? g.due : '') + '"></div>' +
        '</div>' +
        '<div class="field mb-0"><label for="glProg">目前進度（%）</label>' +
          '<input type="number" id="glProg" min="0" max="100" step="10" value="' + (g ? (g.progress || 0) : 0) + '" style="max-width:120px"></div>',
      onOK: function (m) {
        const title = m.querySelector('#glTitle').value.trim();
        if (!title) { UI.toast('請填目標'); return false; }
        const rec = {
          title: title,
          dimension: m.querySelector('#glDim').value,
          actions: m.querySelector('#glActions').value.trim(),
          partner: m.querySelector('#glPartner').value.trim(),
          due: m.querySelector('#glDue').value,
          progress: Number(m.querySelector('#glProg').value) || 0
        };
        if (g) { Store.update('goals', g.id, rec); UI.toast('已更新'); }
        else { rec.done = false; Store.add('goals', rec); UI.toast('已新增成長目標'); }
        renderGoals(); return true;
      }
    });
  }

  /* ====================== 成長歷程 ====================== */
  function renderMilestones() {
    let list = Store.list('milestones').slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    if (filterType) list = list.filter(function (m) { return m.type === filterType; });
    const box = document.getElementById('msList');

    if (!list.length) {
      box.innerHTML = UI.empty('calendar', '還沒有成長歷程紀錄',
        '研習、觀課、公開課、閱讀都算。重點是那一欄「收穫」——三年後這就是你的教學檔案。',
        '<button class="btn btn-primary" id="msEmptyBtn" type="button">新增第一筆</button>');
      const b = document.getElementById('msEmptyBtn');
      if (b) b.addEventListener('click', function () { editMilestone(null); });
      return;
    }

    box.innerHTML = '<ul class="timeline">' + list.map(function (m) {
      return '<li><div class="timeline-date">' + UI.formatDate(m.date, true) + ' · ' + UI.esc(m.type) + '</div>' +
        '<div class="timeline-body"><strong>' + UI.esc(m.title) + '</strong>' +
        (m.note ? '<div class="small muted pre-wrap">收穫：' + UI.esc(m.note) + '</div>' : '') + '</div>' +
        '<div class="row" style="gap:4px;margin-top:4px">' +
          '<button class="btn btn-sm btn-ghost" data-medit="' + m.id + '" type="button">編輯</button>' +
          '<button class="btn btn-sm btn-ghost" data-mdel="' + m.id + '" type="button">刪除</button>' +
        '</div></li>';
    }).join('') + '</ul>';

    box.querySelectorAll('[data-medit]').forEach(function (b) {
      b.addEventListener('click', function () { editMilestone(b.dataset.medit); });
    });
    box.querySelectorAll('[data-mdel]').forEach(function (b) {
      b.addEventListener('click', function () {
        UI.confirmDelete('要刪除這筆成長歷程嗎？', function () {
          Store.remove('milestones', b.dataset.mdel); UI.toast('已刪除'); renderMilestones();
        });
      });
    });
  }

  function editMilestone(id) {
    const m0 = id ? Store.find('milestones', id) : null;
    UI.modal({
      title: m0 ? '編輯成長歷程' : '新增成長歷程',
      bodyHTML:
        '<div class="field-row">' +
          '<div class="field"><label for="msDate">日期</label>' +
            '<input type="date" id="msDate" value="' + (m0 ? m0.date : UI.todayISO()) + '"></div>' +
          '<div class="field"><label for="msType">類型</label><select id="msType">' +
            MS_TYPES.map(function (t) {
              return '<option value="' + t + '"' + (m0 && m0.type === t ? ' selected' : '') + '>' + t + '</option>';
            }).join('') + '</select></div>' +
        '</div>' +
        '<div class="field"><label for="msTitle">名稱</label>' +
          '<input type="text" id="msTitle" value="' + UI.esc(m0 ? m0.title : '') + '" placeholder="例：探究與實作教學設計研習（6 小時）"></div>' +
        '<div class="field mb-0"><label for="msNote">收穫（寫一句就好，要能用得上的）</label>' +
          '<textarea id="msNote">' + UI.esc(m0 ? m0.note : '') + '</textarea></div>',
      onOK: function (m) {
        const title = m.querySelector('#msTitle').value.trim();
        if (!title) { UI.toast('請填名稱'); return false; }
        const rec = {
          date: m.querySelector('#msDate').value || UI.todayISO(),
          type: m.querySelector('#msType').value,
          title: title,
          note: m.querySelector('#msNote').value.trim()
        };
        if (m0) { Store.update('milestones', m0.id, rec); UI.toast('已更新'); }
        else { Store.add('milestones', rec); UI.toast('已新增'); }
        renderMilestones(); return true;
      }
    });
  }

  function renderTypeFilter() {
    document.getElementById('filterType').innerHTML = '<option value="">全部類型</option>' +
      MS_TYPES.map(function (t) {
        return '<option value="' + t + '"' + (filterType === t ? ' selected' : '') + '>' + t + '</option>';
      }).join('');
  }

  /* ====================== 綁定與啟動 ====================== */
  document.getElementById('newAssessBtn').addEventListener('click', openAssessment);
  document.getElementById('newGoalBtn').addEventListener('click', function () { editGoal(null); });
  document.getElementById('newMsBtn').addEventListener('click', function () { editMilestone(null); });
  document.getElementById('filterType').addEventListener('change', function (e) {
    filterType = e.target.value; renderMilestones();
  });

  function refresh() {
    renderRadar();
    renderAssessList();
    renderWeak();
    renderGoals();
    renderTypeFilter();
    renderMilestones();
  }
  window.onDataChanged = refresh;
  refresh();
})();
