'use client'
import { Line } from 'react-chartjs-2'
import { seriesColor, withAlpha } from '@/lib/charts/theme' // central register + defaults

export default function TrendChart({ trendsData }) {
  const timeline = trendsData?.timeline ?? []

  const data = {
    labels:   timeline.map(d => d.date),
    datasets: [{
      label:           'Search Interest (Indonesia)',
      data:            timeline.map(d => d.value),
      borderColor:     seriesColor(0),
      backgroundColor: withAlpha(seriesColor(0), 0.12),
      borderWidth:     2,
      pointRadius:     2,
      tension:         0.35,
      fill:            true,
    }],
  }

  const options = {
    responsive:          true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => ` Interest: ${ctx.raw}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { font: { size: 10 }, maxTicksLimit: 8, color: '#999' },
        grid:  { display: false },
      },
      y: {
        min:   0,
        max:   100,
        ticks: { font: { size: 10 }, color: '#999', stepSize: 25 },
        grid:  { color: 'rgba(0,0,0,.05)' },
      },
    },
  }

  if (!timeline.length) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 13 }}>
        No trend data available
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0 }}>
      <Line data={data} options={options} />
    </div>
  )
}
