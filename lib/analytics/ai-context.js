// ─── AI page-context summarizer (Part D3) ────────────────────────────────────
// Trim a module's engine response before sending it to the AI as page-context.
// Large arrays are bounded to a top-N HEAD (engine responses are pre-sorted, so the
// head IS the top-N: highest lift, biggest profit, etc.) while EVERY honesty flag is
// preserved — both on the kept rows AND in a top-level `_honesty` digest scanned from
// the FULL response. The digest is the safety net: even if a flagged row gets
// truncated, `_honesty.anyDummy` / `smallSample` / `notes` still reach the agent, so a
// trimmed payload can never make it overclaim. Small overview-only modules pass through
// ~unchanged. Pure JS (no prisma) → safe to import client-side in the panel.

const MAX_ARRAY = 12

// Collect honesty signals from anywhere in the tree (survive array truncation).
function collectHonesty(node, acc) {
  if (Array.isArray(node)) { for (const n of node) collectHonesty(n, acc); return }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'dummy' && v === true) acc.anyDummy = true
      else if (k === 'returnDummy' && v === true) acc.returnDummy = true
      else if (k === 'costReal' && v === true) acc.costReal = true
      else if (k === 'smallSample' && v === true) acc.smallSample = true
      else if (k === 'selfReportedGmv' && v === true) acc.selfReportedGmv = true
      else if (k === 'objectiveInferred' && v === true) acc.hasInferredObjective = true
      else if (k === 'coveragePct' && typeof v === 'number') acc.minCoveragePct = Math.min(acc.minCoveragePct ?? Infinity, v)
      else if (k === 'note' && typeof v === 'string' && v) acc.notes.add(v)
      collectHonesty(v, acc)
    }
  }
}

// Deep-copy, capping every array to its top-N head + a truncation marker.
function trimNode(node) {
  if (Array.isArray(node)) {
    const head = node.slice(0, MAX_ARRAY).map(trimNode)
    if (node.length > MAX_ARRAY) head.push({ _truncated: `+${node.length - MAX_ARRAY} more (top ${MAX_ARRAY} shown, sorted by the module's primary metric)` })
    return head
  }
  if (node && typeof node === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(node)) out[k] = trimNode(v)
    return out
  }
  return node
}

/**
 * @param {string} module  the analytics module key (e.g. 'basket')
 * @param {object} response the engine response the page rendered
 * @returns {object} a bounded, honesty-preserving context: { module, _honesty, ...trimmed }
 */
export function contextFor(module, response) {
  if (!response || typeof response !== 'object') return { module, data: response ?? null }
  const acc = { notes: new Set() }
  collectHonesty(response, acc)
  const _honesty = {
    anyDummy: !!acc.anyDummy,
    smallSample: !!acc.smallSample,
    ...(acc.costReal ? { costReal: true } : {}),
    ...(acc.returnDummy ? { returnDummy: true } : {}),
    ...(acc.selfReportedGmv ? { selfReportedGmv: true } : {}),
    ...(acc.hasInferredObjective ? { hasInferredObjective: true } : {}),
    ...(acc.minCoveragePct != null && acc.minCoveragePct !== Infinity ? { minCoveragePct: acc.minCoveragePct } : {}),
    notes: [...acc.notes].slice(0, 6),
  }
  return { module, _honesty, ...trimNode(response) }
}

// Serialized byte length (verify bounds / server backstop).
export function contextSize(ctx) { try { return JSON.stringify(ctx).length } catch { return 0 } }
