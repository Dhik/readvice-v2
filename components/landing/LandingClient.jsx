'use client'
import { useEffect, useState } from 'react'

export default function LandingClient() {
  const [done, setDone] = useState(false)

  useEffect(() => {
    const nav = document.getElementById('navbar')
    const onScroll = () => nav?.classList.toggle('scrolled', window.scrollY > 20)
    window.addEventListener('scroll', onScroll)

    const reveals = document.querySelectorAll('.reveal')
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('visible'), i * 80)
          obs.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12 })
    reveals.forEach(el => obs.observe(el))

    return () => { window.removeEventListener('scroll', onScroll); obs.disconnect() }
  }, [])

  function handleSubscribe(e) {
    e.preventDefault()
    setDone(true)
  }

  if (done) return <p className="subscribe-success">✓ You&apos;re subscribed! We&apos;ll be in touch.</p>

  return (
    <form className="subscribe-form" onSubmit={handleSubscribe}>
      <input type="email" className="subscribe-input" placeholder="Enter your work email" required />
      <button type="submit" className="btn btn-primary" style={{ flexShrink: 0, padding: '14px 24px' }}>
        <i className="fas fa-paper-plane" /> Subscribe
      </button>
    </form>
  )
}
