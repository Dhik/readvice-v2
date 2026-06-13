export default function KpiStrip({ tiles }) {
  return (
    <div className="sv-kpi-strip">
      {tiles.map((tile, i) =>
        tile.icon ? (
          <div key={i} className="kpi-tile">
            <div className="kpi-tile-icon"
              style={{ background: tile.accent + '14', color: tile.accent }}>
              <i className={`fas ${tile.icon}`} />
            </div>
            <div className="min-w-0">
              <div className="kpi-tile-label">{tile.label}</div>
              <div className="kpi-tile-value">{tile.value}</div>
              {tile.sub && <span className="text-[10px] text-dark1/40 mt-0.5">{tile.sub}</span>}
            </div>
          </div>
        ) : (
          <div key={i} className="kpi-tile kpi-tile-simple">
            <span className="kpi-tile-label">{tile.label}</span>
            <span className="kpi-tile-value">{tile.value}</span>
            {tile.sub && <span className="text-[10px] text-dark1/40 mt-0.5">{tile.sub}</span>}
          </div>
        )
      )}
    </div>
  )
}
