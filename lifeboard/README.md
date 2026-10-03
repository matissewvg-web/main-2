# Lifeboard

One board for an accounting student's day: tasks, agenda, study, the skill of the day, budget and a status card for The Break 5. The interface is in Dutch. Studyover, Carryover and Skillday are merged into it; it stands apart from The Break 5 app and just lives in the same repo.

## Where it runs

| Device | How | Data |
|---|---|---|
| **iPhone / iPad** | Open https://claude.ai/artifact/5RKFUnNpmWDS8bX7gQPrpR in Safari, tap **Share → Add to Home Screen**, sign in to claude.ai once | Your claude.ai account |
| **Windows** | Install [Lifeboard-Setup.exe](https://github.com/matissewvg-web/main-2/releases/download/lifeboard/Lifeboard-Setup.exe), sign in to claude.ai once | Your claude.ai account |
| **Any browser** | Same link as the iPhone | Your claude.ai account |

Everything is stored in the artifact's database and file storage, readable and writable only by the owner. It needs an internet connection; there is no offline mode.

## What's in it

| Tab | What it does | Came from |
|---|---|---|
| **Vandaag** | Daily mission, today's list with carried-over items, the next 7 days, skill of the day, next tests with readiness, budget, The Break 5 status | Lifeboard, Skillday |
| **Agenda** | Month or list view of appointments, tasks, study blocks, deadlines, tests and exams | Lifeboard, Studyover calendar |
| **Taken** | Lists, priorities, carried-over tasks, and tasks that repeat daily or weekly | Lifeboard, Carryover |
| **Studie** | Courses with hour goals, tests (quiz, midterm, exam) with a readiness bar, planned blocks, logged sessions with topics and a 1–10 confidence score, study material with an in-app reader | Lifeboard, Studyover |
| **Skill** | Four blind cards a day, XP and levels, streak, heatmap, per-category stats, log | Skillday |
| **Budget** | Monthly plan, categories, spending pace | Lifeboard |

### Test readiness

Each test has a goal in hours (defaults: quiz 4, midterm 12, exam 25). Study minutes logged for that course in the 28 days before the test count toward it. The tick on the bar is where an even pace over those 28 days puts you today: at least 90% of that is *Op schema*, 50–90% is *Achter*, below 50% is *Ver achter*.

### Study material

Word (.docx), PowerPoint (.pptx, with speaker notes), Excel (.xlsx), PDF, images, text and video, up to 50 MB each. PDFs, images and video are stored as they are; Office files are stored as base64 text in 12 MB pieces because the file store does not accept them. The reader loads pdf.js, mammoth, JSZip and SheetJS from jsDelivr the first time you open that kind of file. A timer runs while a file is open; *Log deze sessie* turns it into a logged session with that file attached.

### The Break 5 card

You fill it in by hand. The Break 5 app runs only on the office network over plain HTTP, so a claude.ai page cannot read it.

## Files

- `app.html`: the page published as the artifact above. Edit this, then republish it to the same URL.
- `desktop/`: the Windows app, an Electron window that opens the artifact link. `npm start` runs it locally.
- `../.github/workflows/lifeboard-windows.yml`: builds the `.exe` on every push that touches `desktop/` and refreshes the `lifeboard` release.

## Data moved in on 2026-10-03

- Studyover: 1 test, 1 session and 2 study files (the files were copied into Lifeboard's file storage).
- Carryover: all 9 tasks and the Minecraft tag, which became a list.
- Skillday: the one played day.

The old artifacts still hold their copies. Anything added there after the move does not show up in Lifeboard.
