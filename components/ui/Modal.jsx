'use client'
import { useEffect } from 'react'

export default function Modal({ isOpen, onClose, title, children, footer, size = '' }) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  // `size` overrides the default max-w-2xl (e.g. "max-w-3xl"). Utility wins over
  // the component-layer default in Tailwind v4.
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-box ${size}`.trim()} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-semibold text-dark1 text-base">{title}</h3>
          <button onClick={onClose} className="text-dark1/40 hover:text-dark1 text-xl leading-none">&times;</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
