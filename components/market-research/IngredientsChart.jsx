'use client'
import { Bar } from 'react-chartjs-2'
import { seriesColor, withAlpha } from '@/lib/charts/theme' // central register + defaults

export default function IngredientsChart({ ingredients = [] }) {
  if (!ingredients.length) {
    return (
      <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 13 }}>
        No ingredient data found in product names
      </div>
    )
  }

  const labels = ingredients.map(i => i.name)
  const values = ingredients.map(i => i.count)
  const max    = Math.max(...values)

  const data = {
    labels,
    datasets: [{
      data:            values,
      backgroundColor: values.map((v, idx) => idx === 0 ? seriesColor(0) : idx < 3 ? withAlpha(seriesColor(0), 0.65) : withAlpha(seriesColor(0), 0.3)),
      borderRadius:    4,
      barThickness:    18,
    }],
  }

  const options = {
    indexAxis:           'y',
    responsive:          true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => ` Found in ${ctx.raw} product${ctx.raw !== 1 ? 's' : ''}`,
        },
      },
    },
    scales: {
      x: {
        min:   0,
        max:   max + 1,
        ticks: { font: { size: 10 }, color: '#999', stepSize: 1 },
        grid:  { color: 'rgba(0,0,0,.05)' },
      },
      y: {
        ticks: { font: { size: 11 }, color: seriesColor(1) },
        grid:  { display: false },
      },
    },
  }

  const chartHeight = Math.max(180, ingredients.length * 30 + 20)

  return (
    <div style={{ height: chartHeight }}>
      <Bar data={data} options={options} />
    </div>
  )
}
