export type NotchSourceId = 'clock' | 'timer' | 'task' | 'streak' | 'companion' | 'none'
export type NotchContentMode = 'smart' | 'cycle'

export interface NotchSourceConfig {
  id: NotchSourceId
  label: string
  description: string
  defaultEnabled: boolean
}

export const NOTCH_SOURCES: NotchSourceConfig[] = [
  {
    id: 'clock',
    label: 'Clock',
    description: 'Current local time in 24h format',
    defaultEnabled: true,
  },
  {
    id: 'timer',
    label: 'Active timer',
    description: 'Remaining focus session time',
    defaultEnabled: true,
  },
  {
    id: 'task',
    label: 'Next task',
    description: 'Title of the next pending task (clean, no metadata, max 60 chars)',
    defaultEnabled: false,
  },
  {
    id: 'streak',
    label: 'Focus streak',
    description: 'Completed pomodoro sessions count',
    defaultEnabled: false,
  },
  {
    id: 'companion',
    label: 'Companion',
    description: 'Subtle animated dot-matrix eyes idle character',
    defaultEnabled: false,
  },
  {
    id: 'none',
    label: 'Nothing (always show clock)',
    description: 'Disable other notch sources and keep clean clock',
    defaultEnabled: false,
  },
]

export const DEFAULT_NOTCH_SOURCES: NotchSourceId[] = ['clock', 'timer']
export const DEFAULT_NOTCH_SOURCE_ORDER: NotchSourceId[] = [
  'clock',
  'timer',
  'task',
  'streak',
  'companion',
]

/**
 * Validates whether a task title meets the clean notch display criteria:
 * Only title, no metadata, and fits within 60 characters.
 */
export function isTaskFitForNotch(title?: string | null): boolean {
  if (!title) return false
  const trimmed = title.trim()
  return trimmed.length > 0 && trimmed.length <= 60
}

export function truncateNotchText(text: string, maxChars = 11): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxChars) return trimmed
  return trimmed.slice(0, maxChars - 1).trim() + '…'
}

export interface NotchEvaluationContext {
  clockStr: string
  isRunning: boolean
  secondsLeft: number
  duration: number
  sessions: number
  activeTaskTitle?: string | null
  enabledSources: NotchSourceId[]
  sourceOrder?: NotchSourceId[]
  mode: NotchContentMode
  cycleIndex?: number
}

export interface NotchContentResult {
  source: NotchSourceId
  text: string
  isCompanion: boolean
  totalCycleItems?: number
  currentCycleIndex?: number
}

/**
 * Returns formatted content for a single source, or null if the source currently has no data.
 */
export function getSourceContent(
  source: NotchSourceId,
  ctx: {
    clockStr: string
    isRunning: boolean
    secondsLeft: number
    duration: number
    sessions: number
    activeTaskTitle?: string | null
  }
): { text: string; isCompanion: boolean } | null {
  switch (source) {
    case 'clock':
      return { text: ctx.clockStr, isCompanion: false }

    case 'timer': {
      const isTimerActive = ctx.isRunning || ctx.secondsLeft < ctx.duration
      if (isTimerActive) {
        const m = Math.floor(ctx.secondsLeft / 60)
        const s = ctx.secondsLeft % 60
        return {
          text: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
          isCompanion: false,
        }
      }
      return null
    }

    case 'task': {
      if (isTaskFitForNotch(ctx.activeTaskTitle)) {
        return {
          text: truncateNotchText(ctx.activeTaskTitle!),
          isCompanion: false,
        }
      }
      return null
    }

    case 'streak': {
      if (ctx.sessions > 0) {
        return {
          text: `${ctx.sessions} SESS`,
          isCompanion: false,
        }
      }
      return null
    }

    case 'companion':
      return { text: 'COMPANION', isCompanion: true }

    case 'none':
    default:
      return { text: ctx.clockStr, isCompanion: false }
  }
}

/**
 * Evaluates what content the collapsed notch should display based on configuration and current state.
 */
export function evaluateNotchContent(ctx: NotchEvaluationContext): NotchContentResult {
  const order = ctx.sourceOrder ?? DEFAULT_NOTCH_SOURCE_ORDER
  const enabledSet = new Set(ctx.enabledSources)

  // If "none" is enabled or no sources are enabled, always fall back to clock
  if (enabledSet.has('none') || ctx.enabledSources.length === 0) {
    return {
      source: 'clock',
      text: ctx.clockStr,
      isCompanion: false,
    }
  }

  // ─── Smart Mode ─────────────────────────────────────────────────────────────
  if (ctx.mode === 'smart') {
    // 1. Active timer has highest priority if enabled and running/active
    if (enabledSet.has('timer')) {
      const timerContent = getSourceContent('timer', ctx)
      if (timerContent) {
        return { source: 'timer', ...timerContent }
      }
    }

    // 2. Next task if enabled and valid
    if (enabledSet.has('task')) {
      const taskContent = getSourceContent('task', ctx)
      if (taskContent) {
        return { source: 'task', ...taskContent }
      }
    }

    // 3. Streak if enabled and has sessions
    if (enabledSet.has('streak')) {
      const streakContent = getSourceContent('streak', ctx)
      if (streakContent) {
        return { source: 'streak', ...streakContent }
      }
    }

    // 4. Companion if enabled
    if (enabledSet.has('companion')) {
      return {
        source: 'companion',
        text: 'COMPANION',
        isCompanion: true,
      }
    }

    // 5. Clock fallback
    return {
      source: 'clock',
      text: ctx.clockStr,
      isCompanion: false,
    }
  }

  // ─── Cycle Mode ─────────────────────────────────────────────────────────────
  const validItems: { source: NotchSourceId; text: string; isCompanion: boolean }[] = []

  for (const src of order) {
    if (!enabledSet.has(src) || src === 'none') continue
    const content = getSourceContent(src, ctx)
    if (content) {
      validItems.push({ source: src, ...content })
    }
  }

  if (validItems.length === 0) {
    return {
      source: 'clock',
      text: ctx.clockStr,
      isCompanion: false,
    }
  }

  const cycleIdx = (ctx.cycleIndex ?? 0) % validItems.length
  const activeItem = validItems[cycleIdx]

  return {
    source: activeItem.source,
    text: activeItem.text,
    isCompanion: activeItem.isCompanion,
    totalCycleItems: validItems.length,
    currentCycleIndex: cycleIdx,
  }
}
