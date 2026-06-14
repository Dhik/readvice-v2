'use client'
// BCG Product Matrix — Traffic × Conversion (replica of old /admin/bcg_metrics).
// Deep analysis → lives under Analytics. All logic in @/lib/analytics/bcg-summary
// via /api/analytics/bcg; this is just the lens selector.
import BcgMatrixView from '@/components/bcg/BcgMatrixView'

export default function BcgTrafficPage() {
  return <BcgMatrixView lens="traffic" />
}
