# Beacon Product Requirements

## Problem and target user
Beacon is a Windows 10/11 desktop widget for people who need a visible, low-distraction anchor for focused work. It combines the glanceability of an iPhone Dynamic Island with a task list and Pomodoro timer, without cloud accounts or a full productivity app taking over the screen.

**Primary user:** a solo knowledge worker, student, or developer who manages work in short focus sessions and wants the current task always available.

## Goals / non-goals
**Goals:** make the current task and timer glanceable; make starting, pausing, and completing work take one click or hotkey; provide a useful local task list and lightweight focus history; feel native on Windows; stay quiet when idle.

**Non-goals:** cloud sync, login, collaboration, mobile/macOS support, a full calendar, deep website blocking, or replacing a project-management system.

## User stories
- As a user, I can add and organize tasks so I always know what to work on next.
- As a user, I can start a Pomodoro linked to a task and see progress without opening a window.
- As a user, I can expand the widget to manage tasks, timer controls, and settings.
- As a user, I can configure the notch placement (Left, Center, Right, custom offsets, multi-display) so it never covers browser tabs or app title bars.
- As a user, I can enter Focus mode to hide distractions and get a break reminder.
- As a user, I can review today and this week's focus and completion trends.
- As a user, I can use global hotkeys and the system tray when the widget is collapsed.

## Feature scope
**MVP:** frameless transparent always-on-top widget; configurable position with monitor-aware clamping; collapsed/hover-expanded/full-expanded states with spring motion and inactivity auto-collapse; tasks with add/edit/complete/delete/reorder, priority, today/upcoming, subtasks, estimates; Pomodoro 25/5/15 defaults, configurable durations, four-session long break, auto-start, session count, task link; Focus mode presentation, break nudge; daily stats, completed count, streak, weekly chart; Zustand state; local JSON persistence; global hotkeys; tray menu; startup setting; native notifications; auto-updater.

## UX states
- **Collapsed:** compact 190x30 pill with task name, circular progress ring, remaining time, and focus indicator.
- **Hover/click expanded:** task list, add-task field, play/pause/skip, current session label.
- **Full expanded:** task management, stats, settings, notch position controls, hotkey and behavior controls.
- **Empty/loading/paused/completed:** clear empty task prompt, persisted state restoration, paused label, and completion cue without layout jumps.

## Data model
`Task { id, title, priority, estimate?, reminder?, completed, completedAt?, createdAt }`

`Timer { secondsLeft, duration, isRunning, sessions, activeTaskId? }`

`Settings { notch: { displayId, align, offsetPx }, openOnHover, autoHideNotch, launchAtStartup, autoUpdate, telemetryConsent, telemetryInstallId }`

## Keyboard shortcuts
- `Ctrl+Alt+Space`: Toggle expand / collapse widget
- `Ctrl+Alt+N`: Quick add task
- `Ctrl+Alt+P`: Start / pause timer
- `Ctrl+Alt+Left` / `Ctrl+Alt+Right`: Nudge notch by 20px
- `Ctrl+Alt+Home`: Reset notch position to center

## Performance and platform
Windows 10/11 only; Electron + React + TypeScript + Framer Motion + Zustand. Target under 80 MB RAM, under 1% idle CPU, animation at 60 fps, cold launch under 2 seconds on modern Windows hardware.
