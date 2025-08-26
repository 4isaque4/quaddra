'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  return (
    <header className="bg-white shadow-sm fixed top-0 left-0 w-full z-50 h-20">
      <nav className="container flex justify-between items-center h-full">
        <a href="#home" className="logo" onClick={closeMenu}>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">Q</span>
            </div>
            <span className="text-2xl font-bold text-gray-800">QUADDRA</span>
          </div>
        </a>
        
        <ul className={`nav-links ${isMenuOpen ? 'left-0' : '-left-full'} lg:static lg:flex lg:flex-row lg:bg-transparent lg:shadow-none lg:h-auto lg:w-auto lg:gap-8`}>
          <li><a href="#home" className="nav-link" onClick={closeMenu}>Início</a></li>
          <li><a href="#services" className="nav-link" onClick={closeMenu}>Serviços</a></li>
          <li><a href="#about" className="nav-link" onClick={closeMenu}>Sobre Nós</a></li>
          <li><a href="#contact" className="nav-link" onClick={closeMenu}>Contato</a></li>
        </ul>
        
        <button 
          className="lg:hidden menu-toggle z-50"
          onClick={toggleMenu}
          aria-label="Abrir menu"
        >
          <span className={`block w-6 h-0.5 bg-gray-800 transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`}></span>
          <span className={`block w-6 h-0.5 bg-gray-800 my-1.5 transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`}></span>
          <span className={`block w-6 h-0.5 bg-gray-800 transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}></span>
        </button>
      </nav>
    </header>
  )
}
