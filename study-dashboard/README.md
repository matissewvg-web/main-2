# Study Dashboard

Exam countdown, study hours per subject and "am I on track?" bars for an accounting student at KdG Antwerpen. It stands apart from The Break 5; it just lives in the same repo.

## Where it runs

| Device | How | Data |
|---|---|---|
| **iPhone / iPad** | Open https://claude.ai/artifact/8GGFXkQTni7anqstyLqNBf in Safari, tap **Share → Add to Home Screen** | Synced to your claude.ai account |
| **Windows** | Install [Study-Dashboard-Setup.exe](https://github.com/matissewvg-web/main-2/releases/download/study-dashboard/Study-Dashboard-Setup.exe), sign in to claude.ai once | Synced to your claude.ai account |
| **Any browser** | Same link as the iPhone | Synced to your claude.ai account |
| **Offline file** | Open `web/index.html` directly | This browser only, no sync |

Your claude.ai login is the sign-in: every device that opens the dashboard with the same account sees the same tests and sessions. Each person's data is private to their own account, even if the link is shared.

## Files

- `app.html`: the dashboard (published as the claude.ai artifact above). Edit this, then republish it.
- `web/index.html`: the same page wrapped as a standalone file. Without claude.ai it saves to the browser (`localStorage`).
- `desktop/`: the Windows app, an Electron window that opens the dashboard link. `npm start` runs it locally.
- `../.github/workflows/study-dashboard-windows.yml`: builds the `.exe` on every push that touches `desktop/` and refreshes the `study-dashboard` release.

## How "on track" is worked out

Each test has a study goal in hours (defaults: midterm 12, final 25, quiz 4; editable per test). Hours logged for that subject in the 28 days before the exam count toward it. The bar's white tick shows where you should be by today if you spread the goal evenly over those 28 days: at or above 90% of that is *On track*, 50–90% is *Behind*, below 50% is *Way behind*.
