import { STUDY_PLAN } from "./study-plan.js";

export const SUBJECT_BY_WEEKDAY = Object.fromEntries(
  STUDY_PLAN.weekdays.map((row) => [row.weekday, row.subject])
);

const SUBJECT_LABEL = {
  listening: "听力",
  reading: "阅读",
  writing: "写作",
  speaking: "口语",
  review: "回收",
};

const WEEKEND = new Set([0, 6]);

export function subjectLabel(subject) {
  return SUBJECT_LABEL[subject] ?? subject;
}

export function methodForSubject(subject) {
  return STUDY_PLAN.weekdays.find((row) => row.subject === subject)?.method ?? "纸质书";
}

export function bookForWeek(week, overrides = {}) {
  const row = STUDY_PLAN.weeks.find((item) => item.week === week);
  if (!row) throw new RangeError("week must be 1–12");
  return {
    book: overrides.book ?? row.book,
    test: overrides.test ?? row.test,
    role: row.role,
    focus: row.focus,
  };
}

export function extraPool() {
  return STUDY_PLAN.extraPool;
}

export function sealedUntilWeek() {
  return STUDY_PLAN.rules.sealedFromWeek;
}

export function tonight({ week, weekday, book, test }) {
  const material = bookForWeek(week, { book, test });
  const subject = SUBJECT_BY_WEEKDAY[weekday];
  return {
    ...material,
    subject,
    subjectLabel: subjectLabel(subject),
    method: methodForSubject(subject),
    fullMinutes: STUDY_PLAN.rules.fullStudyMinutes,
    floorMinutes: STUDY_PLAN.rules.minimumStudyMinutes,
  };
}

function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function weekdayOf(iso) {
  return parseISODate(iso).getDay();
}

export function addDays(iso, n) {
  const dt = parseISODate(iso);
  dt.setDate(dt.getDate() + n);
  return formatISO(dt);
}

export function formatISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isWeekday(iso) {
  return !WEEKEND.has(weekdayOf(iso));
}

export function weekdayName(iso) {
  return ["日", "一", "二", "三", "四", "五", "六"][weekdayOf(iso)];
}

function weekdaysBetween(startISO, endISOInclusive) {
  const out = [];
  let cur = startISO;
  while (cur <= endISOInclusive) {
    if (isWeekday(cur)) out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function weekFromCompletions({
  mode,
  completedWeekdays = 0,
  startDate,
  today,
  manualWeek,
}) {
  if (typeof manualWeek === "number") {
    return clampWeek(manualWeek);
  }
  if (mode === "wall") {
    const start = parseISODate(startDate);
    const now = parseISODate(today);
    const days = Math.floor((now - start) / 86400000);
    return clampWeek(Math.floor(days / 7) + 1);
  }
  return clampWeek(Math.floor(completedWeekdays / 5) + 1);
}

function clampWeek(week) {
  return Math.min(STUDY_PLAN.rules.totalWeeks, Math.max(1, week));
}

export function consecutiveMissedWeekdays(checks, today) {
  let n = 0;
  let cur = addDays(today, -1);
  for (let i = 0; i < 60; i += 1) {
    if (isWeekday(cur)) {
      const status = checks[cur];
      if (status === "full" || status === "floor") break;
      if (status === "absent") n += 1;
      else break;
    }
    cur = addDays(cur, -1);
  }
  return n;
}

export function consecutiveSubjectMisses(checks, today, subject) {
  let n = 0;
  let cur = addDays(today, -1);
  for (let i = 0; i < 180; i += 1) {
    if (SUBJECT_BY_WEEKDAY[weekdayOf(cur)] === subject) {
      const status = checks[cur];
      if (status === "full" || status === "floor") break;
      if (status === "absent") n += 1;
      else break;
    }
    cur = addDays(cur, -1);
  }
  return n;
}

export function weakestSubjectGap(checks, today) {
  let best = { subject: null, count: 0 };
  for (const row of STUDY_PLAN.weekdays) {
    const count = consecutiveSubjectMisses(checks, today, row.subject);
    if (count > best.count) best = { subject: row.subject, count };
  }
  return best;
}

export function nudgeMode(checks, today) {
  const missed = consecutiveMissedWeekdays(checks, today);
  if (missed >= STUDY_PLAN.rules.recoverNudge) return "recover";
  if (missed >= STUDY_PLAN.rules.missNudge) return "floor";
  return "normal";
}

export function canBumpWeek(checks, today) {
  return consecutiveMissedWeekdays(checks, today) < STUDY_PLAN.rules.recoverNudge;
}

export function vocabCap(weekday) {
  if (weekday === 5) return STUDY_PLAN.rules.fridayNewWords;
  return STUDY_PLAN.rules.maxNewWordsPerDay;
}

export function calendarTitle({ book, test, subject }) {
  return `打开课表助手 · 剑雅${book} T${test} ${subjectLabel(subject)}`;
}

export function applyPastAbsences({ checks, startDate, today }) {
  const next = { ...checks };
  for (const iso of weekdaysBetween(startDate, addDays(today, -1))) {
    if (!next[iso]) next[iso] = "absent";
  }
  return next;
}

export function countCompletedWeekdays(checks) {
  return Object.values(checks).filter((s) => s === "full" || s === "floor").length;
}

export function nextWeekday(fromISO) {
  let cur = fromISO;
  if (isWeekday(cur)) return cur;
  for (let i = 0; i < 8; i += 1) {
    cur = addDays(cur, 1);
    if (isWeekday(cur)) return cur;
  }
  return cur;
}

export function defaultStartDate(todayISO) {
  const wd = weekdayOf(todayISO);
  if (wd >= 1 && wd <= 5) return todayISO;
  return nextWeekday(todayISO);
}

export function extraUnlocked(weekChecks, mode) {
  return mode === "normal" && weekChecks.some((row) => row.status === "full");
}

export function mondayToFriday(todayISO) {
  const dt = parseISODate(todayISO);
  const day = dt.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + offset);
  return [0, 1, 2, 3, 4].map((i) => {
    const x = new Date(dt);
    x.setDate(dt.getDate() + i);
    return formatISO(x);
  });
}

export function nextCalendarDay(iso) {
  return addDays(iso, 1);
}

export function monthCells(year, month) {
  const first = new Date(year, month - 1, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month - 1, 1 - startOffset);
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    const iso = formatISO(dt);
    cells.push({
      iso,
      day: dt.getDate(),
      inMonth: dt.getMonth() === month - 1,
      weekend: WEEKEND.has(dt.getDay()),
    });
  }
  return cells;
}

export function weekVocabCount(vocab, week) {
  return vocab.filter((item) => item.week === week).length;
}

export function tonightAdvice({
  checks,
  vocab,
  today,
  week,
  weekday,
  card,
  listeningReady = true,
}) {
  const missed = consecutiveMissedWeekdays(checks, today);
  const gap = weakestSubjectGap(checks, today);
  const words = weekVocabCount(vocab, week);
  const { rules } = STUDY_PLAN;

  if (missed >= rules.recoverNudge) {
    return {
      mode: "recover",
      title: "先恢复最低档，不要补套题",
      body: `已连续 ${missed} 个工作日未完成。今晚只做 ${card.floorMinutes} 分钟，不加练、不换套题、不跳周。`,
    };
  }

  if (missed >= rules.missNudge) {
    return {
      mode: "floor",
      title: "只做 25 分钟",
      body: `已连续 ${missed} 个工作日未完成。今晚不要补昨天的任务。完成剑雅 ${card.book} Test ${card.test} · ${card.subjectLabel}最低档即可。`,
    };
  }

  if (missed === 1) {
    return {
      mode: "ease",
      title: "昨晚空了，今晚不补套",
      body: `昨天没有完成计划，今晚不要补昨天的任务。完成剑雅 ${card.book} Test ${card.test} · ${card.subjectLabel}最低档即可。`,
    };
  }

  if (gap.count >= rules.subjectGapRecover) {
    return {
      mode: "subject",
      title: `${subjectLabel(gap.subject)}已经连续 ${gap.count} 次没有产出`,
      body: `今晚不推进新的 ${subjectLabel(gap.subject)} 任务，只做 ${card.floorMinutes} 分钟词汇或录音产出，把 ${subjectLabel(gap.subject)} 重新接上。`,
    };
  }

  if (weekday === 5) {
    return {
      mode: "friday",
      title: "今晚收束本周",
      body: "不开新战线。复习本周词汇，完成本周最后一次打卡。零新词。",
    };
  }

  if (weekday === 1 && !listeningReady) {
    return {
      mode: "listen-prep",
      title: "今晚推进听力主线",
      body: `剑雅 ${card.book} Test ${card.test} · 听力。学习方式：${card.method}。音频还没标记就绪时，也先按最低档把任务接上，不要在电脑里播真题。`,
    };
  }

  if (words < rules.weeklyVocabTarget * ((weekday || 1) / 5) && weekday !== 5) {
    return {
      mode: "vocab",
      title: "今晚推进主线，并补词",
      body: `剑雅 ${card.book} Test ${card.test} · ${card.subjectLabel}。本周词汇 ${words}/${rules.weeklyVocabTarget}，主课结束后补到上限即可，不额外增加刷题量。学习方式：${card.method}。`,
    };
  }

  return {
    mode: "normal",
    title: "今晚推进主线",
    body: `剑雅 ${card.book} Test ${card.test} · ${card.subjectLabel}。完成完整档，词汇最多新增 ${vocabCap(weekday)} 个。学习方式：${card.method}。`,
  };
}

export function restartProgress(state) {
  return {
    ...state,
    manualWeek: 1,
    bookOverride: null,
    testOverride: null,
    checks: Object.fromEntries(
      Object.entries(state.checks).filter(([iso]) => iso !== state.studyDate)
    ),
  };
}

export function statusMark(status) {
  if (status === "full") return "✓";
  if (status === "floor") return "◐";
  if (status === "absent") return "×";
  if (!status) return "·";
  return "·";
}
