import { Code, Cloud, BarChart3 } from 'lucide-react'

export default function Services() {
  const services = [
    {
      icon: Code,
      title: "Desenvolvimento de Software",
      description: "Criamos soluções de software sob medida, desde aplicativos móveis a sistemas empresariais complexos."
    },
    {
      icon: Cloud,
      title: "Soluções em Nuvem",
      description: "Otimizamos sua infraestrutura com serviços em nuvem, garantindo escalabilidade, segurança e eficiência."
    },
    {
      icon: BarChart3,
      title: "Análise de Dados",
      description: "Transformamos dados brutos em insights valiosos para impulsionar a tomada de decisões estratégicas."
    }
  ]

  return (
    <section id="services" className="section container">
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-16 text-gray-900">
        Nossos Serviços
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {services.map((service, index) => {
          const IconComponent = service.icon
          return (
            <div key={index} className="service-card text-center">
              <div className="flex justify-center mb-6">
                <IconComponent className="w-16 h-16 text-orange-500" />
              </div>
              <h3 className="text-xl md:text-2xl font-semibold mb-4 text-gray-900">
                {service.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {service.description}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
