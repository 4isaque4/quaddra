export default function About() {
  return (
    <section id="about" className="section section-alt">
      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="about-text order-2 lg:order-1">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-8 text-gray-900">
              Sobre a Quaddra
            </h2>
            <div className="space-y-6 text-gray-600 leading-relaxed">
              <p>
                Fundada com a paixão por tecnologia e inovação, a Quaddra nasceu para ajudar empresas a navegar no cenário digital em constante mudança. Nossa missão é ser mais que um fornecedor; somos um parceiro estratégico dedicado ao sucesso e crescimento dos nossos clientes.
              </p>
              <p>
                Nossos valores são a base de tudo o que fazemos: excelência técnica, colaboração transparente e um compromisso incansável com os resultados.
              </p>
            </div>
          </div>
          <div className="about-image order-1 lg:order-2">
            <div className="bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl p-8 text-white text-center">
              <div className="text-8xl mb-4">👥</div>
              <h3 className="text-2xl font-bold mb-2">Nossa Equipe</h3>
              <p className="text-orange-100">
                Profissionais apaixonados por tecnologia e inovação
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
