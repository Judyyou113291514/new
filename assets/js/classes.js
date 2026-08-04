/* ==========================================================================
   classes.js — 班級與學生（classes.html）
   --------------------------------------------------------------------------
   功能：班級新增／改名／刪除、班級加分計數器、學生新增／編輯／刪除、
         批次貼上名單、標籤、觀察紀錄時間軸、依班級／標籤／姓名篩選。
   ========================================================================== */

(function () {
  'use strict';

  UI.renderShell('classes.html');

  // 卡片標題的小圖示
  [['icon-users', 'users'], ['icon-grid', 'grid'], ['icon-note', 'note']].forEach(function (p) {
    const el = document.getElementById(p[0]);
    if (el) el.innerHTML = UI.icon(p[1], 20);
  });

  /* ---------- 可用標籤（想增減直接改這裡）---------- */
  const TAGS = ['學習吃力', '情緒波動', '表現亮點', '需家長聯繫', '需關注'];
  const OBS_TYPES = ['學習狀況', '行為/情緒', '表現亮點', '同儕互動', '家庭/出缺席'];

  function tagClass(t) {
    if (t === '表現亮點') return 'tag-success';
    if (t === '需關注') return 'tag-warn';
    if (t === '需家長聯繫') return 'tag-info';
    if (t === '情緒波動') return 'tag-danger';
    if (t === '學習吃力') return 'tag-primary';
    return '';
  }

  let filterClassId = '';
  let filterTag = '';
  let keyword = '';
  let selectedStudentId = null;

  /* ====================== 班級卡（含點數計數器） ====================== */
  function renderClasses() {
    const box = document.getElementById('classCards');
    const list = Store.classes();
    if (!list.length) {
      box.innerHTML = UI.empty('users', '還沒有班級',
        '先建立你任教的班級，例如「五年一班」，再把名單貼進去。',
        '<button class="btn btn-primary" id="emptyNewClass" type="button">新增班級</button>');
      const b = document.getElementById('emptyNewClass');
      if (b) b.addEventListener('click', newClass);
      return;
    }

    box.innerHTML = list.map(function (c) {
      const n = Store.studentsOf(c.id).length;
      const flagged = Store.studentsOf(c.id).filter(function (s) { return (s.tags || []).indexOf('需關注') >= 0; }).length;
      return '<div class="card card-tight">' +
        '<div class="row mb-2">' +
          '<strong class="grow">' + UI.esc(c.name) + '</strong>' +
          '<button class="btn btn-icon btn-ghost" data-cedit="' + c.id + '" type="button" aria-label="重新命名">' + UI.icon('edit', 15) + '</button>' +
          '<button class="btn btn-icon btn-ghost" data-cdel="' + c.id + '" type="button" aria-label="刪除班級">' + UI.icon('trash', 15) + '</button>' +
        '</div>' +
        '<div class="small muted mb-3">' + n + ' 人' + (flagged ? ' · ' + flagged + ' 位需關注' : '') + '</div>' +
        '<div class="row" style="gap:6px">' +
          '<span class="small muted">課堂點數</span>' +
          '<strong class="num" style="font-size:1.15rem">' + (c.points || 0) + '</strong>' +
          '<span class="grow"></span>' +
          '<button class="btn btn-sm" data-pt="' + c.id + ':-1" type="button" aria-label="扣一分">−1</button>' +
          '<button class="btn btn-sm btn-primary" data-pt="' + c.id + ':1" type="button" aria-label="加一分">＋1</button>' +
        '</div></div>';
    }).join('');

    box.querySelectorAll('[data-pt]').forEach(function (b) {
      b.addEventListener('click', function () {
        const p = b.dataset.pt.split(':');
        const c = Store.find('classes', p[0]);
        c.points = Math.max(0, (c.points || 0) + Number(p[1]));
        Store.commit(); renderClasses();
      });
    });
    box.querySelectorAll('[data-cedit]').forEach(function (b) {
      b.addEventListener('click', function () { renameClass(b.dataset.cedit); });
    });
    box.querySelectorAll('[data-cdel]').forEach(function (b) {
      b.addEventListener('click', function () { deleteClass(b.dataset.cdel); });
    });
  }

  function newClass() {
    UI.modal({
      title: '新增班級',
      bodyHTML: '<div class="field mb-0"><label for="ncName">班級名稱</label>' +
        '<input type="text" id="ncName" placeholder="例：五年一班"></div>',
      onOK: function (m) {
        const name = m.querySelector('#ncName').value.trim();
        if (!name) { UI.toast('請填班級名稱'); return false; }
        Store.add('classes', { name: name, points: 0 });
        UI.toast('已新增班級'); refresh(); return true;
      }
    });
  }

  function renameClass(id) {
    const c = Store.find('classes', id);
    UI.modal({
      title: '重新命名班級',
      bodyHTML: '<div class="field mb-0"><label for="rcName">班級名稱</label>' +
        '<input type="text" id="rcName" value="' + UI.esc(c.name) + '"></div>',
      onOK: function (m) {
        const name = m.querySelector('#rcName').value.trim();
        if (!name) return false;
        Store.update('classes', id, { name: name });
        UI.toast('已更新'); refresh(); return true;
      }
    });
  }

  function deleteClass(id) {
    const c = Store.find('classes', id);
    const n = Store.studentsOf(id).length;
    UI.confirmDelete('要刪除「' + c.name + '」嗎？這個班的 ' + n + ' 位學生與其觀察紀錄也會一起刪除。', function () {
      Store.studentsOf(id).forEach(function (s) {
        Store.list('observations').slice().forEach(function (o) {
          if (o.studentId === s.id) Store.remove('observations', o.id);
        });
        Store.remove('students', s.id);
      });
      Store.remove('classes', id);
      if (filterClassId === id) filterClassId = '';
      UI.toast('已刪除班級'); refresh();
    });
  }

  /* ====================== 批次貼上名單 ====================== */
  function pasteRoster() {
    const classes = Store.classes();
    if (!classes.length) { UI.toast('請先新增班級'); return; }
    UI.modal({
      title: '批次貼上學生名單',
      bodyHTML:
        '<div class="field"><label for="prClass">貼到哪個班</label><select id="prClass">' +
          classes.map(function (c) { return '<option value="' + c.id + '">' + UI.esc(c.name) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field mb-0"><label for="prText">名單</label>' +
          '<span class="field-hint">一行一位。支援「03 陳品妤」「03,陳品妤」「03　陳品妤」或只有姓名（座號自動編）。</span>' +
          '<textarea id="prText" style="min-height:180px" placeholder="01 王小明&#10;02 李小華&#10;03 陳小美"></textarea></div>',
      okText: '匯入名單',
      onOK: function (m) {
        const cid = m.querySelector('#prClass').value;
        const lines = m.querySelector('#prText').value.split('\n');
        let count = 0;
        lines.forEach(function (raw) {
          const line = raw.trim();
          if (!line) return;
          const match = line.match(/^(\d{1,3})\s*[,、\s\t　]+\s*(.+)$/);
          let seat, name;
          if (match) { seat = match[1].padStart(2, '0'); name = match[2].trim(); }
          else { seat = String(Store.studentsOf(cid).length + count + 1).padStart(2, '0'); name = line; }
          if (!name) return;
          Store.add('students', { classId: cid, seatNo: seat, name: name, tags: [], points: 0 });
          count++;
        });
        if (!count) { UI.toast('沒有讀到任何名字'); return false; }
        UI.toast('已匯入 ' + count + ' 位學生'); refresh(); return true;
      }
    });
  }

  /* ====================== 學生卡 ====================== */
  function filteredStudents() {
    return Store.list('students').filter(function (s) {
      if (filterClassId && s.classId !== filterClassId) return false;
      if (filterTag && (s.tags || []).indexOf(filterTag) < 0) return false;
      if (keyword && (s.name + ' ' + s.seatNo).indexOf(keyword) < 0) return false;
      return true;
    }).sort(function (a, b) {
      if (a.classId !== b.classId) return a.classId.localeCompare(b.classId);
      return String(a.seatNo).localeCompare(String(b.seatNo));
    });
  }

  function renderStudents() {
    const list = filteredStudents();
    const box = document.getElementById('studentGrid');
    document.getElementById('studentCount').textContent = list.length + ' 位';

    if (!list.length) {
      box.innerHTML = UI.empty('users', '沒有符合條件的學生',
        Store.list('students').length ? '換一組篩選條件，或清除搜尋關鍵字。' : '用「批次貼上名單」一次把整班匯入最快。');
      return;
    }

    box.innerHTML = list.map(function (s) {
      const obsN = Store.observationsOf(s.id).length;
      const flagged = (s.tags || []).indexOf('需關注') >= 0;
      return '<div class="student-card' + (flagged ? ' is-flagged' : '') + '" id="' + s.id + '">' +
        '<div class="student-head">' +
          '<span class="student-seat num">' + UI.esc(s.seatNo) + '</span>' +
          '<span class="student-name">' + UI.esc(s.name) + '</span>' +
          '<button class="btn btn-icon btn-ghost" data-sedit="' + s.id + '" type="button" aria-label="編輯學生">' + UI.icon('edit', 15) + '</button>' +
        '</div>' +
        '<div class="xsmall muted mb-2">' + UI.esc(Store.className(s.classId)) + ' · 加分 ' +
          '<span class="num">' + (s.points || 0) + '</span></div>' +
        '<div class="student-tags">' + ((s.tags || []).length
          ? s.tags.map(function (t) { return '<span class="tag ' + tagClass(t) + '">' + UI.esc(t) + '</span>'; }).join('')
          : '<span class="xsmall faint">沒有標籤</span>') + '</div>' +
        '<div class="row" style="gap:5px">' +
          '<button class="btn btn-sm" data-spt="' + s.id + '" type="button">＋1 分</button>' +
          '<button class="btn btn-sm" data-sobs="' + s.id + '" type="button">寫紀錄</button>' +
          '<button class="btn btn-sm btn-ghost" data-sview="' + s.id + '" type="button">紀錄 ' + obsN + '</button>' +
        '</div></div>';
    }).join('');

    box.querySelectorAll('[data-spt]').forEach(function (b) {
      b.addEventListener('click', function () {
        const s = Store.student(b.dataset.spt);
        Store.update('students', s.id, { points: (s.points || 0) + 1 });
        UI.toast(s.name + ' ＋1 分'); renderStudents();
      });
    });
    box.querySelectorAll('[data-sedit]').forEach(function (b) {
      b.addEventListener('click', function () { editStudent(b.dataset.sedit); });
    });
    box.querySelectorAll('[data-sobs]').forEach(function (b) {
      b.addEventListener('click', function () { addObservation(b.dataset.sobs); });
    });
    box.querySelectorAll('[data-sview]').forEach(function (b) {
      b.addEventListener('click', function () { selectedStudentId = b.dataset.sview; renderObs(); });
    });
  }

  function editStudent(id) {
    const s = id ? Store.student(id) : null;
    const classes = Store.classes();
    UI.modal({
      title: s ? '編輯學生' : '新增學生',
      bodyHTML:
        '<div class="field-row-3" style="display:grid;gap:12px;grid-template-columns:1fr 1fr 90px">' +
          '<div class="field"><label for="esClass">班級</label><select id="esClass">' +
            classes.map(function (c) {
              return '<option value="' + c.id + '"' + (s && s.classId === c.id ? ' selected' : '') + '>' + UI.esc(c.name) + '</option>';
            }).join('') + '</select></div>' +
          '<div class="field"><label for="esName">姓名</label><input type="text" id="esName" value="' + UI.esc(s ? s.name : '') + '"></div>' +
          '<div class="field"><label for="esSeat">座號</label><input type="text" id="esSeat" value="' + UI.esc(s ? s.seatNo : '') + '"></div>' +
        '</div>' +
        '<div class="field"><span class="field-label">標籤</span>' +
          '<span class="field-hint">標籤是給自己的提醒，不是給學生的評價。狀況改善了就取消勾選。</span>' +
          '<div class="check-grid" id="esTags">' + TAGS.map(function (t) {
            const on = s && (s.tags || []).indexOf(t) >= 0;
            return '<label class="check check-plain"><input type="checkbox" value="' + t + '"' + (on ? ' checked' : '') + '>' +
              '<span class="check-text">' + t + '</span></label>';
          }).join('') + '</div></div>' +
        '<div class="field mb-0"><label for="esPoints">累計加分</label>' +
          '<input type="number" id="esPoints" min="0" value="' + (s ? (s.points || 0) : 0) + '" style="max-width:120px"></div>' +
        (s ? '<div class="divider"></div><button class="btn btn-danger btn-sm" id="esDel" type="button">刪除這位學生</button>' : ''),
      onOpen: function (m) {
        const d = m.querySelector('#esDel');
        if (d) d.addEventListener('click', function () {
          m.remove();
          UI.confirmDelete('要刪除「' + s.name + '」與他的觀察紀錄嗎？', function () {
            Store.list('observations').slice().forEach(function (o) {
              if (o.studentId === s.id) Store.remove('observations', o.id);
            });
            Store.remove('students', s.id);
            if (selectedStudentId === s.id) selectedStudentId = null;
            UI.toast('已刪除'); refresh();
          });
        });
      },
      onOK: function (m) {
        const name = m.querySelector('#esName').value.trim();
        if (!name) { UI.toast('請填姓名'); return false; }
        const rec = {
          classId: m.querySelector('#esClass').value,
          name: name,
          seatNo: m.querySelector('#esSeat').value.trim() || '－',
          tags: Array.prototype.slice.call(m.querySelectorAll('#esTags input:checked')).map(function (i) { return i.value; }),
          points: Number(m.querySelector('#esPoints').value) || 0
        };
        if (s) { Store.update('students', s.id, rec); UI.toast('已更新'); }
        else { Store.add('students', rec); UI.toast('已新增學生'); }
        refresh(); return true;
      }
    });
  }

  /* ====================== 觀察紀錄 ====================== */
  function addObservation(studentId, obsId) {
    const o = obsId ? Store.find('observations', obsId) : null;
    const students = Store.list('students');
    if (!students.length) { UI.toast('請先建立學生'); return; }
    UI.modal({
      title: o ? '編輯觀察紀錄' : '新增觀察紀錄',
      bodyHTML:
        '<div class="field"><label for="obStu">學生</label><select id="obStu">' +
          students.map(function (s) {
            const sel = (o ? o.studentId : studentId) === s.id ? ' selected' : '';
            return '<option value="' + s.id + '"' + sel + '>' + UI.esc(Store.studentLabel(s.id)) + '</option>';
          }).join('') + '</select></div>' +
        '<div class="field-row">' +
          '<div class="field"><label for="obDate">日期</label>' +
            '<input type="date" id="obDate" value="' + (o ? o.date : UI.todayISO()) + '"></div>' +
          '<div class="field"><label for="obType">類型</label><select id="obType">' +
            OBS_TYPES.map(function (t) {
              return '<option value="' + t + '"' + (o && o.type === t ? ' selected' : '') + '>' + t + '</option>';
            }).join('') + '</select></div>' +
        '</div>' +
        '<div class="field mb-0"><label for="obText">事件（只寫看得到的事實，先不下判斷）</label>' +
          '<textarea id="obText" placeholder="例：分組時同學先動器材，他大聲抗議並推桌子。課後私下談，說「他們都不等我」。">' +
          UI.esc(o ? o.text : '') + '</textarea></div>',
      onOK: function (m) {
        const text = m.querySelector('#obText').value.trim();
        if (!text) { UI.toast('請填事件內容'); return false; }
        const rec = {
          studentId: m.querySelector('#obStu').value,
          date: m.querySelector('#obDate').value || UI.todayISO(),
          type: m.querySelector('#obType').value,
          text: text
        };
        if (o) { Store.update('observations', o.id, rec); UI.toast('已更新紀錄'); }
        else { Store.add('observations', rec); UI.toast('已新增紀錄'); }
        selectedStudentId = rec.studentId;
        refresh(); return true;
      }
    });
  }

  function renderObs() {
    const box = document.getElementById('obsPanel');

    // 沒有選學生時，顯示全部最近紀錄
    if (!selectedStudentId) {
      const recent = Store.list('observations').slice()
        .sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 8);
      if (!recent.length) {
        box.innerHTML = UI.empty('note', '還沒有觀察紀錄',
          '在學生卡按「寫紀錄」，累積下來就能看出模式。一句話就夠。',
          '<button class="btn btn-primary" id="obsEmptyBtn" type="button">寫第一筆紀錄</button>');
        const b = document.getElementById('obsEmptyBtn');
        if (b) b.addEventListener('click', function () { addObservation(null); });
        return;
      }
      box.innerHTML = '<p class="small muted">最近 8 筆（點學生卡的「紀錄」看單一學生）</p>' + timelineHTML(recent, true);
      bindObsEvents();
      return;
    }

    const s = Store.student(selectedStudentId);
    if (!s) { selectedStudentId = null; renderObs(); return; }
    const list = Store.observationsOf(s.id);

    box.innerHTML =
      '<div class="row mb-3">' +
        '<strong class="grow">' + UI.esc(s.name) + '<span class="small muted"> · ' + UI.esc(Store.className(s.classId)) + '</span></strong>' +
        '<button class="btn btn-sm" id="obsBackBtn" type="button">看全部</button>' +
        '<button class="btn btn-primary btn-sm" id="obsAddBtn" type="button">新增</button>' +
      '</div>' +
      '<div class="student-tags mb-3">' + (s.tags || []).map(function (t) {
        return '<span class="tag ' + tagClass(t) + '">' + UI.esc(t) + '</span>';
      }).join('') + '</div>' +
      (list.length ? timelineHTML(list, false)
        : UI.empty('note', '這位學生還沒有紀錄', '按上面的「新增」寫一筆，下次要跟導師或家長談就有具體事實可以講。'));

    bindObsEvents();
    const back = document.getElementById('obsBackBtn');
    if (back) back.addEventListener('click', function () { selectedStudentId = null; renderObs(); });
    const add = document.getElementById('obsAddBtn');
    if (add) add.addEventListener('click', function () { addObservation(s.id); });
  }

  function timelineHTML(list, showName) {
    return '<ul class="timeline">' + list.map(function (o) {
      return '<li>' +
        '<div class="timeline-date">' + UI.formatDate(o.date) + ' · ' + UI.esc(o.type) +
          (showName ? ' · ' + UI.esc(Store.studentLabel(o.studentId)) : '') + '</div>' +
        '<div class="timeline-body pre-wrap">' + UI.esc(o.text) + '</div>' +
        '<div class="row" style="gap:4px;margin-top:4px">' +
          '<button class="btn btn-sm btn-ghost" data-oedit="' + o.id + '" type="button">編輯</button>' +
          '<button class="btn btn-sm btn-ghost" data-odel="' + o.id + '" type="button">刪除</button>' +
        '</div></li>';
    }).join('') + '</ul>';
  }

  function bindObsEvents() {
    const box = document.getElementById('obsPanel');
    box.querySelectorAll('[data-oedit]').forEach(function (b) {
      b.addEventListener('click', function () { addObservation(null, b.dataset.oedit); });
    });
    box.querySelectorAll('[data-odel]').forEach(function (b) {
      b.addEventListener('click', function () {
        UI.confirmDelete('要刪除這筆觀察紀錄嗎？', function () {
          Store.remove('observations', b.dataset.odel); UI.toast('已刪除'); renderObs();
        });
      });
    });
  }

  /* ====================== 篩選列 ====================== */
  function renderFilters() {
    document.getElementById('filterClass').innerHTML = '<option value="">全部班級</option>' +
      Store.classes().map(function (c) {
        return '<option value="' + c.id + '"' + (filterClassId === c.id ? ' selected' : '') + '>' + UI.esc(c.name) + '</option>';
      }).join('');
    document.getElementById('filterTag').innerHTML = '<option value="">全部標籤</option>' +
      TAGS.map(function (t) {
        return '<option value="' + t + '"' + (filterTag === t ? ' selected' : '') + '>' + t + '</option>';
      }).join('');
  }

  document.getElementById('filterClass').addEventListener('change', function (e) { filterClassId = e.target.value; renderStudents(); });
  document.getElementById('filterTag').addEventListener('change', function (e) { filterTag = e.target.value; renderStudents(); });
  document.getElementById('searchName').addEventListener('input', function (e) { keyword = e.target.value.trim(); renderStudents(); });
  document.getElementById('newClassBtn').addEventListener('click', newClass);
  document.getElementById('newStudentBtn').addEventListener('click', function () { editStudent(null); });
  document.getElementById('pasteBtn').addEventListener('click', pasteRoster);

  function refresh() {
    renderFilters();
    renderClasses();
    renderStudents();
    renderObs();
  }
  window.onDataChanged = refresh;

  // 從儀表板用 #學生id 連過來時，直接開那位學生的時間軸
  if (location.hash.length > 1) selectedStudentId = location.hash.slice(1);

  refresh();
})();
