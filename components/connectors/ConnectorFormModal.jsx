'use client'
import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import FieldMappingBuilder from './FieldMappingBuilder'
import SheetPreview from './SheetPreview'
import { CONNECTOR_TYPES, TARGET_TABLES, TRANSFORMS, validateColumnMapping } from '@/lib/connectors/transforms'
import { SUPPORTED_SOURCE_TYPES } from '@/lib/connectors/source-config'
import { FIELD_LISTS } from '@/lib/connectors/field-lists'
import toast from 'react-hot-toast'

const emptyField = () => ({ enabled: false, transform: 'string', sheetColumn: '', useAdd: false, addColumn: '', value: '' })

// Build the per-field builder state for a target table, hydrating from an
// existing columnMapping (edit mode) where field names overlap.
function buildState(targetTable, columnMapping = {}) {
  const out = {}
  for (const field of FIELD_LISTS[targetTable] ?? []) {
    const m = columnMapping?.[field]
    if (!m) { out[field] = emptyField(); continue }
    out[field] = {
      enabled:    true,
      transform:  m.transform ?? 'string',
      sheetColumn: m.sheetColumn ?? '',
      useAdd:     m.addColumn !== undefined,
      addColumn:  m.addColumn ?? '',
      value:      m.value ?? '',
    }
  }
  return out
}

// Serialize builder state → the exact CS1 columnMapping JSON shape.
function toColumnMapping(state) {
  const out = {}
  for (const [field, c] of Object.entries(state)) {
    if (!c.enabled) continue
    if (c.transform === TRANSFORMS.STATIC) {
      out[field] = { transform: 'static', value: c.value }
      continue
    }
    out[field] = { sheetColumn: c.sheetColumn === '' ? null : Number(c.sheetColumn), transform: c.transform }
    if (c.useAdd && c.addColumn !== '') out[field].addColumn = Number(c.addColumn)
  }
  return out
}

export default function ConnectorFormModal({ connector = null, tenants = [], onClose, onSuccess }) {
  const editing = Boolean(connector)
  const [form, setForm] = useState({
    name:          '',
    tenantId:      '',
    connectorType: 'order_sync',
    sourceType:    'google_sheets',
    spreadsheetId: '',
    sheetTab:      'Sheet1',
    dataRange:     'A2:R',
    driveFileId:    '',   // google_drive_file → sourceConfig.fileId
    driveSheetTab:  '',   // xlsx worksheet (optional)
    driveHeaderRows: '1', // leading rows to skip (mirrors a Sheets A2:… range)
    targetTable:   'Order',
    upsertKey:     'orderId,tenantId',
    isActive:      true,
  })
  const [mapping, setMapping]   = useState(() => buildState('Order'))
  const [platform, setPlatform] = useState('')
  const [channel, setChannel]   = useState('')
  const [staticJson, setStaticJson] = useState('{}')
  const [saving, setSaving]     = useState(false)

  // Hydrate on open / connector change.
  useEffect(() => {
    if (connector) {
      const sc = connector.sourceConfig ?? {}
      setForm({
        name:          connector.name,
        tenantId:      String(connector.tenantId),
        connectorType: connector.connectorType,
        sourceType:    connector.sourceType || 'google_sheets',
        spreadsheetId: connector.spreadsheetId,
        sheetTab:      connector.sheetTab,
        dataRange:     connector.dataRange,
        driveFileId:    sc.fileId ?? '',
        driveSheetTab:  sc.sheetTab ?? '',
        driveHeaderRows: sc.headerRows != null ? String(sc.headerRows) : '1',
        targetTable:   connector.targetTable,
        upsertKey:     Array.isArray(connector.upsertKey) ? connector.upsertKey.join(',') : '',
        isActive:      connector.isActive,
      })
      setMapping(buildState(connector.targetTable, connector.columnMapping))
      const sv = connector.staticValues ?? {}
      setPlatform(sv.platform ?? '')
      setChannel(sv.salesChannelId != null ? String(sv.salesChannelId) : '')
      setStaticJson(JSON.stringify(sv, null, 2))
    }
  }, [connector])

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  // When the target table changes, rebuild the field list (preserving overlap).
  function onTargetChange(targetTable) {
    setField('targetTable', targetTable)
    setMapping(prev => {
      const next = buildState(targetTable)
      for (const field of Object.keys(next)) if (prev[field]) next[field] = prev[field]
      return next
    })
  }

  const isOrderSync = form.connectorType === 'order_sync'

  function buildStaticValues() {
    if (isOrderSync) {
      const sv = {}
      if (platform.trim()) sv.platform = platform.trim()
      if (channel !== '')  sv.salesChannelId = Number(channel)
      return Object.keys(sv).length ? sv : null
    }
    const txt = staticJson.trim()
    if (!txt || txt === '{}') return null
    return JSON.parse(txt) // may throw → caught in submit
  }

  async function onSubmit(e) {
    e.preventDefault()

    const columnMapping = toColumnMapping(mapping)
    // Client-side validation (server re-validates as source of truth).
    try {
      validateColumnMapping(columnMapping)
    } catch (err) {
      toast.error(err.message)
      return
    }
    if (Object.keys(columnMapping).length === 0) {
      toast.error('Map at least one field')
      return
    }

    let staticValues
    try { staticValues = buildStaticValues() }
    catch { toast.error('staticValues must be valid JSON'); return }

    const upsertKey = form.upsertKey.split(',').map(s => s.trim()).filter(Boolean)
    if (upsertKey.length === 0) { toast.error('upsertKey is required (e.g. orderId,tenantId)'); return }
    if (!form.tenantId) { toast.error('Select a tenant'); return }
    const isDrive = form.sourceType === 'google_drive_file'
    if (isDrive && !form.driveFileId.trim()) { toast.error('Drive File ID is required'); return }

    const payload = {
      name:          form.name.trim(),
      tenantId:      Number(form.tenantId),
      connectorType: form.connectorType,
      sourceType:    form.sourceType,
      // Source locator — Sheets columns OR a Drive sourceConfig (server normalizes/validates).
      ...(isDrive
        ? { sourceConfig: {
              fileId: form.driveFileId.trim(),
              ...(form.driveSheetTab.trim() ? { sheetTab: form.driveSheetTab.trim() } : {}),
              ...(form.driveHeaderRows !== '' ? { headerRows: Number(form.driveHeaderRows) } : {}),
            } }
        : { spreadsheetId: form.spreadsheetId.trim(), sheetTab: form.sheetTab.trim(), dataRange: form.dataRange.trim() }),
      targetTable:   form.targetTable,
      upsertKey,
      columnMapping,
      staticValues,
      isActive:      form.isActive,
    }

    setSaving(true)
    const url    = editing ? `/api/connectors/${connector.id}` : '/api/connectors'
    const method = editing ? 'PUT' : 'POST'
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false)

    if (res.ok) {
      toast.success(editing ? 'Connector updated' : 'Connector created')
      onSuccess?.()
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'Save failed')
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="max-w-3xl"
      title={editing ? 'Edit Connector' : 'New Connector'}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
          <button type="submit" form="connector-form" disabled={saving} className="btn btn-primary">
            {saving ? 'Saving…' : 'Save Connector'}
          </button>
        </>
      }
    >
      <form id="connector-form" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3">
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input className="form-input" placeholder="cleora-shopee" value={form.name}
              onChange={e => setField('name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Tenant *</label>
            <select className="form-input" value={form.tenantId} onChange={e => setField('tenantId', e.target.value)}>
              <option value="">— select —</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Connector Type *</label>
            <select className="form-input" value={form.connectorType} onChange={e => setField('connectorType', e.target.value)}>
              {CONNECTOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Target Table *</label>
            <select className="form-input" value={form.targetTable} onChange={e => onTargetChange(e.target.value)}>
              {TARGET_TABLES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group md:col-span-2">
            <label className="form-label">Source *</label>
            <select className="form-input" value={form.sourceType} onChange={e => setField('sourceType', e.target.value)}>
              {SUPPORTED_SOURCE_TYPES.map(s => <option key={s} value={s}>{s === 'google_sheets' ? 'Google Sheets' : 'Google Drive file (csv / xlsx)'}</option>)}
            </select>
          </div>

          {form.sourceType === 'google_sheets' ? (
            <>
              <div className="form-group md:col-span-2">
                <label className="form-label">Spreadsheet ID *</label>
                <input className="form-input font-mono text-xs" placeholder="1ksZm0f…" value={form.spreadsheetId}
                  onChange={e => setField('spreadsheetId', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Sheet Tab *</label>
                <input className="form-input" placeholder="Sheet1" value={form.sheetTab}
                  onChange={e => setField('sheetTab', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Data Range *</label>
                <input className="form-input font-mono text-sm" placeholder="A2:R" value={form.dataRange}
                  onChange={e => setField('dataRange', e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div className="form-group md:col-span-2">
                <label className="form-label">Drive File ID *</label>
                <input className="form-input font-mono text-xs" placeholder="1AbCdEf… (from the file's share URL)" value={form.driveFileId}
                  onChange={e => setField('driveFileId', e.target.value)} />
                <p className="text-[10px] text-orange/90 mt-1"><i className="fas fa-triangle-exclamation" /> Share the file with the <b>service-account email</b> (Viewer) — the #1 Drive gotcha. csv or xlsx only (a native Google Sheet → use the Google Sheets source instead).</p>
              </div>
              <div className="form-group">
                <label className="form-label">Sheet name <span className="text-dark2/40 font-normal">(xlsx, optional)</span></label>
                <input className="form-input" placeholder="(first sheet)" value={form.driveSheetTab}
                  onChange={e => setField('driveSheetTab', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Header rows to skip <span className="text-dark2/40 font-normal">(default 1)</span></label>
                <input type="number" className="form-input font-mono text-sm" placeholder="1" value={form.driveHeaderRows}
                  onChange={e => setField('driveHeaderRows', e.target.value)} />
              </div>
            </>
          )}
          <div className="form-group md:col-span-2">
            <label className="form-label">Upsert Key * <span className="text-dark2/40 font-normal">(comma-separated field names)</span></label>
            <input className="form-input font-mono text-sm" placeholder="orderId,tenantId" value={form.upsertKey}
              onChange={e => setField('upsertKey', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 rounded accent-orange" checked={form.isActive}
              onChange={e => setField('isActive', e.target.checked)} />
            <span className="form-label mb-0">Active</span>
          </label>
        </div>

        {/* Static values */}
        <div className="border-t border-cream/60 pt-2 mt-1">
          <div className="form-label mb-1">Static Values <span className="text-dark2/40 font-normal">(applied to every row)</span></div>
          {isOrderSync ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3">
              <div className="form-group">
                <label className="form-label">platform</label>
                <input className="form-input text-sm" placeholder="shopee" value={platform}
                  onChange={e => setPlatform(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">salesChannelId</label>
                <input type="number" className="form-input text-sm" placeholder="1" value={channel}
                  onChange={e => setChannel(e.target.value)} />
              </div>
            </div>
          ) : (
            <textarea className="form-input font-mono text-xs" rows={3} value={staticJson}
              onChange={e => setStaticJson(e.target.value)} placeholder='{ "platform": "…" }' />
          )}
        </div>

        {/* Sheet preview — column-index reference for the builder below (Sheets only) */}
        {form.sourceType === 'google_sheets' ? (
          <SheetPreview
            connectorId={connector?.id}
            spreadsheetId={form.spreadsheetId}
            sheetTab={form.sheetTab}
            dataRange={form.dataRange}
          />
        ) : (
          <div className="border-t border-cream/60 pt-2 mt-2 text-[11px] text-dark2/60">
            <i className="fas fa-circle-info" /> Live preview is Google-Sheets only. For a Drive file, map fields by <b>0-based column index</b> (column A = 0, B = 1, …), matching the file&apos;s columns after the skipped header row(s).
          </div>
        )}

        {/* Column mapping builder */}
        <div className="border-t border-cream/60 pt-2 mt-2">
          <div className="form-label mb-1">Column Mapping *</div>
          <FieldMappingBuilder fields={FIELD_LISTS[form.targetTable] ?? []} state={mapping} onChange={setMapping} />
        </div>
      </form>
    </Modal>
  )
}
