export default function HeroSection() {
  return (
    <section className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-4xl font-bold tracking-tight">Readvice</h1>
      <p className="mt-4 text-lg text-gray-500 max-w-xl">
        Multi-tenant e-commerce analytics dashboard. Import orders, track campaigns, and grow your business.
      </p>
      <a
        href="/login"
        className="mt-8 inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
      >
        Get Started
      </a>
    </section>
  )
}
