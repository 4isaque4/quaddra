'use client'

import { useState } from 'react'
import Link from 'next/link'
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
        <Link href="/" className="logo" onClick={closeMenu}>
          <Image 
            src="/logo.png" 
            alt="Quaddra" 
            width={240} 
            height={60}
            priority
            className="h-14 w-auto"
          />
        </Link>
        
        <ul className={`nav-links ${isMenuOpen ? 'left-0' : '-left-full'} lg:static lg:flex lg:flex-row lg:bg-transparent lg:shadow-none lg:h-auto lg:w-auto lg:gap-8`}>
          <li><Link href="/" className="nav-link" onClick={closeMenu}>Início</Link></li>
          <li><Link href="/#services" className="nav-link" onClick={closeMenu}>Serviços</Link></li>
          <li><Link href="/#about" className="nav-link" onClick={closeMenu}>Sobre Nós</Link></li>
          <li><Link href="/processos" className="nav-link" onClick={closeMenu}>Processos</Link></li>
          <li><Link href="/processos/inserir" className="nav-link text-orange-600 font-semibold" onClick={closeMenu}>Inserir Processos</Link></li>
          <li><Link href="/#contact" className="nav-link" onClick={closeMenu}>Contato</Link></li>
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
