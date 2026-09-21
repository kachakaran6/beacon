export type Priority = 'high' | 'medium' | 'low'

export type Task = {
  id: string
  title: string
  priority: Priority
  estimate?: number      // minutes
  reminder?: string      // ISO string or HH:MM
  completed: boolean
  completedAt?: number   // timestamp
  createdAt: number
}

export type CalEvent = {
  id: string
  title: string
  start: string   // HH:MM
  end: string     // HH:MM
  date: string    // YYYY-MM-DD (today)
}

export type NotchAlign = 'left' | 'center' | 'right'

export type NotchSettings = {
  displayId: number | null
  align: NotchAlign
  offsetPx: number
}

export type PersistedState = {
  tasks: Task[]
  activeTaskId: string | null
  isRunning: boolean
  secondsLeft: number
  duration: number
  sessions: number
  note: string
  noteEditedAt: number | null
  events: CalEvent[]
  launchAtStartup: boolean
  openOnHover: boolean
  autoHideNotch: boolean
  notch?: NotchSettings
  telemetryConsent?: boolean | null
  telemetryInstallId?: string
  autoUpdate?: boolean
}

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  originX?: number
}

export interface WindowStateChange {
  expanded: boolean
  openedBy?: string
  reason?: string
  originX?: number
}

export interface DisplayInfo {
  id: number
  name: string
  bounds: { x: number; y: number; width: number; height: number }
  isPrimary: boolean
}

export interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloaded' | 'error' | 'disabled'
  version?: string
  error?: string
}

export interface LayoutPayload {
  pillLeft: number
  originX: number
  expanded: boolean
  openedBy?: string
}

export interface StateMachineInfo {
  state: 'closed' | 'opening' | 'open' | 'closing'
  isTransitioning: boolean
  isPinned: boolean
  hoverOpenedBy: string | null
}

export interface BeaconAPI {
  isElectron: true
  loadState: () => Promise<PersistedState | null>
  saveState: (state: PersistedState) => Promise<boolean>
  flushState: (state: PersistedState) => Promise<boolean>
  expand: (openedBy?: string) => Promise<void>
  collapse: () => Promise<void>
  setInputFocused: (focused: boolean) => Promise<void>
  openApp: () => Promise<void>
  setLaunchAtStartup: (enabled: boolean) => Promise<boolean>
  notify: (title: string, body: string) => Promise<void>
  openExternal: (url: string) => void
  getDisplays: () => Promise<DisplayInfo[]>
  setNotchPosition: (settings: NotchSettings) => Promise<void>
  checkForUpdates: () => Promise<UpdateStatus>
  quitAndInstallUpdate: () => Promise<void>
  onShortcut: (callback: (command: string) => void) => () => void
  onWindowStateChanged?: (callback: (state: WindowStateChange) => void) => () => void
  onUpdateStatus?: (callback: (status: UpdateStatus) => void) => () => void
  onLayoutApply?: (callback: (layout: LayoutPayload) => void) => () => void
  ackLayout?: () => void
  onOpenStart?: (callback: (data?: any) => void) => () => void
  notifyOpenDone?: () => void
  onCloseStart?: (callback: (data?: any) => void) => () => void
  notifyCloseDone?: () => void
  test?: {
    getBounds: () => Promise<WindowBounds | null>
    sendShortcut: (command: string) => Promise<void>
    expand: (by?: string) => Promise<void>
    collapse: () => Promise<void>
    isFocusable: () => Promise<boolean>
    setNotchSettings: (settings: NotchSettings) => Promise<void>
    getStateMachine: () => Promise<StateMachineInfo | null>
    simulateCursor: (point: { x: number; y: number }) => Promise<void>
  }
}

declare global {
  interface Window {
    beacon?: BeaconAPI
  }
}

export {}
