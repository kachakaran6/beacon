import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, parseTaskInput, INITIAL_STATE, getPersistPayload } from '../src/store'

describe('parseTaskInput', () => {
  it('parses raw string without estimate', () => {
    const res = parseTaskInput('Write documentation')
    expect(res.title).toBe('Write documentation')
    expect(res.estimate).toBeUndefined()
  })

  it('parses trailing estimate in minutes (e.g. 45m)', () => {
    const res = parseTaskInput('Fix critical bug 45m')
    expect(res.title).toBe('Fix critical bug')
    expect(res.estimate).toBe(45)
  })

  it('handles case-insensitivity in trailing estimate', () => {
    const res = parseTaskInput('Review PR 25M')
    expect(res.title).toBe('Review PR')
    expect(res.estimate).toBe(25)
  })
})

describe('Store Actions', () => {
  beforeEach(() => {
    useStore.getState().reset()
  })

  it('initializes with clean empty state and zero demo data', () => {
    const state = useStore.getState()
    expect(state.tasks).toEqual([])
    expect(state.events).toEqual([])
    expect(state.note).toBe('')
    expect(state.sessions).toBe(0)
    expect(state.secondsLeft).toBe(25 * 60)
  })

  it('adds a task and handles estimate', () => {
    useStore.getState().addTask('Implement feature 30m')
    const tasks = useStore.getState().tasks
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('Implement feature')
    expect(tasks[0].estimate).toBe(30)
    expect(tasks[0].completed).toBe(false)
  })

  it('toggles a task completed and clears activeTaskId if active', () => {
    useStore.getState().addTask('Task 1')
    const id = useStore.getState().tasks[0].id
    useStore.getState().setActive(id)
    expect(useStore.getState().activeTaskId).toBe(id)

    useStore.getState().toggleTask(id)
    expect(useStore.getState().tasks[0].completed).toBe(true)
    expect(useStore.getState().tasks[0].completedAt).toBeDefined()
    expect(useStore.getState().activeTaskId).toBeNull()

    // Toggle back
    useStore.getState().toggleTask(id)
    expect(useStore.getState().tasks[0].completed).toBe(false)
  })

  it('deletes a task', () => {
    useStore.getState().addTask('Task A')
    const id = useStore.getState().tasks[0].id
    useStore.getState().deleteTask(id)
    expect(useStore.getState().tasks).toHaveLength(0)
  })

  it('edits a task', () => {
    useStore.getState().addTask('Original')
    const id = useStore.getState().tasks[0].id
    useStore.getState().editTask(id, { title: 'Updated', priority: 'high' })
    const task = useStore.getState().tasks[0]
    expect(task.title).toBe('Updated')
    expect(task.priority).toBe('high')
  })

  it('controls timer and counts down on tick', () => {
    useStore.getState().setDuration(45)
    expect(useStore.getState().duration).toBe(45 * 60)
    expect(useStore.getState().secondsLeft).toBe(45 * 60)

    useStore.getState().toggleTimer()
    expect(useStore.getState().isRunning).toBe(true)

    useStore.getState().tick()
    expect(useStore.getState().secondsLeft).toBe(45 * 60 - 1)

    useStore.getState().finishSession()
    expect(useStore.getState().isRunning).toBe(false)
    expect(useStore.getState().sessions).toBe(1)
    expect(useStore.getState().secondsLeft).toBe(45 * 60)
  })

  it('updates notepad note and edited timestamp', () => {
    useStore.getState().setNote('Quick note text')
    expect(useStore.getState().note).toBe('Quick note text')
    expect(useStore.getState().noteEditedAt).toBeGreaterThan(0)
  })

  it('adds and deletes calendar events', () => {
    useStore.getState().addEvent({
      title: 'Standup',
      start: '10:00',
      end: '10:30',
    })
    expect(useStore.getState().events).toHaveLength(1)
    const ev = useStore.getState().events[0]
    expect(ev.title).toBe('Standup')
    expect(ev.date).toBeDefined()

    useStore.getState().deleteEvent(ev.id)
    expect(useStore.getState().events).toHaveLength(0)
  })

  it('handles color themes and persists choice', () => {
    expect(useStore.getState().theme).toBe('classic')
    useStore.getState().setTheme('amber')
    expect(useStore.getState().theme).toBe('amber')

    const payload = getPersistPayload(useStore.getState())
    expect(payload.theme).toBe('amber')
  })

  it('manages notch content configuration, toggles, and modes', () => {
    expect(useStore.getState().notchContentMode).toBe('smart')
    expect(useStore.getState().notchSources).toEqual(['clock', 'timer'])

    useStore.getState().setNotchContentMode('cycle')
    expect(useStore.getState().notchContentMode).toBe('cycle')

    useStore.getState().toggleNotchSource('task')
    expect(useStore.getState().notchSources).toContain('task')

    useStore.getState().toggleNotchSource('timer')
    expect(useStore.getState().notchSources).not.toContain('timer')

    useStore.getState().setNotchCycleInterval(7)
    expect(useStore.getState().notchCycleInterval).toBe(7)

    // Clamps interval to [3, 10]
    useStore.getState().setNotchCycleInterval(1)
    expect(useStore.getState().notchCycleInterval).toBe(3)
    useStore.getState().setNotchCycleInterval(25)
    expect(useStore.getState().notchCycleInterval).toBe(10)
  })

  it('toggles reduce animations setting', () => {
    expect(useStore.getState().reduceAnimations).toBe(false)
    useStore.getState().setReduceAnimations(true)
    expect(useStore.getState().reduceAnimations).toBe(true)
  })

  it('hydrates saved state cleanly without data loss', () => {
    const saved = {
      ...INITIAL_STATE,
      tasks: [{ id: '1', title: 'Saved task', priority: 'medium' as const, completed: false, createdAt: 100 }],
      note: 'Persisted note',
      sessions: 4,
      theme: 'ice' as const,
      notchContentMode: 'cycle' as const,
      notchSources: ['clock' as const, 'companion' as const],
      reduceAnimations: true,
    }
    useStore.getState().hydrate(saved)
    const state = useStore.getState()
    expect(state.hydrated).toBe(true)
    expect(state.tasks).toHaveLength(1)
    expect(state.note).toBe('Persisted note')
    expect(state.sessions).toBe(4)
    expect(state.theme).toBe('ice')
    expect(state.notchContentMode).toBe('cycle')
    expect(state.notchSources).toEqual(['clock', 'companion'])
    expect(state.reduceAnimations).toBe(true)

    const payload = getPersistPayload(state)
    expect(payload.tasks).toHaveLength(1)
    expect(payload.note).toBe('Persisted note')
    expect(payload.theme).toBe('ice')
    expect(payload.notchContentMode).toBe('cycle')
    expect(payload.notchSources).toEqual(['clock', 'companion'])
    expect(payload.reduceAnimations).toBe(true)
  })
})
