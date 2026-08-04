/* ==========================================================================
   reflect.js — 教師反思（reflect.html）
   --------------------------------------------------------------------------
   三層模板：
     L1 三句話速記（2 分鐘）
     L2 六格反思卡（10 分鐘，Gibbs 反思循環）
     L3 關鍵事件深挖（30 分鐘，Korthagen ALACT ＋ 洋蔥模型五層）
   另有：紀錄列表、關鍵詞統計（出現三次以上＝系統性缺口）、每週／每月／每學期節奏題組。
   ========================================================================== */

(function () {
  'use strict';

  UI.renderShell('reflect.html');

  [['icon-loop', 'loop'], ['icon-note', 'note'], ['icon-search', 'search'], ['icon-calendar', 'calendar']]
    .forEach(function (p) {
      const el = document.getElementById(p[0]);
      if (el) el.innerHTML = UI.icon(p[1], 20);
    });

  let level = 'L1';
  let editingId = null;
  let filterLevel = '';
  let rhythmTab = 'weekly';

  /* ====================== 欄位定義 ======================
     每個層級是一組欄位；改文案或加欄位就改這裡，表單與列表都會跟著變。
     type: 'text' | 'textarea' | 'matrix'
  =================================================== */
  const LEVELS = {
    L1: {
      label: 'L1 · 三句話速記',
      time: '2 分鐘',
      intro: '下課後趁記憶還熱就寫，關鍵字就好。兩個規則：只寫一件事；第 3 項一定要具體到「明天就能做」。',
      fields: [
        ['what', '1. 發生了什麼？', 'textarea', '一個具體畫面，不要評價。例：分組實驗時第 3、5 組沒等指令就點酒精燈。'],
        ['worked', '2-1. 有效的一件事', 'textarea', '例：先示範一次再發器材，其他組操作都正確。'],
        ['failed', '2-2. 無效的一件事', 'textarea', '例：器材放在桌上才講注意事項，等於邀請他們先玩。'],
        ['next', '3. 下次的一個小改動', 'textarea', '要具體到明天就能做。「要更有耐心」不算，「講完注意事項才發器材」才算。']
      ]
    },
    L2: {
      label: 'L2 · 六格反思卡',
      time: '10 分鐘',
      intro: '依 Gibbs 反思循環六階段。要訣：從一個具體的課堂片段開始，不要反思「整節課」，範圍太大會寫成空話。',
      fields: [
        ['segment', '我要反思的片段', 'text', '例：發器材後到我制止之間的那兩分鐘'],
        ['describe', '① 描述（只寫事實，先不下判斷）', 'gibbs', '發生了什麼？我做了什麼、學生做了什麼？結果是什麼？'],
        ['feeling', '② 感受（誠實寫，先不分析）', 'gibbs', '當時我的感覺是？我猜學生的感覺是？現在回想有變化嗎？'],
        ['evaluate', '③ 評估（好與壞都要寫）', 'gibbs', '哪裡進行得好？哪裡不順？我與學生各貢獻了什麼？'],
        ['analyse', '④ 分析（為什麼會這樣）', 'gibbs', '好的部分為什麼有效？不順的最可能原因？（指令不清／時間不足／先備知識／器材／我的情緒）'],
        ['conclude', '⑤ 結論（我學到什麼）', 'gibbs', '關於學生我學到？關於我的教學我學到？當時我還可以怎麼做？'],
        ['action', '⑥ 行動計畫（下次怎麼做＋怎麼確保做到）', 'gibbs', '具體要改的動作？我怎麼提醒自己？我怎麼知道有效（觀察什麼指標）？']
      ]
    },
    L3: {
      label: 'L3 · 關鍵事件深挖',
      time: '30 分鐘',
      intro: '用於同一個問題反覆出現、與學生或家長的衝突、想很久還是不懂為什麼失敗的一堂課。ALACT 的第三階段「覺察核心」不可跳過。',
      fields: []   // L3 版面較特別，由 renderL3() 專門處理
    }
  };

  /* ====================== 表單渲染 ====================== */
  function renderTabs() {
    document.getElementById('levelTabs').innerHTML = ['L1', 'L2', 'L3'].map(function (k) {
      return '<button class="tab' + (level === k ? ' is-active' : '') + '" data-lv="' + k + '" role="tab" type="button">' +
        LEVELS[k].label + '<span class="tab-badge">' + LEVELS[k].time + '</span></button>';
    }).join('');
    document.querySelectorAll('#levelTabs .tab').forEach(function (b) {
      b.addEventListener('click', function () {
        level = b.dataset.lv; editingId = null; renderTabs(); renderForm();
      });
    });
  }

  // 共同的表頭（日期／班級／單元）
  function headerHTML(rec) {
    const classes = Store.classes();
    return '<div class="field-row-3" style="display:grid;gap:12px;grid-template-columns:150px 1fr 1fr">' +
      '<div class="field"><label for="rDate">日期</label>' +
        '<input type="date" id="rDate" value="' + (rec ? rec.date : UI.todayISO()) + '"></div>' +
      '<div class="field"><label for="rClass">班級</label><select id="rClass">' +
        '<option value="">（不指定）</option>' +
        classes.map(function (c) {
          return '<option value="' + c.id + '"' + (rec && rec.classId === c.id ? ' selected' : '') + '>' + UI.esc(c.name) + '</option>';
        }).join('') + '</select></div>' +
      '<div class="field"><label for="rUnit">單元／主題</label>' +
        '<input type="text" id="rUnit" value="' + UI.esc(rec ? (rec.unit || '') : '') + '" placeholder="例：熱的傳導"></div>' +
    '</div>';
  }

  function renderForm() {
    const rec = editingId ? Store.find('reflections', editingId) : null;
    const f = rec ? (rec.fields || {}) : {};
    const box = document.getElementById('formArea');
    const cfg = LEVELS[level];

    document.getElementById('editingHint').textContent = rec ? '正在編輯 ' + UI.formatDate(rec.date) + ' 的紀錄' : '';

    let html = '<div class="alert alert-info mb-4">' + UI.icon('info', 18) +
      '<div class="alert-body"><div class="alert-desc">' + UI.esc(cfg.intro) + '</div></div></div>' +
      headerHTML(rec);

    if (level === 'L3') { html += renderL3(f); }
    else if (level === 'L2') {
      html += '<div class="field"><label for="fld_segment">我要反思的片段</label>' +
        '<input type="text" id="fld_segment" value="' + UI.esc(f.segment || '') + '" placeholder="例：發器材後到我制止之間的那兩分鐘"></div>' +
        '<div class="gibbs-grid">' + cfg.fields.filter(function (x) { return x[2] === 'gibbs'; })
          .map(function (x, i) {
            return '<div class="gibbs-cell">' +
              '<h4><span class="gibbs-no">' + (i + 1) + '</span>' + UI.esc(x[1].replace(/^[①②③④⑤⑥]\s*/, '')) + '</h4>' +
              '<div class="q">' + UI.esc(x[3]) + '</div>' +
              '<textarea id="fld_' + x[0] + '">' + UI.esc(f[x[0]] || '') + '</textarea></div>';
          }).join('') + '</div>';
    } else {
      html += cfg.fields.map(function (x) {
        return '<div class="field"><label for="fld_' + x[0] + '">' + UI.esc(x[1]) + '</label>' +
          (x[2] === 'text'
            ? '<input type="text" id="fld_' + x[0] + '" value="' + UI.esc(f[x[0]] || '') + '" placeholder="' + UI.esc(x[3]) + '">'
            : '<textarea id="fld_' + x[0] + '" placeholder="' + UI.esc(x[3]) + '">' + UI.esc(f[x[0]] || '') + '</textarea>') +
          '</div>';
      }).join('');
    }

    box.innerHTML = html;
  }

  /* ---------- L3 專屬版面 ---------- */
  const ONION = [
    ['env', '1 環境層', '情境本身有什麼限制？（班級人數、器材、時間、校內文化）'],
    ['behavior', '2 行為層', '我實際做出了什麼行為？'],
    ['ability', '3 能力層', '我缺的是哪個具體能力？不是「能力不好」，要指名道姓。'],
    ['belief', '4 信念層', '這件事讓我不舒服，是因為我相信「一個好老師應該______」？'],
    ['identity', '5 認同層', '我想成為什麼樣的老師？這件事和那個形象哪裡衝突？']
  ];

  function renderL3(f) {
    return '' +
      '<h4 class="mb-3">階段一 · 行動：這件事是什麼</h4>' +
      '<div class="field"><label for="fld_event">事件描述（時間、地點、在場的人、經過）</label>' +
        '<textarea id="fld_event">' + UI.esc(f.event || '') + '</textarea></div>' +
      '<div class="field"><label for="fld_intent">我原本想要達成什麼？</label>' +
        '<textarea id="fld_intent" style="min-height:60px">' + UI.esc(f.intent || '') + '</textarea></div>' +

      '<div class="divider"></div>' +
      '<h4 class="mb-2">階段二 · 回顧：四欄對照表</h4>' +
      '<p class="small muted">把「我」和「學生」的四個面向並排寫，落差就會浮現。填完問自己：哪一格我其實不知道？我的「要」和學生的「要」在哪裡衝突？我的「感」和「做」有落差嗎？</p>' +
      '<div class="table-wrap mb-4"><table class="matrix"><thead><tr><th style="width:130px"></th><th>我</th><th>學生</th></tr></thead><tbody>' +
        [['Think', '想 thinking', '當時腦中在想什麼'],
         ['Feel', '感 feeling', '當時的情緒'],
         ['Want', '要 wanting', '當時想要什麼'],
         ['Do', '做 doing', '實際做出什麼']].map(function (r) {
          return '<tr><th>' + r[1] + '<br><span class="xsmall muted">' + r[2] + '</span></th>' +
            '<td><textarea id="fld_mine' + r[0] + '" aria-label="我的' + r[1] + '">' + UI.esc(f['mine' + r[0]] || '') + '</textarea></td>' +
            '<td><textarea id="fld_stu' + r[0] + '" aria-label="學生的' + r[1] + '">' + UI.esc(f['stu' + r[0]] || '') + '</textarea></td></tr>';
        }).join('') + '</tbody></table></div>' +

      '<div class="divider"></div>' +
      '<h4 class="mb-3">階段三 · 覺察核心：往裡面問五層</h4>' +
      ONION.map(function (o, i) {
        return '<div class="onion-step"><span class="onion-no">' + (i + 1) + '</span>' +
          '<div class="onion-body"><label class="field-label" for="fld_' + o[0] + '">' + o[1] + '</label>' +
          '<div class="xsmall muted mb-2">' + UI.esc(o[2]) + '</div>' +
          '<textarea id="fld_' + o[0] + '" style="min-height:56px">' + UI.esc(f[o[0]] || '') + '</textarea></div></div>';
      }).join('') +
      '<div class="field"><label for="fld_core">★ 一句話總結核心問題</label>' +
        '<input type="text" id="fld_core" value="' + UI.esc(f.core || '') + '" placeholder="例：我沒有收尾制度，卻用情緒補位。"></div>' +
      '<div class="alert alert-warn mb-4">' + UI.icon('alert', 18) +
        '<div class="alert-body"><div class="alert-title">句型提示</div>' +
        '<div class="alert-desc">「我不舒服，是因為我相信一個好老師應該＿＿＿＿。」把這句寫在信念層。</div></div></div>' +

      '<div class="divider"></div>' +
      '<h4 class="mb-2">階段四 · 創造替代方案：至少三個</h4>' +
      '<p class="small muted">強制寫三個是為了打破「只有一種做法」的錯覺。第三個大膽方案常常最有價值。</p>' +
      '<div class="field"><label for="fld_planA">方案 A（最保守，明天就能做）</label>' +
        '<textarea id="fld_planA" style="min-height:56px">' + UI.esc(f.planA || '') + '</textarea></div>' +
      '<div class="field"><label for="fld_planB">方案 B（需要一點準備）</label>' +
        '<textarea id="fld_planB" style="min-height:56px">' + UI.esc(f.planB || '') + '</textarea></div>' +
      '<div class="field"><label for="fld_planC">方案 C（大膽的、可能不敢做的）</label>' +
        '<textarea id="fld_planC" style="min-height:56px">' + UI.esc(f.planC || '') + '</textarea></div>' +
      '<div class="field-row">' +
        '<div class="field"><label for="fld_chosen">我選</label>' +
          '<input type="text" id="fld_chosen" value="' + UI.esc(f.chosen || '') + '" placeholder="例：A + C"></div>' +
        '<div class="field"><label for="fld_reason">理由</label>' +
          '<input type="text" id="fld_reason" value="' + UI.esc(f.reason || '') + '"></div>' +
      '</div>' +

      '<div class="divider"></div>' +
      '<h4 class="mb-3">階段五 · 試驗：變成新的行動</h4>' +
      '<div class="field"><label for="fld_trial">我要在什麼時候、哪個班、試哪一件事？</label>' +
        '<textarea id="fld_trial" style="min-height:56px">' + UI.esc(f.trial || '') + '</textarea></div>' +
      '<div class="field-row">' +
        '<div class="field"><label for="fld_record">我怎麼記錄結果？</label>' +
          '<input type="text" id="fld_record" value="' + UI.esc(f.record || '') + '"></div>' +
        '<div class="field"><label for="fld_reviewDate">檢視日期</label>' +
          '<input type="date" id="fld_reviewDate" value="' + UI.esc(f.reviewDate || '') + '"></div>' +
      '</div>';
  }

  /* ====================== 儲存 ====================== */
  function collectFields() {
    const out = {};
    document.querySelectorAll('#formArea [id^="fld_"]').forEach(function (el) {
      out[el.id.slice(4)] = el.value.trim();
    });
    return out;
  }

  document.getElementById('saveBtn').addEventListener('click', function () {
    const fields = collectFields();
    const filled = Object.keys(fields).filter(function (k) { return fields[k]; }).length;
    if (!filled) { UI.toast('至少寫一格再儲存'); return; }

    const rec = {
      level: level,
      date: document.getElementById('rDate').value || UI.todayISO(),
      classId: document.getElementById('rClass').value,
      unit: document.getElementById('rUnit').value.trim(),
      fields: fields
    };
    if (editingId) { Store.update('reflections', editingId, rec); UI.toast('已更新反思'); }
    else { rec.createdAt = UI.todayISO(); Store.add('reflections', rec); UI.toast('已儲存反思，記得執行那個小改動'); }
    editingId = null;
    renderForm(); renderRecords(); renderKeywords();
  });

  document.getElementById('resetBtn').addEventListener('click', function () {
    editingId = null; renderForm();
  });

  /* ====================== 紀錄列表 ====================== */
  function renderRecords() {
    let list = Store.list('reflections').slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    if (filterLevel) list = list.filter(function (r) { return r.level === filterLevel; });
    const box = document.getElementById('recordList');

    if (!list.length) {
      box.innerHTML = UI.empty('loop', '還沒有反思紀錄',
        '從 L1 開始，寫三句話就好。累積下來才能看出模式，散落的紙條看不出趨勢。');
      return;
    }

    box.innerHTML = list.map(function (r) {
      const f = r.fields || {};
      const gist = f.next || f.action || f.core || f.what || f.describe || f.event || '（未填寫）';
      return '<details class="fold"><summary>' +
        '<span class="tag ' + (r.level === 'L1' ? 'tag-primary' : r.level === 'L2' ? 'tag-info' : 'tag-warn') + '">' + r.level + '</span>' +
        '<span class="nowrap small muted">' + UI.formatDate(r.date) + '</span>' +
        '<span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
          (r.unit ? UI.esc(r.unit) + '：' : '') + UI.esc(String(gist).slice(0, 40)) + '</span>' +
        '</summary><div class="fold-body">' +
        '<p class="small muted">' + UI.esc(r.classId ? Store.className(r.classId) : '未指定班級') +
          (r.unit ? ' · ' + UI.esc(r.unit) : '') + '</p>' +
        fieldsHTML(r) +
        '<div class="row mt-3">' +
          '<button class="btn btn-sm" data-redit="' + r.id + '" type="button">載入到表單編輯</button>' +
          '<button class="btn btn-sm btn-ghost" data-rcopy="' + r.id + '" type="button">複製文字</button>' +
          '<button class="btn btn-sm btn-danger" data-rdel="' + r.id + '" type="button">刪除</button>' +
        '</div></div></details>';
    }).join('');

    box.querySelectorAll('[data-redit]').forEach(function (b) {
      b.addEventListener('click', function () {
        const r = Store.find('reflections', b.dataset.redit);
        editingId = r.id; level = r.level;
        renderTabs(); renderForm();
        document.getElementById('quick').scrollIntoView({ block: 'start' });
      });
    });
    box.querySelectorAll('[data-rdel]').forEach(function (b) {
      b.addEventListener('click', function () {
        UI.confirmDelete('要刪除這篇反思嗎？', function () {
          Store.remove('reflections', b.dataset.rdel);
          if (editingId === b.dataset.rdel) { editingId = null; renderForm(); }
          UI.toast('已刪除'); renderRecords(); renderKeywords();
        });
      });
    });
    box.querySelectorAll('[data-rcopy]').forEach(function (b) {
      b.addEventListener('click', function () {
        const r = Store.find('reflections', b.dataset.rcopy);
        const lines = [r.level + '　' + r.date + '　' + (r.classId ? Store.className(r.classId) : '') + '　' + (r.unit || '')];
        Object.keys(r.fields || {}).forEach(function (k) {
          if (r.fields[k]) lines.push(labelOf(r.level, k) + '：' + r.fields[k]);
        });
        UI.copyText(lines.join('\n'));
      });
    });
  }

  // 欄位代碼 → 顯示名稱
  function labelOf(lv, key) {
    const found = (LEVELS[lv] && LEVELS[lv].fields || []).find(function (x) { return x[0] === key; });
    if (found) return found[1];
    const onion = ONION.find(function (o) { return o[0] === key; });
    if (onion) return onion[1];
    const MAP = {
      event: '事件描述', intent: '原本想達成', core: '核心問題',
      mineThink: '我·想', stuThink: '學生·想', mineFeel: '我·感', stuFeel: '學生·感',
      mineWant: '我·要', stuWant: '學生·要', mineDo: '我·做', stuDo: '學生·做',
      planA: '方案 A', planB: '方案 B', planC: '方案 C', chosen: '我選', reason: '理由',
      trial: '試驗', record: '記錄方式', reviewDate: '檢視日期', segment: '反思片段'
    };
    return MAP[key] || key;
  }

  function fieldsHTML(r) {
    const f = r.fields || {};
    const keys = Object.keys(f).filter(function (k) { return f[k]; });
    if (!keys.length) return '<p class="small faint">（空白）</p>';
    return '<div class="table-wrap"><table class="data"><tbody>' + keys.map(function (k) {
      return '<tr><th style="width:150px">' + UI.esc(labelOf(r.level, k)) + '</th>' +
        '<td class="pre-wrap">' + UI.esc(f[k]) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  document.getElementById('filterLevel').addEventListener('change', function (e) {
    filterLevel = e.target.value; renderRecords();
  });

  /* ====================== 關鍵詞統計 ======================
     用一份常見問題關鍵詞清單去掃所有反思內文。想加自己的關鍵詞就改這個陣列。
  =================================================== */
  const KEYWORDS = ['指令', '器材', '時間', '秩序', '收拾', '分組', '情緒', '音量',
    '變因', '圖表', '學習單', '安全', '動機', '收尾', '等待', '示範', '記名字', '加分'];

  function renderKeywords() {
    const refs = Store.list('reflections');
    const counts = KEYWORDS.map(function (k) {
      let n = 0;
      refs.forEach(function (r) {
        const text = Object.keys(r.fields || {}).map(function (x) { return r.fields[x]; }).join(' ');
        // 同一篇裡出現多次只算一次，避免單篇拉高數字
        if (text.indexOf(k) >= 0) n++;
      });
      return { word: k, n: n };
    }).filter(function (x) { return x.n > 0; }).sort(function (a, b) { return b.n - a.n; });

    const box = document.getElementById('keywordStats');
    if (!counts.length) {
      box.innerHTML = UI.empty('search', '還沒有可統計的關鍵詞',
        '寫幾篇反思之後，這裡會告訴你哪一類問題重複出現。');
      return;
    }

    const max = counts[0].n;
    box.innerHTML = counts.map(function (c) {
      const systemic = c.n >= 3;
      return '<div class="bar-row mb-2">' +
        '<div class="bar-row-head"><span>' + UI.esc(c.word) +
          (systemic ? ' <span class="tag tag-danger">系統性缺口</span>' : '') + '</span>' +
          '<b>' + c.n + ' 篇</b></div>' +
        '<div class="bar' + (systemic ? ' bar-danger' : '') + '"><span style="width:' +
          Math.round(c.n / max * 100) + '%"></span></div></div>';
    }).join('') +
    (counts.some(function (c) { return c.n >= 3; })
      ? '<div class="alert alert-danger mt-3">' + UI.icon('alert', 18) +
        '<div class="alert-body"><div class="alert-title">有標紅的關鍵詞</div>' +
        '<div class="alert-desc">這代表要建立制度或學會某個具體能力。到「專業成長」把它轉成一個成長目標。</div></div></div>' +
        '<a class="btn btn-sm mt-3" href="growth.html">去設成長目標</a>'
      : '');
  }

  /* ====================== 節奏題組 ====================== */
  const RHYTHM = {
    weekly: { label: '每週五 · 10 分鐘', items: [
      '本週最有成就感的一刻是？',
      '本週最想重來的一刻是？',
      '下週我要刻意練習的一件事是？',
      '本週我學到關於某個學生的一件新事是？'
    ]},
    monthly: { label: '每月 · 20 分鐘', items: [
      '翻回這個月的 L1 速記，找出重複出現的關鍵詞',
      '出現最多次的問題代表我需要建立什麼制度／學會什麼能力？',
      '這個月我確實改變的一件事是？',
      '這個月我說了要改但沒改的一件事是？沒改的原因是什麼（忘記／太難／其實不重要）？'
    ]},
    term: { label: '每學期末 · 40 分鐘', items: [
      '這學期我最大的成長是？',
      '我教得最好的一個單元／活動是？（存檔，明年直接用）',
      '我教得最糟的一個單元是？寫下三個改法，明年開學前先看',
      '學生回饋中最刺耳但可能是對的一句是？',
      '下學期我要保留的三件事是？',
      '下學期我要停止的一件事是？',
      '我需要向誰請教什麼？'
    ]}
  };

  function renderRhythm() {
    document.getElementById('rhythmTabs').innerHTML = Object.keys(RHYTHM).map(function (k) {
      return '<button class="tab' + (rhythmTab === k ? ' is-active' : '') + '" data-rt="' + k + '" role="tab" type="button">' +
        (k === 'weekly' ? '每週' : k === 'monthly' ? '每月' : '每學期') + '</button>';
    }).join('');
    document.querySelectorAll('#rhythmTabs .tab').forEach(function (b) {
      b.addEventListener('click', function () { rhythmTab = b.dataset.rt; renderRhythm(); });
    });

    const set = RHYTHM[rhythmTab];
    const state = Store.data().rhythm || {};
    document.getElementById('rhythmArea').innerHTML =
      '<p class="small muted mb-3">' + UI.esc(set.label) + '</p>' +
      set.items.map(function (t, i) {
        const key = rhythmTab + '-' + i;
        return '<label class="check mb-3"><input type="checkbox" data-rh="' + key + '"' +
          (state[key] ? ' checked' : '') + '><span class="check-text">' + UI.esc(t) + '</span></label>';
      }).join('');

    document.querySelectorAll('#rhythmArea [data-rh]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        const d = Store.data();
        if (!d.rhythm) d.rhythm = {};
        d.rhythm[cb.dataset.rh] = cb.checked;
        Store.commit();
      });
    });
  }

  document.getElementById('rhythmResetBtn').addEventListener('click', function () {
    const d = Store.data();
    Object.keys(d.rhythm || {}).forEach(function (k) {
      if (k.indexOf(rhythmTab + '-') === 0) delete d.rhythm[k];
    });
    Store.commit(); UI.toast('已取消勾選'); renderRhythm();
  });

  /* ====================== 起動 ====================== */
  renderTabs();
  renderForm();
  renderRecords();
  renderKeywords();
  renderRhythm();

  // 從其他頁按「立即寫 2 分鐘速記」連過來時，直接聚焦第一格
  if (location.hash === '#quick') {
    const first = document.getElementById('fld_what');
    if (first) first.focus();
  }
})();
