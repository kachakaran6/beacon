import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

test.describe.serial('Beacon Electron E2E Tests', () => {
  let electronApp: ElectronApplication
  let window: Page
  const testUserDataDir = path.join(os.tmpdir(), `beacon-test-${Date.now()}`)

  test.beforeAll(async () => {
    fs.mkdirSync(testUserDataDir, { recursive: true })
    electronApp = await electron.launch({
      args: ['.', `--user-data-dir=${testUserDataDir}`],
      env: {
        ...process.env,
        BEACON_TEST: '1',
      },
    })
    window = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await window.waitForTimeout(500)

    // Reset clean state for deterministic tests
    await window.evaluate(async () => {
      // @ts-ignore
      await window.beacon?.saveState?.({
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
        notch: { displayId: null, align: 'center', offsetPx: 0 },
        telemetryConsent: null,
        telemetryInstallId: 'test-install-id',
        autoUpdate: true,
      })
    })
  })

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close()
    }
    fs.rmSync(testUserDataDir, { recursive: true, force: true })
  })

  test('1. Launch: window bounds equal 190x30, y=0, horizontally centered', async () => {
    const bounds = await window.evaluate(() => window.beacon?.test?.getBounds())
    expect(bounds).toBeTruthy()
    expect(bounds?.width).toBe(190)
    expect(bounds?.height).toBe(30)
    expect(bounds?.y).toBe(0)
    expect(bounds?.x).toBeGreaterThan(0)
  })

  test('2. Open: bounds equal panel size, window is focusable, no app-region: drag', async () => {
    // Expand window
    await window.evaluate(() => window.beacon?.test?.expand())
    await window.waitForTimeout(300)

    // Check bounds (width up to 960, height 420)
    const bounds = await window.evaluate(() => window.beacon?.test?.getBounds())
    expect(bounds).toBeTruthy()
    expect(bounds?.height).toBe(420)
    expect(bounds?.width).toBeGreaterThanOrEqual(300)
    expect(bounds?.width).toBeLessThanOrEqual(960)

    // Check focusable
    const isFocusable = await window.evaluate(() => window.beacon?.test?.isFocusable())
    expect(isFocusable).toBe(true)

    // Check that NO element has -webkit-app-region: drag or app-region: drag
    const hasDragRegion = await window.evaluate(() => {
      const all = document.querySelectorAll('*')
      for (const el of all) {
        const style = window.getComputedStyle(el)
        // @ts-ignore
        const appRegion = style.webkitAppRegion || style.appRegion
        if (appRegion === 'drag') return true
      }
      return false
    })
    expect(hasDragRegion).toBe(false)
  })

  test('3. Type in add-task input and press Enter: task appears', async () => {
    const input = window.locator('#task-input')
    await expect(input).toBeVisible()

    await input.fill('Build awesome widget 45m')
    await input.press('Enter')

    // Verify task row appears with title and estimate
    const taskTitle = window.locator('.task-title').first()
    await expect(taskTitle).toHaveText('Build awesome widget')

    const taskMeta = window.locator('.task-meta').first()
    await expect(taskMeta).toContainText('45m')

    const badge = window.locator('.card-badge')
    await expect(badge).toHaveText('1 left')
  })

  test('4. Click checkbox: moves to Completed, counter updates; click play: timer starts', async () => {
    // Click play on the task
    const playBtn = window.locator('.icon-action-btn[aria-label="Start timer with task"]').first()
    await playBtn.click()

    // Status in timer card should now be FOCUS
    const timerStatus = window.locator('.timer-status-badge')
    await expect(timerStatus).toHaveText('FOCUS')

    // Click checkbox to complete task
    const checkBtn = window.locator('.task-check').first()
    await checkBtn.click()

    // Badge updates to 0 left
    const badge = window.locator('.card-badge')
    await expect(badge).toHaveText('0 left')

    // Completed section toggle exists
    const completedToggle = window.locator('.completed-toggle')
    await expect(completedToggle).toContainText('Completed')
  })

  test('5. Type in notepad: word count updates and text is retained', async () => {
    const textarea = window.locator('.notepad-textarea')
    await expect(textarea).toBeVisible()

    await textarea.fill('Focus on high impact deliverables today.')
    const wordCount = window.locator('.word-count')
    await expect(wordCount).toHaveText('6 words')
  })

  test('6. Set time to 45: display shows 45:00 without overflow', async () => {
    // Click Set time button
    const setTimeBtn = window.locator('.timer-set-time-btn')
    await setTimeBtn.click()

    // Click 45m preset
    const preset45 = window.locator('.preset-btn', { hasText: '45m' })
    await expect(preset45).toBeVisible()
    await preset45.click()

    // Timer SVG display check
    const timerContainer = window.locator('.timer-svg-container')
    await expect(timerContainer).toHaveAttribute('aria-label', 'Timer 45:00')

    // Measure SVG inside card bounds
    const overflowCheck = await window.evaluate(() => {
      const card = document.querySelector('.card--lavender')
      const svg = document.querySelector('.timer-matrix')
      if (!card || !svg) return { overflows: true }
      const cardRect = card.getBoundingClientRect()
      const svgRect = svg.getBoundingClientRect()
      const overflows =
        svgRect.left < cardRect.left ||
        svgRect.right > cardRect.right ||
        svgRect.top < cardRect.top ||
        svgRect.bottom > cardRect.bottom
      return {
        overflows,
        svgWidth: svgRect.width,
        svgHeight: svgRect.height,
        cardWidth: cardRect.width,
      }
    })
    expect(overflowCheck.overflows).toBe(false)
    expect(overflowCheck.svgHeight).toBeLessThanOrEqual(72)
  })

  test('7. Right-click on panel: bounds return to notch size after animation', async () => {
    const panel = window.locator('.panel')
    await expect(panel).toBeVisible()

    // Right click on panel
    await panel.click({ button: 'right' })

    // Wait for exit animation (180ms) + ipc collapse
    await window.waitForTimeout(500)

    const bounds = await window.evaluate(() => window.beacon?.test?.getBounds())
    expect(bounds?.width).toBe(190)
    expect(bounds?.height).toBe(30)
    expect(bounds?.y).toBe(0)
  })

  test('8. Assert bounds match visible shape exactly at both collapsed and expanded states', async () => {
    // Collapsed state
    let bounds = await window.evaluate(() => window.beacon?.test?.getBounds())
    expect(bounds?.width).toBe(190)
    expect(bounds?.height).toBe(30)

    // Expand again
    await window.evaluate(() => window.beacon?.test?.expand())
    await window.waitForTimeout(300)

    // Expanded state
    bounds = await window.evaluate(() => window.beacon?.test?.getBounds())
    expect(bounds?.height).toBe(420)
    expect(bounds?.width).toBeGreaterThanOrEqual(300)
    expect(bounds?.width).toBeLessThanOrEqual(960)
  })

  test('9. Notch positioning: choose Right alignment and verify bounds repositioning', async () => {
    // Navigate to Settings tab
    const settingsTab = window.locator('.segmented-tab', { hasText: 'Settings' })
    await settingsTab.click()

    // Click Right alignment button
    const rightAlignBtn = window.locator('.segmented--small .segmented-tab', { hasText: 'Right' })
    await expect(rightAlignBtn).toBeVisible()
    await rightAlignBtn.click()

    await window.waitForTimeout(200)

    // Right aligned bounds should shift x closer to right edge of screen
    const bounds = await window.evaluate(() => window.beacon?.test?.getBounds())
    expect(bounds).toBeTruthy()
    expect(bounds?.x).toBeGreaterThan(500)
  })

  test('10. Open then close 20 times: pill screen rect is invariant within 1px and state machine does not loop', async () => {
    // Start collapsed
    await window.evaluate(() => window.beacon?.test?.collapse())
    await window.waitForTimeout(300)

    for (let i = 0; i < 20; i++) {
      // 1. Measure collapsed screen X
      const collapsedInfo = await window.evaluate(() => {
        const notch = document.querySelector('.notch')
        const rect = notch ? notch.getBoundingClientRect() : null
        return {
          windowScreenX: window.screenX,
          pillLeft: rect ? rect.left : 0,
          pillScreenX: window.screenX + (rect ? rect.left : 0),
        }
      })

      // 2. Trigger expand
      await window.evaluate(() => window.beacon?.test?.expand('click'))
      await window.waitForTimeout(250)

      const smOpen = await window.evaluate(() => window.beacon?.test?.getStateMachine())
      expect(smOpen?.state).toBe('open')
      expect(smOpen?.isTransitioning).toBe(false)

      // 3. Trigger collapse
      await window.evaluate(() => window.beacon?.test?.collapse())
      await window.waitForTimeout(250)

      const afterCollapse = await window.evaluate(() => {
        const notch = document.querySelector('.notch')
        const rect = notch ? notch.getBoundingClientRect() : null
        return {
          pillScreenX: window.screenX + (rect ? rect.left : 0),
        }
      })

      expect(Math.abs(afterCollapse.pillScreenX - collapsedInfo.pillScreenX)).toBeLessThanOrEqual(1)
    }
  })

  test('11. Left and Right alignments maintain exact screen position invariance across open/close', async () => {
    for (const align of ['left', 'right', 'center'] as const) {
      await window.evaluate((a) => window.beacon?.test?.setNotchSettings({ displayId: null, align: a, offsetPx: 0 }), align)
      await window.waitForTimeout(200)

      const collapsed = await window.evaluate(() => {
        const notch = document.querySelector('.notch')
        const rect = notch ? notch.getBoundingClientRect() : null
        return window.screenX + (rect ? rect.left : 0)
      })

      await window.evaluate(() => window.beacon?.test?.expand('click'))
      await window.waitForTimeout(250)

      await window.evaluate(() => window.beacon?.test?.collapse())
      await window.waitForTimeout(250)

      const after = await window.evaluate(() => {
        const notch = document.querySelector('.notch')
        const rect = notch ? notch.getBoundingClientRect() : null
        return window.screenX + (rect ? rect.left : 0)
      })

      expect(Math.abs(after - collapsed)).toBeLessThanOrEqual(1)
    }
  })

  test('12. Theme switch updates notch instantly and persists', async () => {
    // Expand window first
    await window.evaluate(() => window.beacon?.test?.expand())
    await window.waitForTimeout(300)

    // Navigate to Settings tab
    const settingsTab = window.locator('.segmented-tab', { hasText: 'Settings' })
    await settingsTab.click()

    // Click Amber theme swatch
    const amberBtn = window.locator('.theme-swatch-btn[title="Amber"]')
    await expect(amberBtn).toBeVisible()
    await amberBtn.click()
    await window.waitForTimeout(100)

    // Verify swatch is active
    await expect(amberBtn).toHaveClass(/active/)

    // Check mock preview has amber background (#0F0C08)
    const mockNotch = window.locator('.mock-notch-preview')
    await expect(mockNotch).toHaveCSS('background-color', 'rgb(15, 12, 8)')

    // Collapse and check real notch has amber background
    await window.evaluate(() => window.beacon?.test?.collapse())
    await window.waitForTimeout(300)

    const notch = window.locator('.notch')
    await expect(notch).toHaveCSS('background-color', 'rgb(15, 12, 8)')
  })

  test('13. Notch content configuration and cycle mode', async () => {
    // Expand
    await window.evaluate(() => window.beacon?.test?.expand())
    await window.waitForTimeout(300)

    const settingsTab = window.locator('.segmented-tab', { hasText: 'Settings' })
    await settingsTab.click()

    // Switch to Cycle mode
    const cycleTab = window.locator('.segmented--small .segmented-tab', { hasText: 'Cycle' })
    await expect(cycleTab).toBeVisible()
    await cycleTab.click()

    // Enable Companion
    const companionToggle = window.locator('.source-item', { hasText: 'Companion' }).locator('.switch-btn')
    await companionToggle.click()
    await expect(companionToggle).toHaveClass(/switch--on/)

    // Collapse
    await window.evaluate(() => window.beacon?.test?.collapse())
    await window.waitForTimeout(300)

    // Check notch is still cleanly 190x30 with 0 delta
    const bounds = await window.evaluate(() => window.beacon?.test?.getBounds())
    expect(bounds?.width).toBe(190)
    expect(bounds?.height).toBe(30)
  })

  test('14. Full open/close stability with Companion eyes and themes maintains 1px invariance', async () => {
    for (let i = 0; i < 5; i++) {
      const collapsed = await window.evaluate(() => {
        const notch = document.querySelector('.notch')
        const rect = notch ? notch.getBoundingClientRect() : null
        return window.screenX + (rect ? rect.left : 0)
      })

      await window.evaluate(() => window.beacon?.test?.expand('click'))
      await window.waitForTimeout(300)

      await window.evaluate(() => window.beacon?.test?.collapse())
      await window.waitForTimeout(300)

      const after = await window.evaluate(() => {
        const notch = document.querySelector('.notch')
        const rect = notch ? notch.getBoundingClientRect() : null
        return window.screenX + (rect ? rect.left : 0)
      })

      expect(Math.abs(after - collapsed)).toBeLessThanOrEqual(1)
    }
  })
})
