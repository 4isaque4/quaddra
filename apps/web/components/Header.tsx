'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()
  const { theme } = useTheme()
  
  const isValeShop = pathname?.startsWith('/vale-shop')

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  return (
    <header className="bg-white shadow-sm fixed top-0 left-0 w-full z-50 h-24">
      {/* Remove o ::after do CSS global quando estiver na ValeShop */}
      {isValeShop && (
        <style dangerouslySetInnerHTML={{
          __html: `
            .nav-link::after {
              display: none !important;
            }
          `
        }} />
      )}
      
      <nav className="container flex justify-between items-center h-full">
        <Link href={isValeShop ? "/vale-shop/processos" : "/"} className="logo" onClick={closeMenu}>
          {isValeShop ? (
            <Image 
              src="/valeshop-logo.png" 
              alt="ValeShop" 
              width={180} 
              height={60}
              priority
              style={{ height: 'auto', width: '180px' }}
              className="logo-image"
            />
          ) : (
            <Image 
              src="/logo.png" 
              alt="Quaddra" 
              width={1200} 
              height={300}
              priority
              style={{ height: '200px', width: 'auto' }}
              className="logo-image"
            />
          )}
        </Link>
        
        <ul className={`nav-links ${isMenuOpen ? 'left-0' : '-left-full'} lg:static lg:flex lg:flex-row lg:bg-transparent lg:shadow-none lg:h-auto lg:w-auto lg:gap-8`}>
          {isValeShop ? (
            <>
              <li>
                <Link 
                  href="/vale-shop/processos" 
                  className="nav-link" 
                  onClick={closeMenu}
                  style={{
                    color: pathname === '/vale-shop/processos' ? theme.colors.primary : theme.colors.textSecondary,
                    borderBottom: pathname === '/vale-shop/processos' ? `2px solid ${theme.colors.primary}` : 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = theme.colors.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = pathname === '/vale-shop/processos' ? theme.colors.primary : theme.colors.textSecondary;
                  }}
                >
                  Processos
                </Link>
              </li>
              <li>
                <Link 
                  href="/vale-shop/processos/inserir" 
                  className="nav-link" 
                  onClick={closeMenu}
                  style={{
                    color: pathname === '/vale-shop/processos/inserir' ? theme.colors.primary : theme.colors.textSecondary,
                    borderBottom: pathname === '/vale-shop/processos/inserir' ? `2px solid ${theme.colors.primary}` : 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = theme.colors.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = pathname === '/vale-shop/processos/inserir' ? theme.colors.primary : theme.colors.textSecondary;
                  }}
                >
                  Inserir Processos
                </Link>
              </li>
              <li>
                <Link 
                  href="/" 
                  className="nav-link" 
                  onClick={closeMenu}
                  style={{ color: theme.colors.textSecondary }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = theme.colors.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = theme.colors.textSecondary;
                  }}
                >
                  Voltar para Quaddra
                </Link>
              </li>
            </>
          ) : (
            <>
              <li><Link href="/" className="nav-link" onClick={closeMenu}>Início</Link></li>
              <li><Link href="/#services" className="nav-link" onClick={closeMenu}>Serviços</Link></li>
              <li><Link href="/#about" className="nav-link" onClick={closeMenu}>Sobre Nós</Link></li>
              <li><Link href="/vale-shop/processos" className="nav-link" onClick={closeMenu}>ValeShop</Link></li>
              <li><Link href="/#contact" className="nav-link" onClick={closeMenu}>Contato</Link></li>
            </>
          )}
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
