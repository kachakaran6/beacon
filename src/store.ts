import { create } from 'zustand'
import type {
  CalEvent,
  DisplayInfo,
  NotchAlign,
  NotchContentMode,
  NotchSettings,
  NotchSourceId,
  PersistedState,
  Priority,
  Task,
  ThemeId,
  UpdateStatus,
} from './electron'

export type {
  CalEvent,
  DisplayInfo,
  NotchAlign,
  NotchContentMode,
  NotchSettings,
  NotchSourceId,
  PersistedState,
  Priority,
  Task,
  ThemeId,
  UpdateStatus,
}

export type Store = PersistedState & {
  hydrated: boolean
  updateStatus: UpdateStatus

  // Task actions
  addTask: (title: string, estimate?: number) => void
  toggleTask: (id: string) => void
  deleteTask: (id: string) => void
  editTask: (id: string, patch: Partial<Pick<Task, 'title' | 'priority' | 'estimate' | 'reminder'>>) => void
  setActive: (id: string | null) => void

  // Timer actions
  toggleTimer: () => void
  skipTimer: () => void
  tick: () => void
  finishSession: () => void
  setDuration: (minutes: number) => void

  // Note actions
  setNote: (note: string) => void

  // Events
  addEvent: (event: Omit<CalEvent, 'id' | 'date'>) => void
  deleteEvent: (id: string) => void

  // Settings
  setLaunchAtStartup: (v: boolean) => void
  setOpenOnHover: (v: boolean) => void
  setAutoHideNotch: (v: boolean) => void
  setNotchSettings: (patch: Partial<NotchSettings>) => void
  setTheme: (theme: ThemeId) => void
  setNotchContentMode: (mode: NotchContentMode) => void
  toggleNotchSource: (source: NotchSourceId) => void
  reorderNotchSources: (order: NotchSourceId[]) => void
  setNotchCycleInterval: (seconds: number) => void
  setReduceAnimations: (reduce: boolean) => void
  setTelemetryConsent: (consent: boolean) => void
  resetTelemetryInstallId: () => void
  setAutoUpdate: (v: boolean) => void
  setUpdateStatus: (status: UpdateStatus) => void

  // Hydration
  hydrate: (state: Partial<PersistedState>) => void
  reset: () => void
}

// ─── Initial state (clean, privacy-first) ──────────────────────────────────────

export const DEFAULT_NOTCH: NotchSettings = {
  displayId: null,
  align: 'center',
  offsetPx: 0,
}

export const INITIAL_STATE: PersistedState = {
  tasks: [],
  activeTaskId: null,
  isRunning: false,
  secondsLeft: 25 * 60,
  duration: 25 * 60,
  sessions: 0,
  note: '',
  noteEditedAt: null,
  events: [],
  launchAtStartup: false,
  openOnHover: true,
  autoHideNotch: false,
  notch: DEFAULT_NOTCH,
  theme: 'classic',
  notchContentMode: 'smart',
  notchSources: ['clock', 'timer'],
  notchSourceOrder: ['clock', 'timer', 'task', 'streak', 'companion'],
  notchCycleInterval: 5,
  reduceAnimations: false,
  telemetryConsent: null,
  telemetryInstallId: '',
  autoUpdate: true,
}

// ─── Safe UUID generator ──────────────────────────────────────────────────────
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'id-' + Math.random().toString(36).slice(2, 11) + '-' + Date.now().toString(36)
}

// ─── Parse trailing estimate from task input (e.g. "Design UI 45m" → {title, estimate})
export function parseTaskInput(raw: string): { title: string; estimate?: number } {
  const trimmed = raw.trim()
  const m = trimmed.match(/^(.*?)\s+(\d+)m$/i)
  if (m && m[1].trim()) {
    return { title: m[1].trim(), estimate: parseInt(m[2], 10) }
  }
  return { title: trimmed }
}

// ─── Store Definition ─────────────────────────────────────────────────────────

export const useStore = create<Store>((set) => ({
  ...INITIAL_STATE,
  hydrated: false,
  updateStatus: { status: 'not-available' },

  addTask: (rawTitle, explicitEstimate) => {
    const { title, estimate } = parseTaskInput(rawTitle)
    if (!title) return
    const finalEstimate = explicitEstimate ?? estimate
    const newTask: Task = {
      id: generateId(),
      title,
      priority: 'medium',
      estimate: finalEstimate,
      completed: false,
      createdAt: Date.now(),
    }
    set((s) => ({
      tasks: [...s.tasks, newTask],
    }))
  },

  toggleTask: (id) =>
    set((s) => {
      const task = s.tasks.find((t) => t.id === id)
      if (!task) return s
      const nextCompleted = !task.completed
      return {
        tasks: s.tasks.map((t) =>
          t.id === id
            ? { ...t, completed: nextCompleted, completedAt: nextCompleted ? Date.now() : undefined }
            : t
        ),
        activeTaskId: s.activeTaskId === id && nextCompleted ? null : s.activeTaskId,
      }
    }),

  deleteTask: (id) =>
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
      activeTaskId: s.activeTaskId === id ? null : s.activeTaskId,
    })),

  editTask: (id, patch) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  setActive: (activeTaskId) => set({ activeTaskId }),

  toggleTimer: () => set((s) => ({ isRunning: !s.isRunning })),

  skipTimer: () =>
    set((s) => ({
      isRunning: false,
      secondsLeft: s.duration,
    })),

  tick: () =>
    set((s) => {
      if (!s.isRunning) return s
      if (s.secondsLeft <= 1) {
        return {
          isRunning: false,
          secondsLeft: s.duration,
          sessions: s.sessions + 1,
        }
      }
      return { secondsLeft: s.secondsLeft - 1 }
    }),

  finishSession: () =>
    set((s) => ({
      isRunning: false,
      secondsLeft: s.duration,
      sessions: s.sessions + 1,
    })),

  setDuration: (minutes) => {
    const secs = Math.max(1, minutes) * 60
    set({
      duration: secs,
      secondsLeft: secs,
      isRunning: false,
    })
  },

  setNote: (note) => set({ note, noteEditedAt: Date.now() }),

  addEvent: (ev) => {
    const today = new Date().toISOString().slice(0, 10)
    const newEvent: CalEvent = {
      ...ev,
      id: generateId(),
      date: today,
    }
    set((s) => ({
      events: [...s.events, newEvent],
    }))
  },

  deleteEvent: (id) =>
    set((s) => ({
      events: s.events.filter((e) => e.id !== id),
    })),

  setLaunchAtStartup: (launchAtStartup) => set({ launchAtStartup }),
  setOpenOnHover: (openOnHover) => set({ openOnHover }),
  setAutoHideNotch: (autoHideNotch) => set({ autoHideNotch }),

  setNotchSettings: (patch) =>
    set((s) => {
      const nextNotch = { ...(s.notch ?? DEFAULT_NOTCH), ...patch }
      window.beacon?.setNotchPosition(nextNotch)
      return { notch: nextNotch }
    }),

  setTheme: (theme) => set({ theme }),
  setNotchContentMode: (notchContentMode) => set({ notchContentMode }),
  toggleNotchSource: (source) =>
    set((s) => {
      const current = s.notchSources ?? ['clock', 'timer']
      if (source === 'none') {
        return { notchSources: ['none'] }
      }
      const withoutNone = current.filter((src) => src !== 'none')
      const exists = withoutNone.includes(source)
      const next = exists ? withoutNone.filter((src) => src !== source) : [...withoutNone, source]
      return { notchSources: next }
    }),
  reorderNotchSources: (notchSourceOrder) => set({ notchSourceOrder }),
  setNotchCycleInterval: (notchCycleInterval) =>
    set({ notchCycleInterval: Math.max(3, Math.min(10, notchCycleInterval)) }),
  setReduceAnimations: (reduceAnimations) => set({ reduceAnimations }),

  setTelemetryConsent: (telemetryConsent) =>
    set((s) => {
      const installId = s.telemetryInstallId || generateId()
      return { telemetryConsent, telemetryInstallId: installId }
    }),

  resetTelemetryInstallId: () =>
    set({ telemetryInstallId: generateId() }),

  setAutoUpdate: (autoUpdate) => set({ autoUpdate }),
  setUpdateStatus: (updateStatus) => set({ updateStatus }),

  hydrate: (saved) => {
    set((s) => {
      const notch = { ...DEFAULT_NOTCH, ...(saved.notch ?? {}) }
      const installId = saved.telemetryInstallId || s.telemetryInstallId || generateId()
      return {
        ...s,
        ...saved,
        notch,
        theme: saved.theme ?? s.theme ?? 'classic',
        notchContentMode: saved.notchContentMode ?? s.notchContentMode ?? 'smart',
        notchSources: saved.notchSources ?? s.notchSources ?? ['clock', 'timer'],
        notchSourceOrder:
          saved.notchSourceOrder ?? s.notchSourceOrder ?? ['clock', 'timer', 'task', 'streak', 'companion'],
        notchCycleInterval: saved.notchCycleInterval ?? s.notchCycleInterval ?? 5,
        reduceAnimations: saved.reduceAnimations ?? s.reduceAnimations ?? false,
        telemetryInstallId: installId,
        hydrated: true,
      }
    })
  },

  reset: () => {
    set({
      ...INITIAL_STATE,
      hydrated: true,
      updateStatus: { status: 'not-available' },
    })
  },
}))

// ─── Persistence Layer ────────────────────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | undefined

export function getPersistPayload(state: Store): PersistedState {
  return {
    tasks: state.tasks,
    activeTaskId: state.activeTaskId,
    isRunning: state.isRunning,
    secondsLeft: state.secondsLeft,
    duration: state.duration,
    sessions: state.sessions,
    note: state.note,
    noteEditedAt: state.noteEditedAt,
    events: state.events,
    launchAtStartup: state.launchAtStartup,
    openOnHover: state.openOnHover,
    autoHideNotch: state.autoHideNotch,
    notch: state.notch ?? DEFAULT_NOTCH,
    theme: state.theme ?? 'classic',
    notchContentMode: state.notchContentMode ?? 'smart',
    notchSources: state.notchSources ?? ['clock', 'timer'],
    notchSourceOrder: state.notchSourceOrder ?? ['clock', 'timer', 'task', 'streak', 'companion'],
    notchCycleInterval: state.notchCycleInterval ?? 5,
    reduceAnimations: state.reduceAnimations ?? false,
    telemetryConsent: state.telemetryConsent,
    telemetryInstallId: state.telemetryInstallId,
    autoUpdate: state.autoUpdate,
  }
}

export function startPersistence(): () => void {
  const api = window.beacon
  if (!api) return () => {}

  const unsubscribe = useStore.subscribe((state) => {
    if (!state.hydrated) return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const current = useStore.getState()
      if (!current.hydrated) return
      const payload = getPersistPayload(current)
      api.saveState(payload).catch((err: unknown) => {
        console.error('[store] saveState failed', err)
      })
    }, 400)
  })

  return () => {
    clearTimeout(saveTimer)
    unsubscribe()
  }
}

export async function hydrateFromDisk(): Promise<void> {
  const api = window.beacon
  if (!api) {
    useStore.getState().hydrate({})
    return
  }
  try {
    const saved = await api.loadState()
    useStore.getState().hydrate(saved ?? {})
    if (saved?.notch) {
      api.setNotchPosition(saved.notch)
    }
  } catch (err) {
    console.error('[store] hydrateFromDisk failed', err)
    useStore.getState().hydrate({})
  }
}

export async function flushToDisk(): Promise<boolean> {
  const api = window.beacon
  if (!api) return false
  const state = useStore.getState()
  if (!state.hydrated) return false
  clearTimeout(saveTimer)
  const payload = getPersistPayload(state)
  try {
    return await api.flushState(payload)
  } catch (err) {
    console.error('[store] flushToDisk failed', err)
    return false
  }
}
