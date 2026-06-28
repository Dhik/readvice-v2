'use client'
// Marketplace badge — a small brand-colored chip per platform. TikTok has a real
// FontAwesome brand glyph; the others (Shopee/Tokopedia/Lazada/Blibli/…) aren't in
// FontAwesome, so they use a brand-colored monogram. Pass a single platform name or a
// comma-separated string (the Customers table stores "shopee, tiktok"); renders one
// chip per platform. Unknown platforms get a neutral slate chip with their initial.

const BRAND = {
  shopee:    { label: 'Shopee',    color: '#EE4D2D' },
  tiktok:    { label: 'TikTok',    color: '#010101', brandIcon: 'fa-tiktok' },
  tokopedia: { label: 'Tokopedia', color: '#03AC0E' },
  lazada:    { label: 'Lazada',    color: '#0F146D' },
  blibli:    { label: 'Blibli',    color: '#0095DA' },
  bukalapak: { label: 'Bukalapak', color: '#E31E52' },
  zalora:    { label: 'Zalora',    color: '#000000' },
  website:   { label: 'Website',   color: '#3F4E4F' },
  offline:   { label: 'Offline',   color: '#8B5E3C' },
}

function normalize(name) {
  return String(name ?? '').trim().toLowerCase()
}

function meta(name) {
  const key = normalize(name)
  if (BRAND[key]) return { key, ...BRAND[key] }
  // Title-case the raw value for the label of an unknown platform.
  const label = key ? key.charAt(0).toUpperCase() + key.slice(1) : '—'
  return { key, label, color: '#3F4E4F' }
}

function Dot({ m }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white flex-shrink-0"
      style={{ width: 16, height: 16, background: m.color }}
      title={m.label}
    >
      {m.brandIcon
        ? <i className={`fab ${m.brandIcon}`} style={{ fontSize: 8 }} />
        : <span style={{ fontSize: 8, fontWeight: 700, lineHeight: 1 }}>{(m.label[0] || '?').toUpperCase()}</span>}
    </span>
  )
}

// Single chip with icon + label.
export default function PlatformBadge({ platform, showLabel = true }) {
  const list = String(platform ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (list.length === 0) return <span className="text-dark1/40">—</span>

  // Multiple platforms (e.g. a customer who bought on several): chips of dots + labels.
  if (list.length > 1) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {list.map((p, i) => {
          const m = meta(p)
          return (
            <span key={i} className="inline-flex items-center gap-1 text-[11px]">
              <Dot m={m} />{showLabel && <span>{m.label}</span>}
            </span>
          )
        })}
      </span>
    )
  }

  const m = meta(list[0])
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px]">
      <Dot m={m} />{showLabel && <span>{m.label}</span>}
    </span>
  )
}
