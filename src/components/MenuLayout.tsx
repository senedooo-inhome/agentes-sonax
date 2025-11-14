'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

const menuLinks = [
  { href: '/', label: 'Início' },
  {
    href: '/chamada',
    label: 'Chamada',
    sub: [{ href: '/chamada/relatorio', label: 'Relatório de Chamada' }],
  },
  {
    href: '/erros',
    label: 'Erros',
    sub: [{ href: '/erros/relatorio', label: 'Relatório de Erros' }],
  },
  {
    href: '/advertencias',
    label: 'Advertências',
    sub: [{ href: '/advertencias/relatorio', label: 'Relatório de Advertência' }],
  },
  {
    href: '/ligacoes',
    label: 'Ligações Ativas',
    sub: [{ href: '/ligacoes/relatorios', label: 'Relatório de Ligações' }],
  },
  { href: '/atestados', label: 'Atestados' },
  { href: '/ausencias', label: 'Ausências' },
  {
  href: '/campanhas',
  label: 'Campanhas',
  sub: [{ href: '/campanhas/relatorio', label: 'Relatório de Campanhas' }],
},
  { href: '/login?logout=1', label: 'Sair', color: 'gray' },
]

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const esconderMenu = ['/campanhas', '/login'].includes(pathname)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  // Abre automaticamente o submenu se estiver em uma subrota
  useEffect(() => {
    const match = menuLinks.find(link =>
      link.sub?.some(sub => pathname.startsWith(sub.href))
    )
    if (match) {
      setOpenDropdown(match.label)
    }
  }, [pathname])

  return (
    <div className="flex min-h-screen bg-[#f5f6f7]">
      {!esconderMenu && (
        <aside className="w-64 bg-[#2687e2] text-white flex flex-col p-4 space-y-2 shadow-lg">
          <h2 className="text-xl font-bold mb-4">Sonax Painel</h2>
          {menuLinks.map(link => (
            <div key={link.href} className="relative">
              <div className="flex items-center justify-between">
                <a
                  href={link.href}
                  className={`block w-full px-3 py-2 rounded-md text-sm font-medium hover:bg-[#1f6bb6] ${
                    link.color === 'gray' ? 'bg-gray-500 hover:bg-gray-600' : ''
                  }`}
                >
                  {link.label}
                </a>
                {link.sub && (
                  <button
                    onClick={() =>
                      setOpenDropdown(openDropdown === link.label ? null : link.label)
                    }
                    className="text-white text-xs px-2"
                  >
                    ▼
                  </button>
                )}
              </div>

              {link.sub && openDropdown === link.label && (
                <div className="ml-4 mt-1 space-y-1">
                  {link.sub.map(sub => (
                    <a
                      key={sub.href}
                      href={sub.href}
                      className="block px-3 py-1 rounded-md text-sm bg-[#1f6bb6] hover:bg-[#145a9c]"
                    >
                      {sub.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </aside>
      )}
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}