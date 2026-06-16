// Shared Talent objective inference (Part C — C1). Used by the backfill
// (scripts/backfill-talent-objective.cjs) and the dev return seeder
// (scripts/seed-dev-talent-return.cjs) so both apply IDENTICAL logic.
//
// Heuristic (docs/PLATFORM_DESIGN.md Part C, proposal point 1) — every result is
// marked objectiveInferred:true (a brand owner flips it false on override in C3):
//   1. type='Affiliate'                                  → Conversion    (high)
//   2. type='KOL' OR followers ≥ tenant top tercile      → Awareness     (medium)
//   3. type='Content Creator'/'Clipper'
//        OR (high engRate + mid followers)               → Consideration (medium-low)
//   4. fallback                                          → Consideration (safest middle)
// Tercile + engRate threshold are computed PER TENANT (never globally).

// Top-tercile follower threshold (the 2/3 quantile of positive follower counts).
// < 3 positive values → Infinity (too few for a meaningful tercile; follower rule off).
function followerTercileTop(followersList) {
  const v = followersList.map(Number).filter(x => Number.isFinite(x) && x > 0).sort((a, b) => a - b)
  if (v.length < 3) return Infinity
  return v[Math.floor(v.length * 2 / 3)]
}

// Median of positive numbers (used for the per-tenant "high engRate" threshold).
function medianPositive(list) {
  const v = list.map(Number).filter(x => Number.isFinite(x) && x > 0).sort((a, b) => a - b)
  if (!v.length) return Infinity
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

// Classify ONE talent. (Branch 3's engRate path and branch 4 both resolve to
// Consideration in C1 — the distinction only informs the C3 confidence label.)
function inferObjective({ type, followers, engRate }, tercileTop, engHigh) {
  const t = String(type ?? '').toLowerCase().trim()
  const f = Number(followers ?? 0)
  const e = engRate == null ? null : Number(engRate)
  if (t.includes('affiliate')) return 'Conversion'
  if (t === 'kol' || (f > 0 && f >= tercileTop)) return 'Awareness'
  if (t.includes('content creator') || t.includes('clipper')) return 'Consideration'
  if (e != null && e >= engHigh && f > 0 && f < tercileTop) return 'Consideration'
  return 'Consideration'
}

// Apply inference to one tenant's talents (tenant-scoped, sequential writes for
// connection_limit=1). Skips brand-owner overrides (objectiveInferred=false).
// Returns { updated, skipped, distribution, tercileTop, engHigh }.
async function applyObjectiveInference(prisma, tenantId) {
  const talents = await prisma.talent.findMany({
    where: { tenantId },
    select: { id: true, username: true, type: true, followers: true, objective: true, objectiveInferred: true },
  })
  if (!talents.length) return { updated: 0, skipped: 0, distribution: {}, tercileTop: Infinity, engHigh: Infinity }

  // engRate per username from KolProfile (tenant-scoped real contact DB).
  const kols = await prisma.kolProfile.findMany({ where: { tenantId }, select: { username: true, engRate: true } })
  const engByUser = new Map()
  for (const k of kols) if (k.username) engByUser.set(k.username, k.engRate == null ? null : Number(k.engRate))

  const tercileTop = followerTercileTop(talents.map(t => t.followers))
  const engHigh = medianPositive([...engByUser.values()])

  const distribution = {}
  let updated = 0, skipped = 0
  for (const t of talents) {
    if (t.objectiveInferred === false) {   // honor a C3 owner override — never clobber
      distribution[t.objective] = (distribution[t.objective] ?? 0) + 1
      skipped++
      continue
    }
    const objective = inferObjective(
      { type: t.type, followers: t.followers, engRate: engByUser.get(t.username) ?? null },
      tercileTop, engHigh,
    )
    await prisma.talent.update({ where: { id: t.id }, data: { objective, objectiveInferred: true } })
    distribution[objective] = (distribution[objective] ?? 0) + 1
    updated++
  }
  return { updated, skipped, distribution, tercileTop, engHigh }
}

module.exports = { followerTercileTop, medianPositive, inferObjective, applyObjectiveInference }
