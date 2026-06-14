// ─── Shared chart theme & foundation (Fase 2a) ───────────────────────────────
// Single source of truth for chart colors + global chart.js defaults + ONE
// central registration of controllers/elements/plugins.
//
// HOW REGISTRATION STAYS SAFE: this module registers chart.js components and
// applies Chart.defaults as a TOP-LEVEL side-effect on first import (idempotent).
// Every chart file imports a *named, used* export from here (a palette / helper /
// baseOptions) — never a bare `import`. Because ESM evaluates an imported module
// before the importer's body runs, and React can't render a component before its
// module body runs, registration ALWAYS completes before the first chart renders.
// Idempotency means multiple importers can't double-register. (This mirrors the
// previous per-file `Chart.register(...registerables)` pattern, centralized.)
import { Chart, registerables } from 'chart.js'
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix'
import ChartDataLabels from 'chartjs-plugin-datalabels'
// NB: chartjs-plugin-zoom is NOT imported statically — it pulls in hammerjs, which
// references `window` at import time and would crash SSR (client components are
// evaluated server-side too). It's loaded client-only via dynamic import below.
// Safe to register late: no chart uses zoom yet (pre-registered for Fase 2b).

// ── Palette: brand-derived categorical (replaces every local palette) ─────────
export const CHART_PALETTE = [
  '#E07B39', // orange   (brand primary)
  '#2C3639', // dark1
  '#3F4E4F', // dark2
  '#8B5E3C', // brown
  '#DCD7C9', // cream
  '#A9C5A0', // sage
  '#C9A66B', // gold
  '#6B8E9E', // slate-blue
  '#B5645B', // clay
]

export const SEMANTIC = { success: '#22c55e', warning: '#f59e0b', danger: '#dc3545' }

// Consistent marketplace colors on EVERY page (case-insensitive lookup).
export const PLATFORM_COLORS = {
  shopee:    '#EE4D2D',
  tiktok:    '#010101',
  lazada:    '#0F146D',
  tokopedia: '#03AC0E',
  meta:      '#1877F2',
  facebook:  '#1877F2',
}

// Cycle the categorical palette by index.
export const seriesColor = (i) => CHART_PALETTE[((i % CHART_PALETTE.length) + CHART_PALETTE.length) % CHART_PALETTE.length]

// Marketplace color by name (falls back to the primary palette color).
export const platformColor = (name) => PLATFORM_COLORS[String(name ?? '').toLowerCase()] ?? CHART_PALETTE[0]

// #RRGGBB → rgba(...) — for translucent line fills derived from a palette color.
export const withAlpha = (hex, a = 0.1) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex))
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

// Spread into a chart's `options` (height comes from the container, so no aspect).
export const baseOptions = { responsive: true, maintainAspectRatio: false }

// Deep-merge plain objects (arrays/functions/scalars replace) — lets a chart pass
// only the deltas (tooltip callbacks, zoom, datalabels) over the base options
// without clobbering sibling keys like legend/scales. Extends baseOptions usage.
const isPlainObj = v => v && typeof v === 'object' && !Array.isArray(v)
export function mergeOptions(base, override) {
  if (!isPlainObj(override)) return base
  const out = { ...base }
  for (const k of Object.keys(override)) {
    out[k] = isPlainObj(base?.[k]) && isPlainObj(override[k])
      ? mergeOptions(base[k], override[k])
      : override[k]
  }
  return out
}

// ── Registration + global defaults (run once, on import) ──────────────────────
let booted = false

function registerCharts() {
  // SSR-safe components/plugins, registered synchronously. (Chart.register is
  // idempotent.) zoom is registered client-only — see applyChartTheme().
  Chart.register(...registerables, MatrixController, MatrixElement, ChartDataLabels)
}

export function applyChartTheme() {
  if (booted) return
  registerCharts()

  Chart.defaults.font.family = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  Chart.defaults.font.size   = 11
  Chart.defaults.color       = 'rgba(44,54,57,0.7)' // ticks / legend text
  Chart.defaults.animation.duration = 400
  // NB: maintainAspectRatio is intentionally NOT set globally — charts that need
  // it false already pass it (or use `baseOptions`); charts relying on the default
  // (e.g. canvas + maxHeight) must keep working unchanged.

  Chart.defaults.plugins.legend.labels.boxWidth     = 12
  Chart.defaults.plugins.legend.labels.usePointStyle = true
  Chart.defaults.plugins.legend.labels.font          = { size: 11 }

  // Branded dark tooltip (was chart.js default white everywhere).
  Object.assign(Chart.defaults.plugins.tooltip, {
    backgroundColor: '#2C3639',
    titleColor:      '#ffffff',
    bodyColor:       '#DCD7C9',
    borderColor:     '#E07B39',
    borderWidth:     1,
    padding:         10,
    cornerRadius:    8,
    displayColors:   true,
    boxPadding:      4,
  })

  // Grid lines: subtle brand-tinted.
  Chart.defaults.scale.grid.color = 'rgba(44,54,57,0.06)'

  // datalabels is REGISTERED but OFF by default — opt-in per chart via
  // options.plugins.datalabels.display = true.
  Chart.defaults.plugins.datalabels = { display: false }

  booted = true
}

// Top-level side-effect: guarantees defaults + registration before any render.
applyChartTheme()

// ── zoom plugin: client-only, async (Fase 2b) ────────────────────────────────
// chartjs-plugin-zoom pulls in hammerjs (touches `window`), so it must NOT load on
// SSR. It's a code-split dynamic import. chart.js attaches plugins at chart
// CONSTRUCTION, so a chart wanting zoom must be built AFTER this resolves — consumers
// await `zoomReady` and remount (key-flip) the chart once it's true. Resolves to
// false on the server or if the import fails (zoom is non-essential / opt-in).
export const zoomReady = (typeof window !== 'undefined')
  ? import('chartjs-plugin-zoom')
      .then(m => { Chart.register(m.default ?? m); return true })
      .catch(() => false)
  : Promise.resolve(false)
