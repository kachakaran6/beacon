import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, Notification, screen, shell, Tray } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import Store from 'electron-store'
import electronUpdater from 'electron-updater'
import { computeNotchBounds, NOTCH_WIDTH, NOTCH_HEIGHT, PANEL_DEFAULT_WIDTH, PANEL_DEFAULT_HEIGHT } from './bounds.js'
import { runLegacyMigration } from './legacy-migration.js'
import { sendTelemetryPing } from './telemetry.js'

let autoUpdater = null
try {
  if (electronUpdater) {
    autoUpdater = electronUpdater.autoUpdater || electronUpdater.default?.autoUpdater
  }
} catch {
  // Safe fallback in test environments
}

// ─── Set App User Model ID at early startup ──────────────────────────────────
try {
  if (app && typeof app.setAppUserModelId === 'function') {
    app.setAppUserModelId('com.kachakaran6.beacon')
  }
} catch {
  // Safe fallback in test environments
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = Boolean(app && !app.isPackaged)
const isTest = process.env.BEACON_TEST === '1'
const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE)

// ─── Logging ──────────────────────────────────────────────────────────────────
const logBase = app?.getPath ? app.getPath('appData') : (process.env.APPDATA || path.join(process.cwd(), 'logs'))
const logDir = path.join(logBase, 'Beacon', 'logs')
let logStream = null

function setupLogger() {
  try {
    fs.mkdirSync(logDir, { recursive: true })
    logStream = fs.createWriteStream(path.join(logDir, 'main.log'), { flags: 'a' })
  } catch {
    // Silently skip if unable to write to log directory
  }
}

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}\n`
  if (logStream) logStream.write(line)
  if (isDev) console.log(...args)
}

function logError(...args) {
  const line = `[${new Date().toISOString()}] ERROR ${args.join(' ')}\n`
  if (logStream) logStream.write(line)
  console.error(...args)
}

// ─── Store & Legacy Migration ─────────────────────────────────────────────────
const store = new Store({
  name: 'beacon',
  projectName: 'beacon',
  defaults: {
    state: null,
    launchAtStartup: false,
    telemetryHistory: {},
  },
})

// Run one-time migration from legacy store if needed
runLegacyMigration(store, log)

// ─── Window and State Machine ─────────────────────────────────────────────────
let mainWindow = null
let appWindow = null
let tray = null
let trayIcon = null

// State machine: 'closed' | 'opening' | 'open' | 'closing'
let machineState = 'closed'
let isTransitioning = false
let hoverOpenedBy = null // 'hover' | 'click' | 'shortcut' | null
let isPinned = false
let inputFocused = false
let isHiddenToLine = false

let cursorPollTimer = null
let hoverOpenTimer = null
let hoverCloseTimer = null
let autoHideIdleTimer = null

let layoutAckResolver = null
let closeDoneResolver = null

let simulatedCursor = null // for test simulation

let currentNotchSettings = { displayId: null, align: 'center', offsetPx: 0 }

// ─── Single instance ──────────────────────────────────────────────────────────
if (app?.requestSingleInstanceLock) {
  if (!isTest && !app.requestSingleInstanceLock()) {
    app.quit()
  } else {
    if (!isTest) {
      app.on('second-instance', () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          transitionToOpen('shortcut')
        }
      })
    }
  }
}

// ─── Display & Icon Helpers ──────────────────────────────────────────────────
export function getIconPath() {
  const baseAppPath = app?.getAppPath ? app.getAppPath() : process.cwd()
  const devPath = path.join(baseAppPath, 'build', 'icon.ico')
  if (fs.existsSync(devPath)) return devPath
  const resPath = path.join(process.resourcesPath || '', 'build', 'icon.ico')
  if (fs.existsSync(resPath)) return resPath
  return path.join(baseAppPath, 'public', 'icon.png')
}

export function getIcon() {
  if (nativeImage?.createFromPath) {
    return nativeImage.createFromPath(getIconPath())
  }
  return null
}

/**
 * Universal window chrome applicator: guarantees the notch window never appears in the taskbar
 * and always stays floating above full screen apps.
 */
export function applyWindowChrome(win) {
  if (!win || win.isDestroyed?.()) return
  try {
    win.setSkipTaskbar?.(true)
    win.setAlwaysOnTop?.(true, 'floating')
    win.setMenuBarVisibility?.(false)
  } catch {
    // Ignore if window is being destroyed
  }
}

function getTargetDisplay() {
  if (!screen?.getAllDisplays) {
    return { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }
  }
  const displays = screen.getAllDisplays()
  const savedId = currentNotchSettings?.displayId

  if (savedId !== null && savedId !== undefined) {
    const found = displays.find((d) => d.id === savedId)
    if (found) return found
  }
  return screen.getPrimaryDisplay ? screen.getPrimaryDisplay() : displays[0]
}

/** Get notch bounds on target display */
export function getNotchBounds(shrunk = false) {
  const display = getTargetDisplay()
  const h = shrunk ? 3 : NOTCH_HEIGHT
  return computeNotchBounds(display, currentNotchSettings, { width: NOTCH_WIDTH, height: h })
}

/** Get panel bounds on target display */
export function getPanelBounds() {
  const display = getTargetDisplay()
  return computeNotchBounds(display, currentNotchSettings, { width: PANEL_DEFAULT_WIDTH, height: PANEL_DEFAULT_HEIGHT })
}

function getEffectiveCursor() {
  if (simulatedCursor) return simulatedCursor
  return screen.getCursorScreenPoint()
}

// ─── State Machine Transitions & Paint-Synced Handshake ───────────────────────

export async function transitionToOpen(by = 'click') {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (isTransitioning || machineState === 'open' || machineState === 'opening') return

  isTransitioning = true
  machineState = 'opening'
  hoverOpenedBy = by
  isPinned = by === 'click' || by === 'shortcut'
  isHiddenToLine = false

  if (hoverOpenTimer) {
    clearTimeout(hoverOpenTimer)
    hoverOpenTimer = null
  }
  if (hoverCloseTimer) {
    clearTimeout(hoverCloseTimer)
    hoverCloseTimer = null
  }
  if (autoHideIdleTimer) {
    clearTimeout(autoHideIdleTimer)
    autoHideIdleTimer = null
  }

  const nb = getNotchBounds(false)
  const pb = getPanelBounds()
  const pillLeft = nb.x - pb.x

  log(`[main] transitionToOpen by=${by} pillLeft=${pillLeft} originX=${pb.originX}`)

  // 1. Hide briefly to swap window bounds cleanly without visual glitch
  mainWindow.setOpacity(0)

  // 2. Atomic setBounds
  mainWindow.setBounds({ x: pb.x, y: pb.y, width: pb.width, height: pb.height })
  mainWindow.setFocusable(true)
  applyWindowChrome(mainWindow)

  // 3. Send layout:apply and await renderer 2-rAF ack
  const ackPromise = new Promise((resolve) => {
    layoutAckResolver = resolve
    setTimeout(resolve, 100) // safety fallback
  })

  mainWindow.webContents.send('layout:apply', {
    pillLeft,
    originX: pb.originX,
    expanded: true,
    openedBy: by,
  })

  await ackPromise
  layoutAckResolver = null

  // 4. Reveal window at new bounds and trigger open animation
  mainWindow.setOpacity(1)
  if (by === 'click' || by === 'shortcut') {
    mainWindow.show()
    mainWindow.focus()
  } else {
    // Hover-open must NOT steal keyboard focus from other apps
    mainWindow.showInactive()
  }
  applyWindowChrome(mainWindow)

  mainWindow.webContents.send('open:start', { openedBy: by })

  // 5. Allow morph animation to run (~180ms), then unlock state
  setTimeout(() => {
    if (machineState === 'opening') {
      machineState = 'open'
      isTransitioning = false
      log(`[main] state -> open (by=${by})`)
    }
  }, 200)
}

export async function transitionToClose(reason = 'user') {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (isTransitioning || machineState === 'closed' || machineState === 'closing') return

  isTransitioning = true
  machineState = 'closing'

  if (hoverOpenTimer) {
    clearTimeout(hoverOpenTimer)
    hoverOpenTimer = null
  }
  if (hoverCloseTimer) {
    clearTimeout(hoverCloseTimer)
    hoverCloseTimer = null
  }

  log(`[main] transitionToClose reason=${reason}`)

  // 1. Trigger renderer exit animation and await completion
  const closeDonePromise = new Promise((resolve) => {
    closeDoneResolver = resolve
    setTimeout(resolve, 250) // safety fallback
  })

  mainWindow.webContents.send('close:start', { reason })

  await closeDonePromise
  closeDoneResolver = null

  // 2. Hide briefly to swap back to collapsed notch bounds
  mainWindow.setOpacity(0)

  const nb = getNotchBounds(false)
  mainWindow.setBounds({ x: nb.x, y: nb.y, width: nb.width, height: nb.height })
  mainWindow.setFocusable(false)
  applyWindowChrome(mainWindow)

  // 3. Send collapsed layout and await ack
  const ackPromise = new Promise((resolve) => {
    layoutAckResolver = resolve
    setTimeout(resolve, 100)
  })

  mainWindow.webContents.send('layout:apply', {
    pillLeft: 0,
    originX: 0.5,
    expanded: false,
    reason,
  })

  await ackPromise
  layoutAckResolver = null

  // 4. Reveal collapsed notch
  mainWindow.setOpacity(1)
  mainWindow.showInactive()
  applyWindowChrome(mainWindow)

  hoverOpenedBy = null
  isPinned = false
  inputFocused = false
  machineState = 'closed'
  isTransitioning = false
  log(`[main] state -> closed (reason=${reason})`)

  resetAutoHideTimer()
}

// ─── Hover & Cursor Polling in Main Process (every 60ms) ──────────────────────
function stopCursorPoll() {
  if (cursorPollTimer) {
    clearInterval(cursorPollTimer)
    cursorPollTimer = null
  }
  if (hoverOpenTimer) {
    clearTimeout(hoverOpenTimer)
    hoverOpenTimer = null
  }
  if (hoverCloseTimer) {
    clearTimeout(hoverCloseTimer)
    hoverCloseTimer = null
  }
}

function startCursorPoll() {
  stopCursorPoll()
  cursorPollTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed() || isTransitioning) return

    const cursor = getEffectiveCursor()

    // 1. In 'closed' state: check if cursor enters the notch
    if (machineState === 'closed') {
      const state = store.get('state')
      if (state?.openOnHover === false) return

      const nb = getNotchBounds(false)
      const insideNotch =
        cursor.x >= nb.x &&
        cursor.x <= nb.x + nb.width &&
        cursor.y >= nb.y &&
        cursor.y <= nb.y + nb.height

      if (insideNotch) {
        if (!hoverOpenTimer) {
          hoverOpenTimer = setTimeout(() => {
            hoverOpenTimer = null
            if (machineState === 'closed' && !isTransitioning) {
              transitionToOpen('hover')
            }
          }, 150)
        }
      } else {
        if (hoverOpenTimer) {
          clearTimeout(hoverOpenTimer)
          hoverOpenTimer = null
        }
      }

      // Auto-hide line un-hide logic if active
      if (state?.autoHideNotch && isHiddenToLine && insideNotch) {
        isHiddenToLine = false
        mainWindow.setBounds(getNotchBounds(false))
        applyWindowChrome(mainWindow)
        mainWindow.webContents.send('notch:autohide', false)
        resetAutoHideTimer()
      }
      return
    }

    // 2. In 'open' state: check if cursor left the panel (with 6px hysteresis)
    if (machineState === 'open') {
      if (hoverOpenedBy !== 'hover' || isPinned || inputFocused) {
        if (hoverCloseTimer) {
          clearTimeout(hoverCloseTimer)
          hoverCloseTimer = null
        }
        return
      }

      const pb = getPanelBounds()
      const insidePanelWithHysteresis =
        cursor.x >= pb.x - 6 &&
        cursor.x <= pb.x + pb.width + 6 &&
        cursor.y >= pb.y &&
        cursor.y <= pb.y + pb.height + 6

      if (!insidePanelWithHysteresis) {
        if (!hoverCloseTimer) {
          hoverCloseTimer = setTimeout(() => {
            hoverCloseTimer = null
            if (
              machineState === 'open' &&
              !isTransitioning &&
              hoverOpenedBy === 'hover' &&
              !isPinned &&
              !inputFocused
            ) {
              transitionToClose('hover-exit')
            }
          }, 600)
        }
      } else {
        if (hoverCloseTimer) {
          clearTimeout(hoverCloseTimer)
          hoverCloseTimer = null
        }
      }
    }
  }, 60)
}

function resetAutoHideTimer() {
  if (autoHideIdleTimer) {
    clearTimeout(autoHideIdleTimer)
    autoHideIdleTimer = null
  }

  const state = store.get('state')
  if (!state?.autoHideNotch || machineState !== 'closed') return

  autoHideIdleTimer = setTimeout(() => {
    if (machineState === 'closed' && !isHiddenToLine && !isTransitioning) {
      const cursor = getEffectiveCursor()
      const nb = getNotchBounds(false)
      const inside =
        cursor.x >= nb.x &&
        cursor.x <= nb.x + nb.width &&
        cursor.y >= nb.y &&
        cursor.y <= nb.y + nb.height

      if (!inside) {
        isHiddenToLine = true
        mainWindow.setBounds(getNotchBounds(true))
        applyWindowChrome(mainWindow)
        mainWindow?.webContents.send('notch:autohide', true)
      } else {
        resetAutoHideTimer()
      }
    }
  }, 4000)
}

// ─── Create Main Notch Window ─────────────────────────────────────────────────
function createWindow() {
  const nb = getNotchBounds(false)

  mainWindow = new BrowserWindow({
    x: nb.x,
    y: nb.y,
    width: nb.width,
    height: nb.height,
    type: 'toolbar', // WS_EX_TOOLWINDOW: prevents Windows taskbar button and Alt+Tab
    skipTaskbar: true,
    icon: getIcon(),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    resizable: false,
    thickFrame: false,
    roundedCorners: false,
    movable: false,
    focusable: false,
    show: isTest,
    webPreferences: {
      preload: path.join(__dirname, fs.existsSync(path.join(__dirname, 'preload.cjs')) ? 'preload.cjs' : 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  })

  applyWindowChrome(mainWindow)

  mainWindow.once('ready-to-show', () => {
    mainWindow.showInactive()
    applyWindowChrome(mainWindow)
    startCursorPoll()
    resetAutoHideTimer()
  })

  // Ensure window chrome invariants are preserved across OS window events
  mainWindow.on('focus', () => applyWindowChrome(mainWindow))
  mainWindow.on('blur', () => applyWindowChrome(mainWindow))
  mainWindow.on('show', () => applyWindowChrome(mainWindow))
  mainWindow.on('restore', () => applyWindowChrome(mainWindow))

  mainWindow.on('closed', () => {
    mainWindow = null
    stopCursorPoll()
  })

  const distPath = path.join(__dirname, '../dist/index.html')
  if (isDev && !isTest && !process.env.LOAD_DIST) {
    mainWindow.loadURL('http://127.0.0.1:5173').catch(() => {
      if (fs.existsSync(distPath)) mainWindow.loadFile(distPath)
    })
  } else {
    mainWindow.loadFile(distPath)
  }
}

// ─── Toggle helpers & Hotkeys ──────────────────────────────────────────────────
function toggleWindow(openedBy = 'shortcut') {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (machineState === 'open') {
    transitionToClose('shortcut')
  } else {
    transitionToOpen(openedBy)
  }
}

function toggleTimer() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('shortcut', 'toggle-timer')
}

function quickAdd() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (machineState !== 'open') {
    transitionToOpen('shortcut')
  }
  mainWindow.webContents.send('shortcut', 'quick-add')
}

function nudgeNotch(deltaPx) {
  const current = currentNotchSettings.offsetPx || 0
  currentNotchSettings = { ...currentNotchSettings, offsetPx: current + deltaPx }
  const state = store.get('state') || {}
  store.set('state', { ...state, notch: currentNotchSettings })

  if (mainWindow && !mainWindow.isDestroyed()) {
    if (machineState === 'open') {
      const pb = getPanelBounds()
      mainWindow.setBounds({ x: pb.x, y: pb.y, width: pb.width, height: pb.height })
      applyWindowChrome(mainWindow)
      const nb = getNotchBounds(false)
      mainWindow.webContents.send('layout:apply', {
        pillLeft: nb.x - pb.x,
        originX: pb.originX,
        expanded: true,
      })
    } else {
      const nb = getNotchBounds(false)
      mainWindow.setBounds({ x: nb.x, y: nb.y, width: nb.width, height: nb.height })
      applyWindowChrome(mainWindow)
      mainWindow.webContents.send('layout:apply', {
        pillLeft: 0,
        originX: 0.5,
        expanded: false,
      })
    }
  }
}

function resetNotchPosition() {
  currentNotchSettings = { displayId: null, align: 'center', offsetPx: 0 }
  const state = store.get('state') || {}
  store.set('state', { ...state, notch: currentNotchSettings })

  if (mainWindow && !mainWindow.isDestroyed()) {
    if (machineState === 'open') {
      const pb = getPanelBounds()
      mainWindow.setBounds({ x: pb.x, y: pb.y, width: pb.width, height: pb.height })
      applyWindowChrome(mainWindow)
      const nb = getNotchBounds(false)
      mainWindow.webContents.send('layout:apply', {
        pillLeft: nb.x - pb.x,
        originX: pb.originX,
        expanded: true,
      })
    } else {
      const nb = getNotchBounds(false)
      mainWindow.setBounds({ x: nb.x, y: nb.y, width: nb.width, height: nb.height })
      applyWindowChrome(mainWindow)
      mainWindow.webContents.send('layout:apply', {
        pillLeft: 0,
        originX: 0.5,
        expanded: false,
      })
    }
  }
}

// ─── Tray Menu ────────────────────────────────────────────────────────────────
function createTray() {
  if (tray) return
  trayIcon = getIcon()
  tray = new Tray(trayIcon)
  tray.setToolTip('Beacon - Focus Island')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Toggle Beacon',
      click: () => toggleWindow('shortcut'),
    },
    {
      label: 'Start / Pause Timer',
      click: toggleTimer,
    },
    {
      label: 'Quick Add Task',
      click: quickAdd,
    },
    { type: 'separator' },
    {
      label: 'Reset Position to Center',
      click: resetNotchPosition,
    },
    {
      label: 'Check for Updates...',
      click: () => {
        if (!isPortable) {
          autoUpdater.checkForUpdatesAndNotify().catch((err) => logError('check-update-tray', err))
        } else {
          shell.openExternal('https://github.com/kachakaran6/beacon/releases')
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Beacon',
      click: () => {
        app.isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', () => toggleWindow('shortcut'))
}

// ─── Auto-Updater Setup ───────────────────────────────────────────────────────
function setupAutoUpdater() {
  if (isPortable || isDev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    log('[updater] checking for update...')
    mainWindow?.webContents.send('updates:status', { status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    log('[updater] update available:', info.version)
    mainWindow?.webContents.send('updates:status', { status: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    log('[updater] update not available')
    mainWindow?.webContents.send('updates:status', { status: 'not-available' })
  })

  autoUpdater.on('update-downloaded', (info) => {
    log('[updater] update downloaded:', info.version)
    mainWindow?.webContents.send('updates:status', { status: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (err) => {
    logError('[updater] error:', err)
    mainWindow?.webContents.send('updates:status', { status: 'error', error: String(err) })
  })

  // Check 10s after launch
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => logError('check-update-startup', err))
  }, 10_000)

  // Check every 6 hours
  setInterval(() => {
    const state = store.get('state')
    if (state?.autoUpdate !== false) {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => logError('check-update-cron', err))
    }
  }, 6 * 60 * 60 * 1000)
}

// ─── App Lifecycle ─────────────────────────────────────────────────────────────
if (app?.whenReady) {
  app.whenReady().then(() => {
    setupLogger()
    log('[main] Beacon app ready, isDev=', isDev, 'isTest=', isTest)

    // Restore saved notch settings
    const savedState = store.get('state')
    if (savedState?.notch) {
      currentNotchSettings = { ...currentNotchSettings, ...savedState.notch }
    }

    try {
      app.setLoginItemSettings({
        openAtLogin: Boolean(store.get('launchAtStartup')),
        args: ['--hidden'],
      })
    } catch (err) {
      logError('setLoginItemSettings', err)
    }

    createWindow()
    createTray()
    setupAutoUpdater()

    // Anonymous usage ping on launch (respects privacy consent and env vars)
    setTimeout(() => {
      sendTelemetryPing({
        store,
        event: 'launch',
        appVersion: app.getVersion(),
        logger: log,
      }).catch(() => {})
    }, 3000)

    // Global Shortcuts
    const registerShortcut = (accel, handler) => {
      try {
        const ok = globalShortcut.register(accel, handler)
        if (!ok) log(`[main] WARN could not register shortcut: ${accel}`)
      } catch (err) {
        logError(`shortcut register failed: ${accel}`, err)
      }
    }

    registerShortcut('Ctrl+Alt+Space', () => toggleWindow('shortcut'))
    registerShortcut('Ctrl+Alt+N', quickAdd)
    registerShortcut('Ctrl+Alt+P', toggleTimer)
    registerShortcut('Ctrl+Alt+Left', () => nudgeNotch(-20))
    registerShortcut('Ctrl+Alt+Right', () => nudgeNotch(20))
    registerShortcut('Ctrl+Alt+Home', resetNotchPosition)

    // Display change listeners
    const handleDisplayChange = () => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      applyWindowChrome(mainWindow)
      if (machineState === 'open') {
        const pb = getPanelBounds()
        mainWindow.setBounds({ x: pb.x, y: pb.y, width: pb.width, height: pb.height })
        const nb = getNotchBounds(false)
        mainWindow.webContents.send('layout:apply', {
          pillLeft: nb.x - pb.x,
          originX: pb.originX,
          expanded: true,
        })
      } else {
        const nb = getNotchBounds(isHiddenToLine)
        mainWindow.setBounds({ x: nb.x, y: nb.y, width: nb.width, height: nb.height })
        mainWindow.webContents.send('layout:apply', {
          pillLeft: 0,
          originX: 0.5,
          expanded: false,
        })
      }
    }

    screen.on('display-metrics-changed', handleDisplayChange)
    screen.on('display-added', handleDisplayChange)
    screen.on('display-removed', handleDisplayChange)

    app.on('activate', () => {
      if (!mainWindow) createWindow()
      else mainWindow.showInactive()
    })
  })

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    stopCursorPoll()
    if (autoHideIdleTimer) clearTimeout(autoHideIdleTimer)
    if (logStream) logStream.end()
  })

  app.on('window-all-closed', (event) => {
    event.preventDefault()
  })
}

// ─── IPC Handlers ──────────────────────────────────────────────────────────────

if (typeof ipcMain !== 'undefined' && ipcMain && typeof ipcMain.handle === 'function') {
  // State persistence
  ipcMain.handle('state:load', () => {
    try {
      return store.get('state') ?? null
    } catch (err) {
      logError('state:load', err)
      return null
    }
  })

  ipcMain.handle('state:save', (_event, state) => {
    try {
      store.set('state', state)
      return true
    } catch (err) {
      logError('state:save', err)
      return false
    }
  })

  ipcMain.handle('state:flush', (_event, state) => {
    try {
      store.set('state', state)
      return true
    } catch (err) {
      logError('state:flush', err)
      return false
    }
  })

  // Handshake response listeners
  ipcMain.on('layout:ack', () => {
    if (layoutAckResolver) {
      layoutAckResolver()
      layoutAckResolver = null
    }
  })

  ipcMain.on('close:done', () => {
    if (closeDoneResolver) {
      closeDoneResolver()
      closeDoneResolver = null
    }
  })

  // Window expand / collapse
  ipcMain.handle('window:expand', (_event, openedBy = 'click') => {
    try {
      transitionToOpen(openedBy)
      return true
    } catch (err) {
      logError('window:expand', err)
      return false
    }
  })

  ipcMain.handle('window:collapse', () => {
    try {
      transitionToClose('renderer')
      return true
    } catch (err) {
      logError('window:collapse', err)
      return false
    }
  })

  // Input focus guard
  ipcMain.handle('window:set-input-focused', (_event, focused) => {
    inputFocused = Boolean(focused)
    if (inputFocused && hoverCloseTimer) {
      clearTimeout(hoverCloseTimer)
      hoverCloseTimer = null
    }
  })

  // Open full app window (Only this window has a taskbar button)
  ipcMain.handle('window:open-app', () => {
    try {
      if (appWindow && !appWindow.isDestroyed()) {
        appWindow.show()
        appWindow.focus()
        return
      }
      appWindow = new BrowserWindow({
        width: 1100,
        height: 760,
        minWidth: 900,
        minHeight: 620,
        title: 'Beacon',
        icon: getIcon(),
        show: false,
        frame: true,
        skipTaskbar: false, // Explicitly visible in taskbar
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, fs.existsSync(path.join(__dirname, 'preload.cjs')) ? 'preload.cjs' : 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
        },
      })
      appWindow.setMenuBarVisibility(false)
      appWindow.once('ready-to-show', () => appWindow.show())
      if (isDev && !isTest && !process.env.LOAD_DIST) {
        appWindow.loadURL('http://127.0.0.1:5173/?app=1')
      } else {
        appWindow.loadFile(path.join(__dirname, '../dist/index.html'), { query: { app: '1' } })
      }
      appWindow.on('closed', () => {
        appWindow = null
      })
    } catch (err) {
      logError('window:open-app', err)
    }
  })

  // Displays & Notch Positioning
  ipcMain.handle('displays:get', () => {
    const displays = screen.getAllDisplays()
    const primaryId = screen.getPrimaryDisplay().id
    return displays.map((d, index) => ({
      id: d.id,
      name: `Display ${index + 1} (${d.bounds.width}×${d.bounds.height})`,
      bounds: d.bounds,
      isPrimary: d.id === primaryId,
    }))
  })

  ipcMain.handle('notch:set-position', (_event, settings) => {
    currentNotchSettings = { ...currentNotchSettings, ...settings }
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (machineState === 'open') {
        const pb = getPanelBounds()
        mainWindow.setBounds({ x: pb.x, y: pb.y, width: pb.width, height: pb.height })
        applyWindowChrome(mainWindow)
        const nb = getNotchBounds(false)
        mainWindow.webContents.send('layout:apply', {
          pillLeft: nb.x - pb.x,
          originX: pb.originX,
          expanded: true,
        })
      } else {
        const nb = getNotchBounds(isHiddenToLine)
        mainWindow.setBounds({ x: nb.x, y: nb.y, width: nb.width, height: nb.height })
        applyWindowChrome(mainWindow)
        mainWindow.webContents.send('layout:apply', {
          pillLeft: 0,
          originX: 0.5,
          expanded: false,
        })
      }
    }
  })

  // Auto-update IPC
  ipcMain.handle('updates:check', async () => {
    if (isPortable || isDev) {
      return { status: 'disabled' }
    }
    try {
      const res = await autoUpdater.checkForUpdates()
      return { status: res?.updateInfo ? 'available' : 'not-available', version: res?.updateInfo?.version }
    } catch (err) {
      return { status: 'error', error: String(err) }
    }
  })

  ipcMain.handle('updates:install', () => {
    autoUpdater.quitAndInstall()
  })

  // Startup setting
  ipcMain.handle('startup:set', (_event, enabled) => {
    try {
      store.set('launchAtStartup', Boolean(enabled))
      app.setLoginItemSettings({ openAtLogin: Boolean(enabled), args: ['--hidden'] })
      return true
    } catch (err) {
      logError('startup:set', err)
      return false
    }
  })

  // Notification
  ipcMain.handle('notification:send', (_event, title, body) => {
    try {
      if (Notification.isSupported()) {
        new Notification({ title, body, icon: getIcon() }).show()
      }
    } catch (err) {
      logError('notification:send', err)
    }
  })

  // External links
  ipcMain.on('external:open', (_event, url) => {
    if (/^https?:/.test(url)) {
      shell.openExternal(url).catch((err) => logError('external:open', err))
    }
  })

  // Test-only IPC
  if (isTest) {
    ipcMain.handle('test:get-bounds', () => mainWindow?.getBounds() ?? null)
    ipcMain.handle('test:send-shortcut', (_event, command) => {
      if (command === 'quick-add') {
        quickAdd()
      } else if (command === 'expand') {
        transitionToOpen('shortcut')
      } else if (command === 'collapse') {
        transitionToClose('shortcut')
      } else if (command === 'toggle-timer') {
        toggleTimer()
      } else {
        mainWindow?.webContents.send('shortcut', command)
      }
    })
    ipcMain.handle('test:expand', (_event, by = 'click') => {
      return transitionToOpen(by)
    })
    ipcMain.handle('test:collapse', () => {
      return transitionToClose('test')
    })
    ipcMain.handle('test:is-focusable', () => mainWindow?.isFocusable() ?? false)
    ipcMain.handle('test:set-notch-settings', (_event, settings) => {
      currentNotchSettings = { ...currentNotchSettings, ...settings }
      if (machineState === 'open') {
        const pb = getPanelBounds()
        mainWindow.setBounds({ x: pb.x, y: pb.y, width: pb.width, height: pb.height })
        applyWindowChrome(mainWindow)
        const nb = getNotchBounds(false)
        mainWindow.webContents.send('layout:apply', {
          pillLeft: nb.x - pb.x,
          originX: pb.originX,
          expanded: true,
        })
      } else {
        const nb = getNotchBounds(false)
        mainWindow.setBounds({ x: nb.x, y: nb.y, width: nb.width, height: nb.height })
        applyWindowChrome(mainWindow)
        mainWindow.webContents.send('layout:apply', {
          pillLeft: 0,
          originX: 0.5,
          expanded: false,
        })
      }
    })
    ipcMain.handle('test:get-state-machine', () => ({
      state: machineState,
      isTransitioning,
      isPinned,
      hoverOpenedBy,
      inputFocused,
    }))
    ipcMain.handle('test:simulate-cursor', (_event, point) => {
      simulatedCursor = point
    })
  }
}

