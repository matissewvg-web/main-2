# Studyover

Exams, study hours and study material for an accounting student at KdG Antwerpen, in one place. It is a sibling of Carryover and stands apart from The Break 5; it just lives in the same repo.

## Where it runs

| Device | How | Data |
|---|---|---|
| **iPhone / iPad** | Open https://claude.ai/artifact/8GGFXkQTni7anqstyLqNBf in Safari, tap **Share → Add to Home Screen**, sign in to claude.ai once | Synced to your claude.ai account |
| **Windows** | Install [Studyover-Setup.exe](https://github.com/matissewvg-web/main-2/releases/download/studyover/Studyover-Setup.exe), sign in to claude.ai once | Synced to your claude.ai account |
| **Any browser** | Same link as the iPhone | Synced to your claude.ai account |
| **Offline file** | Open `web/index.html` directly | This browser only, no sync |

Your claude.ai login is the sign-in: every device with the same account sees the same tests, sessions, tags and study material.

## What's in it

- **One + button** opens Test, Study session, Results, Study material, Study plan, Subject goal and Tags.
- **Results**: pick a subject to see all its past tests with score and percentage (green at or above your goal, red under it), the average against your goal, and *+ Score* for tests without one. *Add a result* adds a test that is not in Studyover yet together with its score in one step (type, date of today or earlier, score out of 10/20/50/100, optional note). Each subject card has a *Results* button that opens this for that subject.
- **Study plan**: a week view with study blocks per day (subject, hours, what to study, which test). *Done, log it* turns a block into a study session; missed blocks can move to today. *Plan for me* spreads the hours each test still needs (its study goal minus hours done and already planned) over the 4 weeks before it, in blocks of 1 to 3 hours, within the hours you can study per weekday. Running it again only adds what is still missing.
- **Which subjects need work**: per subject your results (score out of 10, 20, 50 or 100) against the percentage you want (your goal, or the 50% pass mark), an estimate from your confidence when there are no results yet, and hours done + planned for the next test. Subjects are ranked: *Needs work* first, then *Watch*, *On target*. Past tests without a result get an *+ Result* button.
- **Calendar**: a month grid with each test on its due date in its subject colour (high priority glows red) and a dot on days you studied. Tap a day for what's due and to add a test on that date; with no day picked it lists everything due that month. Swipe or use the arrows to change month.
- **Tests** have a subject, exam type, priority (high, medium, low), your own tags, a study goal in hours, notes and attached files.
- **Study sessions** have hours, subject, tags, topics, confidence and the files you studied.
- **Study material** opens inside the app. PowerPoint shows real slides (shapes, colours, charts, tables, pictures) one at a time with arrows, swipe, arrow keys and thumbnails, or all slides in a row, with the speaker notes under each slide. Word shows real pages with headers, tables, bullets and zoom. Excel shows every sheet, PDF every page, plus photos, text and video. Up to 50 MB per file. While a file is open, a timer runs; *Log this session* turns it into a study session with that file attached. *Save a copy* gives you the original to open in Word or PowerPoint.
- Old formats (.doc, .ppt, .xls), Pages and Keynote don't open; save them as .docx/.pptx/.xlsx or PDF first.

## How "on track" is worked out

Each test has a study goal (defaults: midterm 12 h, final 25 h, quiz 4 h). Hours logged for that subject in the 28 days before the exam count toward it. The white tick on the bar is where you should be by today if you spread the goal evenly over those 28 days: at least 90% of that is *On track*, 50–90% is *Behind*, below 50% is *Way behind*.

## Files

- `app.html`: the app (published as the claude.ai artifact above). Edit this, then republish it.
- `web/index.html`: the same page wrapped as a standalone file. Without claude.ai it saves to the browser (localStorage and IndexedDB).
- `desktop/`: the Windows app, an Electron window that opens the artifact link. `npm start` runs it locally.
- `../.github/workflows/studyover-windows.yml`: builds the `.exe` on every push that touches `desktop/` and refreshes the `studyover` release.

## How "needs work" is worked out

A subject is *Needs work* when your average result is more than 5% under your goal (or the pass mark if you set none), or when you are way behind on study hours for its next test. It is *Watch* when it is within 5% of the goal or behind on hours. Without results, your average confidence over the last 3 sessions (out of 10, times 10) stands in as an estimate, and the bar shows it hatched.

## How files are stored

Synced files go to the artifact's file storage. PDFs, images and video are stored as they are. Word, PowerPoint and Excel are not a type that storage accepts, so they are stored as base64 text in pieces of up to 12 MB and put back together when opened. The reader loads its viewers from jsDelivr (@aiden0z/pptx-renderer for slides, docx-preview for Word, pdf.js, SheetJS, JSZip; mammoth as a text-only fallback) the first time you open that kind of file, so opening documents needs an internet connection.
