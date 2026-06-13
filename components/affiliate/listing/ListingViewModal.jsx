'use client'
const fmtRp  = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0))
const fmtNum = n => new Intl.NumberFormat('id-ID').format(n ?? 0)
const APPROVAL_COLORS = { Approve: 'badge-success', Reject: 'badge-danger', Pending: 'badge-warning' }
const STATUS_COLORS   = { Aktif: 'badge-success', 'Tidak Aktif': 'badge-danger', Pending: 'badge-warning' }

export default function ListingViewModal({ row, onClose }) {
  const fields = [
    ['Username', row.username], ['Platform', row.salesChannelId === 1 ? 'Shopee' : row.salesChannelId === 4 ? 'TikTok' : '—'],
    ['Date', new Date(row.date).toLocaleDateString('id-ID')], ['PIC', row.pic ?? '—'],
    ['Followers', fmtNum(row.followers)], ['GMV', fmtRp(row.gmv)],
    ['ROAS', `${row.roas ?? 0}x`], ['Rate Card', fmtRp(row.rateCard)],
    ['Slot', row.slot ?? 0], ['SOW Category', row.sowCategory ?? '—'],
    ['Kontak', row.kontak ?? '—'], ['Remark', row.remark ?? '—'],
    ['Keterangan', row.keterangan ?? '—'],
  ]
  return (
    <div className="sv-modal-backdrop" onClick={onClose}>
      <div className="sv-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="sv-modal-header">
          <span>Listing Detail</span>
          <button className="sv-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="sv-modal-body">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {fields.map(([label, val]) => (
              <div key={label}>
                <div className="text-dark2/60 text-xs">{label}</div>
                <div className="font-medium">{val}</div>
              </div>
            ))}
            <div>
              <div className="text-dark2/60 text-xs">Approval</div>
              <span className={`sv-badge ${APPROVAL_COLORS[row.approval] ?? 'badge-warning'}`}>{row.approval}</span>
            </div>
            <div>
              <div className="text-dark2/60 text-xs">Status</div>
              <span className={`sv-badge ${STATUS_COLORS[row.listingStatus] ?? 'badge-warning'}`}>{row.listingStatus}</span>
            </div>
            <div>
              <div className="text-dark2/60 text-xs">Talent Created</div>
              <div>{row.talentCreatedStatus ? <span className="text-green-600 font-medium">Yes ✓</span> : 'No'}</div>
            </div>
          </div>
        </div>
        <div className="sv-modal-footer"><button className="sv-btn" onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}
