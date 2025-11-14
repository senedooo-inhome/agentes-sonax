'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type AppShellProps = {
  title?: string
  children: React.ReactNode
}

const links = [
  { href: '/', label: 'Início', icon: '🏠' },
  { href: '/chamada', label: 'Chamada', icon: '📞' },
]

export function AppShell({ title, children }: AppShellProps) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen flex bg-[#f5f7fb] text-slate-800">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        {/* Logo / topo */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-slate-200">
          <div className="w-9 h-9 rounded-full bg-[#2687e2] flex items-center justify-center text-white font-bold">
            S
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-[#2687e2] text-sm">Sonax</span>
            <span className="text-xs text-slate-500">Call Center</span>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 py-4">
          {links.map((link) => {
            const active = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-4 py-2 text-sm font-medium hover:bg-slate-50 ${
                  active
                    ? 'text-[#2687e2] bg-slate-50 border-r-4 border-[#2687e2]'
                    : 'text-slate-600'
                }`}
              >
                <span className="text-lg">{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* CONTEÚDO */}
      <div className="flex-1 flex flex-col">
        {/* Topo da página */}
        <header className="h-16 px-8 flex items-center justify-between bg-white border-b border-slate-200">
          <h1 className="text-lg font-semibold text-slate-700">
            {title ?? 'Call Center'}
          </h1>
        </header>

        {/* Área principal */}
        <main className="flex-1 p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
