'use client'

import { useState } from 'react'

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  })
  const [status, setStatus] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('Mensagem enviada com sucesso! Entraremos em contato em breve.')
    
    // Aqui você pode adicionar a lógica para enviar o formulário
    console.log('Formulário enviado:', formData)
    
    // Limpar formulário
    setFormData({ name: '', email: '', message: '' })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <section id="contact" className="section container">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-8 text-gray-900">
          Entre em Contato
        </h2>
        <p className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto">
          Tem um projeto em mente? Adoraríamos ouvir sobre ele.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Seu Nome"
              required
              className="w-full px-6 py-4 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all duration-300 text-gray-900 placeholder-gray-500"
            />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Seu E-mail"
              required
              className="w-full px-6 py-4 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all duration-300 text-gray-900 placeholder-gray-500"
            />
          </div>
          
          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            rows={5}
            placeholder="Sua Mensagem"
            required
            className="w-full px-6 py-4 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all duration-300 text-gray-900 placeholder-gray-500 resize-vertical"
          />
          
          <button type="submit" className="cta-button">
            Enviar Mensagem
          </button>
        </form>
        
        {status && (
          <p className="mt-6 text-orange-600 font-semibold">
            {status}
          </p>
        )}
      </div>
    </section>
  )
}
