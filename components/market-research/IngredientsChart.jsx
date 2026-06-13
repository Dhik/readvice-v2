'use client'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  Title, Tooltip,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip)

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
      backgroundColor: values.map((v, idx) => idx === 0 ? 'var(--color-orange)' : idx < 3 ? 'rgba(224,123,57,.65)' : 'rgba(224,123,57,.3)'),
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
        ticks: { font: { size: 11 }, color: 'var(--color-dark1)' },
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
