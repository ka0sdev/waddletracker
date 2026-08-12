# 🐧 WaddleTracker

**Local-first developer activity tracking for Visual Studio Code.**

WaddleTracker is a developer activity tracker built directly into VS Code. It measures active coding time and the context around it — projects, files, languages, workspaces, and coding sessions — while keeping local tracking useful without requiring an account, cloud service, or external backend.

The goal is not simply to measure how long VS Code has been open. WaddleTracker reacts to actual editor activity, detects idle periods, and builds a more accurate picture of how development time is spent.

> **Status:** WaddleTracker is currently in early development.

---

## Features

### Available

* Active coding-time tracking
* Configurable idle detection
* Automatic pause when idle
* Project and workspace detection
* File tracking
* Language tracking
* VS Code Remote environment awareness
* Persistent local statistics
* Status bar activity timer
* Configurable status bar display
* Native WaddleTracker settings inside VS Code
* Local storage schema migration support

### Planned

* Coding sessions and session history
* Daily, weekly, monthly, and all-time statistics
* Project activity breakdowns
* Language activity breakdowns
* File activity statistics
* Activity timelines
* Coding streaks
* Contribution-style activity heatmaps
* Dedicated WaddleTracker sidebar
* Advanced statistics dashboard
* SQLite local storage
* Data export and import
* Optional synchronization
* Self-hosted WaddleTracker API
* PostgreSQL and MySQL-backed remote storage
* Multi-device statistics

---

## Local-first by design

WaddleTracker is designed to work without an external service.

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

Future synchronization will be optional and separated from the core tracker:

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

The extension itself will not require direct database access or expose database credentials.

---

## Activity tracking

WaddleTracker does not count the entire time VS Code is running as development time.

Instead, editor activity is used to determine whether a developer is active.

Examples of activity signals include:

* Editing a document
* Changing the active editor
* Moving the editor selection
* Saving a document
* Opening a document

When no activity occurs for the configured idle period, WaddleTracker stops accumulating active time.

```text
Editor activity
      │
      ▼
Activity detected
      │
      ▼
Active time accumulated
      │
      ▼
Idle timeout reached
      │
      ▼
Tracking paused
      │
      ▼
New activity
      │
      ▼
Tracking resumes
```

The default idle timeout is **5 minutes** and can be changed through the WaddleTracker settings.

---

## Context tracking

WaddleTracker associates activity with development context rather than storing only a single timer.

Currently tracked context includes:

```text
Activity
├── Workspace
├── Project
├── File
├── Language
└── Remote environment
```

This forms the foundation for statistics such as:

```text
Today
├── TypeScript       2h 14m
├── JavaScript         48m
└── Markdown           17m

Projects
├── WaddleTracker    1h 32m
├── RelioMap           59m
└── ka0s.dev           48m
```

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

Current configuration includes:

### Idle Timeout

Controls how long WaddleTracker continues considering the developer active after the last editor interaction.

Default:

```text
5 minutes
```

### Status Bar

The WaddleTracker status bar indicator can be enabled or disabled.

The display mode can currently show:

* Today's tracked time
* Today's tracked time with the current project

Example:

```text
◷ 1:24:18
```

or:

```text
◷ 1:24:18 • waddletracker
```

---

## Commands

WaddleTracker currently contributes the following VS Code commands:

```text
WaddleTracker: Show Status
WaddleTracker: Open Settings
```

They can be accessed through the Command Palette.

---

## Storage

WaddleTracker currently uses local JSON persistence stored inside VS Code's extension-specific global storage directory.

The storage layer is abstracted behind a provider interface:

```text
ActivityTracker
      │
      ▼
StorageProvider
      │
      ├── JSON
      ├── SQLite
      ├── API
      └── Future providers
```

This allows WaddleTracker to move from JSON to SQLite later without coupling the tracking engine to a specific storage implementation.

Remote database support will eventually be handled through a WaddleTracker API rather than connecting the VS Code extension directly to PostgreSQL or MySQL.

---

## Project structure

```text
waddletracker/
├── .vscode/
│   ├── launch.json
│   └── tasks.json
│
├── src/
│   ├── storage/
│   │   ├── JsonStorageProvider.ts
│   │   └── StorageProvider.ts
│   │
│   ├── tracking/
│   │   ├── ActivityTracker.ts
│   │   └── ContextResolver.ts
│   │
│   ├── types/
│   │   ├── ActivityContext.ts
│   │   └── TrackerState.ts
│   │
│   ├── ui/
│   │   └── StatusBarController.ts
│   │
│   └── extension.ts
│
├── esbuild.js
├── package.json
└── tsconfig.json
```

The architecture intentionally separates tracking, storage, data models, and UI so each part can evolve independently.

---

## Development

### Requirements

* Node.js
* npm
* Visual Studio Code

Clone the repository:

```bash
git clone https://github.com/ka0sdev/waddletracker.git
cd waddletracker
```

Install dependencies:

```bash
npm install
```

Run the TypeScript checks:

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

VS Code will launch an **Extension Development Host** with the development version of WaddleTracker loaded.

---

## Development scripts

```bash
npm run check
```

Runs TypeScript type checking without producing output files.

```bash
npm run compile
```

Builds the extension using esbuild.

```bash
npm run watch
```

Runs esbuild in watch mode during development.

---

## Architecture

WaddleTracker currently follows this general architecture:

```text
VS Code Extension Host
        │
        ├── VS Code Events
        │
        ▼
 ActivityTracker
        │
        ├── ContextResolver
        │
        ├── Idle Detection
        │
        └── Activity Aggregation
        │
        ▼
 StorageProvider
        │
        ▼
 Local Persistence
```

Future components will extend this with:

```text
ActivityTracker
      │
      ▼
SessionManager
      │
      ▼
Statistics
      │
      ├── Projects
      ├── Languages
      ├── Files
      ├── Sessions
      └── Historical activity
```

---

## Privacy

WaddleTracker is being designed around a local-first model.

The core extension does not require an account or external service to track development activity.

Features involving synchronization or remote storage will be optional and explicitly separated from local tracking.

Additional privacy controls are planned for:

* File-path tracking
* Project-name tracking
* Ignore patterns
* Language exclusions
* Data retention
* Synchronization

---

## Roadmap

### Foundation

* [x] VS Code extension foundation
* [x] TypeScript
* [x] esbuild
* [x] Local persistence
* [x] Activity detection
* [x] Idle detection
* [x] Status bar integration
* [x] Native configuration
* [x] Project tracking
* [x] File tracking
* [x] Language tracking

### Sessions

* [ ] Coding session model
* [ ] Session lifecycle management
* [ ] Session persistence
* [ ] Session history

### Statistics

* [ ] Daily statistics
* [ ] Weekly statistics
* [ ] Monthly statistics
* [ ] Project breakdowns
* [ ] Language breakdowns
* [ ] File breakdowns
* [ ] Coding streaks
* [ ] Activity heatmap

### Interface

* [ ] WaddleTracker Activity Bar container
* [ ] Sidebar overview
* [ ] Current session view
* [ ] Project statistics
* [ ] Language statistics
* [ ] Historical dashboard

### Storage & Sync

* [ ] SQLite local storage
* [ ] Export and import
* [ ] WaddleTracker API
* [ ] Optional account/device synchronization
* [ ] PostgreSQL support
* [ ] MySQL support

---

## Technology

WaddleTracker is currently built with:

* TypeScript
* VS Code Extension API
* Node.js
* esbuild

---

## Contributing

WaddleTracker is currently in early development and its architecture is still evolving.

Issues and suggestions are welcome as the project develops.

---

## License

WaddleTracker is intended to be released under the MIT License.
