'use client'
const fmtNum = n => new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0))

export default function FunnelChart({ impressions, estimatedOrders, productsSold }) {
  const levels = [
    { label: 'Product Impressions', value: impressions,     width: 100, color: '#2C3639', textColor: '#DCD7C9' },
    { label: 'Estimated Orders',    value: estimatedOrders, width: 70,  color: '#E07B39', textColor: '#fff'    },
    { label: 'Products Sold',       value: productsSold,    width: 45,  color: '#DCD7C9', textColor: '#2C3639' },
  ]

  return (
    <div className="flex flex-col items-center gap-1 py-4">
      {levels.map((l, i) => (
        <div key={i} className="flex flex-col items-center w-full">
          <div
            className="flex items-center justify-between px-4 py-3 rounded text-sm font-medium transition-all"
            style={{ width: `${l.width}%`, backgroundColor: l.color, color: l.textColor }}
          >
            <span>{l.label}</span>
            <span className="font-bold">{fmtNum(l.value)}</span>
          </div>
          {i < levels.length - 1 && (
            <div className="text-dark2/40 text-xs my-1">↓</div>
          )}
        </div>
      ))}
      {/* Conversion rates */}
      {impressions > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 w-full text-center">
          <div className="bg-dark1/5 rounded p-2">
            <div className="text-xs text-dark2/60">Impression → Order</div>
            <div className="font-semibold text-orange">{(estimatedOrders / impressions * 100).toFixed(2)}%</div>
          </div>
          <div className="bg-dark1/5 rounded p-2">
            <div className="text-xs text-dark2/60">Order → Sold</div>
            <div className="font-semibold text-orange">
              {estimatedOrders > 0 ? (productsSold / estimatedOrders * 100).toFixed(1) : '0'}%
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
