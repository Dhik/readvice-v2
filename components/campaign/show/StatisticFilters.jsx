'use client'

const PIC_OPTIONS = ['Alni', 'Amel', 'Putri', 'Nova', 'Naufal', 'Aisyah', 'Silmi', 'Cantika', 'Acha', 'Afra']

export default function StatisticFilters({ filterDates, setFilterDates, filterPic, setFilterPic, onReset }) {
  return (
    <div className="bg-white border border-cream rounded-lg px-3 py-2 flex items-center gap-2 flex-wrap mb-3">
      <span className="text-[10px] font-semibold text-dark2 uppercase tracking-wide mr-1">Filters</span>
      <input
        type="text"
        value={filterDates}
        onChange={e => setFilterDates(e.target.value)}
        placeholder="DD/MM/YYYY - DD/MM/YYYY"
        className="border border-cream rounded text-xs px-2 py-1 text-dark1 focus:outline-none focus:border-dark2 h-7 bg-white w-48"
      />
      <select
        value={filterPic}
        onChange={e => setFilterPic(e.target.value)}
        className="border border-cream rounded text-xs px-2 py-1 text-dark1 focus:outline-none focus:border-dark2 h-7 bg-white">
        <option value="">All PIC</option>
        {PIC_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <button onClick={onReset}
        className="sv-tbtn sv-tbtn-ghost text-xs h-7 px-2">
        <i className="fas fa-times text-[10px]"></i> Reset
      </button>
    </div>
  )
}
