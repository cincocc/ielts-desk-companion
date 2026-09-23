/** 整体学习方案。改书目、科目、时长时只动这份配置。执行记录在 localStorage。 */
export const STUDY_PLAN = {
  version: "2026-09-v1",

  goal: {
    score: 6.5,
    sectionScore: 6.0,
    type: "Academic",
  },

  weekdays: [
    { weekday: 1, subject: "listening", method: "手机听力 App" },
    { weekday: 2, subject: "reading", method: "纸质书" },
    { weekday: 3, subject: "writing", method: "纸笔" },
    { weekday: 4, subject: "speaking", method: "手机录音 / 口语 App" },
    { weekday: 5, subject: "review", method: "词汇本 + 纸笔" },
  ],

  weeks: [
    { week: 1, book: 16, test: 1, role: "main", focus: "限时主练" },
    { week: 2, book: 16, test: 2, role: "main", focus: "限时主练" },
    { week: 3, book: 16, test: 3, role: "main", focus: "限时主练" },
    { week: 4, book: 16, test: 4, role: "main", focus: "限时主练" },
    { week: 5, book: 17, test: 1, role: "main", focus: "限时主练" },
    { week: 6, book: 17, test: 2, role: "main", focus: "限时主练" },
    { week: 7, book: 17, test: 3, role: "main", focus: "限时主练" },
    { week: 8, book: 17, test: 4, role: "main", focus: "限时主练" },
    { week: 9, book: 18, test: 1, role: "main", focus: "收紧计时" },
    { week: 10, book: 18, test: 2, role: "main", focus: "收紧计时" },
    { week: 11, book: 20, test: 1, role: "mock", focus: "封存模考" },
    { week: 12, book: 21, test: 1, role: "mock", focus: "封存模考" },
  ],

  extraPool: [
    ...flattenBooks([11, 12, 13, 14, 15], [1, 2, 3, 4]),
    { book: 18, test: 3 },
    { book: 18, test: 4 },
    ...flattenBooks([19], [1, 2, 3, 4]),
  ],

  rules: {
    maxNewWordsPerDay: 10,
    fridayNewWords: 0,
    weeklyVocabTarget: 40,
    minimumStudyMinutes: 25,
    fullStudyMinutes: 60,
    sealedFromWeek: 11,
    missNudge: 2,
    recoverNudge: 3,
    subjectGapRecover: 3,
    totalWeeks: 12,
  },
};

function flattenBooks(books, tests) {
  const items = [];
  for (const book of books) {
    for (const test of tests) items.push({ book, test });
  }
  return items;
}
