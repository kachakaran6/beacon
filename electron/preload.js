const { contextBridge, ipcRenderer } = require('electron')

const api = {
  isElectron: true,

  // State persistence
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  flushState: (state) => ipcRenderer.invoke('state:flush', state),

  // Window control
  expand: (openedBy) => ipcRenderer.invoke('window:expand', openedBy),
  collapse: () => ipcRenderer.invoke('window:collapse'),
  setInputFocused: (focused) => ipcRenderer.invoke('window:set-input-focused', focused),
  openApp: () => ipcRenderer.invoke('window:open-app'),

  // Displays & Notch Positioning
  getDisplays: () => ipcRenderer.invoke('displays:get'),
  setNotchPosition: (settings) => ipcRenderer.invoke('notch:set-position', settings),

  // Auto-update
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('updates:install'),

  // Misc
  setLaunchAtStartup: (enabled) => ipcRenderer.invoke('startup:set', enabled),
  notify: (title, body) => ipcRenderer.invoke('notification:send', title, body),
  openExternal: (url) => ipcRenderer.send('external:open', url),

  // Shortcut events from main → renderer
  onShortcut: (callback) => {
    const listener = (_event, command) => callback(command)
    ipcRenderer.on('shortcut', listener)
    return () => ipcRenderer.removeListener('shortcut', listener)
  },

  // Window state changes from main → renderer
  onWindowStateChanged: (callback) => {
    const listener = (_event, state) => callback(state)
    ipcRenderer.on('window:state-changed', listener)
    return () => ipcRenderer.removeListener('window:state-changed', listener)
  },

  // Update status changes from main → renderer
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status)
    ipcRenderer.on('updates:status', listener)
    return () => ipcRenderer.removeListener('updates:status', listener)
  },

  // Test-only (gated by BEACON_TEST=1 or test mode in main process)
  test: {
    getBounds: () => ipcRenderer.invoke('test:get-bounds'),
    sendShortcut: (command) => ipcRenderer.invoke('test:send-shortcut', command),
    expand: () => ipcRenderer.invoke('test:expand'),
    collapse: () => ipcRenderer.invoke('test:collapse'),
    isFocusable: () => ipcRenderer.invoke('test:is-focusable'),
    setNotchSettings: (settings) => ipcRenderer.invoke('test:set-notch-settings', settings),
  },
}

contextBridge.exposeInMainWorld('beacon', api)
