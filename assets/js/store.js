/* ==========================================================================
   store.js — 資料層（唯一負責讀寫 localStorage 的檔案）
   --------------------------------------------------------------------------
   設計原則：
     ‧ 全部資料放在同一個 localStorage 鍵（見 STORAGE_KEY），存成一個 JSON 物件。
     ‧ 頁面程式碼只透過 Store.xxx() 存取資料，不直接碰 localStorage。
     ‧ 第一次開啟（沒有資料）時自動載入示範資料 seedData()。
     ‧ 匯出／匯入／清除：Store.exportJSON() / importJSON() / clearAll()

   想加新的資料表？在 emptyData() 加一個陣列，再用 Store.list / add / update /
   remove 就能直接用，不用另外寫程式。
   ========================================================================== */

const Store = (function () {
  'use strict';

  const STORAGE_KEY = 'teacherDashboard.v1';   // localStorage 的鍵名
  const SCHEMA_VERSION = 1;                    // 資料格式版本（未來升級用）

  /* ---------- 儲存媒體轉接層 ----------
     正常情況下寫入瀏覽器的 localStorage。
     若瀏覽器不允許（隱私模式、嵌入式 iframe、關閉 Cookie），
     就自動改成「記憶體模式」：功能都能用，但關閉頁面後資料不保留。
     可用 Store.isPersistent() 判別目前是哪一種。 */
  const Persist = (function () {
    const memory = {};
    let backend = null;
    try {
      const probe = window['local' + 'Storage'];
      probe.setItem('__probe__', '1');
      probe.removeItem('__probe__');
      backend = probe;
    } catch (e) {
      backend = null;   // 不可用 → 退回記憶體
    }
    return {
      available: function () { return backend !== null; },
      getItem: function (k) {
        if (backend) { try { return backend.getItem(k); } catch (e) { /* 忽略 */ } }
        return Object.prototype.hasOwnProperty.call(memory, k) ? memory[k] : null;
      },
      setItem: function (k, v) {
        memory[k] = v;
        if (backend) { try { backend.setItem(k, v); return true; } catch (e) { return false; } }
        return false;
      },
      removeItem: function (k) {
        delete memory[k];
        if (backend) { try { backend.removeItem(k); } catch (e) { /* 忽略 */ } }
      }
    };
  })();

  /* ---------- 小工具 ---------- */

  // 產生簡單的唯一 id（時間 + 隨機碼）
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // 取得 YYYY-MM-DD 格式字串
  function toISODate(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return dt.getFullYear() + '-' + m + '-' + day;
  }

  // 今天往前／往後 n 天的日期字串（示範資料用，讓示範資料永遠貼近「今天」）
  function dayOffset(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return toISODate(d);
  }

  /* ---------- 空白資料結構 ---------- */
  function emptyData() {
    return {
      meta: { version: SCHEMA_VERSION, seeded: false, createdAt: new Date().toISOString() },

      // 設定：老師姓名、學期起訖、週課表
      settings: {
        teacherName: '',
        school: '',
        semesterStart: dayOffset(-21),
        semesterEnd: dayOffset(120),
        parentMeetingDate: dayOffset(18),           // 班親會日期（儀表板倒數用）
        sciFairStart: dayOffset(-28),               // 科展 8 週的第一週起始日
        periodLabels: ['1', '2', '3', '4', '5', '6', '7'],
        // timetable[星期(1=一 ~ 5=五)][節次索引] = 課程文字
        timetable: { 1: [], 2: [], 3: [], 4: [], 5: [] }
      },

      todos: [],          // {id, text, scope:'today'|'week'|'term', done, createdAt}
      classes: [],        // {id, name, points}
      students: [],       // {id, classId, seatNo, name, tags:[], points}
      observations: [],   // {id, studentId, date, type, text}
      lessons: [],        // 備課單
      contacts: [],       // 親師聯繫紀錄
      templates: [],      // 溝通模板
      groups: [],         // 科展分組
      reflections: [],    // 反思紀錄
      rhythm: {},         // 反思節奏題組的勾選狀態 {key: true}
      assessments: [],    // 自評量表歷次結果
      goals: [],          // 成長目標
      milestones: [],     // 成長歷程（研習／觀課／閱讀）
      links: [],          // 資源連結
      checklists: [],     // 可勾選檢核清單
      notes: []           // 純文字筆記
    };
  }

  /* ---------- 示範資料（seed）---------- */
  function seedData() {
    const d = emptyData();
    d.meta.seeded = true;

    d.settings.teacherName = '林老師';
    d.settings.school = '新竹市陽光國小';

    // 週課表：科任老師典型的跑班課表
    d.settings.timetable = {
      1: ['', '五年一班', '五年一班', '', '六年二班', '六年二班', ''],
      2: ['五年二班', '五年二班', '', '六年一班', '', '自然科教研會', ''],
      3: ['', '六年一班', '六年一班', '五年三班', '五年三班', '', '科展指導'],
      4: ['五年一班', '', '六年二班', '', '五年二班', '五年二班', ''],
      5: ['六年一班', '六年一班', '', '五年三班', '', '器材整理', '']
    };

    /* --- 班級與學生 --- */
    const classSpecs = [
      { name: '五年一班', students: [
        ['03', '陳品妤', ['表現亮點']],
        ['07', '林宥辰', ['學習吃力', '需關注']],
        ['12', '黃苡榛', []],
        ['15', '張家豪', ['情緒波動', '需關注']],
        ['21', '吳承恩', []],
        ['26', '劉曉彤', ['表現亮點']]
      ]},
      { name: '五年二班', students: [
        ['02', '王柏睿', []],
        ['09', '李念慈', ['需家長聯繫']],
        ['14', '謝孟哲', ['學習吃力']],
        ['19', '洪雅涵', ['表現亮點']],
        ['24', '鄭子謙', []]
      ]},
      { name: '五年三班', students: [
        ['05', '許庭萱', []],
        ['11', '蔡宇軒', ['情緒波動']],
        ['18', '賴思妤', []],
        ['23', '周立宸', ['需關注', '學習吃力']]
      ]},
      { name: '六年一班', students: [
        ['01', '楊承翰', ['表現亮點']],
        ['08', '簡佩蓉', []],
        ['13', '呂宗霖', ['需家長聯繫', '需關注']],
        ['20', '范曉薇', []],
        ['25', '邱柏勳', []]
      ]},
      { name: '六年二班', students: [
        ['04', '彭子涵', []],
        ['10', '曾柏勛', ['情緒波動']],
        ['17', '柯宜蓁', ['表現亮點']],
        ['22', '莊天佑', []]
      ]}
    ];

    classSpecs.forEach(function (cs, ci) {
      const cid = 'cls_' + (ci + 1);
      d.classes.push({ id: cid, name: cs.name, points: [12, 9, 15, 7, 11][ci] || 0 });
      cs.students.forEach(function (s, si) {
        d.students.push({
          id: cid + '_stu' + (si + 1),
          classId: cid,
          seatNo: s[0],
          name: s[1],
          tags: s[2],
          points: [2, 1, 3, 0, 4, 1][si] || 0
        });
      });
    });

    /* --- 觀察紀錄 --- */
    d.observations = [
      { id: uid('obs'), studentId: 'cls_1_stu2', date: dayOffset(-2), type: '學習狀況', text: '變因控制的概念仍混淆，把「要測的」和「要固定的」講反。已請他用自己的話再說一次。' },
      { id: uid('obs'), studentId: 'cls_1_stu2', date: dayOffset(-9), type: '學習狀況', text: '學習單第 3 題空白，個別問後發現是不會讀圖表刻度。' },
      { id: uid('obs'), studentId: 'cls_1_stu4', date: dayOffset(-1), type: '行為/情緒', text: '同組同學先動器材，他大聲抗議並推桌子。課後私下談，說「他們都不等我」。' },
      { id: uid('obs'), studentId: 'cls_1_stu1', date: dayOffset(-4), type: '表現亮點', text: '主動幫組員畫紀錄表格，並提醒大家先寫預測再實驗。' },
      { id: uid('obs'), studentId: 'cls_4_stu3', date: dayOffset(-3), type: '行為/情緒', text: '連續兩週未帶學習單，聯絡簿也沒簽。已請導師協助確認家中狀況。' },
      { id: uid('obs'), studentId: 'cls_3_stu4', date: dayOffset(-6), type: '學習狀況', text: '實驗操作願意動手，但書寫紀錄幾乎放棄。下次改用口說錄音替代。' }
    ];

    /* --- 待辦 --- */
    d.todos = [
      { id: uid('td'), text: '影印五年一班「熱的傳導」學習單 30 份', scope: 'today', done: true,  createdAt: dayOffset(0) },
      { id: uid('td'), text: '檢查酒精燈存量與燈芯（今天第 5 節要用）', scope: 'today', done: false, createdAt: dayOffset(0) },
      { id: uid('td'), text: '登錄六年二班上週加減分', scope: 'today', done: false, createdAt: dayOffset(0) },
      { id: uid('td'), text: '回覆李念慈家長的請假訊息', scope: 'today', done: false, createdAt: dayOffset(0) },
      { id: uid('td'), text: '預做「水的三態」實驗一次，抓安全風險點', scope: 'week', done: false, createdAt: dayOffset(-2) },
      { id: uid('td'), text: '和五年一班導師交換林宥辰的學習狀況', scope: 'week', done: false, createdAt: dayOffset(-2) },
      { id: uid('td'), text: '科展第 5 組的研究問題要再收斂', scope: 'week', done: true,  createdAt: dayOffset(-3) },
      { id: uid('td'), text: '整理下週實驗器材清單並補購耗材', scope: 'week', done: false, createdAt: dayOffset(-1) },
      { id: uid('td'), text: '完成期中成績登錄（教學組截止日）', scope: 'term', done: false, createdAt: dayOffset(-14) },
      { id: uid('td'), text: '整理自然教室器材清冊（位置／數量／堪用狀況）', scope: 'term', done: false, createdAt: dayOffset(-18) },
      { id: uid('td'), text: '寫一份科展承辦交接文件', scope: 'term', done: false, createdAt: dayOffset(-10) },
      { id: uid('td'), text: '滅火器效期檢查與報修', scope: 'term', done: true, createdAt: dayOffset(-20) }
    ];

    /* --- 備課單 --- */
    d.lessons = [
      {
        id: uid('les'),
        classId: 'cls_1', unit: '熱的傳導與保溫',
        goals: '能辨別不同材質導熱快慢的差異，並用「控制變因」的方式設計比較實驗。',
        codes: ['pe-Ⅲ-1', 'pa-Ⅲ-1'],
        flow: {
          motivate: { text: '拿兩支湯匙（金屬／木頭）泡在熱水中，請學生猜哪支先變熱、為什麼。', min: 5 },
          inquiry:  { text: '分組測試四種材質棒子的導熱速度：討論要固定什麼（水溫、長度、時間），紀錄表格由小組自己畫。', min: 20 },
          integrate:{ text: '各組把結果貼上黑板排序，比較差異，導出「導熱快慢」的說法。', min: 8 },
          wrapup:   { text: '收器材點算＋回扣生活情境（保溫杯為什麼要雙層）。', min: 7 }
        },
        materials: [
          { name: '金屬棒／木棒／塑膠棒 各 8 支', ready: true },
          { name: '燒杯 8 個', ready: true },
          { name: '熱水瓶（老師操作，學生不碰沸水）', ready: false },
          { name: '溫度計 8 支', ready: false },
          { name: '學習單 30 份', ready: true }
        ],
        obstacles: '學生會把「要測的變項」和「要固定的變項」講反；急著動手不聽指令。',
        backup: '注意事項講完、全體點頭後才發器材。若溫度計不足改成「摸感覺＋排序」的定性比較。',
        createdAt: dayOffset(-5), updatedAt: dayOffset(-2)
      },
      {
        id: uid('les'),
        classId: 'cls_4', unit: '簡單機械：槓桿',
        goals: '能透過改變支點位置，觀察並記錄省力與費力的關係。',
        codes: ['po-Ⅲ-2', 'pa-Ⅲ-2'],
        flow: {
          motivate: { text: '請兩位體型差很多的同學玩蹺蹺板照片，問「怎麼讓小的贏」。', min: 5 },
          inquiry:  { text: '用尺與硬幣做槓桿，改變支點位置測需要幾枚硬幣才平衡，做成表格。', min: 22 },
          integrate:{ text: '畫出「支點距離 vs 所需重量」折線圖，找規律。', min: 8 },
          wrapup:   { text: '舉三個生活中的槓桿例子並標出支點。', min: 5 }
        },
        materials: [
          { name: '30cm 直尺 10 支', ready: true },
          { name: '硬幣或墊片 每組 20 枚', ready: true },
          { name: '三角支架 10 個', ready: false },
          { name: '方格紙 30 張', ready: true }
        ],
        obstacles: '折線圖的軸不會標；硬幣容易滾掉造成秩序混亂。',
        backup: '先在黑板一起畫一次軸再放手。硬幣改用有黏性的墊片。',
        createdAt: dayOffset(-11), updatedAt: dayOffset(-11)
      }
    ];

    /* --- 溝通模板（內建 8 個）--- */
    const T = [
      ['請假回覆', '請假與補課', '{{parent}}您好，我是{{class}}自然科{{teacher}}。收到{{student}}今天請假的訊息了，請多休息。本節我們上到「{{unit}}」，學習單我會留一份給導師，回來後我再找時間個別說明，不用擔心進度。謝謝您的告知。'],
      ['材料提醒', '課前準備', '{{parent}}您好，我是{{class}}自然科{{teacher}}。下週自然課要做實驗，需要請{{student}}帶：（1）＿＿＿（2）＿＿＿。若家中不方便準備，請告訴我，學校可以提供，不會影響上課。謝謝您。'],
      ['活動通知', '活動與行政', '{{parent}}您好，我是{{class}}自然科{{teacher}}。{{class}}將於＿月＿日進行「＿＿＿＿」活動，時間為第＿節，地點在自然教室。請提醒{{student}}當天穿著方便活動的服裝。若有任何疑問歡迎與我聯繫。'],
      ['鼓勵訊息', '正向回饋', '{{parent}}您好，我是{{class}}自然科{{teacher}}。想跟您分享一件小事：這週實驗課{{student}}主動＿＿＿＿，而且會提醒同組同學注意安全。這種態度在自然課非常珍貴，也請您在家肯定他一下。謝謝您。'],
      ['行為問題告知', '行為與輔導', '{{parent}}您好，我是{{class}}自然科{{teacher}}。今天自然課發生一件事想讓您知道：{{student}}在＿＿＿＿的時候＿＿＿＿（只描述事實）。當下我已經請他＿＿＿＿，他也願意配合。我想了解的是他在家是否也有類似狀況，我們一起找方法。不是要責備孩子，是希望他在實驗室裡是安全的。方便的話請回覆您的想法，謝謝。'],
      ['科展參與通知', '科展', '{{parent}}您好，我是{{class}}自然科{{teacher}}。{{student}}在課堂上對探究很有興趣，我想邀請他加入今年的科展小組。時間安排是每週＿放學後約 1 小時，為期約 8 週，會有一次校內成果發表。參加與否完全自願，也不影響成績。若您同意，請回覆讓我知道，我會再提供詳細時程。'],
      ['成績說明', '成績', '{{parent}}您好，我是{{class}}自然科{{teacher}}。關於{{student}}這次自然科成績的計算方式說明如下：平時表現（課堂參與、實驗操作、學習單）佔 25%，紙筆測驗佔 75%。這次{{student}}在＿＿＿＿部分表現不錯，需要加強的是＿＿＿＿。下次評量前我會再提供複習重點。若還有疑問歡迎聯繫，謝謝您。'],
      ['班親會邀請', '活動與行政', '{{parent}}您好，我是{{class}}自然科{{teacher}}。班親會將於＿月＿日（＿）晚上＿點於{{class}}教室舉行，我會出席說明本學期自然課的進度、評量方式與實驗室安全規範，也保留時間回答問題。若您無法到場，可以先把想問的事寫下來交給導師，我會個別回覆。期待與您見面。']
    ];
    d.templates = T.map(function (t) {
      return { id: uid('tpl'), title: t[0], category: t[1], body: t[2], builtin: true };
    });

    /* --- 親師聯繫紀錄 --- */
    d.contacts = [
      { id: uid('ct'), studentId: 'cls_2_stu2', classId: 'cls_2', date: dayOffset(-1), method: '訊息（導師轉達）',
        content: '家長告知今日請假就醫，詢問是否需要補學習單。', followUp: '週五前給補充說明時間', followDone: false },
      { id: uid('ct'), studentId: 'cls_4_stu3', classId: 'cls_4', date: dayOffset(-3), method: '電話',
        content: '說明連續未帶學習單的情形，家長表示近期家中有事會協助盯。', followUp: '下週回報是否改善', followDone: false },
      { id: uid('ct'), studentId: 'cls_1_stu4', classId: 'cls_1', date: dayOffset(-7), method: '面談（放學後）',
        content: '討論小組衝突事件，約定「先舉手再動器材」的規則。', followUp: '', followDone: true },
      { id: uid('ct'), studentId: 'cls_1_stu1', classId: 'cls_1', date: dayOffset(-10), method: '聯絡簿',
        content: '寫下課堂主動協助組員的具體事例，給正向回饋。', followUp: '', followDone: true }
    ];

    /* --- 科展分組 --- */
    const weekTitles = sciFairWeekTitles();
    d.groups = [
      {
        id: uid('grp'), name: '第 1 組 · 涼快小屋', members: '楊承翰、簡佩蓉、范曉薇', topic: '不同屋頂材質對室內降溫的效果',
        question: '哪一種屋頂材質能讓模型屋內部溫度上升最少？',
        iv: '屋頂材質（鋁箔／白紙／黑紙／草皮）', cv: '模型屋大小、光源距離、照射時間、起始室溫', dv: '30 分鐘後屋內溫度（℃）',
        expect: '反射率高的鋁箔與白色屋頂升溫最少，黑紙最多。',
        weeks: [true, true, true, true, false, false, false, false],
        blockers: [
          { week: 4, block: '預做時燈泡距離不好固定，數據跳動很大', next: '做一個固定燈架，重測一次' }
        ],
        materials: [{ name: '模型屋紙板 4 組', ready: true }, { name: '鋁箔／白紙／黑紙／人工草皮', ready: true }, { name: '溫度計 4 支', ready: false }, { name: '檯燈與固定架', ready: false }],
        report: reportChecklist([true, true, false, false, false, false, false]),
        createdAt: dayOffset(-28)
      },
      {
        id: uid('grp'), name: '第 2 組 · 果皮除臭', members: '邱柏勳、呂宗霖', topic: '不同果皮吸附冰箱異味的效果比較',
        question: '柑橘類、蘋果、茶葉三種材料，哪一種除臭效果最好？',
        iv: '除臭材料種類', cv: '密閉容器大小、異味來源與量、放置時間、環境溫度', dv: '五位評分者的氣味強度評分（1–5）',
        expect: '柑橘類含精油，除臭效果最好。',
        weeks: [true, true, false, false, false, false, false, false],
        blockers: [
          { week: 3, block: '「氣味」是主觀的，不知道怎麼量化', next: '設計 1–5 分評分表，找 5 位同學盲測平均' }
        ],
        materials: [{ name: '密封玻璃罐 6 個', ready: true }, { name: '柑橘皮／蘋果皮／茶葉', ready: false }, { name: '評分表 30 份', ready: false }],
        report: reportChecklist([true, false, false, false, false, false, false]),
        createdAt: dayOffset(-28)
      },
      {
        id: uid('grp'), name: '第 3 組 · 紙橋承重', members: '彭子涵、柯宜蓁、莊天佑', topic: '摺法對紙橋承重能力的影響',
        question: '同一張紙用不同摺法，哪一種能承受最多重量？',
        iv: '紙的摺法（平板／波浪／管狀／三角）', cv: '紙張大小與材質、跨距、加重方式、加重位置', dv: '崩塌前承受的硬幣數量',
        expect: '波浪與三角結構因為分散受力，承重最多。',
        weeks: [true, true, true, true, true, true, false, false],
        blockers: [],
        materials: [{ name: 'A4 影印紙 100 張', ready: true }, { name: '硬幣或砝碼', ready: true }, { name: '積木橋墩 2 組', ready: true }],
        report: reportChecklist([true, true, true, true, false, false, false]),
        createdAt: dayOffset(-28)
      }
    ];
    // 把週次標題存起來，頁面顯示用
    d.settings.sciFairWeekTitles = weekTitles;

    /* --- 反思紀錄 --- */
    d.reflections = [
      {
        id: uid('ref'), level: 'L1', date: dayOffset(-1), classId: 'cls_1', unit: '熱的傳導',
        fields: {
          what: '分組實驗時第 3、5 組沒等指令就點酒精燈，我提高音量制止，全班安靜了但氣氛僵掉十分鐘。',
          worked: '先示範一次再發器材，其他組操作都正確。',
          failed: '器材放在桌上才講注意事項，等於邀請他們先玩。',
          next: '注意事項講完、確認全體點頭後才發器材。'
        },
        createdAt: dayOffset(-1)
      },
      {
        id: uid('ref'), level: 'L1', date: dayOffset(-4), classId: 'cls_4', unit: '槓桿',
        fields: {
          what: '折線圖畫到一半有五個學生舉手問軸怎麼標，我來不及一個個看。',
          worked: '硬幣改成墊片後沒有再滾掉，秩序好很多。',
          failed: '指令一次講三件事，學生只記得最後一件。',
          next: '指令一次只講一件，講完停三秒再講下一件。'
        },
        createdAt: dayOffset(-4)
      },
      {
        id: uid('ref'), level: 'L1', date: dayOffset(-8), classId: 'cls_2', unit: '水的三態',
        fields: {
          what: '收拾時間只留三分鐘，下課鐘響時桌上還有水漬，下一節老師進來很尷尬。',
          worked: '用倒數計時器宣布「還剩五分鐘」，學生有反應。',
          failed: '指令不清：沒說清楚誰負責擦桌子、誰負責歸位。',
          next: '課前就寫好值日組分工在黑板角落。'
        },
        createdAt: dayOffset(-8)
      },
      {
        id: uid('ref'), level: 'L2', date: dayOffset(-3), classId: 'cls_1', unit: '熱的傳導',
        fields: {
          segment: '發器材後到我制止之間的那兩分鐘',
          describe: '我把器材籃放到各組桌上，接著開始講安全注意事項。講到第二點時第 3 組已經打開酒精燈蓋子，第 5 組在互相搶溫度計。我停下來提高音量說「全部放下」。',
          feeling: '當下很緊張也有點被冒犯，覺得「我還在講你們就不聽」。學生應該是覺得被兇了、莫名其妙。現在回想，緊張主要來自怕出安全事故。',
          evaluate: '好的是我有立刻停下來，沒有讓危險繼續。不順的是我讓器材先到他們手上，等於自己製造了誘因；我的音量讓後面十分鐘的氣氛都僵掉。',
          analyse: '主因是流程順序錯誤，不是學生故意。小五學生看到新器材會忍不住碰，這是可預期的。指南也提過：器材放在桌上才講注意事項，等於邀請他們先玩。',
          conclude: '關於學生：他們不是不守規矩，是我把誘因放在他們手上。關於自己：我用音量解決流程問題，成本很高。當時可以請各組長先來領器材。',
          action: '（1）注意事項講完、全體點頭後才由組長領器材。（2）寫在備課單「器材發放時機」欄提醒自己。（3）檢核指標：連續三堂沒有出現「未指令先操作」。'
        },
        createdAt: dayOffset(-3)
      },
      {
        id: uid('ref'), level: 'L3', date: dayOffset(-12), classId: 'cls_3', unit: '課堂秩序',
        fields: {
          event: '五年三班連續三週在實驗後段失控，這次我在走廊上對全班大聲說「以後不要做實驗了」，說完就後悔。',
          intent: '我想要的是他們安全地完成實驗、並且尊重器材。',
          mineThink: '「又來了，我控制不住這個班。」', stuThink: '「老師又生氣了，反正等他講完就好。」',
          mineFeel: '挫折、丟臉（隔壁班老師在走廊）', stuFeel: '被責備、無所謂',
          mineWant: '想要秩序，也想要被尊重', stuWant: '想繼續玩器材、想被注意',
          mineDo: '講了做不到的威脅', stuDo: '安靜幾秒後繼續小聲吵',
          env: '這班 28 人、實驗桌只有 6 組、最後一節課、器材要跨教室搬。',
          behavior: '我用「取消實驗」當威脅，而且是在走廊上公開說。',
          ability: '我缺的是「收尾流程的設計能力」——不是耐心不夠，是我沒有一套固定的收拾程序。',
          belief: '一個好老師應該不用大聲就能讓班級安靜。',
          identity: '我想成為讓學生喜歡動手做科學的老師，但那天我變成用取消活動威脅的人，這和我的形象直接衝突。',
          core: '真正的問題是「我沒有收尾制度，卻用情緒補位」。',
          planA: '固定收尾流程：倒數五分鐘鈴聲＋黑板上的值日組分工表。',
          planB: '把最後一節的實驗改成半量設計，留 10 分鐘收拾。',
          planC: '讓學生自己訂收尾守則並互相評分，把權力交出去。',
          chosen: 'A + C',
          reason: 'A 明天就能做，C 才能真正改變動機，兩個一起。',
          trial: '下週三第 6 節，五年三班，試固定收尾流程。',
          record: '記錄「鐘響時桌面是否乾淨」與「我有沒有提高音量」。',
          reviewDate: dayOffset(4)
        },
        createdAt: dayOffset(-12)
      }
    ];

    /* --- 反思節奏勾選（示範勾幾項）--- */
    d.rhythm = { 'weekly-0': true, 'weekly-3': true, 'monthly-1': true };

    /* --- 自評量表歷次結果 --- */
    d.assessments = [
      { id: uid('asm'), date: dayOffset(-60), scores: { design: [3,2,3,2,3], manage: [2,2,3,2], research: [3,2,2,3], attitude: [4,4,3,4] } },
      { id: uid('asm'), date: dayOffset(-14), scores: { design: [4,3,4,3,3], manage: [3,3,3,2], research: [3,3,3,3], attitude: [4,5,4,4] } }
    ];

    /* --- 成長目標 --- */
    d.goals = [
      { id: uid('goal'), title: '建立一套固定的實驗收尾流程並在三個班實施', dimension: 'manage',
        actions: '設計倒數提示＋值日組分工表；每堂課記錄鐘響時桌面狀況。', partner: '五年三班導師、資深自然老師王主任',
        due: dayOffset(25), progress: 40, done: false },
      { id: uid('goal'), title: '學會把探究活動的鷹架寫進備課單（變因欄）', dimension: 'design',
        actions: '每個單元至少一份備課單填完「預期卡點與備案」；月底回看修正。', partner: '自然科教學研究會',
        due: dayOffset(45), progress: 60, done: false },
      { id: uid('goal'), title: '完成 6 小時探究與實作線上研習', dimension: 'research',
        actions: '每週三晚上看一單元，做筆記存到資源中心。', partner: '',
        due: dayOffset(-3), progress: 100, done: true }
    ];

    /* --- 成長歷程 --- */
    d.milestones = [
      { id: uid('ms'), date: dayOffset(-3),  type: '研習', title: '探究與實作教學設計線上研習（6 小時）', note: '最有用的是「一個單元只做一個核心探究」這句話。' },
      { id: uid('ms'), date: dayOffset(-17), type: '觀課', title: '觀王主任六年三班「電磁鐵」', note: '他發器材前會讓組長重述一次指令，我要學。' },
      { id: uid('ms'), date: dayOffset(-31), type: '閱讀', title: '《學習的答案，課堂上的科學》第 3 章', note: '學生的迷思概念要先問出來，不能直接糾正。' },
      { id: uid('ms'), date: dayOffset(-45), type: '公開課', title: '校內公開授課：五年一班「熱的傳導」', note: '議課回饋：指令太密、可多留學生說話時間。' },
      { id: uid('ms'), date: dayOffset(-58), type: '會議', title: '自然科教學研究會：全學期進度與器材採購', note: '記得科任最容易被挪課，進度表要留緩衝。' }
    ];

    /* --- 資源連結 --- */
    d.links = [
      { id: uid('lk'), category: '課綱與教材', title: '十二年國教自然領域探究與實作', url: 'https://sites.google.com/ms.cshs.tc.edu.tw/guidelines/108/nature/inquiry', note: '四大主軸與學習表現代碼查詢' },
      { id: uid('lk'), category: '課綱與教材', title: '探究教學課程設計實例（含學習單）', url: 'https://e108in.knsh.com.tw/Upload/Artical/47/', note: '可以直接改用的學習單格式' },
      { id: uid('lk'), category: '實驗安全', title: '教育部：學校實驗室與實習場所安全衛生管理要點', url: 'https://edu.law.moe.gov.tw/LawContent.aspx?id=GL001991', note: '法規依據，班親會可引用' },
      { id: uid('lk'), category: '實驗安全', title: '學校實驗室一般注意事項及安全指引', url: 'https://www.safelab.edu.tw/', note: '安全設備配置與檢查' },
      { id: uid('lk'), category: '實驗安全', title: '小學科學科安全手冊（香港教育局）', url: 'https://www.edb.gov.hk/attachment/tc/curriculum-development/kla/science-edu/pri-sci/PS_Safety_Handbook_Chi_2024.pdf', note: '器材操作要點寫得最細' },
      { id: uid('lk'), category: '科展', title: '中小學科學展覽會', url: 'https://twsf.ntsec.gov.tw/', note: '歷屆作品與評審標準' },
      { id: uid('lk'), category: '班級經營', title: '班級經營研習資料（守則怎麼訂）', url: 'https://blog2.huayuworld.org/eccsat/wp-content/uploads/sites/4201/2019/05/2.%E7%8F%AD%E7%B4%9A%E7%B6%93%E7%87%9F.pdf', note: '明確、可觀察、正面表述、5 條以內' },
      { id: uid('lk'), category: '班級經營', title: '科任老師班級經營實務分享', url: 'http://yalin-edu-pral.blogspot.com/2016/07/010-5-1050730.html', note: '科任要靠制度不靠關係累積' },
      { id: uid('lk'), category: '研習平台', title: '全國教師在職進修資訊網', url: 'https://www1.inservice.edu.tw/', note: '研習報名與時數查詢' },
      { id: uid('lk'), category: '研習平台', title: '教育部因材網／愛學網', url: 'https://adl.edu.tw/', note: '補救教學與影片資源' }
    ];

    /* --- 檢核清單（內容濃縮自生存指南）--- */
    d.checklists = builtinChecklists();

    /* --- 筆記 --- */
    d.notes = [
      { id: uid('nt'), title: '五年級「熱」單元卡點筆記', body: '‧ 學生常說「金屬比較冷」→ 其實是導熱快把手的熱帶走，要用「摸起來」和「實際溫度」分開講。\n‧ 溫度計讀數要練習：眼睛與刻度平視。\n‧ 下次先做一次「兩支湯匙」示範再進實驗。', updatedAt: dayOffset(-2) },
      { id: uid('nt'), title: '器材採購待辦（給下學期的我）', body: '溫度計缺 12 支、酒精燈燈芯要補、三角支架破損 3 個已報修。採購申請通常在期初兩週內截止，記得先問設備組。', updatedAt: dayOffset(-9) },
      { id: uid('nt'), title: '第一堂課四段流程（明年直接用）', body: '1. 自我介紹＋期待 5 分\n2. 教室守則說明 10 分（5 條以內、要可觀察）\n3. 常規演練 15 分（一定要「做一遍」，不只是說）\n4. 評分方式＋科學小魔術 10 分', updatedAt: dayOffset(-40) }
    ];

    return d;
  }

  // 科展 8 週的節奏標題（對照生存指南）
  function sciFairWeekTitles() {
    return ['選題', '查資料', '動機假設', '預做', '正式實驗', '整理圖表', '寫報告', '練口試'];
  }

  // 報告檢核清單樣板
  function reportChecklist(states) {
    const items = ['研究動機與目的', '文獻／資料整理', '研究方法與變項表', '實驗數據原始紀錄', '圖表與統計', '結論與討論', '參考資料與致謝'];
    return items.map(function (t, i) { return { item: t, done: !!(states && states[i]) }; });
  }

  // 內建檢核清單（濃縮自《新進自然科任教師生存指南》）
  function builtinChecklists() {
    const mk = function (title, desc, items) {
      return {
        id: uid('cl'), title: title, desc: desc, builtin: true,
        items: items.map(function (t) { return { text: t, done: false }; })
      };
    };
    return [
      mk('實驗室 30 秒課前檢查', '每次實驗前跑一遍，寧可慢 30 秒也不要出事。', [
        '器材無破損、裂痕、鬆脫（有裂痕的玻璃器材直接淘汰）',
        '加熱區附近無易燃物、無紙張書本',
        '通風：明火或化學品時關空調、開排風扇與窗戶',
        '滅火器、急救箱、防火沙桶就位可取用',
        '學生長髮束起、鬆身衣物收好',
        '需要時全體戴安全眼鏡（含老師自己，示範效果最強）'
      ]),
      mk('學生實驗室 10 條守則', '開學第一堂課逐條演練，並印成海報貼在自然教室。', [
        '老師不在場不得進入實驗室',
        '實驗室內禁止追逐、嬉戲、飲食',
        '未經許可不得取用器材或藥品',
        '不得任意添加藥品或改變實驗順序',
        '不可徒手取用化學藥品，使用刮勺',
        '加熱時試管口不可對著自己或他人',
        '不可離開自己的實驗區，尤其加熱、用火時',
        '器材損壞或身體不適，立刻報告老師',
        '廢棄物放置指定位置，不可任意棄置',
        '實驗前後都要洗手；結束後器材歸位、桌面整理才可離開'
      ]),
      mk('開學前 10 件事', '地基打好，整年輕鬆一半。', [
        '拿到課表與任教班級名單，確認跑班還是學生跑教室',
        '清點自然教室器材，列器材清冊（位置、數量、堪用狀況）',
        '檢查安全設備：滅火器效期、急救箱、洗眼設備、防火沙桶、逃生路線圖',
        '找去年的自然老師問：進度到哪、哪些實驗會失敗、哪些班要注意',
        '向教學組確認：成績登錄期限、平時成績比例、實驗室借用登記方式',
        '排定全學期進度表（含考試週、校慶、運動會等會被借走的節數）',
        '製作教室守則海報（5 條以內）與值日組工作表',
        '設計評分表／座位表，一班一頁含小組編號',
        '準備第一堂課的流程（四段式）',
        '確認家長聯絡管道：科任通常透過導師轉達，先問校內慣例'
      ]),
      mk('每堂課速查', '課前／課中／課後各一遍，養成習慣就不用想。', [
        '課前：教具到位', '課前：器材檢查', '課前：安全設備確認', '課前：座位表／評分表帶著',
        '課中：開場宣布本節重點', '課中：注意力訊號', '課中：走動巡視', '課中：正向回饋', '課中：預留 5–8 分鐘收拾時間',
        '課後：加減分登錄', '課後：器材歸位', '課後：水電氣關閉', '課後：門窗上鎖', '課後：記一句教學反思'
      ]),
      mk('每週例行', '週五花 10 分鐘做完，下週會順很多。', [
        '與導師交換一次學生訊息',
        '檢查下週實驗器材是否齊備',
        '預做一次新實驗（確認會成功、抓安全風險點）',
        '寫一份 L2 六格反思卡',
        '整理本週加減分紀錄'
      ]),
      mk('每學期節點', '期初／期中／期末各自要做的事。', [
        '期初：守則與評分說明、全學期進度表',
        '期初：器材採購申請（注意截止日）',
        '期中：成績結算、學生回饋調查',
        '期末：成績登錄',
        '期末：器材清點與報修',
        '期末：更新交接文件（未來的你會感謝現在的你）'
      ])
    ];
  }

  /* ---------- 讀寫核心 ---------- */
  let cache = null;

  function load() {
    if (cache) return cache;
    let raw = null;
    raw = Persist.getItem(STORAGE_KEY);
    if (!raw) {
      cache = seedData();       // 第一次開啟：載入示範資料
      save();
      return cache;
    }
    try {
      const parsed = JSON.parse(raw);
      // 補上舊資料可能缺少的欄位，避免升級後壞掉
      cache = Object.assign(emptyData(), parsed);
      cache.settings = Object.assign(emptyData().settings, parsed.settings || {});
      return cache;
    } catch (e) {
      console.warn('資料解析失敗，改用示範資料：', e);
      cache = seedData();
      save();
      return cache;
    }
  }

  let warnedOnce = false;
  function save() {
    const ok = Persist.setItem(STORAGE_KEY, JSON.stringify(cache));
    if (!ok && Persist.available() && !warnedOnce) {
      warnedOnce = true;
      alert('儲存失敗，可能是瀏覽器空間不足。請到設定頁匯出 JSON 備份後再清除舊資料。');
    }
  }

  /* ---------- 對外 API ---------- */
  const api = {
    uid: uid,
    toISODate: toISODate,
    STORAGE_KEY: STORAGE_KEY,

    /** 資料是否真的存得住（false = 瀏覽器不允許儲存，目前是記憶體模式） */
    isPersistent: function () { return Persist.available(); },

    /** 取得整份資料物件（唯讀用途；改完請呼叫 Store.commit()） */
    data: function () { return load(); },

    /** 存檔（改了 Store.data() 回傳的物件後要呼叫） */
    commit: function () { save(); },

    /** 設定值讀寫 */
    settings: function () { return load().settings; },
    setSetting: function (key, value) { load().settings[key] = value; save(); },

    /** 通用表格操作：collection 是 emptyData() 裡的陣列名稱 */
    list: function (collection) { return load()[collection] || []; },

    find: function (collection, id) {
      return (load()[collection] || []).find(function (r) { return r.id === id; }) || null;
    },

    add: function (collection, record) {
      const d = load();
      if (!d[collection]) d[collection] = [];
      if (!record.id) record.id = uid(collection.slice(0, 3));
      d[collection].push(record);
      save();
      return record;
    },

    update: function (collection, id, patch) {
      const rec = api.find(collection, id);
      if (!rec) return null;
      Object.assign(rec, patch);
      save();
      return rec;
    },

    remove: function (collection, id) {
      const d = load();
      d[collection] = (d[collection] || []).filter(function (r) { return r.id !== id; });
      save();
    },

    /* --- 便利查詢 --- */
    classes: function () { return load().classes; },
    className: function (classId) {
      const c = api.find('classes', classId);
      return c ? c.name : '未指定班級';
    },
    studentsOf: function (classId) {
      return load().students.filter(function (s) { return !classId || s.classId === classId; });
    },
    student: function (id) { return api.find('students', id); },
    studentLabel: function (id) {
      const s = api.student(id);
      if (!s) return '（已刪除的學生）';
      return api.className(s.classId) + ' ' + s.seatNo + ' ' + s.name;
    },
    observationsOf: function (studentId) {
      return load().observations
        .filter(function (o) { return o.studentId === studentId; })
        .sort(function (a, b) { return b.date.localeCompare(a.date); });
    },

    /* --- 匯出 / 匯入 / 清除 --- */
    exportJSON: function () { return JSON.stringify(load(), null, 2); },

    importJSON: function (text) {
      const parsed = JSON.parse(text);        // 失敗會丟出例外，由呼叫端處理
      if (typeof parsed !== 'object' || parsed === null) throw new Error('JSON 格式不正確');
      cache = Object.assign(emptyData(), parsed);
      cache.settings = Object.assign(emptySettings(), parsed.settings || {});
      save();
      return true;
    },

    /** 清除全部資料。reseed = true 時重新載入示範資料 */
    clearAll: function (reseed) {
      Persist.removeItem(STORAGE_KEY);
      cache = reseed ? seedData() : emptyData();
      save();
    },

    /** 目前佔用的 localStorage 位元數（估算） */
    usageBytes: function () {
      const raw = Persist.getItem(STORAGE_KEY) || '';
      try { return new Blob([raw]).size; }
      catch (e) { return raw.length * 2; }
    },

    /* --- 給頁面用的固定選項 --- */
    sciFairWeekTitles: sciFairWeekTitles,
    reportChecklist: reportChecklist,
    builtinChecklists: builtinChecklists,
    seedData: seedData
  };

  function emptySettings() { return emptyData().settings; }

  return api;
})();
