'use client'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

// Company-metadata fields for document exports (Invoice / SPK). [name, label].
const COMPANY_FIELDS = [
  ['invoiceDisplayName',   'Invoice Display Name'],
  ['invoiceDisplayHandle', 'Invoice Handle (e.g. @brand)'],
  ['legalName',            'Legal Name'],
  ['companyAddress',       'Company Address'],
  ['companyEmail',         'Company Email'],
  ['companyPhone',         'Company Phone'],
  ['contactPerson',        'Contact Person'],
  ['contactTitle',         'Contact Title'],
  ['contactPhone',         'Contact Phone'],
  ['senderBankName',       'Sender Bank Name'],
  ['senderBankAccount',    'Sender Bank Account'],
  ['senderAccountName',    'Sender Account Name'],
  ['companyNpwp',          'Company NPWP'],
  ['footerPhone',          'Invoice Footer Phone'],
  ['footerAddress',        'Invoice Footer Address'],
  ['logoFile',             'Invoice Logo File (public/img)'],
  ['letterheadFile',       'SPK Letterhead File (public/img)'],
]

const EMPTY_COMPANY = Object.fromEntries(COMPANY_FIELDS.map(([k]) => [k, '']))

export default function TenantModal({ tenant = null, onClose, onSuccess }) {
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      name:     '',
      slug:     '',
      logoUrl:  '',
      isActive: true,
      ...EMPTY_COMPANY,
    },
  })

  useEffect(() => {
    if (tenant) {
      setValue('name',     tenant.name)
      setValue('slug',     tenant.slug)
      setValue('logoUrl',  tenant.logoUrl ?? '')
      setValue('isActive', tenant.isActive)
      for (const [k] of COMPANY_FIELDS) setValue(k, tenant[k] ?? '')
    } else {
      reset({ name: '', slug: '', logoUrl: '', isActive: true, ...EMPTY_COMPANY })
    }
  }, [tenant])

  // Auto-generate slug from name when creating a new tenant
  function handleNameChange(e) {
    if (!tenant) {
      const slug = e.target.value
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
      setValue('slug', slug)
    }
  }

  async function onSubmit(data) {
    const method = tenant ? 'PUT' : 'POST'
    const url    = tenant ? `/api/tenants/${tenant.id}` : '/api/tenants'
    const res    = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    })
    if (res.ok) {
      toast.success(tenant ? 'Tenant updated' : 'Tenant created')
      reset()
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
      title={tenant ? 'Edit Tenant' : 'New Tenant'}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
          <button
            type="submit"
            form="tenant-form"
            disabled={isSubmitting}
            className="btn btn-primary"
          >
            {isSubmitting ? 'Saving…' : 'Save Tenant'}
          </button>
        </>
      }
    >
      <form id="tenant-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input
            className="form-input"
            placeholder="Acme Brand"
            {...register('name', { required: 'Name is required' })}
            onChange={e => { register('name').onChange(e); handleNameChange(e) }}
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div className="form-group">
          <label className="form-label">Slug * <span className="text-dark2/40 font-normal">(URL-safe, auto-generated)</span></label>
          <input
            className="form-input font-mono text-[13px]"
            placeholder="acme-brand"
            {...register('slug', {
              required: 'Slug is required',
              pattern:  { value: /^[a-z0-9-]+$/, message: 'Lowercase letters, numbers and hyphens only' },
            })}
          />
          {errors.slug && <p className="text-red-500 text-xs mt-1">{errors.slug.message}</p>}
        </div>

        <div className="form-group">
          <label className="form-label">Logo URL <span className="text-dark2/40 font-normal">(optional)</span></label>
          <input
            className="form-input"
            placeholder="https://example.com/logo.png"
            {...register('logoUrl')}
          />
        </div>

        <div className="form-group">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded accent-orange"
              {...register('isActive')}
            />
            <span className="form-label mb-0">Active</span>
          </label>
        </div>

        {/* Document / Company Info — used by Invoice & SPK PDF exports */}
        <details className="mt-2 border-t border-cream/60 pt-2">
          <summary className="cursor-pointer text-xs font-semibold text-dark2 select-none">
            Document / Company Info <span className="text-dark2/40 font-normal">(Invoice &amp; SPK exports)</span>
          </summary>
          <div className="grid grid-cols-2 gap-x-3 mt-2">
            {COMPANY_FIELDS.map(([name, label]) => (
              <div className="form-group" key={name}>
                <label className="form-label text-[11px]">{label}</label>
                <input className="form-input text-[13px]" {...register(name)} />
              </div>
            ))}
          </div>
        </details>
      </form>
    </Modal>
  )
}
