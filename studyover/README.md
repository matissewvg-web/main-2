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

- **One + button** opens Test, Study session, Study material and Tags.
- **Tests** have a subject, exam type, priority (high, medium, low), your own tags, a study goal in hours, notes and attached files.
- **Study sessions** have hours, subject, tags, topics, confidence and the files you studied.
- **Study material** opens inside the app: Word (.docx), PowerPoint (.pptx, with speaker notes), Excel (.xlsx, every sheet), PDF, photos, text and video. Up to 50 MB per file. While a file is open, a timer runs; *Log this session* turns it into a study session with that file attached. *Save a copy* gives you the original to open in Word or PowerPoint.
- Old formats (.doc, .ppt, .xls), Pages and Keynote don't open; save them as .docx/.pptx/.xlsx or PDF first.

## How "on track" is worked out

Each test has a study goal (defaults: midterm 12 h, final 25 h, quiz 4 h). Hours logged for that subject in the 28 days before the exam count toward it. The white tick on the bar is where you should be by today if you spread the goal evenly over those 28 days: at least 90% of that is *On track*, 50–90% is *Behind*, below 50% is *Way behind*.

## Files

- `app.html`: the app (published as the claude.ai artifact above). Edit this, then republish it.
- `web/index.html`: the same page wrapped as a standalone file. Without claude.ai it saves to the browser (localStorage and IndexedDB).
- `desktop/`: the Windows app, an Electron window that opens the artifact link. `npm start` runs it locally.
- `../.github/workflows/studyover-windows.yml`: builds the `.exe` on every push that touches `desktop/` and refreshes the `studyover` release.

## How files are stored

Synced files go to the artifact's file storage. PDFs, images and video are stored as they are. Word, PowerPoint and Excel are not a type that storage accepts, so they are stored as base64 text in pieces of up to 12 MB and put back together when opened. The reader loads pdf.js, mammoth, JSZip and SheetJS from jsDelivr the first time you open that kind of file, so opening documents needs an internet connection.
