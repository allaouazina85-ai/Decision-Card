/* =========================
   DecisionCard MVP - JavaScript
   ملف JavaScript كامل
========================= */

/* =========================
   Constants & Utils
========================= */
const LS_KEY = "dc_mvp_v1";

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
   Dashboard View
========================= */
function renderDashboard(state) {
  const tasks = state.tasks;
  const subs = state.submissions;

  const totalTasks = tasks.length;
  const totalSubs = subs.length;
  const strong = subs.filter(s => computeTraceStatus(s).level === "ok").length;

  // Update KPI
  document.getElementById("kpi").innerHTML = `
    <div class="item"><div class="muted">عدد المهام</div><div class="num">${totalTasks}</div></div>
    <div class="item"><div class="muted">عدد التسليمات</div><div class="num">${totalSubs}</div></div>
    <div class="item"><div class="muted">مسار قوي</div><div class="num">${strong}</div></div>
  `;

  // Update tasks list
  const tasksListEl = document.getElementById("tasksList");
  if (tasks.length === 0) {
    tasksListEl.innerHTML = `
      <div class="itemRow">
        <div class="meta">
          <div><b>لا توجد مهام بعد</b></div>
          <div class="muted">ابدئي بإنشاء مهمة ترجمة لتجربة مسار "بطاقة القرار".</div>
        </div>
        <a class="btn primary" href="#/new">إنشاء مهمة</a>
      </div>
    `;
    return;
  }

  tasksListEl.innerHTML = tasks
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .map(t => {
      const sub = getSubmission(state, t.id);
      const st = computeTraceStatus(sub);
      const badgeClass = st.level === "ok" ? "ok" : st.level === "bad" ? "bad" : "warn";
      const badgeText = st.label;

      return `
        <div class="itemRow">
          <div class="meta">
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              <b>${t.domain} • ${t.srcLang.toUpperCase()}→${t.tgtLang.toUpperCase()}</b>
              <span class="badge ${badgeClass}">${badgeText}</span>
              ${t.sensitive === "yes" ? `<span class="badge warn">⚠️ حساس</span>` : ``}
            </div>
            <div class="muted">
              جمهور: ${t.audience} • نبرة: ${t.tone} • أنشئت: ${formatDate(t.createdAt)}
            </div>
            <div class="small mono">${(t.sourceText || "").slice(0, 120).replaceAll("<", "&lt;")}…</div>
          </div>
          <div class="rightActions">
            <a class="btn" href="#/work/${t.id}">فتح</a>
            ${sub ? `<a class="btn" href="#/report/${sub.id}">عرض التقرير</a>` : ``}
          </div>
        </div>
      `;
    }).join("");
}

/* =========================
   Hallucination Exercise Functions
========================= */
function showHallucinationHint() {
  const feedback = document.getElementById("hallucinationFeedback");
  feedback.innerHTML = `
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
    message = `
      <div class="success">✅ <b>ممتاز!</b> اكتشفتِ الخطأين كليهما:</div>
      <div class="small muted" style="margin-top:5px">
        1. الخطأ في التاريخ: 2023 بدلاً من 2024<br>
        2. الخطأ في المكان: كامبريدج بدلاً من أكسفورد<br>
        هذا بالضبط نوع الأخطاء التي قد ينتجها الذكاء الاصطناعي دون تحقق!
      </div>
    `;
  } else if (hasDateError || hasPlaceError) {
    score = 50;
    message = `
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
    message = `
      <div class="error">❌ <b>تحتاج للمزيد من التدقيق</b></div>
      <div class="small muted" style="margin-top:5px">
        حاولي التركيز على:<br>
        1. التواريخ والأرقام (2023 vs 2024)<br>
        2. الأسماء والمعلومات الواقعية (جامعة كامبريدج vs جامعة أكسفورد)<br>
        هذه الأخطاء تسمى "هلوسة" (Hallucination) وهي شائعة في مخرجات الذكاء الاصطناعي
      </div>
    `;
  }
  
  feedback.innerHTML = `
    ${message}
    <div class="sep" style="margin:10px 0"></div>
    <div style="display:flex; justify-content:space-between; align-items:center">
      <div class="small">درجة الاكتشاف: <b>${score}%</b></div>
      <button class="btn small" onclick="clearHallucinationAnswer()">حاولي مرة أخرى</button>
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
  document.getElementById("taskMeta").textContent = 
    `مجال: ${task.domain} • ${task.srcLang.toUpperCase()}→${task.tgtLang.toUpperCase()} • جمهور: ${task.audience} • نبرة: ${task.tone}`;
  
  document.getElementById("wsSource").value = task.sourceText;
  document.getElementById("wsTranslation").value = sub.finalTranslation || sub.draftTranslation || "";
  document.getElementById("lastSaved").textContent = sub.updatedAt ? formatDate(sub.updatedAt) : "—";
  document.getElementById("privacyHint").style.display = task.sensitive === "yes" ? "block" : "none";

  const st = computeTraceStatus(sub);
  const badgeClass = st.level === "ok" ? "ok" : st.level === "bad" ? "bad" : "warn";
  document.getElementById("traceStatus").innerHTML = `
    <div class="badge ${badgeClass}" style="margin-bottom:10px">${st.label}</div>
    <div class="muted">${st.details.map(x => `<div>${x}</div>`).join("")}</div>
  `;

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

btnOpenDecision.addEventListener("click", () => modal.classList.add("open"));
btnCloseDecision.addEventListener("click", () => modal.classList.remove("open"));
modal.addEventListener("click", (e) => { 
  if (e.target === modal) modal.classList.remove("open"); 
});

// Form elements
const dcChosen = document.getElementById("dcChosen");
const dcJustify = document.getElementById("dcJustify");
const dcAlt1 = document.getElementById("dcAlt1");
const dcAlt2 = document.getElementById("dcAlt2");
const dcSources = document.getElementById("dcSources");
const dcPostEdit = document.getElementById("dcPostEdit");

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
  document.getElementById("reviewMeta").textContent = 
    `مجال: ${task.domain} • ${task.srcLang.toUpperCase()}→${task.tgtLang.toUpperCase()} • أنشئت: ${formatDate(task.createdAt)}`;
  
  // Update summary
  const st = computeTraceStatus(sub);
  document.getElementById("reviewSummary").innerHTML = `
    <div>طول النص المصدر: <span class="mono">${task.sourceText.length}</span> حرف</div>
    <div>طول الترجمة: <span class="mono">${(sub.finalTranslation || "").length}</span> حرف</div>
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
  
  document.getElementById("reportMeta").innerHTML = `
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

  const summaryText = sub.learningReport?.summary || buildReportText(task, sub);
  const lines = summaryText.split("\n").map(l => l.replaceAll("<", "&lt;"));
  
  // Create enhanced report display
  document.getElementById("reportBody").innerHTML = `
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
window.addEventListener("DOMContentLoaded", route);