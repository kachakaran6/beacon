# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-09-27

### Added
- **Linux Platform Support**: Full compatibility for Linux desktops (Ubuntu, Debian, Linux Mint, Fedora, Arch, KDE Plasma).
- **Linux Packages**: Automated packaging for universal standalone `.AppImage` and Debian `.deb` installers.
- **Multi-Resolution Linux Icon Set**: Pre-rendered icons from 16x16 up to 512x512 for Linux desktop launchers and docks.
- **X11 / XWayland Desktop Dock Integration**: Window type and transparent visual flags for seamless frameless floating island behavior.
- **Multi-Platform CI/CD**: Automated parallel GitHub Actions matrix building and publishing Windows and Linux binaries.

## [1.0.0] - 2026-09-22

### Added
- **Dynamic Collapsed Notch**: Glanceable desktop pill for Windows 10/11 displaying active task, Pomodoro progress, and controls.
- **Configurable Notch Placement**: Left, Center, and Right segmented docking with fine offset slider, monitor selector, and keyboard nudging (`Ctrl+Alt+Left`/`Right`/`Home`).
- **Focus & Pomodoro Timer**: Custom intervals for work, short break, and long break sessions with audio cues and desktop notifications.
- **Task Management**: Drag-and-drop task reordering, priority tags, time estimates, and completion history.
- **Productivity Workspace**: Embedded markdown notepad, daily/weekly stats, focus streak tracker, and completion charts.
- **Background Auto-Updates**: Integrated GitHub Releases provider with automatic background download and in-app update toast.
- **Privacy-First Anonymous Telemetry**: Optional, strictly anonymous usage ping with full live payload transparency and D1 backend worker.
- **Legacy Migration**: Automatic one-time migration for legacy local storage on first run.
- **Windows Integration**: Global hotkeys, System Tray menu, and per-user startup launch toggle.
