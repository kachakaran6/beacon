/**
 * Pure function to compute notch and panel bounds on any given display
 * with alignment, signed pixel offset, and display boundary clamping.
 */

export const NOTCH_WIDTH = 190
export const NOTCH_HEIGHT = 30
export const PANEL_DEFAULT_WIDTH = 960
export const PANEL_DEFAULT_HEIGHT = 420
export const DISPLAY_MARGIN = 8

export const NOTCH_CORNER_RADIUS = 15
export const PANEL_CORNER_RADIUS = 28
export const NOTCH_AUTOHIDE_RADIUS = 2

/**
 * Computes polygon path vertices for top-flat, bottom-rounded notch/panel window at a specific DPI.
 */
export function computeWindowShapeVertices(width, height, radius, dpi = 1.0) {
  const w = Math.round(width * dpi)
  const h = Math.round(height * dpi)
  const r = Math.min(Math.round(radius * dpi), Math.floor(h), Math.floor(w / 2))

  const points = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h - r },
  ]

  // Bottom-right arc from angle 0 (right edge) to PI/2 (bottom edge)
  const arcSegments = 4
  for (let i = 1; i <= arcSegments; i++) {
    const angle = (Math.PI / 2) * (i / arcSegments)
    points.push({
      x: Math.round(w - r + Math.cos(angle) * r),
      y: Math.round(h - r + Math.sin(angle) * r),
    })
  }

  // Bottom-left arc from angle PI/2 (bottom edge) to PI (left edge)
  for (let i = 1; i <= arcSegments; i++) {
    const angle = Math.PI / 2 + (Math.PI / 2) * (i / arcSegments)
    points.push({
      x: Math.round(r + Math.cos(angle) * r),
      y: Math.round(h - r + Math.sin(angle) * r),
    })
  }

  points.push({ x: 0, y: 0 })
  return points
}

export function computeNotchBounds(display, notchSettings = {}, size = { width: NOTCH_WIDTH, height: NOTCH_HEIGHT }) {
  if (!display || !display.bounds) {
    throw new Error('Valid display with bounds is required')
  }

  const { bounds } = display
  const align = notchSettings.align || 'center'
  const offsetPx = Number(notchSettings.offsetPx) || 0

  // 1. Compute target notch center X
  let rawNotchCenterX
  if (align === 'left') {
    rawNotchCenterX = bounds.x + DISPLAY_MARGIN + NOTCH_WIDTH / 2 + offsetPx
  } else if (align === 'right') {
    rawNotchCenterX = bounds.x + bounds.width - DISPLAY_MARGIN - NOTCH_WIDTH / 2 + offsetPx
  } else {
    // center
    rawNotchCenterX = bounds.x + bounds.width / 2 + offsetPx
  }

  // 2. Clamp notch center so 190px notch stays fully on display with 8px margin
  const minNotchCenter = bounds.x + DISPLAY_MARGIN + NOTCH_WIDTH / 2
  const maxNotchCenter = bounds.x + bounds.width - DISPLAY_MARGIN - NOTCH_WIDTH / 2

  let notchCenterX
  if (minNotchCenter > maxNotchCenter) {
    // Display smaller than notch + margins
    notchCenterX = bounds.x + bounds.width / 2
  } else {
    notchCenterX = Math.max(minNotchCenter, Math.min(maxNotchCenter, rawNotchCenterX))
  }

  const isPanel = size.width > NOTCH_WIDTH || size.height > NOTCH_HEIGHT

  if (!isPanel) {
    // Collapsed notch
    return {
      x: Math.round(notchCenterX - NOTCH_WIDTH / 2),
      y: Math.round(bounds.y),
      width: NOTCH_WIDTH,
      height: Math.round(size.height || NOTCH_HEIGHT),
      originX: 0.5,
    }
  }

  // Expanded panel
  const maxPanelWidth = Math.max(200, Math.floor(bounds.width * 0.92))
  const targetWidth = Math.min(size.width || PANEL_DEFAULT_WIDTH, maxPanelWidth)
  const targetHeight = size.height || PANEL_DEFAULT_HEIGHT

  const rawPanelX = notchCenterX - targetWidth / 2
  const minPanelX = bounds.x + DISPLAY_MARGIN
  const maxPanelX = bounds.x + bounds.width - DISPLAY_MARGIN - targetWidth

  let panelX
  if (minPanelX > maxPanelX) {
    panelX = bounds.x
  } else {
    panelX = Math.max(minPanelX, Math.min(maxPanelX, rawPanelX))
  }

  const originX = targetWidth > 0 ? (notchCenterX - panelX) / targetWidth : 0.5
  const clampedOriginX = Math.max(0, Math.min(1, originX))

  return {
    x: Math.round(panelX),
    y: Math.round(bounds.y),
    width: Math.round(targetWidth),
    height: Math.round(targetHeight),
    originX: Number(clampedOriginX.toFixed(4)),
  }
}
