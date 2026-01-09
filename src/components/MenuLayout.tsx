'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const menuLinks = [
  { href: '/dashboard', label: 'Dashboard' },
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

  {
    href: '/ura',
    label: 'URA',
    sub: [{ href: '/ura/relatorio', label: 'Relatório de Operação' }],
  },

  // ✅ MONITORIA (APENAS GRUPO / SEM LINK)
{
  label: 'Monitoria',
  sub: [
    { href: '/monitoria-qualidade/controle-diario', label: 'Controle Diário' },
    { href: '/monitoria-qualidade/controle-drive', label: 'Controle do Drive' },
    { href: '/monitoria-qualidade', label: 'Monitoria de Qualidade' },
  { href: '/qualidade-registros', label: 'Avaliação & Reclamações' },
  { href: '/monitoria-qualidade/elogios', label: 'Elogios' },
  { href: '/monitoria-qualidade/nps-solicitado', label: 'NPS Solicitado' },
],
},


  { href: '/login?logout=1', label: 'Sair', color: 'gray' },
] as const

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  // ✅ Esconde menu em rotas específicas (inclui subrotas)
  const esconderMenu = useMemo(() => {
    const hiddenPrefixes = ['/campanhas', '/login']
    return hiddenPrefixes.some((p) => pathname === p || pathname.startsWith(p + '/'))
  }, [pathname])

  // ✅ helper: rota ativa (ex: /monitoria-qualidade ativa também em /monitoria-qualidade/registros)
  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  // ✅ abre automaticamente o dropdown do grupo quando entra em qualquer subrota
  useEffect(() => {
    const match = menuLinks.find((link: any) => link.sub?.some((sub: any) => isActive(sub.href)))
    if (match) setOpenDropdown(match.label)
  }, [pathname])

  return (
    <div className="flex min-h-screen bg-[#f5f6f7]">
      {!esconderMenu && (
        <aside className="w-64 bg-[#2687e2] text-white flex flex-col p-4 space-y-2 shadow-lg">
          <h2 className="text-xl font-bold mb-4">Sonax Painel</h2>

          {menuLinks.map((link: any) => {
            const temSub = !!link.sub
            const isGray = link.color === 'gray'

            // pai pode não ter href (grupo)
            const ativoPai = link.href ? isActive(link.href) : false
            const ativoAlgumSub = temSub ? link.sub.some((s: any) => isActive(s.href)) : false

            return (
              <div key={link.href ?? link.label} className="relative">
                <div className="flex items-center justify-between gap-2">
                  {link.href ? (
                    <Link
                      href={link.href}
                      className={[
                        'block w-full px-3 py-2 rounded-md text-sm font-medium transition',
                        isGray
                          ? 'bg-gray-500 hover:bg-gray-600'
                          : ativoPai || ativoAlgumSub
                          ? 'bg-[#145a9c]'
                          : 'hover:bg-[#1f6bb6]',
                      ].join(' ')}
                    >
                      {link.label}
                    </Link>
                  ) : (
                    // ✅ grupo sem link
                    <div className="block w-full px-3 py-2 rounded-md text-sm font-bold uppercase tracking-wide text-white/95 bg-[#1f6bb6]">
                      {link.label}
                    </div>
                  )}

                  {temSub && (
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === link.label ? null : link.label)}
                      className="text-white text-xs px-2 py-2 rounded hover:bg-[#1f6bb6] transition"
                      aria-label={`Abrir submenu de ${link.label}`}
                    >
                      {openDropdown === link.label ? '▲' : '▼'}
                    </button>
                  )}
                </div>

                {temSub && openDropdown === link.label && (
                  <div className="ml-4 mt-2 space-y-1">
                    {link.sub.map((sub: any) => {
                      const subAtivo = isActive(sub.href)
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={[
                            'block px-3 py-1.5 rounded-md text-sm transition',
                            subAtivo ? 'bg-[#145a9c]' : 'bg-[#1f6bb6] hover:bg-[#145a9c]',
                          ].join(' ')}
                        >
                          {sub.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </aside>
      )}

      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}
