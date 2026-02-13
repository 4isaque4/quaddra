'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Search, KeyRound, ChevronDown } from 'lucide-react'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()
  const isValeShop = pathname?.startsWith('/vale-shop')

  const toggleMenu = () => setIsMenuOpen((prev) => !prev)
  const closeMenu = () => setIsMenuOpen(false)

  const valeLinks = [
    { href: '/vale-shop/processos', label: 'Processos' },
    { href: '/vale-shop/processos/inserir', label: 'Inserir Processos' },
    { href: '/', label: 'Voltar para Quaddra' },
  ]

  return (
    <header
      className="fixed top-0 left-0 w-full z-50 h-24 shadow-sm"
      style={{ backgroundColor: isValeShop ? '#005EA8' : '#fff' }}
    >
      {isValeShop && (
        <style dangerouslySetInnerHTML={{ __html: `.nav-link::after { display: none !important; }` }} />
      )}

      <nav className="container flex justify-between items-center h-full">
        <Link href={isValeShop ? '/vale-shop/processos' : '/'} className="logo" onClick={closeMenu}>
          {isValeShop ? (
            <Image src="/valeshop-logo.png" alt="ValeShop" width={180} height={60} priority style={{ height: 'auto', width: '180px' }} />
          ) : (
            <Image src="/logo.png" alt="Quaddra" width={1200} height={300} priority style={{ height: '200px', width: 'auto' }} />
          )}
        </Link>

        <ul
          className={`nav-links ${isMenuOpen ? 'left-0' : '-left-full'} lg:static lg:flex lg:flex-row lg:bg-transparent lg:shadow-none lg:h-auto lg:w-auto lg:gap-6`}
          style={{ backgroundColor: isValeShop ? '#005EA8' : undefined }}
        >
          {isValeShop ? (
            <>
              {valeLinks.map((item) => {
                const active = pathname === item.href
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="nav-link flex items-center gap-1"
                      onClick={closeMenu}
                      style={{ color: '#fff', borderBottom: active ? '2px solid #FFD24A' : 'none' }}
                    >
                      <span>{item.label}</span>
                      {item.href !== '/' && <ChevronDown className="w-3 h-3 opacity-80" />}
                    </Link>
                  </li>
                )
              })}
              <li>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#FFD24A] text-[#FFD24A] text-sm font-semibold">
                  <KeyRound className="w-4 h-4" /> Meu acesso
                </span>
              </li>
              <li>
                <button type="button" className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/80 text-white">
                  <Search className="w-4 h-4" />
                </button>
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

        <button className="lg:hidden menu-toggle z-50" onClick={toggleMenu} aria-label="Abrir menu">
          <span className={`block w-6 h-0.5 transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`} style={{ backgroundColor: isValeShop ? '#fff' : '#1f2937' }}></span>
          <span className={`block w-6 h-0.5 my-1.5 transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`} style={{ backgroundColor: isValeShop ? '#fff' : '#1f2937' }}></span>
          <span className={`block w-6 h-0.5 transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} style={{ backgroundColor: isValeShop ? '#fff' : '#1f2937' }}></span>
        </button>
      </nav>
    </header>
  )
}
