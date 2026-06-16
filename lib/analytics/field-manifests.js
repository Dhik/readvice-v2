// ─── FIELD_MANIFEST registry (Part B3) ───────────────────────────────────────
// Server-side map of module key → that engine's FIELD_MANIFEST (the B1 export).
// Used by the calc-fields route to (a) serve a module's params to the modal and
// (b) server-validate a formula via the B2 evaluator. SERVER-ONLY — these engine
// imports pull in `prisma`; never import this into a client bundle (the modal gets
// the manifest as JSON from the route instead).
import { FIELD_MANIFEST as bcg } from './bcg-summary'
import { FIELD_MANIFEST as rfm } from './rfm-summary'
import { FIELD_MANIFEST as adsAllocation } from './ads-allocation-summary'
import { FIELD_MANIFEST as campaignEfficiency } from './campaign-efficiency-summary'
import { FIELD_MANIFEST as grossMargin } from './gross-margin-summary'
import { FIELD_MANIFEST as talentRoi } from './talent-roi-summary'
import { FIELD_MANIFEST as operational } from './operational-summary'
import { FIELD_MANIFEST as cohort } from './cohort-summary'
import { FIELD_MANIFEST as basket } from './basket-summary'
import { FIELD_MANIFEST as clv } from './clv-summary'
import { FIELD_MANIFEST as roas } from './roas-summary'

// Keys match the analytics route/module identifiers used across the app.
export const MANIFESTS = {
  'bcg': bcg,
  'rfm': rfm,
  'ads-allocation': adsAllocation,
  'campaign-efficiency': campaignEfficiency,
  'gross-margin': grossMargin,
  'talent-roi': talentRoi,
  'operational': operational,
  'cohort': cohort,
  'basket': basket,
  'clv': clv,
  'roas': roas,
}

export const getManifest = (module) => MANIFESTS[module] ?? null
