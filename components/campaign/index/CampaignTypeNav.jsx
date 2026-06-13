'use client'
import Link from 'next/link'

const NAV_ITEMS = [
  { type: 'affiliate', label: 'Affiliate Talent', icon: 'fa-user-tie', href: '/campaign/affiliate' },
  { type: 'kol',       label: 'KOL',              icon: 'fa-star',     href: '/campaign/kol' },
  { type: 'clipper',   label: 'Clipper',           icon: 'fa-film',     href: '/campaign/clipper' },
]

export default function CampaignTypeNav({ type }) {
  return (
    <div className="sv-cam-nav">
      {NAV_ITEMS.map(item => (
        <Link key={item.type} href={item.href}
          className={'sv-cam-tab' + (type === item.type ? ' sv-cam-tab-active' : '')}>
          <i className={'fas ' + item.icon}></i> {item.label}
        </Link>
      ))}
    </div>
  )
}
