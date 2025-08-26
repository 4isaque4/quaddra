import { Header, Hero, Services, About, Contact, Footer } from '@/components'

export default function Home() {
  return (
    <>
      <Header />
      <main className="pt-20">
        <Hero />
        <Services />
        <About />
        <section className="section container text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-8 text-gray-900">
            Nossos Processos
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Visualize e analise nossos processos de negócio BPMN
          </p>
          <a href="/processos" className="cta-button">
            Ver Processos
          </a>
        </section>
        <Contact />
      </main>
      <Footer />
    </>
  )
}
