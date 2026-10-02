# The Break 5

Desktop app for running the company: tasks, projects, contacts, meeting notes and a shared file hub, for a team of 2–5 people in one office. The interface is in Dutch.

## How it works

```
 Office desktop (HOST, always on)             Colleagues' PCs (CLIENTS)
 ┌──────────────────────────────┐             ┌──────────────────┐
 │ The Break 5                  │◄────LAN─────┤ The Break 5      │
 │  ├ database (thebreak5.db)   │  port 4750  └──────────────────┘
 │  ├ Bestanden/  (shared files)│             ┌──────────────────┐
 │  ├ Prullenbak/ (trash)       │◄────LAN─────┤ The Break 5      │
 │  └ daily backups             │             └──────────────────┘
 └──────────────────────────────┘
```

- One PC is the **host**. It stores everything and must be on while people work. Closing the window keeps it running in the system tray.
- Every other PC installs the same `.exe` and picks **"Verbinden met de host"**. The host is found automatically on the network; otherwise type its address, shown on the host under *Instellingen → Verbinding*.
- Everyone has their own login. The first account (created on the host) is the admin, who adds colleagues under *Instellingen → Team*.
- Changes show up live on every PC.

## ⬇️ Download

### **[Download The Break 5 for Windows (newest version)](https://github.com/matissewvg-web/main-2/releases/latest/download/The-Break-5-Setup.exe)**

- Direct link to the installer, always the newest version: `https://github.com/matissewvg-web/main-2/releases/latest/download/The-Break-5-Setup.exe`
- Portable version (no install): `https://github.com/matissewvg-web/main-2/releases/latest/download/The-Break-5-Portable.exe`
- All versions: [Releases](https://github.com/matissewvg-web/main-2/releases)
- Inside the app: *Instellingen → Over The Break 5 → Download .exe*

Every push is built on a Windows machine by GitHub Actions (`.github/workflows/build-windows.yml`) and published as a new release automatically. **To update:** run the new Setup over the old one. Your data stays where it is.

**Windows will warn "Windows protected your PC"** because the app isn't code-signed (a certificate costs roughly €200–400/year). Click *More info → Run anyway*.

## Installing in the office

1. **Host PC first.** Install, choose *Dit is de host-pc*, keep the default data folder, and click *Host starten*.
   - When Windows Firewall asks, allow access on **private networks**. Otherwise colleagues can't connect.
   - Create your admin account.
   - In *Instellingen*:
     - Tick **start with Windows**.
     - Set the **backup folder to another disk** (USB drive, NAS or OneDrive folder).
     - Add your colleagues.
2. **Other PCs.** Install, choose *Verbinden met de host*, pick the host from the list and log in.

The office network must be set to *Private* in Windows on the host. On a *Public* network, Windows blocks incoming connections.

## Features

| Module | What it does |
|---|---|
| **Vandaag** | Your focus list, overdue and upcoming deadlines, who's doing what, "Aandacht nodig" (low stock, overdue payments, fundraising steps), activity |
| **Overzicht** | **Everything in one table**: tasks, projects, documents, meetings, brainstorms and fundraising, with **creation date and creator, deadline, who's working on it**, status, priority and last change. Filter by type, person, open/done and deadline window. Sort, group by type, person or deadline. Export to CSV |
| **Kalender** | Month view of deadlines, meetings, brainstorms, payments and fundraising steps |
| **Vergaderingen** | Rich-text notes, attendees, autosave, "Maak taak" from a line, comments, print/PDF |
| **Document Hub** | **Documenten:** write procedures, proposals, plans and handbooks in the app, from templates, with status (concept / review / final), deadline, owners, categories, pinning, comments and print/PDF. **Bestanden:** shared files as folder bubbles and file cards |
| **Taken** | Board, priority board, per-person board and list. Several people per task, **checklist / subtasks**, **recurring tasks** (daily up to yearly; the next one appears when you tick it off), comments, tags |
| **Voorraad** | Products, prices, suppliers, minimum stock, logged stock movements with undo, CSV import and export |
| **Brainstorm** | Live sticky-note board: everyone adds ideas, votes, drag between Ideas / Interesting / Chosen / Parked, timer, idea → task or project in one click |
| **Projecten** | Owner + **team members**, client, deadline, progress, linked folder, meetings, task board, comments |
| **Contacten** | People and companies with linked work, comments, **CSV import** |
| **Fundraising** | Rounds with target and deadline, investor pipeline (Lead → Contact → Pitch → Due diligence → Committed → Received), asked/committed/received amounts, next steps with dates, progress bar, CSV |
| **Financiën** | Income and expenses, VAT, open/paid, receipt upload, monthly chart, categories, CSV |
| **Investeringen** | Purchases, sales, dividends, manual valuations, return %, value over time |
| **Meldingen** 🔔 | You get notified when someone assigns you, **@mentions** you, or comments on your work. Plus your own overdue and today deadlines. Windows notifications while the app is in the background |
| **+ Nieuw** | Create a task, document, meeting, project, brainstorm, contact, product or (with access) a transaction or investor from anywhere |
| **Zoeken** | `Ctrl+K` across everything |
| **Tags** | Anyone creates tags inline; admins manage them |
| **Back-ups** | Database and files, daily, last 14 kept |

**Who sees money:** Financiën and Investeringen are visible to admins only, plus members an admin explicitly allows (*Instellingen → Team → Bewerken → Financiën & investeringen*). The server enforces this, not just the menu. Inventory is visible to everyone.

**Opening files from a colleague's PC:** the file is downloaded to a temp folder and opened in Word, Excel or whatever program handles it. When you **save**, the change is uploaded back to the host automatically and you get a notification.

## Known limitations (read these)

- **The host must be on.** If it's off, nobody can work. There is no offline mode.
- **Office network only.** Working from home needs a VPN to the office network. That's not part of this app.
- **Two people editing the same file or meeting note at the same time:** the last save wins. There is no real-time co-editing or merge.
- **No encryption on the network (plain HTTP).** This is fine on your own office LAN. **Never** forward port 4750 to the internet.
- **Unsigned .exe**, so Windows shows a warning (see above).
- Not tested on a real Windows network yet. Expect firewall or network settings to need a tweak on day one.

## Not included (on purpose)

- **Bookkeeping.** No ledger, no VAT returns, no bank import. Export CSV and hand it to your accountant.
- **Live prices** for investments. You enter valuations yourself.
- **Inventory linked to sales.** Selling something doesn't automatically book stock out or create income. You do both.

## Development

```bash
npm install
npm run build            # build the interface into dist/
npm run server           # host server without the window, at http://localhost:4750
npm run dev              # interface with hot reload (talks to `npm run server`)
npm start                # run the desktop app
npm run dist:win         # build the .exe (on Windows)
```

- **Requirements:** Node 22.5+. The database uses Node's built-in `node:sqlite`, so there are no native modules to compile.
- **Code layout:**
  - `electron/`: window, tray, host/client config, network discovery, opening and syncing files.
  - `server/`: Express API, SQLite schema/migrations, file hub, backups.
  - `src/`: React interface.
