'use client'
import { useState } from 'react'

export default function ProductsTable({ products = [], source = 'tokopedia' }) {
  const isKalodata = source === 'kalodata'

  const [sortKey,  setSortKey]  = useState(isKalodata ? 'name' : 'sold')
  const [sortDir,  setSortDir]  = useState('desc')
  const [page,     setPage]     = useState(1)
  const PER_PAGE = 15

  function handleSort(key) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
    setPage(1)
  }

  const sorted = [...products].sort((a, b) => {
    const av = a[sortKey] ?? 0
    const bv = b[sortKey] ?? 0
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    return sortDir === 'asc' ? av - bv : bv - av
  })

  const total   = sorted.length
  const pages   = Math.ceil(total / PER_PAGE)
  const visible = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const SortIcon = ({ col }) => {
    if (col !== sortKey) return <i className="fas fa-sort" style={{ opacity: .3, fontSize: 10, marginLeft: 3 }} />
    return <i className={`fas fa-sort-${sortDir === 'asc' ? 'up' : 'down'}`} style={{ color: 'var(--color-orange)', fontSize: 10, marginLeft: 3 }} />
  }

  const Stars = ({ rating }) => {
    const r = parseFloat(rating) || 0
    return (
      <span style={{ color: '#F59E0B', fontSize: 11 }}>
        {'★'.repeat(Math.floor(r))}{'☆'.repeat(5 - Math.floor(r))}
        <span style={{ color: '#999', marginLeft: 3 }}>{r.toFixed(1)}</span>
      </span>
    )
  }

  if (!products.length) {
    return <div style={{ padding: '24px', textAlign: 'center', color: '#bbb', fontSize: 13 }}>No products found</div>
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table className="sv-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', minWidth: 220 }}>
                Produk <SortIcon col="name" />
              </th>
              {isKalodata ? (
                <>
                  <th onClick={() => handleSort('revenue')} style={{ cursor: 'pointer' }}>Revenue <SortIcon col="revenue" /></th>
                  <th onClick={() => handleSort('sales')} style={{ cursor: 'pointer' }}>Sales <SortIcon col="sales" /></th>
                  <th onClick={() => handleSort('avgPrice')} style={{ cursor: 'pointer' }}>Avg Price <SortIcon col="avgPrice" /></th>
                  <th onClick={() => handleSort('growth')} style={{ cursor: 'pointer' }}>Growth <SortIcon col="growth" /></th>
                </>
              ) : (
                <>
                  <th onClick={() => handleSort('shop')} style={{ cursor: 'pointer' }}>{source === 'shopee' ? 'Lokasi' : 'Brand / Toko'} <SortIcon col="shop" /></th>
                  <th>Kota</th>
                  <th onClick={() => handleSort('price')} style={{ cursor: 'pointer' }}>Harga <SortIcon col="price" /></th>
                  <th onClick={() => handleSort('sold')} style={{ cursor: 'pointer' }}>Terjual <SortIcon col="sold" /></th>
                  <th onClick={() => handleSort('rating')} style={{ cursor: 'pointer' }}>Rating <SortIcon col="rating" /></th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((p, i) => (
              <tr key={i}>
                <td style={{ color: '#999' }}>{(page - 1) * PER_PAGE + i + 1}</td>
                <td>
                  {p.url
                    ? <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-dark1)', textDecoration: 'none', fontWeight: 500 }} title={p.name}>
                        {p.name.length > 60 ? p.name.slice(0, 60) + '…' : p.name}
                      </a>
                    : <span style={{ fontWeight: 500, color: 'var(--color-dark1)' }} title={p.name}>
                        {p.name.length > 60 ? p.name.slice(0, 60) + '…' : p.name}
                      </span>
                  }
                </td>
                {isKalodata ? (
                  <>
                    <td style={{ fontWeight: 600, color: '#10B981', whiteSpace: 'nowrap' }}>{p.revenue || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.sales || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.avgPrice || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap', color: p.growth?.startsWith('+') ? '#10B981' : p.growth?.startsWith('-') ? '#EF4444' : '#888', fontWeight: 600 }}>
                      {p.growth || '—'}
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ fontWeight: 500 }}>{p.shop || '—'}</td>
                    <td style={{ color: '#888' }}>{p.city || '—'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-dark1)', whiteSpace: 'nowrap' }}>
                      {p.price > 0 ? `Rp ${p.price.toLocaleString('id-ID')}` : '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.sold > 0 ? p.sold.toLocaleString('id-ID') : '—'}</td>
                    <td><Stars rating={p.rating} /></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderTop: '1px solid var(--color-cream)', fontSize: 12, color: '#888' }}>
          <span>{total} produk ditemukan</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)}
                style={{
                  width: 26, height: 26, borderRadius: 4, border: '1px solid',
                  borderColor: p === page ? 'var(--color-orange)' : 'var(--color-cream)',
                  background:  p === page ? 'var(--color-orange)' : 'white',
                  color:       p === page ? 'white' : 'var(--color-dark2)',
                  cursor: 'pointer', fontSize: 11, fontWeight: 600,
                }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
