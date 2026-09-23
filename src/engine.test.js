import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SUBJECT_BY_WEEKDAY,
  bookForWeek,
  extraPool,
  tonight,
  weekFromCompletions,
  consecutiveMissedWeekdays,
  nudgeMode,
  canBumpWeek,
  vocabCap,
  calendarTitle,
  applyPastAbsences,
  mondayToFriday,
  tonightAdvice,
  consecutiveSubjectMisses,
  methodForSubject,
  restartProgress,
} from "./engine.js";

test("weekday subjects are fixed", () => {
  assert.equal(SUBJECT_BY_WEEKDAY[1], "listening");
  assert.equal(SUBJECT_BY_WEEKDAY[2], "reading");
  assert.equal(SUBJECT_BY_WEEKDAY[3], "writing");
  assert.equal(SUBJECT_BY_WEEKDAY[4], "speaking");
  assert.equal(SUBJECT_BY_WEEKDAY[5], "review");
});

test("book layering: 16 then 17 then 18 then sealed mocks", () => {
  assert.deepEqual(bookForWeek(1), { book: 16, test: 1, role: "main", focus: "限时主练" });
  assert.deepEqual(bookForWeek(4), { book: 16, test: 4, role: "main", focus: "限时主练" });
  assert.deepEqual(bookForWeek(5), { book: 17, test: 1, role: "main", focus: "限时主练" });
  assert.deepEqual(bookForWeek(8), { book: 17, test: 4, role: "main", focus: "限时主练" });
  assert.deepEqual(bookForWeek(9), { book: 18, test: 1, role: "main", focus: "收紧计时" });
  assert.deepEqual(bookForWeek(10), { book: 18, test: 2, role: "main", focus: "收紧计时" });
  assert.deepEqual(bookForWeek(11), { book: 20, test: 1, role: "mock", focus: "封存模考" });
  assert.deepEqual(bookForWeek(12), { book: 21, test: 1, role: "mock", focus: "封存模考" });
});

test("extra pool excludes 1-10 and sealed remainder until week 11", () => {
  const pool = extraPool();
  assert.ok(pool.every((item) => item.book >= 11));
  assert.ok(!pool.some((item) => item.book <= 10));
  assert.ok(pool.some((item) => item.book === 19));
  assert.ok(pool.some((item) => item.book === 18 && item.test === 3));
  assert.ok(!pool.some((item) => item.book === 20));
  assert.ok(!pool.some((item) => item.book === 21));
});

test("tonight card uses current week + weekday, not book 1", () => {
  const card = tonight({ week: 1, weekday: 2 });
  assert.equal(card.book, 16);
  assert.equal(card.test, 1);
  assert.equal(card.subject, "reading");
  assert.equal(card.method, "纸质书");
  assert.equal(card.fullMinutes, 60);
  assert.equal(card.floorMinutes, 25);
});

test("week advances by completed weekdays / 5, not wall calendar", () => {
  assert.equal(weekFromCompletions({ mode: "completions", completedWeekdays: 0 }), 1);
  assert.equal(weekFromCompletions({ mode: "completions", completedWeekdays: 4 }), 1);
  assert.equal(weekFromCompletions({ mode: "completions", completedWeekdays: 5 }), 2);
  assert.equal(weekFromCompletions({ mode: "completions", completedWeekdays: 9 }), 2);
});

test("wall calendar alignment can be switched on", () => {
  const start = "2026-09-21";
  assert.equal(
    weekFromCompletions({
      mode: "wall",
      startDate: start,
      today: "2026-09-28",
    }),
    2
  );
});

test("two missed weekdays switch to floor-only nudge", () => {
  const checks = {
    "2026-09-21": "absent",
    "2026-09-22": "absent",
  };
  assert.equal(consecutiveMissedWeekdays(checks, "2026-09-23"), 2);
  assert.equal(nudgeMode(checks, "2026-09-23"), "floor");
});

test("three absences block week bump and keep floor check-in", () => {
  const checks = {
    "2026-09-21": "absent",
    "2026-09-22": "absent",
    "2026-09-23": "absent",
  };
  assert.equal(nudgeMode(checks, "2026-09-24"), "recover");
  assert.equal(canBumpWeek(checks, "2026-09-24"), false);
});

test("Friday has zero new words; other weekdays cap at 10", () => {
  assert.equal(vocabCap(5), 0);
  assert.equal(vocabCap(1), 10);
});

test("calendar title is one copyable line", () => {
  assert.equal(
    calendarTitle({ book: 16, test: 2, subject: "reading" }),
    "打开课表助手 · 剑雅16 T2 阅读"
  );
});

test("unmarked past weekdays become absent when reopened", () => {
  const next = applyPastAbsences({
    checks: {},
    startDate: "2026-09-21",
    today: "2026-09-24",
  });
  assert.equal(next["2026-09-21"], "absent");
  assert.equal(next["2026-09-22"], "absent");
  assert.equal(next["2026-09-23"], "absent");
  assert.equal(next["2026-09-24"], undefined);
});

test("listening is an app method, not a local player", () => {
  assert.equal(methodForSubject("listening"), "手机听力 App");
});

test("advice recovers after three absences and does not invent catch-up", () => {
  const checks = {
    "2026-09-21": "absent",
    "2026-09-22": "absent",
    "2026-09-23": "absent",
  };
  const card = tonight({ week: 1, weekday: 4 });
  const advice = tonightAdvice({
    checks,
    vocab: [],
    today: "2026-09-24",
    week: 1,
    weekday: 4,
    card,
  });
  assert.equal(advice.mode, "recover");
  assert.match(advice.body, /不跳周/);
});

test("speaking gap of three Thursdays surfaces subject recovery", () => {
  const checks = {
    "2026-09-10": "absent",
    "2026-09-11": "full",
    "2026-09-14": "full",
    "2026-09-15": "full",
    "2026-09-16": "full",
    "2026-09-17": "absent",
    "2026-09-18": "full",
    "2026-09-21": "full",
    "2026-09-22": "full",
    "2026-09-23": "full",
    "2026-09-24": "absent",
    "2026-09-25": "full",
  };
  assert.equal(consecutiveSubjectMisses(checks, "2026-09-28", "speaking"), 3);
  const card = tonight({ week: 2, weekday: 1 });
  const advice = tonightAdvice({
    checks,
    vocab: Array.from({ length: 40 }, (_, i) => ({ week: 2, word: String(i) })),
    today: "2026-09-28",
    week: 2,
    weekday: 1,
    card,
  });
  assert.equal(advice.mode, "subject");
});

test("Friday advice is review-only", () => {
  const card = tonight({ week: 1, weekday: 5 });
  const advice = tonightAdvice({
    checks: { "2026-09-24": "full" },
    vocab: [],
    today: "2026-09-25",
    week: 1,
    weekday: 5,
    card,
  });
  assert.equal(advice.mode, "friday");
});

test("restart keeps vocab and history except the study date", () => {
  const next = restartProgress({
    studyDate: "2026-09-22",
    manualWeek: 4,
    bookOverride: 18,
    testOverride: 2,
    checks: { "2026-09-21": "full", "2026-09-22": "floor" },
    vocab: [{ word: "pivotal" }],
  });
  assert.equal(next.manualWeek, 1);
  assert.equal(next.bookOverride, null);
  assert.equal(next.checks["2026-09-21"], "full");
  assert.equal(next.checks["2026-09-22"], undefined);
  assert.equal(next.vocab.length, 1);
});

test("mondayToFriday returns the containing work week", () => {
  assert.deepEqual(mondayToFriday("2026-09-23"), [
    "2026-09-21",
    "2026-09-22",
    "2026-09-23",
    "2026-09-24",
    "2026-09-25",
  ]);
});
