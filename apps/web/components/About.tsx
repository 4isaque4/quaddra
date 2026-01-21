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
              <div className="flex justify-center mb-4">
                <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
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
