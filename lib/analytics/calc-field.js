// ─── Calculated-field evaluator (Part B2 — the sandbox) ──────────────────────
// Evaluates a user-defined formula over a module's FIELD_MANIFEST params. The
// sandbox is the whole point: ONLY arithmetic (+ - * / %, parentheses, unary ±)
// over manifest param keys is allowed. Anything else — unknown symbols, function
// calls, power/factorial, comparisons, ternaries, assignments, constants like
// e/pi — is REJECTED (throws). There is no JS eval; we parse with mathjs, then
// walk the AST and reject any node outside the arithmetic whitelist BEFORE
// evaluating in a numeric-only scope restricted to the referenced params.
//
//   evaluate(formula, paramValues, manifest) -> { value, dummy }
//
// `dummy` is true when the formula references ANY manifest param flagged dummy.
// Structural violations THROW (so the UI can surface an inline validation error);
// a structurally-valid formula that computes a non-finite result (division by
// zero, Infinity, NaN) returns { value: null, dummy } — guarded, never throws.
import { parse } from 'mathjs'

// AST node types allowed in a calc-field formula. Everything else (FunctionNode,
// ConditionalNode, AssignmentNode, AccessorNode, ArrayNode, RangeNode, …) is rejected.
const ALLOWED_NODE_TYPES = new Set(['ConstantNode', 'SymbolNode', 'OperatorNode', 'ParenthesisNode'])

// Arithmetic operator functions only. Explicitly NOT pow (^), factorial (!),
// comparisons (larger/smaller/equal…), bitwise, etc.
const ALLOWED_OPERATOR_FNS = new Set(['add', 'subtract', 'multiply', 'divide', 'mod', 'unaryMinus', 'unaryPlus'])

// Coerce a runtime param value to a finite number for the scope (null/undefined/
// non-numeric → 0, so a missing value never crashes a live preview).
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }

// Recursively validate the AST: only arithmetic over whitelisted symbols. Collects
// referenced symbol names into `referenced`. Throws on the first violation.
function validateNode(node, whitelist, referenced) {
  if (!node || !ALLOWED_NODE_TYPES.has(node.type)) {
    const detail = node?.fn ? ` (${node.fn})` : ''
    throw new Error(`Disallowed expression: ${node?.type ?? 'empty'}${detail}`)
  }
  if (node.type === 'OperatorNode' && !ALLOWED_OPERATOR_FNS.has(node.fn)) {
    throw new Error(`Operator not allowed: ${node.op ?? node.fn}`)
  }
  if (node.type === 'SymbolNode') {
    if (!whitelist.has(node.name)) throw new Error(`Unknown symbol: ${node.name}`)
    referenced.add(node.name)
  }
  // forEach visits the node's direct children (args / parenthesis content).
  node.forEach(child => validateNode(child, whitelist, referenced))
}

/**
 * Evaluate a calculated-field formula in the sandbox.
 * @param {string} formula        arithmetic over manifest param keys, e.g. "(revenue-hpp)/hpp*100"
 * @param {object} paramValues    { paramKey: number } for the current row / overview
 * @param {Array}  manifest       the module's FIELD_MANIFEST ({ key, label, unit, dummy, source }[])
 * @returns {{ value: number|null, dummy: boolean }}
 * @throws  on an empty / structurally-invalid / unsafe formula (the rejection path)
 */
export function evaluate(formula, paramValues = {}, manifest = []) {
  if (typeof formula !== 'string' || !formula.trim()) throw new Error('Formula is empty')

  const byKey = new Map((manifest ?? []).map(m => [m.key, m]))
  const whitelist = new Set(byKey.keys())

  // 1. Parse with mathjs (grammar only — we restrict the AST ourselves next).
  let node
  try { node = parse(formula) }
  catch (e) { throw new Error(`Invalid formula: ${e.message}`) }

  // 2. Reject anything outside arithmetic-over-whitelisted-params; collect refs.
  const referenced = new Set()
  validateNode(node, whitelist, referenced)

  // 3. dummy = the formula touches ANY dummy-flagged param.
  const dummy = [...referenced].some(k => byKey.get(k)?.dummy === true)

  // 4. Evaluate in a numeric-only scope holding ONLY the referenced params.
  const scope = {}
  for (const k of referenced) scope[k] = num(paramValues[k])
  let value
  try { value = node.evaluate(scope) }
  catch { return { value: null, dummy } }   // guard — never throw from evaluation

  // 5. Guard non-finite / non-number results (division by zero, Infinity, NaN).
  if (typeof value !== 'number' || !Number.isFinite(value)) return { value: null, dummy }
  return { value, dummy }
}
