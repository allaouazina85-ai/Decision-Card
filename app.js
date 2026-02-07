/* ====================================================
   DecisionCard MVP - JavaScript
   ملف JavaScript كامل مع تحسينات متجاوبة
==================================================== */

/* =========================
   Constants & Utils
========================= */
const LS_KEY = "dc_mvp_v1";

// Responsive detection
const isMobile = () => window.innerWidth <= 767;
const isTablet = () => window.innerWidth >= 768 && window.innerWidth <= 1024;

// Formatting helpers
const nowISO = () => new Date().toISOString();

const formatDate = (iso) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ar-DZ", { 
      dateStyle: "medium", 
      timeStyle: "short" 
    });
  } catch { 
    return iso; 
  }
};

const uid = (prefix = "id") => {
  return prefix + "_" + 
         Math.random().toString(16).slice(2) + "_" + 
         Date.now().toString(16);
};

/* =========================
   Storage Management
========================= */
function loadState() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) {
    const init = { 
      tasks: [], 
      submissions: [], 
      lastOpenTaskId: null 
    };
    localStorage.setItem(LS_KEY, JSON.stringify(init));
    return init;
  }
  
  try { 
    return JSON.parse(raw); 
  } catch { 
    return { 
      tasks: [], 
      submissions: [], 
      lastOpenTaskId: null 
    }; 
  }
}

function saveState(state) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function getTask(state, taskId) {
  return state.tasks.find(t => t.id === taskId);
}

function getSubmission(state, taskId) {
  return state.submissions.find(s => s.taskId === taskId) || null;
}

function upsertSubmission(state, sub) {
  const idx = state.submissions.findIndex(s => s.taskId === sub.taskId);
  if (idx >= 0) {
    state.submissions[idx] = sub;
  } else {
    state.submissions.push(sub);
  }
}

/* =========================
   Core Functions
========================= */
function computeTraceStatus(sub) {
  if (!sub) {
    return { 
      level: "bad", 
      label: "لا يوجد تسليم بعد",
      details: ["ابدئي بكتابة الترجمة وحفظها ثم املئي بطاقة القرار."]
    };
  }

  const dc = sub.decisionCard || {};
  const required = [
    ["القرار المعتمد", !!dc.chosen && dc.chosen.trim().length >= 3],
    ["التبرير", !!dc.justification && dc.justification.trim().length >= 15],
    ["بديلان مرفوضان", !!dc.alt1 && dc.alt1.trim().length >= 8 && !!dc.alt2 && dc.alt2.trim().length >= 8],
    ["مصدر تحقق", !!dc.sources && dc.sources.trim().length >= 8],
    ["ما بعد التحرير", !!dc.postEdit && dc.postEdit.trim().length >= 12],
  ];

  const okCount = required.filter(x => x[1]).length;
  let level = "warn", label = "مسار متوسط";
  
  if (okCount <= 2) { 
    level = "bad"; 
    label = "مسار ضعيف"; 
  }
  
  if (okCount === required.length) { 
    level = "ok"; 
    label = "مسار قوي"; 
  }

  return {
    level,
    label,
    details: required.map(([name, ok]) => (ok ? "✅ " : "✳️ ") + name)
  };
}

/* =========================
   Enhanced Mobile Views
========================= */
function renderEmptyStateMobile() {
  return `
    <div class="empty-state-mobile" style="text-align: center; padding: 3rem 1rem;">
      <div style="font-size: 3.5rem; margin-bottom: 1.5rem; color: var(--muted);">📝</div>
      <h3 style="color: var(--text); margin-bottom: 0.75rem; font-size: 1.3rem;">
        لا توجد مهام بعد
      </h3>
      <p style="color: var(--muted); margin-bottom: 2rem; line-height: 1.5;">
        ابدأ بإنشاء مهمة جديدة لتجربة النموذج الهجين
        لتعليمية الترجمة مع الذكاء الاصطناعي
      </p>
      <a href="#/new" class="btn primary" style="padding: 1rem 2rem; font-size: 1rem;">
        إنشاء أول مهمة
      </a>
    </div>
  `;
}

function renderEmptyStateDesktop() {
  return `
    <div class="itemRow">
      <div class="meta">
        <div><b>لا توجد مهام بعد</b></div>
        <div class="muted">ابدئي بإنشاء مهمة ترجمة لتجربة مسار "بطاقة القرار".</div>
      </div>
      <a class="btn primary" href="#/new">إنشاء مهمة</a>
    </div>
  `;
}

function renderTaskItemMobile(task, state) {
  const sub = getSubmission(state, task.id);
  const st = computeTraceStatus(sub);
  const badgeClass = st.level === "ok" ? "ok" : st.level === "bad" ? "bad" : "warn";
  
  return `
    <div class="itemRow mobile-task-item" data-task-id="${task.id}">
      <div class="meta">
        <div class="mobile-task-header">
          <div style="flex: 1;">
            <div class="mobile-task-title">${task.domain || 'عام'} • ${task.srcLang.toUpperCase()}→${task.tgtLang.toUpperCase()}</div>
            <div class="mobile-task-subtitle">${task.audience} • ${task.tone}</div>
          </div>
          <span class="badge mobile-badge ${badgeClass}">${st.label}</span>
        </div>
        
        <div class="mobile-task-preview">
          ${(task.sourceText || "").slice(0, 80).replaceAll("<", "&lt;")}${task.sourceText.length > 80 ? "…" : ""}
        </div>
        
        <div class="mobile-task-footer">
          <div class="mobile-task-date">
            <span>📅</span>
            <span>${formatDate(task.createdAt)}</span>
          </div>
          ${task.sensitive === "yes" ? 
            `<span class="mobile-task-sensitive">🔒 حساس</span>` : ''}
        </div>
      </div>
      
      <div class="mobile-task-actions">
        <a class="btn mobile-task-btn" href="#/work/${task.id}">
          <span>فتح</span>
          <span>→</span>
        </a>
        ${sub ? 
          `<a class="btn mobile-task-btn secondary" href="#/report/${sub.id}">
            <span>تقرير</span>
            <span>📊</span>
          </a>` : ''}
      </div>
    </div>
  `;
}

function renderTaskItemDesktop(task, state) {
  const sub = getSubmission(state, task.id);
  const st = computeTraceStatus(sub);
  const badgeClass = st.level === "ok" ? "ok" : st.level === "bad" ? "bad" : "warn";
  const badgeText = st.label;

  return `
    <div class="itemRow">
      <div class="meta">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <b>${task.domain} • ${task.srcLang.toUpperCase()}→${task.tgtLang.toUpperCase()}</b>
          <span class="badge ${badgeClass}">${badgeText}</span>
          ${task.sensitive === "yes" ? `<span class="badge warn">⚠️ حساس</span>` : ``}
        </div>
        <div class="muted">
          جمهور: ${task.audience} • نبرة: ${task.tone} • أنشئت: ${formatDate(task.createdAt)}
        </div>
        <div class="small mono">${(task.sourceText || "").slice(0, 120).replaceAll("<", "&lt;")}…</div>
      </div>
      <div class="rightActions">
        <a class="btn" href="#/work/${task.id}">فتح</a>
        ${sub ? `<a class="btn" href="#/report/${sub.id}">عرض التقرير</a>` : ``}
      </div>
    </div>
  `;
}

/* =========================
   Views Management
========================= */
const views = {
  intro: document.getElementById("viewIntro"),
  theory: document.getElementById("viewTheory"),
  dashboard: document.getElementById("viewDashboard"),
  new: document.getElementById("viewNew"),
  work: document.getElementById("viewWork"),
  review: document.getElementById("viewReview"),
  report: document.getElementById("viewReport"),
};

function showView(name) {
  Object.values(views).forEach(v => v.classList.add("hidden"));
  if (views[name]) {
    views[name].classList.remove("hidden");
  }
}

/* =========================
   Routing
========================= */
function route() {
  const hash = location.hash || "#/intro";
  const [ , path, id ] = hash.split("/");
  const state = loadState();

  switch (path) {
    case "intro":
      showView("intro");
      break;
      
    case "theory":
      showView("theory");
      break;
      
    case "dashboard":
      renderDashboard(state);
      showView("dashboard");
      break;
      
    case "new":
      showView("new");
      break;
      
    case "work":
      const taskId = id || state.lastOpenTaskId;
      if (!taskId) { 
        location.hash = "#/dashboard"; 
        return; 
      }
      state.lastOpenTaskId = taskId;
      saveState(state);
      renderWorkspace(state, taskId);
      showView("work");
      break;
      
    case "review":
      const reviewTaskId = id || state.lastOpenTaskId;
      if (!reviewTaskId) { 
        location.hash = "#/dashboard"; 
        return; 
      }
      renderReview(state, reviewTaskId);
      showView("review");
      break;
      
    case "report":
      if (!id) { 
        location.hash = "#/dashboard"; 
        return; 
      }
      renderReport(state, id);
      showView("report");
      break;
      
    default:
      location.hash = "#/intro";
  }
}

/* =========================
   Dashboard View - Enhanced
========================= */
function renderDashboard(state) {
  const tasks = state.tasks;
  const subs = state.submissions;

  const totalTasks = tasks.length;
  const totalSubs = subs.length;
  const strong = subs.filter(s => computeTraceStatus(s).level === "ok").length;

  // Update KPI
  const kpiContent = isMobile() ? `
    <div class="kpi-mobile">
      <div class="kpi-row">
        <div class="kpi-item">
          <div class="kpi-number">${totalTasks}</div>
          <div class="kpi-label">المهام</div>
        </div>
        <div class="kpi-item">
          <div class="kpi-number">${totalSubs}</div>
          <div class="kpi-label">التسليمات</div>
        </div>
        <div class="kpi-item">
          <div class="kpi-number">${strong}</div>
          <div class="kpi-label">مسار قوي</div>
        </div>
      </div>
    </div>
  ` : `
    <div class="kpi">
      <div class="item"><div class="muted">عدد المهام</div><div class="num">${totalTasks}</div></div>
      <div class="item"><div class="muted">عدد التسليمات</div><div class="num">${totalSubs}</div></div>
      <div class="item"><div class="muted">مسار قوي</div><div class="num">${strong}</div></div>
    </div>
  `;

  document.getElementById("kpi").innerHTML = kpiContent;

  // Update tasks list
  const tasksListEl = document.getElementById("tasksList");
  if (tasks.length === 0) {
    tasksListEl.innerHTML = isMobile() ? renderEmptyStateMobile() : renderEmptyStateDesktop();
    return;
  }

  const tasksHtml = tasks
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .map(t => isMobile() ? renderTaskItemMobile(t, state) : renderTaskItemDesktop(t, state))
    .join("");

  tasksListEl.innerHTML = tasksHtml;
}

/* =========================
   Hallucination Exercise Functions
========================= */
function showHallucinationHint() {
  const feedback = document.getElementById("hallucinationFeedback");
  feedback.innerHTML = isMobile() ? `
    <div class="hint-mobile">
      <div style="font-weight: bold; margin-bottom: 8px; color: #2c5282;">💡 تلميح:</div>
      <div style="font-size: 14px; line-height: 1.4;">
        ابحثي عن:<br>
        1. خطأ في <strong>التاريخ</strong> (السنة)<br>
        2. خطأ في <strong>المكان</strong> (اسم الجامعة)<br>
        الذكاء الاصطناعي قد يقدم معلومات تبدو منطقية لكنها غير دقيقة!
      </div>
    </div>
  ` : `
    <div><b>💡 تلميح:</b></div>
    <div class="small muted" style="margin-top:5px">
      ابحثي عن:
      1. خطأ في التاريخ (السنة)
      2. خطأ في المكان (اسم الجامعة)
      الذكاء الاصطناعي قد يقدم معلومات تبدو منطقية لكنها غير دقيقة!
    </div>
  `;
  feedback.classList.remove("hidden");
}

function clearHallucinationAnswer() {
  document.getElementById("hallucinationAnswer").value = "";
  document.getElementById("hallucinationFeedback").classList.add("hidden");
}

function checkHallucination() {
  const answer = document.getElementById("hallucinationAnswer").value.toLowerCase().trim();
  const feedback = document.getElementById("hallucinationFeedback");
  
  const hasDateError = answer.includes("2023") || answer.includes("تاريخ") || answer.includes("سنة");
  const hasPlaceError = answer.includes("كامبريدج") || answer.includes("cambridge") || 
                       (answer.includes("أكسفورد") || answer.includes("oxford")) && 
                       answer.includes("خطأ");
  
  let score = 0;
  let message = "";
  
  if (hasDateError && hasPlaceError) {
    score = 100;
    message = isMobile() ? `
      <div class="success-message">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
          <span style="font-size: 20px;">✅</span>
          <span style="font-weight: bold;">ممتاز! اكتشفتِ الخطأين كليهما</span>
        </div>
        <div style="font-size: 14px; line-height: 1.4; background: rgba(72, 187, 120, 0.1); padding: 12px; border-radius: 8px;">
          1. الخطأ في التاريخ: <strong>2023 بدلاً من 2024</strong><br>
          2. الخطأ في المكان: <strong>كامبريدج بدلاً من أكسفورد</strong><br>
          هذا بالضبط نوع الأخطاء التي قد ينتجها الذكاء الاصطناعي دون تحقق!
        </div>
      </div>
    ` : `
      <div class="success">✅ <b>ممتاز!</b> اكتشفتِ الخطأين كليهما:</div>
      <div class="small muted" style="margin-top:5px">
        1. الخطأ في التاريخ: 2023 بدلاً من 2024<br>
        2. الخطأ في المكان: كامبريدج بدلاً من أكسفورد<br>
        هذا بالضبط نوع الأخطاء التي قد ينتجها الذكاء الاصطناعي دون تحقق!
      </div>
    `;
  } else if (hasDateError || hasPlaceError) {
    score = 50;
    message = isMobile() ? `
      <div class="warning-message">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
          <span style="font-size: 20px;">⚠️</span>
          <span style="font-weight: bold;">جيد جزئياً</span>
        </div>
        <div style="font-size: 14px; line-height: 1.4; background: rgba(237, 137, 54, 0.1); padding: 12px; border-radius: 8px;">
          ${hasDateError ? 
            'اكتشفتِ خطأ التاريخ ✓ لكن هناك خطأ آخر في المكان' : 
            'اكتشفتِ خطأ المكان ✓ لكن هناك خطأ آخر في التاريخ'}
          <br>تذكري: الذكاء الاصطناعي قد يخطئ في عدة جوانب دفعة واحدة!
        </div>
      </div>
    ` : `
      <div class="error">⚠️ <b>جيد جزئياً</b> اكتشفتِ خطأ واحداً:</div>
      <div class="small muted" style="margin-top:5px">
        ${hasDateError ? 
          'اكتشفتِ خطأ التاريخ ✓ لكن هناك خطأ آخر في المكان' : 
          'اكتشفتِ خطأ المكان ✓ لكن هناك خطأ آخر في التاريخ'}
        <br>تذكري: الذكاء الاصطناعي قد يخطئ في عدة جوانب دفعة واحدة!
      </div>
    `;
  } else {
    score = 0;
    message = isMobile() ? `
      <div class="error-message">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
          <span style="font-size: 20px;">❌</span>
          <span style="font-weight: bold;">تحتاج للمزيد من التدقيق</span>
        </div>
        <div style="font-size: 14px; line-height: 1.4; background: rgba(245, 101, 101, 0.1); padding: 12px; border-radius: 8px;">
          حاولي التركيز على:<br>
          1. <strong>التواريخ والأرقام</strong> (2023 vs 2024)<br>
          2. <strong>الأسماء والمعلومات الواقعية</strong> (جامعة كامبريدج vs جامعة أكسفورد)<br>
          هذه الأخطاء تسمى "هلوسة" (Hallucination) وهي شائعة في مخرجات الذكاء الاصطناعي
        </div>
      </div>
    ` : `
      <div class="error">❌ <b>تحتاج للمزيد من التدقيق</b></div>
      <div class="small muted" style="margin-top:5px">
        حاولي التركيز على:<br>
        1. التواريخ والأرقام (2023 vs 2024)<br>
        2. الأسماء والمعلومات الواقعية (جامعة كامبريدج vs جامعة أكسفورد)<br>
        هذه الأخطاء تسمى "هلوسة" (Hallucination) وهي شائعة في مخرجات الذكاء الاصطناعي
      </div>
    `;
  }
  
  feedback.innerHTML = message + `
    <div class="sep" style="margin:${isMobile() ? '12px' : '10px'} 0"></div>
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap: wrap; gap: 8px;">
      <div class="${isMobile() ? 'score-mobile' : 'small'}">
        درجة الاكتشاف: <b>${score}%</b>
      </div>
      <button class="btn ${isMobile() ? 'small secondary' : 'small'}" onclick="clearHallucinationAnswer()" style="padding: ${isMobile() ? '8px 12px' : '6px 12px'}">
        حاولي مرة أخرى
      </button>
    </div>
  `;
  
  feedback.className = hasDateError && hasPlaceError ? "success" : "error";
  feedback.classList.remove("hidden");
}

/* =========================
   New Task View
========================= */
document.getElementById("formNewTask").addEventListener("submit", (e) => {
  e.preventDefault();
  const state = loadState();
  
  const task = {
    id: uid("task"),
    srcLang: document.getElementById("srcLang").value,
    tgtLang: document.getElementById("tgtLang").value,
    domain: document.getElementById("domain").value,
    audience: document.getElementById("audience").value,
    tone: document.getElementById("tone").value,
    sensitive: document.getElementById("sensitive").value,
    sourceText: document.getElementById("sourceText").value.trim(),
    createdAt: nowISO()
  };
  
  if (task.sourceText.length < 10) {
    alert("رجاءً أدخلي نص مصدر أطول قليلًا.");
    return;
  }
  
  state.tasks.push(task);
  state.lastOpenTaskId = task.id;
  saveState(state);
  location.hash = "#/work/" + task.id;
});

/* =========================
   Workspace View
========================= */
let currentTaskId = null;

function renderWorkspace(state, taskId) {
  currentTaskId = taskId;
  const task = getTask(state, taskId);
  if (!task) { 
    location.hash = "#/dashboard"; 
    return; 
  }

  const sub = getSubmission(state, taskId) || {
    id: uid("sub"),
    taskId,
    draftTranslation: "",
    finalTranslation: "",
    decisionCard: null,
    checklist: {},
    aiDisclosure: { used: false, types: [], notes: "" },
    createdAt: nowISO(),
    updatedAt: nowISO()
  };

  // Update UI
  const metaText = isMobile() ? 
    `${task.domain} • ${task.srcLang.toUpperCase()}→${task.tgtLang.toUpperCase()}` :
    `مجال: ${task.domain} • ${task.srcLang.toUpperCase()}→${task.tgtLang.toUpperCase()} • جمهور: ${task.audience} • نبرة: ${task.tone}`;
  
  document.getElementById("taskMeta").textContent = metaText;
  
  document.getElementById("wsSource").value = task.sourceText;
  document.getElementById("wsTranslation").value = sub.finalTranslation || sub.draftTranslation || "";
  document.getElementById("lastSaved").textContent = sub.updatedAt ? formatDate(sub.updatedAt) : "—";
  
  const privacyHint = document.getElementById("privacyHint");
  if (task.sensitive === "yes") {
    privacyHint.style.display = "block";
    if (isMobile()) {
      privacyHint.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 8px; font-size: 14px;">
          <span style="color: #ed8936; font-size: 16px;">⚠️</span>
          <div>
            <strong>نص حساس</strong><br>
            تجنبي إدخال بيانات شخصية أو حقوق نشر في أي أدوات عامة خارجية.
          </div>
        </div>
      `;
    }
  } else {
    privacyHint.style.display = "none";
  }

  const st = computeTraceStatus(sub);
  const badgeClass = st.level === "ok" ? "ok" : st.level === "bad" ? "bad" : "warn";
  
  const traceStatusHTML = isMobile() ? `
    <div class="trace-status-mobile">
      <div class="trace-header">
        <span class="badge ${badgeClass}">${st.label}</span>
        <div class="trace-progress">
          <div class="progress-bar">
            <div class="progress-fill ${st.level}" style="width: ${st.level === 'ok' ? '100%' : st.level === 'warn' ? '60%' : '30%'}"></div>
          </div>
        </div>
      </div>
      <div class="trace-details">
        ${st.details.map(x => `
          <div class="trace-detail-item">
            <span>${x.includes('✅') ? '✅' : '✳️'}</span>
            <span>${x.replace('✅ ', '').replace('✳️ ', '')}</span>
          </div>
        `).join('')}
      </div>
    </div>
  ` : `
    <div class="badge ${badgeClass}" style="margin-bottom:10px">${st.label}</div>
    <div class="muted">${st.details.map(x => `<div>${x}</div>`).join("")}</div>
  `;

  document.getElementById("traceStatus").innerHTML = traceStatusHTML;

  // Save to state
  upsertSubmission(state, sub);
  saveState(state);
  fillDecisionModal(sub.decisionCard);
}

document.getElementById("btnSaveDraft").addEventListener("click", () => {
  const state = loadState();
  const sub = getSubmission(state, currentTaskId);
  if (!sub) { 
    alert("تعذر العثور على التسليم."); 
    return; 
  }
  
  sub.finalTranslation = document.getElementById("wsTranslation").value.trim();
  sub.updatedAt = nowISO();
  upsertSubmission(state, sub);
  saveState(state);
  document.getElementById("lastSaved").textContent = formatDate(sub.updatedAt);
  renderWorkspace(state, currentTaskId);
});

document.getElementById("btnGoReview").addEventListener("click", () => {
  if (!currentTaskId) return;
  location.hash = "#/review/" + currentTaskId;
});

/* =========================
   Decision Card Modal
========================= */
const modal = document.getElementById("modalDecision");
const btnOpenDecision = document.getElementById("btnOpenDecision");
const btnCloseDecision = document.getElementById("btnCloseDecision");

// Form elements
const dcChosen = document.getElementById("dcChosen");
const dcJustify = document.getElementById("dcJustify");
const dcAlt1 = document.getElementById("dcAlt1");
const dcAlt2 = document.getElementById("dcAlt2");
const dcSources = document.getElementById("dcSources");
const dcPostEdit = document.getElementById("dcPostEdit");

btnOpenDecision.addEventListener("click", () => {
  modal.classList.add("open");
  if (isMobile()) {
    document.body.style.overflow = "hidden";
    // Focus first input on mobile
    setTimeout(() => dcChosen.focus(), 300);
  }
});

btnCloseDecision.addEventListener("click", () => {
  modal.classList.remove("open");
  if (isMobile()) {
    document.body.style.overflow = "auto";
  }
});

modal.addEventListener("click", (e) => { 
  if (e.target === modal) {
    modal.classList.remove("open");
    if (isMobile()) {
      document.body.style.overflow = "auto";
    }
  }
});

function fillDecisionModal(dc) {
  dc = dc || {};
  dcChosen.value = dc.chosen || "";
  dcJustify.value = dc.justification || "";
  dcAlt1.value = dc.alt1 || "";
  dcAlt2.value = dc.alt2 || "";
  dcSources.value = dc.sources || "";
  dcPostEdit.value = dc.postEdit || "";
}

document.getElementById("btnAutoFill").addEventListener("click", () => {
  if (dcChosen.value.trim() || dcJustify.value.trim() || dcSources.value.trim()) return;
  
  dcChosen.value = "اعتماد المقابل الأكثر ملاءمة للجمهور والنبرة مع الحفاظ على الدقة المصطلحية.";
  dcJustify.value = "اخترتُ هذا الحل لأنه يوازن بين الدقة والملاءمة التداولية، ويمنع الالتباس في المجال، ويُحافظ على اتساق المصطلح داخل النص.";
  dcAlt1.value = "بديل 1: صياغة حرفية — رُفضت لأنها تُضعف السلاسة وتُربك القراءة.";
  dcAlt2.value = "بديل 2: تعميم المصطلح — رُفض لأنه يُفقد التحديد الدلالي المطلوب في السياق.";
  dcSources.value = "قاموس تخصصي / نص موازٍ من جهة موثوقة (ضعي الرابط أو اسم المرجع).";
  dcPostEdit.value = "(1) توحيد المصطلحات المتكررة. (2) إعادة صياغة جملة لتناسب النبرة والجمهور.";
});

document.getElementById("formDecision").addEventListener("submit", (e) => {
  e.preventDefault();
  const state = loadState();
  const sub = getSubmission(state, currentTaskId);
  if (!sub) { 
    alert("تعذر العثور على التسليم."); 
    return; 
  }

  sub.decisionCard = {
    chosen: dcChosen.value.trim(),
    justification: dcJustify.value.trim(),
    alt1: dcAlt1.value.trim(),
    alt2: dcAlt2.value.trim(),
    sources: dcSources.value.trim(),
    postEdit: dcPostEdit.value.trim(),
    updatedAt: nowISO()
  };
  
  sub.updatedAt = nowISO();
  upsertSubmission(state, sub);
  saveState(state);
  modal.classList.remove("open");
  
  if (isMobile()) {
    document.body.style.overflow = "auto";
  }
  
  renderWorkspace(state, currentTaskId);
});

/* =========================
   Review View
========================= */
document.getElementById("btnBackToWork").addEventListener("click", () => {
  if (!currentTaskId) return;
  location.hash = "#/work/" + currentTaskId;
});

function renderReview(state, taskId) {
  currentTaskId = taskId;
  const task = getTask(state, taskId);
  const sub = getSubmission(state, taskId);
  
  if (!task || !sub) { 
    location.hash = "#/work/" + taskId; 
    return; 
  }

  // Update meta
  const metaText = isMobile() ? 
    `${task.domain} • ${formatDate(task.createdAt)}` :
    `مجال: ${task.domain} • ${task.srcLang.toUpperCase()}→${task.tgtLang.toUpperCase()} • أنشئت: ${formatDate(task.createdAt)}`;
  
  document.getElementById("reviewMeta").textContent = metaText;
  
  // Update summary
  const st = computeTraceStatus(sub);
  const translationLength = (sub.finalTranslation || "").length;
  const sourceLength = task.sourceText.length;
  
  document.getElementById("reviewSummary").innerHTML = isMobile() ? `
    <div class="review-summary-mobile">
      <div class="review-stats">
        <div class="stat-item">
          <div class="stat-label">النص المصدر</div>
          <div class="stat-value">${sourceLength} حرف</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">الترجمة</div>
          <div class="stat-value">${translationLength} حرف</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">حالة المسار</div>
          <div class="stat-value">
            <span class="badge ${st.level === "ok" ? "ok" : st.level === "bad" ? "bad" : "warn"}">${st.label}</span>
          </div>
        </div>
      </div>
      <div class="review-details">
        ${st.details.map(x => `
          <div class="detail-item">
            <span>${x.includes('✅') ? '✅' : '✳️'}</span>
            <span>${x.replace('✅ ', '').replace('✳️ ', '')}</span>
          </div>
        `).join('')}
      </div>
    </div>
  ` : `
    <div>طول النص المصدر: <span class="mono">${sourceLength}</span> حرف</div>
    <div>طول الترجمة: <span class="mono">${translationLength}</span> حرف</div>
    <div>حالة المسار: <span class="badge ${st.level === "ok" ? "ok" : st.level === "bad" ? "bad" : "warn"}">${st.label}</span></div>
    <div class="small muted" style="margin-top:8px">${st.details.map(x => `<div>${x}</div>`).join("")}</div>
  `;

  // Load AI disclosure
  document.getElementById("aiUsed").checked = !!sub.aiDisclosure?.used;
  document.getElementById("aiNotes").value = sub.aiDisclosure?.notes || "";
  document.querySelectorAll(".aiType").forEach(ch => {
    ch.checked = (sub.aiDisclosure?.types || []).includes(ch.value);
  });

  // Load checklist
  document.querySelectorAll(".ck").forEach(ch => {
    const key = ch.dataset.k;
    if (key === "decisionCard") {
      ch.checked = computeTraceStatus(sub).level === "ok";
      ch.disabled = true;
    } else {
      ch.disabled = false;
      ch.checked = !!(sub.checklist && sub.checklist[key]);
    }
  });

  updateSubmitGate(state, taskId);
}

function updateSubmitGate(state, taskId) {
  const sub = getSubmission(state, taskId);
  const translationOk = (sub.finalTranslation || "").trim().length >= 20;
  const dcOk = computeTraceStatus(sub).level === "ok";
  const ck = sub.checklist || {};
  const checklistOk = !!ck.namesNumbers && !!ck.terminology && !!ck.toneAudience && dcOk;

  const ok = translationOk && checklistOk;
  const submitGateEl = document.getElementById("submitGate");
  submitGateEl.className = "badge " + (ok ? "ok" : "warn");
  submitGateEl.textContent = ok ? "✅ جاهز للتسليم" : "✳️ أكمل الترجمة + checklist + بطاقة القرار";
  return ok;
}

// Checklist events
document.querySelectorAll(".ck").forEach(ch => {
  ch.addEventListener("change", () => {
    const state = loadState();
    const sub = getSubmission(state, currentTaskId);
    if (!sub) return;
    
    if (ch.dataset.k !== "decisionCard") {
      sub.checklist = sub.checklist || {};
      sub.checklist[ch.dataset.k] = ch.checked;
      sub.updatedAt = nowISO();
      upsertSubmission(state, sub);
      saveState(state);
    }
    updateSubmitGate(state, currentTaskId);
  });
});

// AI disclosure events
document.getElementById("aiUsed").addEventListener("change", () => {
  const state = loadState();
  const sub = getSubmission(state, currentTaskId);
  if (!sub) return;
  
  sub.aiDisclosure = sub.aiDisclosure || { used: false, types: [], notes: "" };
  sub.aiDisclosure.used = document.getElementById("aiUsed").checked;
  sub.aiDisclosure.types = Array.from(document.querySelectorAll(".aiType"))
    .filter(x => x.checked)
    .map(x => x.value);
  sub.aiDisclosure.notes = document.getElementById("aiNotes").value.trim();
  sub.updatedAt = nowISO();
  upsertSubmission(state, sub);
  saveState(state);
});

document.querySelectorAll(".aiType").forEach(ch => {
  ch.addEventListener("change", () => {
    const state = loadState();
    const sub = getSubmission(state, currentTaskId);
    if (!sub) return;
    
    sub.aiDisclosure = sub.aiDisclosure || { used: false, types: [], notes: "" };
    sub.aiDisclosure.types = Array.from(document.querySelectorAll(".aiType"))
      .filter(x => x.checked)
      .map(x => x.value);
    sub.updatedAt = nowISO();
    upsertSubmission(state, sub);
    saveState(state);
  });
});

document.getElementById("aiNotes").addEventListener("input", () => {
  const state = loadState();
  const sub = getSubmission(state, currentTaskId);
  if (!sub) return;
  
  sub.aiDisclosure = sub.aiDisclosure || { used: false, types: [], notes: "" };
  sub.aiDisclosure.notes = document.getElementById("aiNotes").value.trim();
  sub.updatedAt = nowISO();
  upsertSubmission(state, sub);
  saveState(state);
});

// Submit button
document.getElementById("btnSubmit").addEventListener("click", () => {
  const state = loadState();
  const taskId = currentTaskId;
  const task = getTask(state, taskId);
  const sub = getSubmission(state, taskId);
  
  if (!task || !sub) return;

  // Check translation exists
  if (!(sub.finalTranslation || "").trim()) {
    alert("الترجمة فارغة. عودي لمساحة العمل واكتبي الترجمة.");
    return;
  }

  // Check if ready
  const ready = updateSubmitGate(state, taskId);
  if (!ready) {
    alert("التسليم يتطلب إكمال: الترجمة + checklist + بطاقة القرار بشكل قوي.");
    return;
  }

  // Generate learning report
  const trace = computeTraceStatus(sub);
  sub.learningReport = {
    createdAt: nowISO(),
    traceLevel: trace.level,
    traceLabel: trace.label,
    summary: buildReportText(task, sub),
  };
  
  sub.submittedAt = nowISO();
  sub.updatedAt = nowISO();
  upsertSubmission(state, sub);
  saveState(state);

  location.hash = "#/report/" + sub.id;
});

/* =========================
   Enhanced Report Functions
========================= */
function calculateRubricScore(task, sub) {
  // Calculate product score (60%)
  let productScore = 42; // Base score for having a translation
  
  const translation = sub.finalTranslation || "";
  const sourceLength = task.sourceText.length;
  const translationLength = translation.length;
  
  // Length ratio (ideal: 0.8-1.2)
  const lengthRatio = translationLength / sourceLength;
  if (lengthRatio >= 0.7 && lengthRatio <= 1.3) {
    productScore += 8;
  }
  
  // Decision card completeness
  const dc = sub.decisionCard || {};
  if (dc.chosen && dc.chosen.length > 20) productScore += 5;
  if (dc.postEdit && dc.postEdit.length > 30) productScore += 5;
  
  // Cap at 60
  productScore = Math.min(productScore, 60);
  
  // Calculate process score (40%)
  let processScore = 0;
  const trace = computeTraceStatus(sub);
  
  // Trace level score
  if (trace.level === "ok") processScore += 20;
  else if (trace.level === "warn") processScore += 12;
  else processScore += 5;
  
  // AI disclosure
  const ai = sub.aiDisclosure || {};
  if (ai.used && ai.types && ai.types.length > 0) processScore += 10;
  if (ai.notes && ai.notes.length > 10) processScore += 5;
  
  // Checklist
  const ck = sub.checklist || {};
  const checklistCount = Object.values(ck).filter(v => v === true).length;
  processScore += checklistCount * 2;
  
  // Cap at 40
  processScore = Math.min(processScore, 40);
  
  return {
    productScore,
    processScore,
    totalScore: productScore + processScore,
    productPercentage: Math.round((productScore / 60) * 100),
    processPercentage: Math.round((processScore / 40) * 100)
  };
}

function buildReportText(task, sub) {
  const dc = sub.decisionCard || {};
  const sources = (dc.sources || "").split("\n").map(x => x.trim()).filter(Boolean);
  const ai = sub.aiDisclosure || { used: false, types: [], notes: "" };
  const trace = computeTraceStatus(sub);
  const rubric = calculateRubricScore(task, sub);
  
  // Get score level
  let scoreLevel = "poor";
  if (rubric.totalScore >= 80) scoreLevel = "good";
  else if (rubric.totalScore >= 60) scoreLevel = "average";

  return [
    `═╦═══════════════════════════════════════╦═`,
    ` ║       تقرير التعلّم - النموذج الهجين      ║ `,
    `═╩═══════════════════════════════════════╩═`,
    ``,
    `◈ المهمة: ${task.domain} | ${task.srcLang.toUpperCase()}→${task.tgtLang.toUpperCase()}`,
    `◈ الجمهور/النبرة: ${task.audience} / ${task.tone}`,
    `◈ الحساسية: ${task.sensitive === "yes" ? "نعم ⚠️" : "لا"}`,
    `◈ تاريخ الإنشاء: ${formatDate(task.createdAt)}`,
    `◈ تاريخ التسليم: ${sub.submittedAt ? formatDate(sub.submittedAt) : "—"}`,
    ``,
    `════════════════════════════════════════════`,
    `         تقييم وفق الروبرك المزدوج 60/40       `,
    `════════════════════════════════════════════`,
    ``,
    `▣ جودة المنتج النهائي (60 نقطة):`,
    `  • النقاط: ${rubric.productScore}/60 (${rubric.productPercentage}%)`,
    `  • الدقة والاتساق المصطلحي`,
    `  • السلاسة الأسلوبية واللغوية`,
    `  • الملاءمة الثقافية والجمهور`,
    ``,
    `▣ جودة المسار والتفكير (40 نقطة):`,
    `  • النقاط: ${rubric.processScore}/40 (${rubric.processPercentage}%)`,
    `  • مستوى المسار: ${trace.label}`,
    `  • عمق التبرير والتحليل`,
    `  • التحقق من المصادر`,
    `  • الإفصاح الأخلاقي`,
    ``,
    `════════════════════════════════════════════`,
    `  المجموع الكلي: ${rubric.totalScore}/100`,
    `  التقدير: ${scoreLevel === "good" ? "ممتاز 🏅" : scoreLevel === "average" ? "جيد ✓" : "يحتاج تحسين 🔄"}`,
    `════════════════════════════════════════════`,
    ``,
    `1) القرار المعتمد:`,
    `${dc.chosen || "—"}`,
    ``,
    `2) التبرير:`,
    `${dc.justification || "—"}`,
    ``,
    `3) بدائل مرفوضة:`,
    `- ${dc.alt1 || "—"}`,
    `- ${dc.alt2 || "—"}`,
    ``,
    `4) مصادر التحقق:`,
    ...(sources.length ? sources.map(s => `- ${s}`) : ["- —"]),
    ``,
    `5) ما بعد التحرير:`,
    `${dc.postEdit || "—"}`,
    ``,
    `6) تصريح استخدام AI:`,
    `- استخدمتُ AI؟ ${ai.used ? "نعم" : "لا"}`,
    `- نوع الاستعانة: ${ai.types && ai.types.length ? ai.types.join("، ") : "—"}`,
    `- ملاحظات: ${ai.notes || "—"}`,
    ``,
    `════════════════════════════════════════════`,
    `ملاحظة: هذا التقييم تلقائي، ويمكن للمدرس تعديله وفق الروبرك الكامل.`,
    `════════════════════════════════════════════`
  ].join("\n");
}

/* =========================
   Enhanced Report View
========================= */
document.getElementById("btnExport").addEventListener("click", () => {
  const state = loadState();
  const subId = (location.hash.split("/")[2] || "").trim();
  const sub = state.submissions.find(s => s.id === subId);
  const task = sub ? getTask(state, sub.taskId) : null;
  
  if (!sub || !task) return;

  const text = sub.learningReport?.summary || buildReportText(task, sub);
  navigator.clipboard.writeText(text).then(() => {
    alert("تم نسخ التقرير كنص.");
  }).catch(() => {
    alert("تعذر النسخ تلقائيًا. يمكنك نسخ النص يدويًا من الصفحة.");
  });
});

function renderReport(state, subId) {
  const sub = state.submissions.find(s => s.id === subId);
  if (!sub) { 
    location.hash = "#/dashboard"; 
    return; 
  }
  
  const task = getTask(state, sub.taskId);
  if (!task) { 
    location.hash = "#/dashboard"; 
    return; 
  }

  const trace = computeTraceStatus(sub);
  const rubric = calculateRubricScore(task, sub);
  
  // Determine score level for styling
  let scoreLevelClass = "poor";
  if (rubric.totalScore >= 80) scoreLevelClass = "good";
  else if (rubric.totalScore >= 60) scoreLevelClass = "average";
  
  const metaHTML = isMobile() ? `
    <div class="report-meta-mobile">
      <div class="meta-row">
        <span>📅</span>
        <span>${sub.submittedAt ? formatDate(sub.submittedAt) : "—"}</span>
      </div>
      <div class="meta-row">
        <span>📊</span>
        <span>حالة المسار: <span class="badge ${trace.level === "ok" ? "ok" : trace.level === "bad" ? "bad" : "warn"}">${trace.label}</span></span>
      </div>
      <div class="meta-row">
        <span>🏆</span>
        <span>التقدير: <span class="badge ${scoreLevelClass === "good" ? "ok" : scoreLevelClass === "average" ? "warn" : "bad"}">${rubric.totalScore}/100</span></span>
      </div>
    </div>
  ` : `
    <div style="display:flex; gap:15px; flex-wrap:wrap">
      <div>تاريخ التسليم: ${sub.submittedAt ? formatDate(sub.submittedAt) : "—"}</div>
      <div>•</div>
      <div>حالة المسار: <span class="badge ${trace.level === "ok" ? "ok" : trace.level === "bad" ? "bad" : "warn"}">${trace.label}</span></div>
      <div>•</div>
      <div>التقدير: <span class="badge ${scoreLevelClass === "good" ? "ok" : scoreLevelClass === "average" ? "warn" : "bad"}">
        ${rubric.totalScore}/100
      </span></div>
    </div>
  `;

  document.getElementById("reportMeta").innerHTML = metaHTML;

  const summaryText = sub.learningReport?.summary || buildReportText(task, sub);
  const lines = summaryText.split("\n").map(l => l.replaceAll("<", "&lt;"));
  
  // Create enhanced report display
  const reportBodyHTML = isMobile() ? `
    <div class="report-mobile">
      <div class="score-cards-mobile">
        <div class="score-card product-score">
          <div class="score-title">📊 جودة المنتج</div>
          <div class="score-value ${rubric.productPercentage >= 70 ? "good" : rubric.productPercentage >= 50 ? "average" : "poor"}">
            ${rubric.productScore}/60
          </div>
          <div class="score-percentage">${rubric.productPercentage}%</div>
          <div class="progress-bar-mobile">
            <div class="progress-fill product" style="width: ${rubric.productPercentage}%"></div>
          </div>
        </div>
        
        <div class="score-card process-score">
          <div class="score-title">🔍 جودة المسار</div>
          <div class="score-value ${rubric.processPercentage >= 70 ? "good" : rubric.processPercentage >= 50 ? "average" : "poor"}">
            ${rubric.processScore}/40
          </div>
          <div class="score-percentage">${rubric.processPercentage}%</div>
          <div class="progress-bar-mobile">
            <div class="progress-fill process" style="width: ${rubric.processPercentage}%"></div>
          </div>
        </div>
      </div>
      
      <div class="total-score-mobile" style="border-color: ${
        scoreLevelClass === "good" ? "var(--ok)" : 
        scoreLevelClass === "average" ? "var(--warn)" : 
        "var(--bad)"
      }">
        <div class="total-score-value">${rubric.totalScore}/100</div>
        <div class="total-score-label">المجموع الكلي</div>
        <div class="progress-bar-mobile total">
          <div class="progress-fill product" style="width: 60%"></div>
          <div class="progress-fill process" style="width: 40%"></div>
        </div>
        <div class="progress-labels">
          <span class="label-product">60% منتج</span>
          <span class="label-process">40% مسار</span>
        </div>
      </div>
      
      <div class="report-details-mobile">
        <h3 style="margin-bottom: 1rem; font-size: 1.2rem;">📄 التقرير التفصيلي</h3>
        <div class="report-content-mobile">
          ${lines.map(line => `
            <div class="report-line">${line}</div>
          `).join('')}
        </div>
      </div>
    </div>
  ` : `
    <div class="grid" style="margin-bottom:20px">
      <div class="card" style="background:rgba(106,166,255,.05)">
        <h3>📊 تقييم المنتج</h3>
        <div class="report-score ${rubric.productPercentage >= 70 ? "good" : rubric.productPercentage >= 50 ? "average" : "poor"}">
          ${rubric.productScore}/60
        </div>
        <div class="progress-bar">
          <div class="progress-fill product" style="width: ${rubric.productPercentage}%"></div>
        </div>
        <div class="small muted" style="text-align:center; margin-top:5px">
          ${rubric.productPercentage}% من النقاط
        </div>
      </div>
      
      <div class="card" style="background:rgba(125,255,178,.05)">
        <h3>🔍 تقييم المسار</h3>
        <div class="report-score ${rubric.processPercentage >= 70 ? "good" : rubric.processPercentage >= 50 ? "average" : "poor"}">
          ${rubric.processScore}/40
        </div>
        <div class="progress-bar">
          <div class="progress-fill process" style="width: ${rubric.processPercentage}%"></div>
        </div>
        <div class="small muted" style="text-align:center; margin-top:5px">
          ${rubric.processPercentage}% من النقاط
        </div>
      </div>
    </div>
    
    <div class="card" style="background:rgba(255,255,255,.02); border:2px solid ${
      scoreLevelClass === "good" ? "rgba(125,255,178,.4)" : 
      scoreLevelClass === "average" ? "rgba(255,211,106,.4)" : 
      "rgba(255,125,125,.4)"
    }">
      <div style="text-align:center; margin-bottom:15px">
        <div style="font-size:24px; font-weight:800; color:${
          scoreLevelClass === "good" ? "var(--ok)" : 
          scoreLevelClass === "average" ? "var(--warn)" : 
          "var(--bad)"
        }">
          ${rubric.totalScore}/100
        </div>
        <div class="muted">المجموع الكلي</div>
      </div>
      
      <div class="progress-bar" style="height:12px">
        <div class="progress-fill product" style="width: 60%"></div>
        <div class="progress-fill process" style="width: 40%"></div>
      </div>
      
      <div class="row" style="justify-content:space-between; margin-top:5px">
        <div class="small" style="color:var(--accent)">60% منتج</div>
        <div class="small" style="color:var(--ok)">40% مسار</div>
      </div>
    </div>
    
    <div class="report-section" style="margin-top:20px">
      <h3>📄 التقرير التفصيلي</h3>
      <pre style="white-space:pre-wrap; line-height:1.7; font-family:monospace; font-size:12px; background:transparent; border:none; padding:0; margin:0">${lines.join("\n")}</pre>
    </div>
  `;

  document.getElementById("reportBody").innerHTML = reportBodyHTML;
}

/* =========================
   Reset Button
========================= */
document.getElementById("btnReset").addEventListener("click", () => {
  if (confirm("هل تريدين مسح كل البيانات المحلية لهذا النموذج؟")) {
    localStorage.removeItem(LS_KEY);
    location.hash = "#/dashboard";
    route();
  }
});

/* =========================
   Initialize App
========================= */
window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", () => {
  // Add responsive styles
  const style = document.createElement("style");
  style.textContent = `
    @media (max-width: 767px) {
      .empty-state-mobile {
        padding: 2rem 1rem;
      }
      
      .mobile-task-item {
        margin-bottom: 1rem;
      }
      
      .mobile-task-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 0.75rem;
      }
      
      .mobile-task-title {
        font-weight: 600;
        font-size: 1rem;
        color: var(--text);
      }
      
      .mobile-task-subtitle {
        font-size: 0.85rem;
        color: var(--muted);
        margin-top: 0.25rem;
      }
      
      .mobile-badge {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
      }
      
      .mobile-task-preview {
        font-size: 0.9rem;
        color: var(--muted);
        line-height: 1.4;
        margin: 0.75rem 0;
        padding: 0.75rem;
        background: rgba(0,0,0,0.02);
        border-radius: 8px;
      }
      
      .mobile-task-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.8rem;
        color: var(--muted);
        margin-top: 0.5rem;
      }
      
      .mobile-task-date {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      .mobile-task-sensitive {
        color: var(--warn);
        font-size: 0.75rem;
      }
      
      .mobile-task-actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 1rem;
      }
      
      .mobile-task-btn {
        flex: 1;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        font-size: 0.9rem;
      }
      
      .mobile-task-btn.secondary {
        background: rgba(0,0,0,0.05);
        border: 1px solid var(--line);
      }
      
      /* KPI Mobile */
      .kpi-mobile {
        background: white;
        border-radius: 12px;
        padding: 1rem;
        border: 1px solid var(--line);
      }
      
      .kpi-row {
        display: flex;
        justify-content: space-around;
      }
      
      .kpi-item {
        text-align: center;
        flex: 1;
      }
      
      .kpi-number {
        font-size: 1.8rem;
        font-weight: 700;
        color: var(--accent);
        margin-bottom: 0.25rem;
      }
      
      .kpi-label {
        font-size: 0.85rem;
        color: var(--muted);
      }
      
      /* Trace Status Mobile */
      .trace-status-mobile {
        background: rgba(0,0,0,0.02);
        border-radius: 12px;
        padding: 1rem;
      }
      
      .trace-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }
      
      .trace-progress {
        flex: 1;
        margin-left: 1rem;
      }
      
      .progress-bar {
        height: 6px;
        background: rgba(0,0,0,0.1);
        border-radius: 3px;
        overflow: hidden;
      }
      
      .progress-fill {
        height: 100%;
        border-radius: 3px;
      }
      
      .progress-fill.ok { background: var(--ok); }
      .progress-fill.warn { background: var(--warn); }
      .progress-fill.bad { background: var(--bad); }
      
      .trace-details {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      
      .trace-detail-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.9rem;
      }
      
      /* Review Mobile */
      .review-summary-mobile {
        background: rgba(0,0,0,0.02);
        border-radius: 12px;
        padding: 1rem;
      }
      
      .review-stats {
        display: flex;
        justify-content: space-between;
        margin-bottom: 1rem;
      }
      
      .stat-item {
        text-align: center;
        flex: 1;
      }
      
      .stat-label {
        font-size: 0.8rem;
        color: var(--muted);
        margin-bottom: 0.25rem;
      }
      
      .stat-value {
        font-weight: 600;
        font-size: 1rem;
      }
      
      .review-details {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      
      .detail-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.9rem;
      }
      
      /* Report Mobile */
      .report-meta-mobile {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        font-size: 0.9rem;
      }
      
      .meta-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      
      .score-cards-mobile {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      
      .score-card {
        background: white;
        border-radius: 12px;
        padding: 1.25rem;
        border: 1px solid var(--line);
      }
      
      .score-title {
        font-weight: 600;
        margin-bottom: 0.75rem;
        font-size: 1rem;
      }
      
      .score-value {
        font-size: 2rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
      }
      
      .score-value.good { color: var(--ok); }
      .score-value.average { color: var(--warn); }
      .score-value.poor { color: var(--bad); }
      
      .score-percentage {
        font-size: 0.9rem;
        color: var(--muted);
        margin-bottom: 0.75rem;
      }
      
      .progress-bar-mobile {
        height: 8px;
        background: rgba(0,0,0,0.1);
        border-radius: 4px;
        overflow: hidden;
      }
      
      .progress-bar-mobile.total {
        display: flex;
      }
      
      .progress-bar-mobile.total .progress-fill.product {
        border-radius: 4px 0 0 4px;
      }
      
      .progress-bar-mobile.total .progress-fill.process {
        border-radius: 0 4px 4px 0;
      }
      
      .total-score-mobile {
        background: white;
        border-radius: 12px;
        padding: 1.5rem;
        border: 2px solid;
        margin-bottom: 1.5rem;
        text-align: center;
      }
      
      .total-score-value {
        font-size: 2.5rem;
        font-weight: 800;
        margin-bottom: 0.5rem;
      }
      
      .total-score-label {
        font-size: 1rem;
        color: var(--muted);
        margin-bottom: 1rem;
      }
      
      .progress-labels {
        display: flex;
        justify-content: space-between;
        margin-top: 0.5rem;
        font-size: 0.85rem;
      }
      
      .label-product { color: var(--accent); }
      .label-process { color: var(--ok); }
      
      .report-details-mobile {
        background: white;
        border-radius: 12px;
        padding: 1.5rem;
        border: 1px solid var(--line);
      }
      
      .report-content-mobile {
        font-family: monospace;
        font-size: 0.85rem;
        line-height: 1.5;
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      
      .report-line {
        margin-bottom: 0.5rem;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Initialize
  route();
});

// Export functions to global scope
window.showHallucinationHint = showHallucinationHint;
window.clearHallucinationAnswer = clearHallucinationAnswer;
window.checkHallucination = checkHallucination;
