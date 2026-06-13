'use client'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

export default function UserModal({ user = null, onClose, onSuccess }) {
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { name: '', email: '', password: '', isActive: true },
  })

  const [allRoles,          setAllRoles]          = useState([])
  const [allTenants,        setAllTenants]        = useState([])
  const [selectedRoleIds,   setSelectedRoleIds]   = useState(new Set())
  const [selectedTenantIds, setSelectedTenantIds] = useState(new Set())

  useEffect(() => {
    Promise.all([
      fetch('/api/users/roles').then(r => r.json()),
      fetch('/api/tenant/list').then(r => r.json()),
    ]).then(([roles, tenantData]) => {
      setAllRoles(Array.isArray(roles) ? roles : [])
      setAllTenants(tenantData.tenants ?? [])
    })
  }, [])

  useEffect(() => {
    if (user) {
      setValue('name',     user.name)
      setValue('email',    user.email)
      setValue('password', '')
      setValue('isActive', user.isActive)
      setSelectedRoleIds(new Set(user.roles?.map(r => r.id) ?? []))
      setSelectedTenantIds(new Set(user.tenants?.map(t => t.id) ?? []))
    } else {
      reset({ name: '', email: '', password: '', isActive: true })
      setSelectedRoleIds(new Set())
      setSelectedTenantIds(new Set())
    }
  }, [user])

  function toggleRole(id) {
    setSelectedRoleIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTenant(id) {
    setSelectedTenantIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function onSubmit(data) {
    const method = user ? 'PUT' : 'POST'
    const url    = user ? `/api/users/${user.id}` : '/api/users'

    const body = {
      name:      data.name,
      email:     data.email,
      isActive:  data.isActive,
      roleIds:   [...selectedRoleIds],
      tenantIds: [...selectedTenantIds],
    }
    const pw = data.password?.trim()
    if (pw) body.password = pw

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })

    if (res.ok) {
      toast.success(user ? 'User updated' : 'User created')
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
      title={user ? 'Edit User' : 'New User'}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
          <button
            type="submit"
            form="user-form"
            disabled={isSubmitting}
            className="btn btn-primary"
          >
            {isSubmitting ? 'Saving…' : 'Save User'}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input
            className="form-input"
            placeholder="Jane Doe"
            {...register('name', { required: 'Name is required' })}
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div className="form-group">
          <label className="form-label">Email *</label>
          <input
            type="email"
            className="form-input"
            placeholder="jane@example.com"
            {...register('email', { required: 'Email is required' })}
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div className="form-group">
          <label className="form-label">
            Password {user ? <span className="text-dark2/40 font-normal">(leave blank to keep current)</span> : '*'}
          </label>
          <input
            type="password"
            className="form-input"
            placeholder={user ? 'Leave blank to keep current' : 'Set a password'}
            {...register('password', {
              validate: v => user ? true : (v?.trim() ? true : 'Password is required'),
            })}
          />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
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

        {allRoles.length > 0 && (
          <div className="form-group">
            <label className="form-label">Roles</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {allRoles.map(role => (
                <label
                  key={role.id}
                  className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-dark1 bg-cream/60 px-2 py-1 rounded"
                >
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 accent-orange"
                    checked={selectedRoleIds.has(role.id)}
                    onChange={() => toggleRole(role.id)}
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {allTenants.length > 0 && (
          <div className="form-group">
            <label className="form-label">Accessible Brands</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {allTenants.map(tenant => (
                <label
                  key={tenant.id}
                  className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-dark1 bg-cream/60 px-2 py-1 rounded"
                >
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 accent-orange"
                    checked={selectedTenantIds.has(tenant.id)}
                    onChange={() => toggleTenant(tenant.id)}
                  />
                  {tenant.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </form>
    </Modal>
  )
}
