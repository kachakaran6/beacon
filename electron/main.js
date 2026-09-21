import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, Notification, screen, shell, Tray } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import Store from 'electron-store'
import electronUpdater from 'electron-updater'
const { autoUpdater } = electronUpdater
import { computeNotchBounds, NOTCH_WIDTH, NOTCH_HEIGHT, PANEL_DEFAULT_WIDTH, PANEL_DEFAULT_HEIGHT } from './bounds.js'
import { runLegacyMigration } from './legacy-migration.js'
import { sendTelemetryPing } from './telemetry.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged
const isTest = process.env.BEACON_TEST === '1'
const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE)

// ─── Logging ──────────────────────────────────────────────────────────────────
const logDir = path.join(app.getPath('appData'), 'Beacon', 'logs')
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
  defaults: {
    state: null,
    launchAtStartup: false,
    telemetryHistory: {},
  },
})

// Run one-time migration from legacy store if needed
runLegacyMigration(store, log)

// ─── Window and State ─────────────────────────────────────────────────────────
let mainWindow = null
let appWindow = null
let tray = null
let isExpanded = false
let isHiddenToLine = false
let inputFocused = false
let hoverOpenedBy = null // 'hover' | 'shortcut' | 'click' | null
let cursorPollTimer = null
let hoverGraceTimer = null
let autoHideIdleTimer = null
let currentNotchSettings = { displayId: null, align: 'center', offsetPx: 0 }

// ─── Single instance ──────────────────────────────────────────────────────────
if (!isTest && !app.requestSingleInstanceLock()) {
  app.quit()
} else {
  if (!isTest) {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.showInactive()
        mainWindow.focus()
      }
    })
  }
}

// ─── Display & Bounds Helpers ────────────────────────────────────────────────
function getIcon() {
  const iconPath = path.join(app.getAppPath(), 'build', 'icon.ico')
  return nativeImage.createFromPath(iconPath)
}

function getTargetDisplay() {
  const displays = screen.getAllDisplays()
  const savedId = currentNotchSettings?.displayId

  if (savedId !== null && savedId !== undefined) {
    const found = displays.find((d) => d.id === savedId)
    if (found) return found
  }
  return screen.getPrimaryDisplay()
}

/** Get notch bounds on target display with alignment, offset and height */
function getNotchBounds(shrunk = false) {
  const display = getTargetDisplay()
  const h = shrunk ? 3 : NOTCH_HEIGHT
  return computeNotchBounds(display, currentNotchSettings, { width: NOTCH_WIDTH, height: h })
}

/** Get panel bounds on target display */
function getPanelBounds() {
  const display = getTargetDisplay()
  return computeNotchBounds(display, currentNotchSettings, { width: PANEL_DEFAULT_WIDTH, height: PANEL_DEFAULT_HEIGHT })
}

/** Apply bounds and correct for Windows DPI off-by-1 rounding */
function applyBounds(win, target) {
  if (!win || win.isDestroyed()) return
  win.setBounds({ x: target.x, y: target.y, width: target.width, height: target.height })
  setImmediate(() => {
    if (!win || win.isDestroyed()) return
    const actual = win.getBounds()
    const drift =
      Math.abs(actual.x - target.x) +
      Math.abs(actual.y - target.y) +
      Math.abs(actual.width - target.width) +
      Math.abs(actual.height - target.height)
    if (drift > 0 && drift <= 4) {
      win.setBounds({ x: target.x, y: target.y, width: target.width, height: target.height })
    }
  })
}

// ─── Hover & Auto-hide polling ────────────────────────────────────────────────
function clearHoverGrace() {
  if (hoverGraceTimer) {
    clearTimeout(hoverGraceTimer)
    hoverGraceTimer = null
  }
}

function stopCursorPoll() {
  if (cursorPollTimer) {
    clearInterval(cursorPollTimer)
    cursorPollTimer = null
  }
  clearHoverGrace()
}

function startCursorPoll() {
  stopCursorPoll()
  cursorPollTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      stopCursorPoll()
      return
    }

    const cursor = screen.getCursorScreenPoint()
    const bounds = mainWindow.getBounds()

    // 1. Hover-close tracking with 600ms grace
    if (isExpanded && hoverOpenedBy === 'hover') {
      if (inputFocused) {
        clearHoverGrace()
        return
      }

      const inside =
        cursor.x >= bounds.x &&
        cursor.x <= bounds.x + bounds.width &&
        cursor.y >= bounds.y &&
        cursor.y <= bounds.y + bounds.height

      if (!inside) {
        if (!hoverGraceTimer) {
          hoverGraceTimer = setTimeout(() => {
            hoverGraceTimer = null
            if (!inputFocused && isExpanded && hoverOpenedBy === 'hover') {
              collapseWindow('hover-exit')
            }
          }, 600)
        }
      } else {
        clearHoverGrace()
      }
    }

    // 2. Auto-hide line touch-open
    if (!isExpanded) {
      const state = store.get('state')
      if (state?.autoHideNotch) {
        const nb = getNotchBounds(false)
        const nearTop =
          cursor.x >= nb.x &&
          cursor.x <= nb.x + nb.width &&
          cursor.y >= nb.y &&
          cursor.y <= nb.y + 35

        if (nearTop && isHiddenToLine) {
          isHiddenToLine = false
          applyBounds(mainWindow, getNotchBounds(false))
          mainWindow.webContents.send('notch:autohide', false)
          resetAutoHideTimer()
        }
      }
    }
  }, 100)
}

function resetAutoHideTimer() {
  if (autoHideIdleTimer) {
    clearTimeout(autoHideIdleTimer)
    autoHideIdleTimer = null
  }

  const state = store.get('state')
  if (!state?.autoHideNotch || isExpanded) return

  autoHideIdleTimer = setTimeout(() => {
    if (!isExpanded && !isHiddenToLine) {
      const cursor = screen.getCursorScreenPoint()
      const nb = getNotchBounds(false)
      const inside =
        cursor.x >= nb.x &&
        cursor.x <= nb.x + nb.width &&
        cursor.y >= nb.y &&
        cursor.y <= nb.y + nb.height

      if (!inside) {
        isHiddenToLine = true
        applyBounds(mainWindow, getNotchBounds(true))
        mainWindow?.webContents.send('notch:autohide', true)
      } else {
        resetAutoHideTimer()
      }
    }
  }, 4000)
}

// ─── Expand / Collapse ────────────────────────────────────────────────────────
function expandWindow(openedBy = 'click') {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (autoHideIdleTimer) {
    clearTimeout(autoHideIdleTimer)
    autoHideIdleTimer = null
  }
  isHiddenToLine = false
  isExpanded = true
  hoverOpenedBy = openedBy

  const pb = getPanelBounds()
  applyBounds(mainWindow, pb)
  mainWindow.setFocusable(true)
  mainWindow.showInactive()
  mainWindow.focus()
  mainWindow.setAlwaysOnTop(true, 'floating')

  mainWindow.webContents.send('window:state-changed', {
    expanded: true,
    openedBy,
    originX: pb.originX,
  })

  if (openedBy === 'hover') {
    startCursorPoll()
  }
  log(`[main] expandWindow openedBy=${openedBy} bounds=${JSON.stringify(pb)}`)
}

function collapseWindow(reason = 'user') {
  if (!mainWindow || mainWindow.isDestroyed()) return
  stopCursorPoll()
  isExpanded = false
  hoverOpenedBy = null
  inputFocused = false

  const nb = getNotchBounds(false)
  applyBounds(mainWindow, nb)
  mainWindow.setFocusable(false)
  mainWindow.setAlwaysOnTop(true, 'floating')

  mainWindow.webContents.send('window:state-changed', {
    expanded: false,
    reason,
    originX: 0.5,
  })
  log(`[main] collapseWindow reason=${reason} bounds=${JSON.stringify(nb)}`)

  startCursorPoll()
  resetAutoHideTimer()
}

// ─── Create Window ─────────────────────────────────────────────────────────────
function createWindow() {
  const nb = getNotchBounds(false)
  mainWindow = new BrowserWindow({
    x: nb.x,
    y: nb.y,
    width: nb.width,
    height: nb.height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    show: isTest,
    webPreferences: {
      preload: path.join(__dirname, fs.existsSync(path.join(__dirname, 'preload.cjs')) ? 'preload.cjs' : 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.setAlwaysOnTop(true, 'floating')
  mainWindow.setMenuBarVisibility(false)
  mainWindow.once('ready-to-show', () => {
    mainWindow.showInactive()
    startCursorPoll()
    resetAutoHideTimer()
  })

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
  if (isExpanded) {
    mainWindow.webContents.send('shortcut', 'collapse')
  } else {
    expandWindow(openedBy)
    mainWindow.webContents.send('shortcut', 'expand')
  }
}

function toggleTimer() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('shortcut', 'toggle-timer')
}

function quickAdd() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (!isExpanded) {
    expandWindow('shortcut')
  }
  mainWindow.focus()
  mainWindow.webContents.send('shortcut', 'quick-add')
}

function nudgeNotch(deltaPx) {
  const currentOffset = currentNotchSettings.offsetPx || 0
  const nextOffset = currentOffset + deltaPx
  currentNotchSettings = { ...currentNotchSettings, offsetPx: nextOffset }
  
  const state = store.get('state') || {}
  store.set('state', { ...state, notch: currentNotchSettings })

  if (isExpanded) {
    applyBounds(mainWindow, getPanelBounds())
  } else {
    applyBounds(mainWindow, getNotchBounds(isHiddenToLine))
  }
  mainWindow?.webContents.send('notch:settings-changed', currentNotchSettings)
}

function resetNotchPosition() {
  currentNotchSettings = { displayId: null, align: 'center', offsetPx: 0 }
  const state = store.get('state') || {}
  store.set('state', { ...state, notch: currentNotchSettings })

  if (isExpanded) {
    applyBounds(mainWindow, getPanelBounds())
  } else {
    applyBounds(mainWindow, getNotchBounds(isHiddenToLine))
  }
  mainWindow?.webContents.send('notch:settings-changed', currentNotchSettings)
}

// ─── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  tray = new Tray(getIcon())
  tray.setToolTip('Beacon')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show / hide widget', click: () => toggleWindow('shortcut') },
      { label: 'Start / pause timer', click: toggleTimer },
      { type: 'separator' },
      {
        label: 'Quit Beacon',
        click: () => {
          app.quit()
        },
      },
    ])
  )
  tray.on('double-click', () => {
    if (!isExpanded) expandWindow('click')
    mainWindow?.focus()
  })
}

// ─── Auto-Updater ─────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  if (isDev || isPortable) {
    log('[updater] Auto-updater disabled in dev/portable mode')
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('updates:status', { status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updates:status', { status: 'available', version: info.version })
    log('[updater] Update available: ' + info.version)
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('updates:status', { status: 'not-available' })
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updates:status', { status: 'downloaded', version: info.version })
    log('[updater] Update downloaded: ' + info.version)
  })

  autoUpdater.on('error', (err) => {
    logError('updater error', err)
    mainWindow?.webContents.send('updates:status', { status: 'error', error: String(err) })
  })

  // Initial check 10 seconds after launch
  setTimeout(() => {
    const state = store.get('state')
    if (state?.autoUpdate !== false) {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => logError('check-update-launch', err))
    }
  }, 10000)

  // Recurring check every 6 hours
  setInterval(() => {
    const state = store.get('state')
    if (state?.autoUpdate !== false) {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => logError('check-update-cron', err))
    }
  }, 6 * 60 * 60 * 1000)
}

// ─── App Lifecycle ─────────────────────────────────────────────────────────────
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
    mainWindow.setAlwaysOnTop(true, 'floating')
    if (isExpanded) {
      applyBounds(mainWindow, getPanelBounds())
    } else {
      applyBounds(mainWindow, getNotchBounds(isHiddenToLine))
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

// ─── IPC Handlers ──────────────────────────────────────────────────────────────

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

// Window expand / collapse
ipcMain.handle('window:expand', (_event, openedBy = 'click') => {
  try {
    expandWindow(openedBy)
    return true
  } catch (err) {
    logError('window:expand', err)
    return false
  }
})

ipcMain.handle('window:collapse', () => {
  try {
    collapseWindow('renderer')
    return true
  } catch (err) {
    logError('window:collapse', err)
    return false
  }
})

// Input focus guard
ipcMain.handle('window:set-input-focused', (_event, focused) => {
  inputFocused = Boolean(focused)
  if (inputFocused) {
    clearHoverGrace()
  }
})

// Open full app window
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
      show: false,
      frame: true,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, fs.existsSync(path.join(__dirname, 'preload.cjs')) ? 'preload.cjs' : 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    appWindow.setMenuBarVisibility(false)
    appWindow.once('ready-to-show', () => appWindow.show())
    if (isDev) {
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
    if (isExpanded) {
      applyBounds(mainWindow, getPanelBounds())
    } else {
      applyBounds(mainWindow, getNotchBounds(isHiddenToLine))
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
      expandWindow('shortcut')
    } else if (command === 'collapse') {
      mainWindow?.webContents.send('shortcut', 'collapse')
    } else if (command === 'toggle-timer') {
      toggleTimer()
    } else {
      mainWindow?.webContents.send('shortcut', command)
    }
  })
  ipcMain.handle('test:expand', () => {
    expandWindow('click')
  })
  ipcMain.handle('test:collapse', () => {
    collapseWindow('test')
  })
  ipcMain.handle('test:is-focusable', () => mainWindow?.isFocusable() ?? false)
  ipcMain.handle('test:set-notch-settings', (_event, settings) => {
    currentNotchSettings = { ...currentNotchSettings, ...settings }
    if (isExpanded) {
      applyBounds(mainWindow, getPanelBounds())
    } else {
      applyBounds(mainWindow, getNotchBounds(false))
    }
  })
}
