'use client'

const fmtRp  = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0))
const fmtNum = n => new Intl.NumberFormat('id-ID').format(n ?? 0)
const STATUS_CLS = { Approve: 'badge-success', Reject: 'badge-danger', Pending: 'badge-warning' }

export default function DealingViewModal({ row, onClose }) {
  const overall = row.approvalFromLeaderStatus === 'Approve' && row.approvalFromManagementStatus === 'Approve'
    ? 'Approve'
    : (row.approvalFromLeaderStatus === 'Reject' || row.approvalFromManagementStatus === 'Reject')
      ? 'Reject'
      : 'Pending'

  const fields = [
    ['Dealing Number', row.dealingNumber ?? '—'],
    ['Username', row.username],
    ['Platform', row.platform ?? '—'],
    ['PIC', row.pic ?? '—'],
    ['Dealing Date', row.dealingDate ? new Date(row.dealingDate).toLocaleDateString('id-ID') : '—'],
    ['Rate Card', fmtRp(row.rateCard)],
    ['Slot', fmtNum(row.slot)],
    ['SOW Category', row.sowCategory ?? '—'],
    ['Tax Rate', `${row.taxRate ?? 0}%`],
    ['Net Rate Card', fmtRp(row.netRateCard)],
    ['Kontak', row.kontak ?? '—'],
    ['Remark', row.remark ?? '—'],
  ]

  return (
    <div className="sv-modal-backdrop" onClick={onClose}>
      <div className="sv-modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div className="sv-modal-header">
          <span>Dealing Detail — {row.dealingNumber ?? row.id}</span>
          <button className="sv-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="sv-modal-body space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {fields.map(([label, val]) => (
              <div key={label}>
                <div className="text-dark2/60 text-xs">{label}</div>
                <div className="font-medium">{val}</div>
              </div>
            ))}
          </div>

          {/* Approval status */}
          <div className="rounded bg-dark1/5 p-3 space-y-2">
            <div className="text-xs font-semibold text-dark2/60 uppercase tracking-wide">Approval Status</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-dark2/60">Leader</div>
                <span className={`sv-badge ${STATUS_CLS[row.approvalFromLeaderStatus] ?? 'badge-warning'}`}>
                  {row.approvalFromLeaderStatus ?? 'Pending'}
                </span>
              </div>
              <div>
                <div className="text-xs text-dark2/60">Management</div>
                <span className={`sv-badge ${STATUS_CLS[row.approvalFromManagementStatus] ?? 'badge-warning'}`}>
                  {row.approvalFromManagementStatus ?? 'Pending'}
                </span>
              </div>
              <div>
                <div className="text-xs text-dark2/60">Overall</div>
                <span className={`sv-badge ${STATUS_CLS[overall] ?? 'badge-warning'}`}>{overall}</span>
              </div>
            </div>
          </div>

          {/* Staff notes */}
          {row.staffNotes && (
            <div className="rounded bg-orange/5 border border-orange/20 p-3 text-sm">
              <div className="text-xs font-semibold text-dark2/60 mb-1">Staff Notes</div>
              <div className="text-dark1">{row.staffNotes}</div>
            </div>
          )}
        </div>
        <div className="sv-modal-footer">
          <button className="sv-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
