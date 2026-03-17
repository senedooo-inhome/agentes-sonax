'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { hasPermission, type UserRole } from '@/lib/permissions'

type MenuSubItem = {
  href: string
  label: string
}

type MenuItem =
  | {
      href: string
      label: string
      color?: string
      sub?: readonly MenuSubItem[]
    }
  | {
      label: string
      color?: string
      sub: readonly MenuSubItem[]
    }

const menuLinks: readonly MenuItem[] = [
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

  { href: '/informacoes-agentes', label: 'Informações de Agentes' },

  { href: '/login?logout=1', label: 'Sair', color: 'gray' },
] as const

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loadingRole, setLoadingRole] = useState(true)

  useEffect(() => {
    let active = true

    async function loadRole() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!active) return

      if (!session?.user) {
        setRole(null)
        setLoadingRole(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (!active) return

      if (profile?.role) {
        setRole(profile.role as UserRole)
      } else {
        setRole(null)
      }

      setLoadingRole(false)
    }

    loadRole()

    return () => {
      active = false
    }
  }, [])

  const esconderMenu = useMemo(() => {
    if (pathname === '/login') return true
    if (pathname === '/escala-feriado' || pathname.startsWith('/escala-feriado/')) return true
    if (pathname === '/campanhas') return true
    return false
  }, [pathname])

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  const menuFiltrado = useMemo(() => {
    if (!role) return []

    return menuLinks
      .map((link) => {
        if ('href' in link && link.href === '/login?logout=1') {
          return link
        }

        const subItems = 'sub' in link ? (link.sub ?? []) : []

        if (subItems.length > 0) {
          const subPermitidos = subItems.filter((sub) => hasPermission(role, sub.href))
          const paiPermitido = 'href' in link && link.href ? hasPermission(role, link.href) : false

          if (!paiPermitido && subPermitidos.length === 0) return null

          return {
            ...link,
            sub: subPermitidos,
          } as MenuItem
        }

        if ('href' in link && link.href && hasPermission(role, link.href)) {
          return link
        }

        return null
      })
      .filter(Boolean) as MenuItem[]
  }, [role])

  useEffect(() => {
    const match = menuFiltrado.find((link) => {
      const subItems = 'sub' in link ? (link.sub ?? []) : []
      return subItems.some((sub) => isActive(sub.href))
    })

    if (match) {
      setOpenDropdown(match.label)
    }
  }, [pathname, menuFiltrado])

  if (loadingRole) {
    return (
      <div className="flex min-h-screen bg-[#f5f6f7]">
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#f5f6f7]">
      {!esconderMenu && (
        <aside className="w-64 bg-[#2687e2] text-white flex flex-col p-4 space-y-2 shadow-lg">
          <h2 className="text-xl font-bold mb-4">Sonax Painel</h2>

          {menuFiltrado.map((link) => {
            const subItems = 'sub' in link ? (link.sub ?? []) : []
            const temSub = subItems.length > 0
            const isGray = link.color === 'gray'
            const ativoPai = 'href' in link && link.href ? isActive(link.href) : false
            const ativoAlgumSub = subItems.some((s) => isActive(s.href))

            return (
              <div key={('href' in link && link.href) ? link.href : link.label} className="relative">
                <div className="flex items-center justify-between gap-2">
                  {'href' in link && link.href ? (
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
                    {subItems.map((sub) => {
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