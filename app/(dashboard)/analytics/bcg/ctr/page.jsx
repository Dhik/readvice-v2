'use client'
// BCG CTR Matrix — CTR × Conversion lens (Star / Potensi / Cash Cows / Dog).
// Same view component, ctr lens. All logic in @/lib/analytics/bcg-summary.
import BcgMatrixView from '@/components/bcg/BcgMatrixView'

export default function BcgCtrPage() {
  return <BcgMatrixView lens="ctr" />
}
