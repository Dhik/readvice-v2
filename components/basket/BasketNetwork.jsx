'use client'
// Force-directed co-purchase network (d3-force + SVG). MAIN visual.
// SSR-safe by design: d3-force has no window-at-import dependency, AND the simulation is
// run only in useEffect (after mount). The sim is ticked to a settled state once (no
// ongoing animation) → it never jitters. 20 nodes / 34 edges is trivial.
//
// Honesty encodings: edge THICKNESS = co-occurrence count (not lift — so a single
// co-occurrence with a huge lift doesn't dominate); edges with co-occurrence === 1 are
// DASHED (weak signal), ≥2 SOLID. Node radius ∝ orders (sales volume).
import { useEffect, useMemo, useRef, useState } from 'react'
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force'
import { withAlpha, seriesColor } from '@/lib/charts/theme'
import { formatCurrency, formatNumber } from '@/lib/utils'

const VBW = 820, VBH = 480, PAD = 34
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const nodeR = d => clamp(5 + Math.sqrt(d.orders || 1) * 1.9, 6, 26)
const NODE_FILL = '#E07B39'   // orange (theme)

export default function BasketNetwork({ nodes = [], pairs = [], selectedSku = null, onSelectNode, height = 480 }) {
  const [layout, setLayout] = useState(null)
  const [hover, setHover] = useState(null)   // { kind:'node'|'edge', data, x, y }
  const wrapRef = useRef(null)

  // Run the force simulation ONCE, after mount, to a settled layout (no animation loop).
  useEffect(() => {
    if (!nodes.length) return   // parent guards empty; keep the only setState the computed one below
    const simNodes = nodes.map(n => ({ ...n, id: n.sku }))
    const simLinks = pairs.map(p => ({ ...p, source: p.a, target: p.b }))
    const sim = forceSimulation(simNodes)
      .force('link', forceLink(simLinks).id(d => d.id).distance(d => 70 + (3 - Math.min(d.cooccur, 3)) * 22).strength(0.5))
      .force('charge', forceManyBody().strength(-260))
      .force('center', forceCenter(VBW / 2, VBH / 2))
      .force('collide', forceCollide().radius(d => nodeR(d) + 5))
      .stop()
    const ticks = Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay()))
    for (let i = 0; i < ticks; i++) sim.tick()
    simNodes.forEach(d => { d.x = clamp(d.x, PAD, VBW - PAD); d.y = clamp(d.y, PAD, VBH - PAD) })
    const posBy = new Map(simNodes.map(d => [d.id, d]))
    setLayout({ nodes: simNodes, links: simLinks.map(l => ({ ...l, sx: posBy.get(l.a).x, sy: posBy.get(l.a).y, tx: posBy.get(l.b).x, ty: posBy.get(l.b).y })) })
  }, [nodes, pairs])

  const maxRev = useMemo(() => Math.max(1, ...nodes.map(n => n.revenue || 0)), [nodes])
  const adjacent = useMemo(() => {
    if (!selectedSku && !(hover?.kind === 'node')) return null
    const sku = hover?.kind === 'node' ? hover.data.sku : selectedSku
    const set = new Set([sku])
    for (const p of pairs) { if (p.a === sku) set.add(p.b); if (p.b === sku) set.add(p.a) }
    return { sku, set }
  }, [selectedSku, hover, pairs])

  const showTip = (e, kind, data) => {
    const r = wrapRef.current?.getBoundingClientRect()
    setHover({ kind, data, x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) })
  }

  if (!layout) return <div style={{ height }} className="flex items-center justify-center text-dark1/30 text-xs">Laying out…</div>

  return (
    <div ref={wrapRef} className="relative" style={{ height }}>
      <svg viewBox={`0 0 ${VBW} ${VBH}`} width="100%" height={height} preserveAspectRatio="xMidYMid meet">
        {/* edges */}
        {layout.links.map((l, i) => {
          const active = adjacent ? (adjacent.set.has(l.a) && adjacent.set.has(l.b)) : true
          const dim = adjacent && !active
          return (
            <line key={i} x1={l.sx} y1={l.sy} x2={l.tx} y2={l.ty}
              stroke={l.cooccur >= 2 ? withAlpha('#2C3639', dim ? 0.06 : 0.5) : withAlpha('#8B5E3C', dim ? 0.05 : 0.45)}
              strokeWidth={clamp(l.cooccur, 1, 4) * 1.3}
              strokeDasharray={l.cooccur === 1 ? '4 3' : undefined}
              onMouseMove={e => showTip(e, 'edge', l)} onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }} />
          )
        })}
        {/* nodes */}
        {layout.nodes.map(n => {
          const active = adjacent ? adjacent.set.has(n.sku) : true
          const dim = adjacent && !active
          const isSel = selectedSku === n.sku
          return (
            <g key={n.sku} transform={`translate(${n.x},${n.y})`} style={{ cursor: 'pointer' }}
              onMouseMove={e => showTip(e, 'node', n)} onMouseLeave={() => setHover(null)}
              onClick={() => onSelectNode && onSelectNode(n.sku)}>
              <circle r={nodeR(n)} fill={withAlpha(NODE_FILL, dim ? 0.12 : 0.35 + (n.revenue / maxRev) * 0.5)}
                stroke={isSel ? '#2C3639' : NODE_FILL} strokeWidth={isSel ? 2.5 : 1} />
              <text textAnchor="middle" dy={nodeR(n) + 9} fontSize="8" fill={dim ? 'rgba(44,54,57,0.3)' : 'rgba(44,54,57,0.75)'}>{n.sku}</text>
            </g>
          )
        })}
      </svg>

      {hover && (
        <div className="absolute z-10 pointer-events-none rounded-md shadow-lg text-[10px] px-2 py-1.5 bg-dark1 text-cream max-w-[220px]"
          style={{ left: Math.min(hover.x + 10, VBW - 180), top: hover.y + 10 }}>
          {hover.kind === 'node' ? (
            <>
              <div className="font-semibold text-white truncate">{hover.data.name}</div>
              <div>{hover.data.sku} · {formatNumber(hover.data.orders)} orders · {formatCurrency(hover.data.revenue)}</div>
              <div className="text-cream/60 mt-0.5">click → partners</div>
            </>
          ) : (
            <>
              <div className="font-semibold text-white">{hover.data.a} + {hover.data.b}</div>
              <div>co-occur <b>{hover.data.cooccur}</b>{hover.data.cooccur === 1 ? ' (n=1 — weak)' : ''} · support {hover.data.supportPct}%</div>
              <div>conf {hover.data.confidenceAtoB}% / {hover.data.confidenceBtoA}% · lift <b>{hover.data.lift}×</b></div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
