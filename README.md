# 🐧 WaddleTracker

**Local-first developer activity tracking for Visual Studio Code.**

WaddleTracker is a privacy-focused developer activity tracker built directly into VS Code. It measures active coding time and the development context around it — projects, files, languages, workspaces, remote environments, and coding sessions — while keeping the collected data local and useful without requiring an account, cloud service, or external backend.

The goal is not simply to measure how long VS Code has been open. WaddleTracker reacts to actual editor activity, detects idle periods, groups work into coding sessions, and builds a more useful picture of how development time is spent.

> **Status:** WaddleTracker is currently under active development.

---

## Features

### Available

#### Activity tracking

- Active coding-time tracking
- Configurable idle detection
- Automatic pause when idle
- Automatic resume when activity returns
- Project and workspace detection
- File tracking
- Language tracking
- VS Code Remote environment awareness
- Persistent local statistics

#### Coding sessions

- Automatic coding-session creation
- Session lifecycle management
- Automatic session closure after idle periods
- Session recovery after interrupted extension shutdowns
- Grouped session history by date
- Session duration and start/end information
- Per-session language tracking
- Per-session file tracking
- Language and file breakdowns for individual sessions
- Direct file opening from session history

#### Statistics

- Today statistics
- Last 7 days statistics
- Last 30 days statistics
- All-time statistics
- Total coding time
- Active-day counts
- Daily coding average
- Best coding day
- Current coding streak
- Longest coding streak
- Daily activity charts
- Project activity breakdowns
- Language activity breakdowns
- File activity breakdowns
- 365-day contribution-style activity heatmap

#### VS Code interface

- Dedicated WaddleTracker Activity Bar container
- Live Current Activity dashboard
- Current project card
- Active/idle status
- Current-session timer
- Today's coding time
- Current language
- Session History Tree View
- Statistics Dashboard
- Responsive VS Code-native card layouts
- Configurable status bar timer
- Native VS Code Settings integration
- Manual statistics refresh

#### Storage

- Local JSON persistence
- Versioned tracker-state schema
- Automatic storage migrations
- Abstract storage-provider architecture

### Planned

- Project, file, and language exclusion rules
- Privacy controls for tracked paths and project names
- Configurable data retention
- SQLite local storage
- Data export
- Data import
- Optional synchronization
- Self-hosted WaddleTracker API
- Multi-device statistics
- PostgreSQL-backed remote storage
- MySQL-backed remote storage
- Companion web application
- Deeper cross-device analytics
- Optional public developer statistics and portfolio integrations

---

## Local-first by design

WaddleTracker is designed to remain useful without an external service.

```text
VS Code
   │
   ▼
WaddleTracker
   │
   ▼
Local Storage
```

Tracking data stays local by default.

No account, hosted service, or subscription is required for the core tracking experience.

Future synchronization will remain optional and separated from the local tracker:

```text
VS Code
   │
   ▼
WaddleTracker
   │
   ├── Local Storage
   │
   └── Optional HTTPS Sync
            │
            ▼
      WaddleTracker API
            │
            ▼
   PostgreSQL / MySQL
```

The VS Code extension will not connect directly to a remote database or require database credentials.

---

## Activity tracking

WaddleTracker does not treat the entire time VS Code is open as development time.

Instead, editor activity determines whether the developer is considered active.

Activity signals currently include:

- Editing a document
- Changing the active editor
- Moving the editor selection
- Saving a document
- Opening a document

The tracking lifecycle is approximately:

```text
Editor activity
      │
      ▼
Activity detected
      │
      ▼
Coding session active
      │
      ▼
Active time accumulated
      │
      ▼
Idle timeout reached
      │
      ▼
Session closed
      │
      ▼
Tracking paused
      │
      ▼
New activity
      │
      ▼
New session created
```

The default idle timeout is **5 minutes** and can be changed through the native WaddleTracker settings.

---

## Context tracking

WaddleTracker associates tracked time with development context rather than storing only a single timer.

Currently tracked context includes:

```text
Activity
├── Workspace
├── Project
├── File
├── Language
└── Remote environment
```

This context is aggregated into daily statistics:

```text
Today
├── Projects
│   ├── WaddleTracker
│   └── ka0s.dev
│
├── Languages
│   ├── TypeScript
│   ├── JSON
│   └── Markdown
│
└── Files
    ├── ActivityTracker.ts
    ├── SessionManager.ts
    └── README.md
```

It is also recorded against individual coding sessions:

```text
Coding Session
├── Project
├── Workspace
├── Remote environment
├── Active time
├── Languages
│   ├── TypeScript
│   └── JSON
└── Files
    ├── ActivityTracker.ts
    └── SessionManager.ts
```

This allows WaddleTracker to answer both:

```text
How did I spend my time today?
```

and:

```text
What did I work on during this specific session?
```

---

## Current Activity

WaddleTracker provides a compact live dashboard directly in the Activity Bar.

```text
┌─────────────────────────────────┐
│ PROJECT                         │
│ WaddleTracker                   │
└─────────────────────────────────┘

┌───────────────┐ ┌───────────────┐
│ STATUS        │ │ CURRENT       │
│ Active        │ │ SESSION       │
│               │ │ 24m 18s       │
└───────────────┘ └───────────────┘

┌───────────────┐ ┌───────────────┐
│ TODAY         │ │ LANGUAGE      │
│ 2h 47m        │ │ TypeScript    │
└───────────────┘ └───────────────┘
```

The view updates while coding without rebuilding the complete Webview.

---

## Session History

Coding sessions are grouped chronologically by date:

```text
SESSION HISTORY

▼ Today
    ▸ WaddleTracker          58m
    ▸ ka0s.dev               25m

▼ Yesterday
    ▸ RelioMap             1h 12m
```

Sessions recorded with the current storage schema can be expanded further:

```text
▼ WaddleTracker              58m
    ▼ Languages
        TypeScript       46m • 79%
        JSON              8m • 14%
        Markdown          4m • 7%

    ▼ Files
        ActivityTracker.ts    24m • 41%
        SessionManager.ts     18m • 31%
        package.json           8m • 14%
```

Tracked files can be opened directly from the Session History view.

Older sessions created before detailed session dimensions were introduced remain available but naturally cannot contain file/language history that was not originally recorded.

---

## Statistics Dashboard

The Statistics Dashboard provides historical analytics directly inside VS Code.

Available ranges:

```text
Today
7 Days
30 Days
All
```

The summary includes:

```text
┌───────────────┐ ┌───────────────┐
│ CODING TIME   │ │ ACTIVE DAYS   │
│ 3h 42m        │ │ 2             │
└───────────────┘ └───────────────┘

┌───────────────┐ ┌───────────────┐
│ DAILY AVERAGE │ │ BEST DAY      │
│ 1h 51m        │ │ 2h 34m        │
└───────────────┘ └───────────────┘

┌───────────────┐ ┌───────────────┐
│ CURRENT       │ │ LONGEST       │
│ STREAK        │ │ STREAK        │
│ 2 days        │ │ 5 days        │
└───────────────┘ └───────────────┘
```

The dashboard also provides:

- Daily activity visualization
- Project breakdowns
- Language breakdowns
- File breakdowns
- Percentage distribution
- Clickable tracked files
- Current streak
- Longest streak
- Best coding day
- 365-day coding activity heatmap
- Hover details
- Persistent range and breakdown selections

The heatmap intentionally represents the latest **365 days**, independently of the currently selected statistics range.

---

## Configuration

WaddleTracker integrates with the native VS Code Settings interface.

Open the Command Palette:

```text
Ctrl + Shift + P
```

and run:

```text
WaddleTracker: Open Settings
```

### Idle Timeout

Controls how long WaddleTracker continues considering the developer active after the last editor interaction.

Default:

```text
5 minutes
```

Valid range:

```text
1–60 minutes
```

### Status Bar

The WaddleTracker status bar indicator can be enabled or disabled.

Available display modes are:

```text
today
project
session
```

#### Today

Displays today's tracked coding time:

```text
◷ 1:24:18
```

#### Project

Displays today's tracked time together with the current project:

```text
◷ 1:24:18 • waddletracker
```

#### Session

Displays active coding time for the current coding session.

---

## Commands

WaddleTracker currently contributes:

```text
WaddleTracker: Show Status
WaddleTracker: Open Settings
WaddleTracker: Refresh
```

The refresh command updates:

```text
Current Activity
Session History
Statistics Dashboard
```

Commands can be accessed through the Command Palette, while refresh and settings controls are also exposed in the WaddleTracker views.

---

## Storage

WaddleTracker currently uses local JSON persistence stored inside VS Code's extension-specific global storage directory.

The tracker state contains:

```text
TrackerState
├── Daily statistics
│   ├── Active time
│   ├── Projects
│   ├── Languages
│   └── Files
│
└── Coding sessions
    ├── Session metadata
    ├── Active time
    ├── Languages
    └── Files
```

The storage layer is abstracted behind a provider interface:

```text
ActivityTracker
      │
      ▼
StorageProvider
      │
      ├── JsonStorageProvider
      ├── SQLite          planned
      ├── API             planned
      └── Future providers
```

Storage schemas are versioned and migrated automatically as WaddleTracker evolves.

This allows the tracker to move from JSON to SQLite later without coupling the tracking engine to one persistence format.

Optional remote storage will eventually be handled through a WaddleTracker API rather than through direct database access from the extension.

---

## Architecture

WaddleTracker separates activity detection, session management, statistics, persistence, and presentation.

```text
VS Code Extension Host
        │
        ├── Editor events
        │
        ▼
 ActivityTracker
        │
        ├── ContextResolver
        │
        ├── Idle detection
        │
        ├── Daily aggregation
        │
        └── SessionManager
        │
        ▼
   TrackerState
        │
        ▼
 StorageProvider
        │
        ▼
 JsonStorageProvider
```

Statistics are derived separately:

```text
TrackerState
     │
     ▼
StatisticsService
     │
     ├── Time ranges
     ├── Active days
     ├── Daily averages
     ├── Best day
     ├── Streaks
     ├── Projects
     ├── Languages
     ├── Files
     └── Daily activity
```

The user interface is split according to purpose:

```text
WaddleTracker Activity Bar
        │
        ├── Current Activity
        │   └── Live Webview
        │
        ├── Session History
        │   └── Native Tree View
        │
        └── Statistics Dashboard
            └── Analytics Webview
```

This keeps live state, chronological session data, and aggregate analytics separate.

---

## Project structure

```text
waddletracker/
├── .vscode/
│   ├── launch.json
│   └── tasks.json
│
├── resources/
│   └── waddletracker.svg
│
├── src/
│   ├── sessions/
│   │   ├── SessionHistoryService.ts
│   │   └── SessionHistoryTypes.ts
│   │
│   ├── statistics/
│   │   ├── StatisticsService.ts
│   │   └── StatisticsTypes.ts
│   │
│   ├── storage/
│   │   ├── JsonStorageProvider.ts
│   │   └── StorageProvider.ts
│   │
│   ├── tracking/
│   │   ├── ActivityTracker.ts
│   │   ├── ContextResolver.ts
│   │   └── SessionManager.ts
│   │
│   ├── types/
│   │   ├── ActivityContext.ts
│   │   ├── CodingSession.ts
│   │   └── TrackerState.ts
│   │
│   ├── ui/
│   │   ├── CurrentActivityProvider.ts
│   │   ├── SessionHistoryTreeProvider.ts
│   │   ├── StatisticsDashboardProvider.ts
│   │   └── StatusBarController.ts
│   │
│   ├── utils/
│   │   └── formatters.ts
│   │
│   └── extension.ts
│
├── .gitignore
├── LICENSE
├── README.md
├── esbuild.js
├── package.json
├── package-lock.json
└── tsconfig.json
```

The architecture intentionally keeps tracking, session management, statistics, storage, types, and UI independent so each can evolve without tightly coupling the rest of the extension.

---

## Development

### Requirements

- Node.js
- npm
- Visual Studio Code

Clone the repository:

```bash
git clone https://github.com/ka0sdev/waddletracker.git
cd waddletracker
```

Install dependencies:

```bash
npm install
```

Run TypeScript checks:

```bash
npm run check
```

Build the extension:

```bash
npm run compile
```

### Run inside VS Code

Open the repository in VS Code and press:

```text
F5
```

Select:

```text
Run WaddleTracker
```

VS Code will launch an **Extension Development Host** containing the development build of WaddleTracker.

---

## Development scripts

### Type checking

```bash
npm run check
```

Runs TypeScript type checking without producing output files.

### Build

```bash
npm run compile
```

Builds the extension with esbuild.

### Watch

```bash
npm run watch
```

Runs esbuild in watch mode during development.

---

## Privacy

WaddleTracker is built around a local-first model.

The core extension does not require:

- An account
- A hosted backend
- A subscription
- Remote storage
- Direct database access

WaddleTracker tracks development metadata rather than source-code contents.

Tracked metadata can currently include:

- Workspace names
- Project names
- File paths
- Language identifiers
- Session timestamps
- Active coding durations
- Remote environment names

Because file paths and project names can themselves contain sensitive information, additional privacy controls are an important part of the roadmap.

Planned controls include:

- Ignored projects
- Ignored files
- Ignored directories
- Path patterns
- Language exclusions
- Configurable data retention
- Synchronization controls

Any future synchronization will remain optional.

---

## Roadmap

### Foundation

- [x] VS Code extension foundation
- [x] TypeScript
- [x] esbuild
- [x] Local persistence
- [x] Activity detection
- [x] Idle detection
- [x] Status bar integration
- [x] Native configuration
- [x] Project tracking
- [x] Workspace tracking
- [x] File tracking
- [x] Language tracking
- [x] Remote environment awareness
- [x] Storage schema migrations

### Sessions

- [x] Coding-session model
- [x] Session lifecycle management
- [x] Session persistence
- [x] Idle-based session boundaries
- [x] Session recovery
- [x] Session history
- [x] Date-grouped session history
- [x] Per-session language tracking
- [x] Per-session file tracking
- [x] Session language breakdowns
- [x] Session file breakdowns
- [x] Open tracked files from session history

### Statistics

- [x] Daily statistics
- [x] 7-day statistics
- [x] 30-day statistics
- [x] All-time statistics
- [x] Active-day counts
- [x] Daily averages
- [x] Best-day statistics
- [x] Project breakdowns
- [x] Language breakdowns
- [x] File breakdowns
- [x] Daily activity chart
- [x] Current coding streak
- [x] Longest coding streak
- [x] 365-day activity heatmap

### Interface

- [x] WaddleTracker Activity Bar container
- [x] Current Activity Webview
- [x] Current project display
- [x] Active/idle status display
- [x] Current-session display
- [x] Current-language display
- [x] Session History Tree View
- [x] Statistics Dashboard
- [x] Responsive statistics cards
- [x] Dashboard range selector
- [x] Project/language/file breakdown tabs
- [x] Dashboard tooltips
- [x] Clickable tracked files

### Privacy

- [ ] Ignore projects
- [ ] Ignore files and directories
- [ ] Ignore path patterns
- [ ] Language exclusions
- [ ] Configurable data retention
- [ ] Additional path privacy controls

### Storage & Sync

- [ ] SQLite local storage
- [ ] Data export
- [ ] Data import
- [ ] WaddleTracker API
- [ ] Optional synchronization
- [ ] Multi-device statistics
- [ ] PostgreSQL remote storage
- [ ] MySQL remote storage

### Extended platform

- [ ] Companion web application
- [ ] Cross-device analytics
- [ ] Optional public developer profiles
- [ ] Portfolio integrations

---

## Technology

WaddleTracker is currently built with:

- TypeScript
- VS Code Extension API
- Node.js
- esbuild

The extension intentionally avoids requiring a frontend framework for its VS Code Webviews.

---

## Contributing

WaddleTracker is under active development and its architecture is still evolving.

Issues, suggestions, bug reports, and contributions are welcome.

Before submitting changes, verify:

```bash
npm run check
npm run compile
```

---

## License

WaddleTracker is licensed under the **MIT License**.
