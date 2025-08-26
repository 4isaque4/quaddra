export default function Hero() {
  return (
    <section id="home" className="hero bg-gray-50 min-h-screen flex items-center pt-20">
      <div className="container text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          Soluções inovadoras para o seu negócio.
        </h1>
        <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto mb-8 leading-relaxed">
          Transformamos ideias em realidade digital com tecnologia de ponta e uma equipe apaixonada pelo que faz.
        </p>
        <a href="#contact" className="cta-button">
          Vamos Conversar
        </a>
      </div>
    </section>
  )
}
