'use client'
import { useForm } from 'react-hook-form'
import Modal from '@/components/ui/Modal'

export default function CampaignModal({ isOpen, onClose, onSuccess, campaign = null, type = 'creative' }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: campaign ?? {
      title:       '',
      platform:    '',
      purpose:     '',
      budget:      '',
      status:      'active',
      description: '',
      startDate:   '',
      endDate:     '',
    },
  })

  async function onSubmit(data) {
    const method = campaign ? 'PUT' : 'POST'
    const url    = campaign ? `/api/campaigns/${campaign.id}` : '/api/campaigns'
    const res    = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, type }),
    })
    if (res.ok) {
      reset()
      onSuccess?.()
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={campaign ? 'Edit Campaign' : 'New Campaign'}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
          <button
            type="submit"
            form="campaign-form"
            disabled={isSubmitting}
            className="btn btn-primary"
          >
            {isSubmitting ? 'Saving...' : 'Save Campaign'}
          </button>
        </>
      }
    >
      <form id="campaign-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-input" {...register('title', { required: true })} />
          {errors.title && <p className="text-red-500 text-xs mt-1">Required</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Platform</label>
            <select className="form-input" {...register('platform')}>
              <option value="">All</option>
              <option value="shopee">Shopee</option>
              <option value="tiktok">TikTok</option>
              <option value="lazada">Lazada</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-input" {...register('status')}>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Purpose</label>
          <input className="form-input" {...register('purpose')} />
        </div>
        <div className="form-group">
          <label className="form-label">Budget (IDR)</label>
          <input className="form-input" type="number" {...register('budget')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input className="form-input" type="date" {...register('startDate')} />
          </div>
          <div className="form-group">
            <label className="form-label">End Date</label>
            <input className="form-input" type="date" {...register('endDate')} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-input" rows={3} {...register('description')} />
        </div>
      </form>
    </Modal>
  )
}
