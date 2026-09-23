import { STUDY_PLAN } from "./study-plan.js";
import {
  applyPastAbsences,
  calendarTitle,
  canBumpWeek,
  countCompletedWeekdays,
  defaultStartDate,
  extraPool,
  extraUnlocked,
  formatISO,
  isWeekday,
  mondayToFriday,
  monthCells,
  nextCalendarDay,
  nudgeMode,
  restartProgress,
  sealedUntilWeek,
  statusMark,
  subjectLabel,
  tonight,
  tonightAdvice,
  vocabCap,
  weekFromCompletions,
  weekdayName,
} from "./engine.js";

const KEY = "ielts-desk-companion-v1";
const ROUTES = [
  ["#/", "今晚"],
  ["#/days", "每日计划"],
  ["#/progress", "进度"],
  ["#/vocab", "词汇"],
  ["#/settings", "设置"],
];

const state = load();
let monthCursor = null;

const studyISO = () => state.studyDate || formatISO(new Date());

boot();

function emptyState() {
  return {
    version: 2,
    startDate: null,
    weekMode: "completions",
    manualWeek: null,
    bookOverride: null,
    testOverride: null,
    studyDate: null,
    checks: {},
    notes: {},
    vocab: [],
    listeningReady: false,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const data = JSON.parse(raw);
    const next = { ...emptyState(), ...data };
    if (!next.studyDate && data.simulatedDate) next.studyDate = data.simulatedDate;
    if (!next.notes) next.notes = {};
    delete next.attachments;
    delete next.listeningSteps;
    delete next.simulatedDate;
    return next;
  } catch {
    return emptyState();
  }
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function weekday(iso) {
  return new Date(`${iso}T12:00:00`).getDay();
}

function derived() {
  const today = studyISO();
  state.checks = applyPastAbsences({
    checks: state.checks,
    startDate: state.startDate || today,
    today,
  });
  const completed = countCompletedWeekdays(state.checks);
  const week = weekFromCompletions({
    mode: state.weekMode,
    completedWeekdays: completed,
    startDate: state.startDate,
    today,
    manualWeek: state.manualWeek,
  });
  const wd = weekday(today);
  const weekend = !isWeekday(today);
  const card = weekend
    ? { ...tonight({ week, weekday: 1, book: state.bookOverride, test: state.testOverride }), weekend: true }
    : tonight({ week, weekday: wd, book: state.bookOverride, test: state.testOverride });
  const mode = nudgeMode(state.checks, today);
  const advice = tonightAdvice({
    checks: state.checks,
    vocab: state.vocab,
    today,
    week,
    weekday: weekend ? 1 : wd,
    card,
    listeningReady: state.listeningReady,
  });
  const weekChecks = mondayToFriday(today).map((iso) => ({
    iso,
    status: state.checks[iso],
    subject: subjectLabel(
      tonight({ week, weekday: weekday(iso) || 1, book: state.bookOverride, test: state.testOverride }).subject
    ),
  }));
  const thisWeekVocab = state.vocab.filter((v) => v.week === week);
  return {
    today,
    week,
    wd,
    weekend,
    card,
    mode,
    advice,
    todayStatus: state.checks[today],
    completed,
    thisWeekVocab,
    weekChecks,
    extraOk: extraUnlocked(weekChecks, mode),
    sealedWeeksLeft: Math.max(0, sealedUntilWeek() - week),
    note: state.notes[today] || "",
  };
}

function route() {
  return location.hash || "#/";
}

function boot() {
  const setup = document.getElementById("setup");
  const form = document.getElementById("setup-form");
  form.elements.startDate.value = defaultStartDate(formatISO(new Date()));
  document.getElementById("setup-hint").textContent =
    `目标 ${STUDY_PLAN.goal.score} / 单科 ${STUDY_PLAN.goal.sectionScore} · ${STUDY_PLAN.goal.type}。方案版本 ${STUDY_PLAN.version}。`;

  if (!state.startDate) setup.showModal();
  else render();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    state.startDate = form.elements.startDate.value;
    save();
    setup.close();
    render();
  });

  document.getElementById("restart-form").addEventListener("submit", (e) => {
    const value = e.submitter?.value;
    if (value !== "ok") return;
    e.preventDefault();
    if (formValue("restart-form", "confirm") !== "重新开始") {
      alert("请输入「重新开始」");
      return;
    }
    Object.assign(state, restartProgress({ ...state, studyDate: studyISO() }));
    save();
    document.getElementById("restart").close();
    location.hash = "#/";
    render();
  });

  window.addEventListener("hashchange", render);
  document.getElementById("view").addEventListener("click", onClick);
  document.getElementById("view").addEventListener("change", onChange);
  document.getElementById("view").addEventListener("submit", onSubmit);
}

function formValue(id, name) {
  return document.getElementById(id).elements[name].value.trim();
}

function render() {
  const d = derived();
  save();
  if (!monthCursor) {
    const dt = new Date(`${d.today}T12:00:00`);
    monthCursor = { year: dt.getFullYear(), month: dt.getMonth() + 1 };
  }
  document.getElementById("eyebrow").textContent =
    `计划控制台 · ${STUDY_PLAN.goal.type} ${STUDY_PLAN.goal.score}`;
  document.getElementById("nav").innerHTML = ROUTES.map(
    ([href, label]) =>
      `<a href="${href}" class="${route() === href ? "current" : ""}">${label}</a>`
  ).join("");

  const titles = {
    "#/": "今晚怎么学",
    "#/days": "每日计划",
    "#/progress": "进度",
    "#/vocab": "词汇",
    "#/settings": "设置",
  };
  document.getElementById("mast-title").textContent = titles[route()] || "今晚怎么学";
  document.getElementById("mast-sub").textContent = d.weekend
    ? `${d.today} 不是工作日。下面预告下周一；周末不会自动跳周。`
    : `学习日期 ${d.today} · 第 ${d.week} / ${STUDY_PLAN.rules.totalWeeks} 周 · ${d.card.subjectLabel} · 剑雅 ${d.card.book} Test ${d.card.test}`;

  const view = document.getElementById("view");
  if (route() === "#/days") view.innerHTML = viewDays(d);
  else if (route() === "#/progress") view.innerHTML = viewProgress(d);
  else if (route() === "#/vocab") view.innerHTML = viewVocab(d);
  else if (route() === "#/settings") view.innerHTML = viewSettings(d);
  else view.innerHTML = viewTonight(d);
}

function viewTonight(d) {
  const { card, advice } = d;
  const status = d.todayStatus || "none";
  return `
    <main class="booklet">
      <aside class="spine">
        <div class="spine-code">C${card.book}</div>
        <div class="spine-meta">TEST ${card.test}</div>
      </aside>
      <article class="leaf">
        <div class="nudge">${advice.title}</div>
        <h2>${d.weekend ? "下个工作日预告" : `Week ${d.week} · ${card.focus}`}</h2>
        <p class="task">剑雅 ${card.book} Test ${card.test} · ${card.subjectLabel}</p>
        <p class="brief">${advice.body}</p>
        <p class="hint">学习方式：${card.method}。本工具只记录完成情况，不打开真题。</p>
      </article>
    </main>
    <section class="panel">
      <h3>今日完成度</h3>
      <form id="today-form">
        <div class="choice">
          ${choice("none", "未完成", status)}
          ${choice("floor", `最低档 · ${card.floorMinutes} 分钟`, status)}
          ${choice("full", `完整档 · ${card.fullMinutes} 分钟`, status)}
        </div>
        <h3>今日备注</h3>
        <p class="hint">只解释今天为什么偏离计划，不会改整体学习方案。</p>
        <textarea class="note" name="note" placeholder="例如：加班，口语改成整理词汇">${escapeHtml(d.note)}</textarea>
        <div class="actions">
          <button class="btn primary" type="submit">保存今日记录</button>
          <button class="btn" type="button" data-act="copy">复制日历文案</button>
        </div>
      </form>
    </section>
  `;
}

function choice(value, label, current) {
  return `<label><input type="radio" name="status" value="${value}" ${current === value || (value === "none" && !current) ? "checked" : ""} /> ${label}</label>`;
}

function viewDays(d) {
  const cells = monthCells(monthCursor.year, monthCursor.month);
  const week = mondayToFriday(d.today);
  return `
    <section class="panel">
      <div class="month-nav">
        <button class="btn" data-act="prev-month">上个月</button>
        <strong>${monthCursor.year} 年 ${monthCursor.month} 月</strong>
        <button class="btn" data-act="next-month">下个月</button>
      </div>
      <div class="cal">
        ${["一", "二", "三", "四", "五", "六", "日"].map((n) => `<div class="hd">${n}</div>`).join("")}
        ${cells
          .map((cell) => {
            const future = cell.iso > d.today;
            const status = isWeekday(cell.iso) ? state.checks[cell.iso] : null;
            const mark = cell.weekend
              ? "—"
              : future
                ? "·"
                : statusMark(status);
            return `<button type="button" data-act="pick-day" data-iso="${cell.iso}" class="${cell.inMonth ? "" : "out"} ${cell.weekend ? "weekend" : ""} ${cell.iso === d.today ? "active" : ""}">${cell.day}<br>${mark}</button>`;
          })
          .join("")}
      </div>
    </section>
    <section class="panel">
      <h3>W${d.week} · 剑雅 ${d.card.book} Test ${d.card.test}</h3>
      <div class="week-grid">
        ${week
          .map((iso, i) => {
            const wd = i + 1;
            const row = tonight({ week: d.week, weekday: wd, book: state.bookOverride, test: state.testOverride });
            return `<div><strong>${["周一", "周二", "周三", "周四", "周五"][i]}</strong><br>${row.subjectLabel}<br>${statusMark(state.checks[iso])} ${iso.slice(5)}</div>`;
          })
          .join("")}
      </div>
    </section>
    ${dayDetail(d.today, d)}
  `;
}

function dayDetail(iso, d) {
  const wd = weekday(iso);
  const planned = isWeekday(iso)
    ? tonight({ week: d.week, weekday: wd, book: state.bookOverride, test: state.testOverride })
    : null;
  const status = state.checks[iso];
  const words = state.vocab.filter((v) => v.date === iso);
  return `
    <section class="panel">
      <h3>${iso} · 星期${weekdayName(iso)}</h3>
      ${
        planned
          ? `<p>今日计划：${planned.subjectLabel} · 剑雅 ${planned.book} Test ${planned.test}<br>学习方式：${planned.method}<br>词汇：新增 ≤${vocabCap(wd)} 个</p>`
          : "<p>非工作日，没有主课。</p>"
      }
      <p>今日实际：${statusLabel(status)}<br>今日词汇：${words.length} 个</p>
      <p>今日备注：${escapeHtml(state.notes[iso] || "（无）")}</p>
      <button class="btn" data-act="use-day" data-iso="${iso}">把学习日期切到这一天</button>
    </section>
  `;
}

function statusLabel(status) {
  if (status === "full") return "完整档";
  if (status === "floor") return "最低档";
  if (status === "absent") return "缺席";
  return "未完成";
}

function viewProgress(d) {
  const bySubject = {};
  for (const [iso, status] of Object.entries(state.checks)) {
    const wd = weekday(iso);
    const sub = tonight({ week: 1, weekday: wd }).subject;
    if (!sub) continue;
    bySubject[sub] ??= { full: 0, floor: 0, absent: 0 };
    if (status === "full" || status === "floor" || status === "absent") {
      bySubject[sub][status] += 1;
    }
  }
  return `
    <section class="panel stats">
      <div class="stat"><b>${d.week}</b>当前周 / ${STUDY_PLAN.rules.totalWeeks}</div>
      <div class="stat"><b>C${d.card.book}</b>Test ${d.card.test}</div>
      <div class="stat"><b>${d.completed}</b>已完成工作日</div>
      <div class="stat"><b>${state.vocab.length}</b>词汇累计</div>
      <div class="stat"><b>${d.thisWeekVocab.length}</b>本周词 / ${STUDY_PLAN.rules.weeklyVocabTarget}</div>
      <div class="stat"><b>${d.sealedWeeksLeft}</b>距模考封存（周）</div>
    </section>
    <section class="panel">
      <h3>科目完成情况</h3>
      <p class="hint">${Object.entries(bySubject).map(([k, v]) => `${subjectLabel(k)} 完整 ${v.full || 0} · 最低档 ${v.floor || 0} · 缺席 ${v.absent || 0}`).join("　") || "还没有记录"}</p>
      ${d.extraOk ? `<p class="pool">加练池已开：${extraPool().slice(0, 6).map((x) => `C${x.book} T${x.test}`).join("、")}… 共 ${extraPool().length} 套。不算模考。</p>` : `<p class="hint">加练池：本周主套记完整档后出现。20/21 在第 ${sealedUntilWeek()} 周前不可选。1–10 不做套题。</p>`}
    </section>
  `;
}

function viewVocab(d) {
  const cap = d.weekend ? 0 : vocabCap(d.wd);
  const todayCount = state.vocab.filter((v) => v.date === d.today).length;
  const left = Math.max(0, cap - todayCount);
  return `
    <section class="panel">
      <h3>词汇四格 · 今日还可 ${left} 个</h3>
      <form class="vocab-grid" id="vocab-form">
        <input name="word" placeholder="word" required ${left === 0 ? "disabled" : ""} />
        <input name="pos" placeholder="pos" ${left === 0 ? "disabled" : ""} />
        <input name="collocation" placeholder="一个搭配" required ${left === 0 ? "disabled" : ""} />
        <input name="zh" placeholder="中文（复习时请自己遮住）" ${left === 0 ? "disabled" : ""} />
        <textarea name="my_sentence" placeholder="一句自己的话" required ${left === 0 ? "disabled" : ""}></textarea>
        <button class="btn primary" ${left === 0 ? "disabled" : ""}>记入本机</button>
      </form>
      <ul class="word-list">
        ${state.vocab
          .slice()
          .reverse()
          .slice(0, 20)
          .map(
            (v) => `
          <li>
            <div>
              <strong>${escapeHtml(v.word)}</strong>
              <span class="meta">${escapeHtml(v.pos || "")} · ${escapeHtml(v.collocation)} · C${v.source.book} T${v.source.test}</span>
              <div>${escapeHtml(v.my_sentence)}</div>
            </div>
            <button class="btn ${v.red ? "danger" : ""}" data-red="${v.id}">${v.red ? "红标" : "用不出去"}</button>
          </li>`
          )
          .join("")}
      </ul>
    </section>
  `;
}

function viewSettings(d) {
  return `
    <section class="panel">
      <h3>学习方案</h3>
      <p>版本 ${STUDY_PLAN.version}。改书目或科目顺序请编辑 <code>src/study-plan.js</code>，不要用今日备注去改全局计划。</p>
      <p class="pool">${STUDY_PLAN.weeks.map((w) => `W${w.week} 剑雅${w.book} T${w.test}`).join(" · ")}</p>
    </section>
    <section class="panel">
      <h3>当前进度调整</h3>
      <p class="hint">只改正学到哪，不清空历史。</p>
      <label>当前周 <input type="number" id="manual-week" min="1" max="${STUDY_PLAN.rules.totalWeeks}" value="${state.manualWeek ?? d.week}" /></label>
      <label>当前书 <input type="number" id="book-override" min="11" max="21" value="${state.bookOverride ?? d.card.book}" /></label>
      <label>当前 Test <input type="number" id="test-override" min="1" max="4" value="${state.testOverride ?? d.card.test}" /></label>
      <div class="actions">
        <button class="btn primary" data-act="save-progress">保存进度位置</button>
        <button class="btn" data-act="bump" ${canBumpWeek(state.checks, d.today) ? "" : "disabled"}>当前周 +1</button>
      </div>
    </section>
    <section class="panel">
      <h3>学习日期与开始日</h3>
      <label>计划开始日 <input type="date" id="start" value="${state.startDate}" /></label>
      <label>学习日期 <input type="date" id="study-date" value="${d.today}" /></label>
      <label>进周方式
        <select id="mode">
          <option value="completions" ${state.weekMode === "completions" ? "selected" : ""}>按完成的工作日</option>
          <option value="wall" ${state.weekMode === "wall" ? "selected" : ""}>按墙上日期对齐</option>
        </select>
      </label>
      <label><input type="checkbox" id="listen-ready" ${state.listeningReady ? "checked" : ""} /> 听力材料已在手机 App 就绪</label>
      <div class="actions">
        <button class="btn" data-act="next-day">下一天</button>
        <button class="btn" data-act="clear-study-date">回到今天</button>
        <button class="btn" data-act="export">导出 JSON</button>
        <label class="btn">导入 JSON <input type="file" id="import" accept="application/json" hidden /></label>
      </div>
    </section>
    <section class="panel">
      <h3>重新开始学习计划</h3>
      <p class="hint">入口故意放在设置里。会重置当前周，不清空历史词汇。</p>
      <button class="btn danger" data-act="restart">重新开始…</button>
    </section>
  `;
}

function onClick(e) {
  const act = e.target.dataset?.act;
  const red = e.target.dataset?.red;
  if (red) {
    const item = state.vocab.find((v) => v.id === red);
    if (item) item.red = !item.red;
    save();
    render();
    return;
  }
  if (!act) return;
  const d = derived();
  if (act === "copy") navigator.clipboard.writeText(calendarTitle(d.card));
  if (act === "prev-month") shiftMonth(-1);
  if (act === "next-month") shiftMonth(1);
  if (act === "pick-day") {
    state.studyDate = e.target.dataset.iso;
    save();
    render();
  }
  if (act === "use-day") {
    state.studyDate = e.target.dataset.iso;
    save();
    location.hash = "#/";
    render();
  }
  if (act === "save-progress") {
    state.manualWeek = Number(document.getElementById("manual-week").value);
    state.bookOverride = Number(document.getElementById("book-override").value);
    state.testOverride = Number(document.getElementById("test-override").value);
    save();
    render();
  }
  if (act === "bump" && canBumpWeek(state.checks, d.today)) {
    state.manualWeek = Math.min(STUDY_PLAN.rules.totalWeeks, d.week + 1);
    save();
    render();
  }
  if (act === "next-day") {
    state.studyDate = nextCalendarDay(d.today);
    save();
    render();
  }
  if (act === "clear-study-date") {
    state.studyDate = null;
    save();
    render();
  }
  if (act === "export") {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ielts-desk-${d.today}.json`;
    a.click();
  }
  if (act === "restart") document.getElementById("restart").showModal();
}

function shiftMonth(delta) {
  monthCursor.month += delta;
  if (monthCursor.month < 1) {
    monthCursor.month = 12;
    monthCursor.year -= 1;
  }
  if (monthCursor.month > 12) {
    monthCursor.month = 1;
    monthCursor.year += 1;
  }
  render();
}

function onChange(e) {
  if (e.target.id === "start") state.startDate = e.target.value;
  if (e.target.id === "study-date") state.studyDate = e.target.value || null;
  if (e.target.id === "mode") state.weekMode = e.target.value;
  if (e.target.id === "listen-ready") state.listeningReady = e.target.checked;
  if (e.target.id === "import") {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Object.assign(state, emptyState(), JSON.parse(reader.result));
        save();
        render();
      } catch {
        alert("这份 JSON 读不出来");
      }
    };
    reader.readAsText(file);
    return;
  }
  save();
  if (e.target.id) render();
}

function onSubmit(e) {
  e.preventDefault();
  const d = derived();
  if (e.target.id === "today-form") {
    const status = new FormData(e.target).get("status");
    const note = new FormData(e.target).get("note");
    if (status === "none") delete state.checks[d.today];
    else state.checks[d.today] = status;
    state.notes[d.today] = String(note || "").trim();
    save();
    render();
    return;
  }
  if (e.target.id === "vocab-form") {
    const cap = d.weekend ? 0 : vocabCap(d.wd);
    const todayCount = state.vocab.filter((v) => v.date === d.today).length;
    if (todayCount >= cap) return;
    const data = Object.fromEntries(new FormData(e.target));
    state.vocab.push({
      id: crypto.randomUUID(),
      ...data,
      date: d.today,
      week: d.week,
      red: false,
      source: { book: d.card.book, test: d.card.test, subject: d.card.subject },
    });
    save();
    render();
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
