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

## Getting the .exe

The Windows build runs on GitHub Actions (`.github/workflows/build-windows.yml`) on every push:

1. Open the repo on GitHub, go to **Actions** and click **Build Windows app**, then open the latest green run.
2. Download the artifact **The-Break-5-Windows** (a zip) and extract it. It contains:
   - `The-Break-5-Setup-x.y.z.exe`, the installer (recommended).
   - `The-Break-5-Portable-x.y.z.exe`, which runs without installing.

Pushing a tag like `v0.1.0` also attaches both files to a GitHub Release.

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

## Features (phase 1)

| Module | What it does |
|---|---|
| **Vandaag** | Your focus list, overdue and upcoming deadlines, who's doing what, recent activity, quick-add |
| **Taken** | Kanban board (drag between columns) and list. Priority (Urgent/Hoog/Normaal/Laag), assignee, deadline, project, contact, tags |
| **Projecten** | Status, owner, client, deadline, progress bar, linked folder, meetings, own task board |
| **Contacten** | People and companies, linked projects, tasks and meetings |
| **Vergaderingen** | Rich-text notes (headings, lists, checklists, links), attendees, autosave, **select a line → "Maak taak"**, print/PDF |
| **Bestanden** | Folders are colored **bubbles** and files are **cards** with a type icon. Drag files or whole folders in from Explorer, drag items onto a bubble or breadcrumb to move them, search across all folders, and switch to list view. Deleting moves items to a trash folder on the host |
| **Zoeken** | `Ctrl+K` searches tasks, projects, contacts, meeting notes and file names |
| **Back-ups** | Database and all files, automatically once a day, keeping the last 14 |

**Opening files from a colleague's PC:** the file is downloaded to a temp folder and opened in Word, Excel or whatever program handles it. When you **save**, the change is uploaded back to the host automatically and you get a notification.

## Known limitations (read these)

- **The host must be on.** If it's off, nobody can work. There is no offline mode.
- **Office network only.** Working from home needs a VPN to the office network. That's not part of this app.
- **Two people editing the same file or meeting note at the same time:** the last save wins. There is no real-time co-editing or merge.
- **No encryption on the network (plain HTTP).** This is fine on your own office LAN. **Never** forward port 4750 to the internet.
- **Unsigned .exe**, so Windows shows a warning (see above).
- Not tested on a real Windows network yet. Expect firewall or network settings to need a tweak on day one.

## Roadmap

- **Phase 2:** inventory (stock, SKUs, low-stock alerts, suppliers), funds and expenditures, calendar view.
- **Phase 3:** investment tracker (manual prices).

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
