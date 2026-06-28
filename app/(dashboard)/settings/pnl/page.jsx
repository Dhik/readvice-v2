'use client'
// Net P&L business-rules editor (Wave 3.3) — where a tenant turns config-default layers
// into configured ones and ENTERS opex (which ungates the true net). Tenant-scoped via
// session; PATCHes /api/settings/pnl-config. Opex starts EMPTY — entering it is what makes
// the net real (never a fabricated number).
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import CompactPage from '@/components/dashboard/CompactPage'
import CompactTopbar from '@/components/dashboard/CompactTopbar'
import CompactPanel from '@/components/dashboard/CompactPanel'

const PLATFORM_ORDER = ['shopee', 'tiktok', 'tokopedia', 'lazada', 'default']

export default function PnlConfigPage() {
  const [cfg, setCfg] = useState(null)
  const [hasRow, setHasRow] = useState(false)
  const [feePct, setFeePct] = useState({})
  const [taxPct, setTaxPct] = useState('0.5')
  const [marketingDeducted, setMarketingDeducted] = useState(true)
  const [opex, setOpex] = useState([])   // [{ label, mode:'amount'|'pct', value }]
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    fetch('/api/settings/pnl-config').then(r => r.json()).then(d => {
      if (d?.error) return
      setCfg(d.config); setHasRow(d.hasConfigRow)
      setFeePct({ ...d.config.platformFeePct })
      setTaxPct(String(d.config.taxPct))
      setMarketingDeducted(!!d.config.marketingDeducted)
      setOpex((d.config.opexCategories ?? []).map(c => ({ label: c.label, mode: c.amount != null ? 'amount' : 'pct', value: String(c.amount != null ? c.amount : c.pct) })))
    }).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  function setFee(k, v) { setFeePct(f => ({ ...f, [k]: v })) }
  function addOpex() { setOpex(o => [...o, { label: '', mode: 'amount', value: '' }]) }
  function setOpexRow(i, patch) { setOpex(o => o.map((r, j) => j === i ? { ...r, ...patch } : r)) }
  function removeOpex(i) { setOpex(o => o.filter((_, j) => j !== i)) }

  async function save() {
    setSaving(true)
    try {
      const platformFeePct = {}
      for (const k of Object.keys(feePct)) platformFeePct[k] = Number(feePct[k])
      const opexCategories = opex
        .filter(r => r.label.trim() && r.value !== '')
        .map(r => r.mode === 'amount' ? { label: r.label.trim(), amount: Number(r.value) } : { label: r.label.trim(), pct: Number(r.value) })
      const res = await fetch('/api/settings/pnl-config', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformFeePct, taxPct: Number(taxPct), marketingDeducted, opexCategories }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d?.error || 'Save failed'); return }
      toast.success('P&L rules saved')
      load()
    } catch (e) { toast.error(e.message || 'Save failed') } finally { setSaving(false) }
  }

  if (!cfg) return <CompactPage><CompactTopbar title="P&L Rules" icon="fa-sliders" /><div className="text-dark1/40 text-xs py-8 text-center">Loading…</div></CompactPage>

  return (
    <CompactPage>
      <CompactTopbar title="P&L Rules" icon="fa-sliders"
        actions={<>
          <Link href="/analytics/pnl" className="sv-tbtn sv-tbtn-ghost"><i className="fas fa-scale-balanced" /> View P&L</Link>
          <button onClick={save} disabled={saving} className="sv-tbtn sv-tbtn-dark disabled:opacity-40"><i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-check'}`} /> Save rules</button>
        </>}>
        <span className="text-[10px] text-dark1/45">{hasRow ? 'configured' : 'using factual defaults'}</span>
      </CompactTopbar>

      <div className="flex items-start gap-2 rounded-lg border border-cream bg-bg/60 px-3 py-2 text-[11px] text-dark1/80">
        <i className="fas fa-circle-info text-dark2 mt-0.5" />
        <span>These rules drive your <Link href="/analytics/pnl" className="underline">Net P&L</Link>. Platform fees &amp; tax start from <b>researched defaults</b> — adjust to your actual rates. <b>Opex starts empty</b>; the net stays &ldquo;before opex&rdquo; until you add at least one category (we never fabricate a net).</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-2">
        <CompactPanel title="Platform fees (% of that platform's revenue)" icon="fa-store" bodyClass="p-3">
          <div className="grid grid-cols-2 gap-2">
            {PLATFORM_ORDER.filter(k => k in feePct).map(k => (
              <label key={k} className="text-xs text-dark1/70">{k}
                <input type="number" step="0.1" value={feePct[k] ?? ''} onChange={e => setFee(k, e.target.value)}
                  className="w-full border border-cream rounded text-sm px-2 py-1 mt-0.5 bg-white text-dark1 focus:outline-none focus:border-dark2" />
              </label>
            ))}
          </div>
          <p className="text-[10px] text-dark1/40 mt-2">Researched mid-2026 marketplace admin fees. <code>default</code> applies to any unlisted platform.</p>
        </CompactPanel>

        <CompactPanel title="Tax & marketing" icon="fa-file-invoice-dollar" bodyClass="p-3">
          <label className="text-xs text-dark1/70">Tax % (on gross revenue)
            <input type="number" step="0.1" value={taxPct} onChange={e => setTaxPct(e.target.value)}
              className="w-full border border-cream rounded text-sm px-2 py-1 mt-0.5 bg-white text-dark1 focus:outline-none focus:border-dark2" />
          </label>
          <p className="text-[10px] text-dark1/40 mt-1">Default 0.5% = Indonesian UMKM final income tax (PP 55/2022).</p>
          <label className="flex items-center gap-2 mt-3 cursor-pointer select-none text-xs text-dark1/80">
            <input type="checkbox" className="w-4 h-4 rounded accent-orange" checked={marketingDeducted} onChange={e => setMarketingDeducted(e.target.checked)} />
            Deduct marketing spend in the P&L
          </label>
        </CompactPanel>
      </div>

      <CompactPanel title="Operating expenses (opex)" icon="fa-receipt" bodyClass="p-3"
        headerRight={<button onClick={addOpex} className="sv-tbtn sv-tbtn-ghost text-[10px]"><i className="fas fa-plus" /> Add category</button>}>
        {opex.length === 0 ? (
          <div className="text-[11px] text-dark1/50 py-2"><i className="fas fa-circle-info" /> No opex entered — your Net P&L will show <b>&ldquo;net before opex&rdquo;</b> (not a final net). Add categories (rent, salaries, packaging, …) to see true net.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {opex.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <input placeholder="Label (e.g. Salaries)" value={r.label} onChange={e => setOpexRow(i, { label: e.target.value })}
                  className="flex-1 border border-cream rounded text-sm px-2 py-1 bg-white text-dark1 focus:outline-none focus:border-dark2" />
                <select value={r.mode} onChange={e => setOpexRow(i, { mode: e.target.value })} className="border border-cream rounded text-xs px-2 py-1 h-8 bg-white">
                  <option value="amount">Rp amount</option>
                  <option value="pct">% of revenue</option>
                </select>
                <input type="number" step="0.01" placeholder={r.mode === 'amount' ? 'Rp' : '%'} value={r.value} onChange={e => setOpexRow(i, { value: e.target.value })}
                  className="w-32 border border-cream rounded text-sm px-2 py-1 bg-white text-dark1 focus:outline-none focus:border-dark2" />
                <button onClick={() => removeOpex(i)} className="text-dark1/30 hover:text-red-500 text-sm w-6"><i className="fas fa-trash-alt" /></button>
              </div>
            ))}
          </div>
        )}
      </CompactPanel>
    </CompactPage>
  )
}
