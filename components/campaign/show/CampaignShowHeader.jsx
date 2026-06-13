'use client'
import { useRouter } from 'next/navigation'
import Swal from 'sweetalert2'
import toast from 'react-hot-toast'

export default function CampaignShowHeader({ campaign }) {
  const router = useRouter()

  async function handleDelete() {
    if (!campaign) return
    const result = await Swal.fire({
      title: 'Delete this campaign?',
      text: 'All content entries will also be deleted. This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Delete',
    })
    if (!result.isConfirmed) return
    const res = await fetch(`/api/campaigns/${campaign.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Campaign deleted')
      router.push('/campaign/creative')
    } else {
      toast.error('Delete failed')
    }
  }

  return (
    <div className="sv-sh-header">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button onClick={() => router.back()}
          className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 text-sm text-dark1"
          style={{ background: 'rgba(255,255,255,0.15)' }}>
          <i className="fas fa-arrow-left text-white text-xs"></i>
        </button>
        <div className="min-w-0">
          <h5 className="text-sm font-bold text-white m-0 overflow-hidden text-ellipsis whitespace-nowrap max-w-[600px]">
            {campaign?.title ?? <span className="opacity-40">Loading...</span>}
          </h5>
          <div className="text-[11px] text-white/60 flex items-center gap-2 mt-0.5">
            {campaign && (
              <>
                <i className="fas fa-calendar-alt text-orange text-[10px]"></i>
                <span>{campaign.startDate ?? '—'} — {campaign.endDate ?? '—'}</span>
                <span className="opacity-40">|</span>
                <span>Created by: {campaign.createdBy?.name ?? '—'}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={() => router.push(`/campaign/${campaign?.id}/edit`)}
          className="sv-act-btn text-xs flex items-center gap-1"
          style={{ background: '#E07B39', color: 'white', borderColor: '#E07B39' }}>
          <i className="fas fa-pencil-alt"></i> Edit
        </button>
        <button onClick={handleDelete}
          className="sv-act-btn sv-act-outline text-xs"
          style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.8)' }}>
          <i className="fas fa-trash-alt text-red-400"></i> Delete
        </button>
      </div>
    </div>
  )
}
