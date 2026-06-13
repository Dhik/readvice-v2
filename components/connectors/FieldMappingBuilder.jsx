'use client'
import { TRANSFORM_VALUES, TRANSFORMS } from '@/lib/connectors/transforms'

// Controlled column-mapping builder. `state` is keyed by field name:
//   { enabled, transform, sheetColumn, useAdd, addColumn, value }
// Serialization to the CS1 JSON shape lives in the parent (toColumnMapping).
export default function FieldMappingBuilder({ fields, state, onChange }) {
  const update = (field, patch) => onChange({ ...state, [field]: { ...state[field], ...patch } })
  // Editing any data input auto-enables the row — no hidden checkbox to discover.
  const edit   = (field, patch) => update(field, { enabled: true, ...patch })

  return (
    <div>
      <p className="text-xs text-dark2/60 mb-2">
        Column index helper: <span className="font-mono text-dark1">A=0, B=1, C=2 … Z=25, AA=26 …</span>
        &nbsp;Uncheck a field to skip it.
      </p>

      <div className="overflow-x-auto">
        <div className="flex flex-col gap-1.5 min-w-[480px]">
          {fields.map(field => {
            const c = state[field] ?? {}
            const isStatic = c.transform === TRANSFORMS.STATIC
            const off = !c.enabled
            return (
              <div
                key={field}
                className={`grid grid-cols-[20px_130px_1fr_1fr_auto] items-center gap-2 px-2 py-1.5 rounded border border-cream/60 ${off ? 'opacity-50 bg-bg/40' : 'bg-white'}`}
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-orange"
                  checked={!!c.enabled}
                  onChange={e => update(field, { enabled: e.target.checked })}
                />
                <span className="font-mono text-xs text-dark1 truncate" title={field}>{field}</span>

                <select
                  className="form-input text-xs py-1"
                  value={c.transform ?? 'string'}
                  onChange={e => edit(field, { transform: e.target.value })}
                >
                  {TRANSFORM_VALUES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                {isStatic ? (
                  <input
                    className="form-input text-xs py-1"
                    placeholder="static value"
                    value={c.value ?? ''}
                    onChange={e => edit(field, { value: e.target.value })}
                  />
                ) : (
                  <input
                    type="number"
                    min={0}
                    className="form-input text-xs py-1"
                    placeholder="col # (A=0)"
                    value={c.sheetColumn ?? ''}
                    onChange={e => edit(field, { sheetColumn: e.target.value })}
                  />
                )}

                {/* addColumn (sum-with-another-column) — only for numeric transforms */}
                {!isStatic ? (
                  <div className="flex items-center gap-1">
                    <label className="flex items-center gap-1 text-xs text-dark2/70 whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 rounded accent-orange"
                        checked={!!c.useAdd}
                        onChange={e => edit(field, { useAdd: e.target.checked })}
                      />
                      +col
                    </label>
                    {c.useAdd && (
                      <input
                        type="number"
                        min={0}
                        className="form-input text-xs py-1 !w-16"
                        placeholder="#"
                        value={c.addColumn ?? ''}
                        onChange={e => edit(field, { addColumn: e.target.value })}
                      />
                    )}
                  </div>
                ) : <span />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
