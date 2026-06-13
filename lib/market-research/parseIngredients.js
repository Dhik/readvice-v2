const INGREDIENTS = [
  'Niacinamide', 'Hyaluronic Acid', 'Retinol', 'Vitamin C',
  'Ceramide', 'Salicylic Acid', 'AHA', 'BHA', 'Glycerin',
  'Kojic Acid', 'Collagen', 'Peptide', 'SPF', 'Centella',
  'Tranexamic Acid', 'Zinc', 'Tea Tree', 'Bakuchiol',
  'Squalane', 'Aloe Vera', 'Arbutin', 'Lactic Acid',
  'Glycolic Acid', 'Azelaic Acid', 'Propolis', 'Snail Mucin',
  'Mugwort', 'Panthenol',
]

export function parseIngredients(products) {
  const counts = {}
  for (const product of products) {
    const text = (product.name || '').toLowerCase()
    for (const ing of INGREDIENTS) {
      if (text.includes(ing.toLowerCase())) {
        counts[ing] = (counts[ing] || 0) + 1
      }
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))
}
