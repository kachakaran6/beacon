import { describe, it, expect } from 'vitest'
import {
  evaluateNotchContent,
  getSourceContent,
  isTaskFitForNotch,
  truncateNotchText,
} from '../src/notch-content'

describe('Notch Content System', () => {
  describe('isTaskFitForNotch', () => {
    it('accepts clean titles under 60 characters', () => {
      expect(isTaskFitForNotch('Implement feature')).toBe(true)
      expect(isTaskFitForNotch('A'.repeat(60))).toBe(true)
    })

    it('rejects empty strings or titles exceeding 60 characters', () => {
      expect(isTaskFitForNotch('')).toBe(false)
      expect(isTaskFitForNotch('   ')).toBe(false)
      expect(isTaskFitForNotch(null)).toBe(false)
      expect(isTaskFitForNotch('A'.repeat(61))).toBe(false)
    })
  })

  describe('truncateNotchText', () => {
    it('truncates text with ellipsis to fit compact notch', () => {
      expect(truncateNotchText('Short', 11)).toBe('Short')
      expect(truncateNotchText('A very long task title that exceeds width', 11)).toBe('A very lon…')
    })
  })

  describe('evaluateNotchContent in Smart Mode', () => {
    const baseCtx = {
      clockStr: '12:00',
      isRunning: false,
      secondsLeft: 1500,
      duration: 1500,
      sessions: 0,
      enabledSources: ['clock', 'timer'] as const,
      mode: 'smart' as const,
    }

    it('defaults to showing Clock when timer is idle and next task is disabled', () => {
      const res = evaluateNotchContent({
        ...baseCtx,
        activeTaskTitle: 'Fix issue', // task exists, but task source is not enabled
      })
      expect(res.source).toBe('clock')
      expect(res.text).toBe('12:00')
    })

    it('shows Active timer when timer is running', () => {
      const res = evaluateNotchContent({
        ...baseCtx,
        isRunning: true,
        secondsLeft: 1490,
      })
      expect(res.source).toBe('timer')
      expect(res.text).toBe('24:50')
    })

    it('shows Active timer when timer is paused mid-session', () => {
      const res = evaluateNotchContent({
        ...baseCtx,
        isRunning: false,
        secondsLeft: 1200, // < duration
      })
      expect(res.source).toBe('timer')
      expect(res.text).toBe('20:00')
    })

    it('shows Next task if enabled and timer is idle', () => {
      const res = evaluateNotchContent({
        ...baseCtx,
        enabledSources: ['clock', 'timer', 'task'],
        activeTaskTitle: 'Design UI',
      })
      expect(res.source).toBe('task')
      expect(res.text).toBe('Design UI')
    })

    it('falls back to clock if task title exceeds 60 chars or no task is pending', () => {
      const resOver = evaluateNotchContent({
        ...baseCtx,
        enabledSources: ['clock', 'timer', 'task'],
        activeTaskTitle: 'A'.repeat(65),
      })
      expect(resOver.source).toBe('clock')

      const resEmpty = evaluateNotchContent({
        ...baseCtx,
        enabledSources: ['clock', 'timer', 'task'],
        activeTaskTitle: null,
      })
      expect(resEmpty.source).toBe('clock')
    })

    it('falls back to clock if all sources disabled or none is chosen', () => {
      const resNone = evaluateNotchContent({
        ...baseCtx,
        enabledSources: ['none'],
      })
      expect(resNone.source).toBe('clock')

      const resEmpty = evaluateNotchContent({
        ...baseCtx,
        enabledSources: [],
      })
      expect(resEmpty.source).toBe('clock')
    })
  })

  describe('evaluateNotchContent in Cycle Mode', () => {
    it('rotates through enabled and available sources in order', () => {
      const ctx = {
        clockStr: '14:30',
        isRunning: true,
        secondsLeft: 1400,
        duration: 1500,
        sessions: 3,
        activeTaskTitle: 'Build app',
        enabledSources: ['clock', 'timer', 'task', 'streak'],
        sourceOrder: ['clock', 'timer', 'task', 'streak'],
        mode: 'cycle' as const,
      }

      // Slot 0: Clock
      const s0 = evaluateNotchContent({ ...ctx, cycleIndex: 0 })
      expect(s0.source).toBe('clock')
      expect(s0.text).toBe('14:30')
      expect(s0.totalCycleItems).toBe(4)
      expect(s0.currentCycleIndex).toBe(0)

      // Slot 1: Timer
      const s1 = evaluateNotchContent({ ...ctx, cycleIndex: 1 })
      expect(s1.source).toBe('timer')
      expect(s1.text).toBe('23:20')

      // Slot 2: Task
      const s2 = evaluateNotchContent({ ...ctx, cycleIndex: 2 })
      expect(s2.source).toBe('task')
      expect(s2.text).toBe('Build app')

      // Slot 3: Streak
      const s3 = evaluateNotchContent({ ...ctx, cycleIndex: 3 })
      expect(s3.source).toBe('streak')
      expect(s3.text).toBe('3 SESS')

      // Wraps around
      const s4 = evaluateNotchContent({ ...ctx, cycleIndex: 4 })
      expect(s4.source).toBe('clock')
    })

    it('skips sources that currently have no data without breaking cycle order', () => {
      const ctx = {
        clockStr: '10:00',
        isRunning: false,
        secondsLeft: 1500,
        duration: 1500, // timer not running -> no data
        sessions: 0, // streak is 0 -> no data
        activeTaskTitle: null, // no task -> no data
        enabledSources: ['clock', 'timer', 'task', 'streak'],
        mode: 'cycle' as const,
        cycleIndex: 0,
      }

      const res = evaluateNotchContent(ctx)
      expect(res.source).toBe('clock')
      expect(res.totalCycleItems).toBe(1) // only clock was available
    })
  })
})
