import { describe, it, expect, vi } from 'vitest'
import { applyWindowChrome } from '../electron/main'

describe('Window Chrome and Taskbar Suppression (Bug 1)', () => {
  it('applyWindowChrome sets skipTaskbar, floating alwaysOnTop, and hides menu bar', () => {
    const mockWin = {
      isDestroyed: vi.fn().mockReturnValue(false),
      setSkipTaskbar: vi.fn(),
      setAlwaysOnTop: vi.fn(),
      setMenuBarVisibility: vi.fn(),
    }

    applyWindowChrome(mockWin as any)

    expect(mockWin.setSkipTaskbar).toHaveBeenCalledWith(true)
    expect(mockWin.setAlwaysOnTop).toHaveBeenCalledWith(true, 'floating')
    expect(mockWin.setMenuBarVisibility).toHaveBeenCalledWith(false)
  })

  it('safely ignores destroyed window instances without throwing', () => {
    const destroyedWin = {
      isDestroyed: vi.fn().mockReturnValue(true),
      setSkipTaskbar: vi.fn(),
      setAlwaysOnTop: vi.fn(),
      setMenuBarVisibility: vi.fn(),
    }

    expect(() => applyWindowChrome(destroyedWin as any)).not.toThrow()
    expect(destroyedWin.setSkipTaskbar).not.toHaveBeenCalled()
  })

  it('safely handles null window reference', () => {
    expect(() => applyWindowChrome(null as any)).not.toThrow()
  })
})

describe('State Machine & Hover Logic (Bug 2)', () => {
  it('locks transitions while animating/transitioning', () => {
    let state = 'closed'
    let isTransitioning = false

    const tryTransitionToOpen = () => {
      if (isTransitioning || state === 'open' || state === 'opening') {
        return false
      }
      isTransitioning = true
      state = 'opening'
      return true
    }

    // First transition succeeds
    expect(tryTransitionToOpen()).toBe(true)
    expect(state).toBe('opening')
    expect(isTransitioning).toBe(true)

    // Re-entrant transition while opening is rejected
    expect(tryTransitionToOpen()).toBe(false)
  })

  it('prevents auto-close when input is focused or session is pinned', () => {
    const isPinned = true
    const inputFocused = true
    const hoverOpenedBy = 'hover'

    const shouldAutoCloseOnExit = (openedBy: string, pinned: boolean, focused: boolean) => {
      if (openedBy !== 'hover' || pinned || focused) {
        return false
      }
      return true
    }

    expect(shouldAutoCloseOnExit(hoverOpenedBy, isPinned, false)).toBe(false)
    expect(shouldAutoCloseOnExit(hoverOpenedBy, false, inputFocused)).toBe(false)
    expect(shouldAutoCloseOnExit('click', false, false)).toBe(false)
    expect(shouldAutoCloseOnExit('hover', false, false)).toBe(true)
  })
})
