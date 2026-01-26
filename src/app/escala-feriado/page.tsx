'use client'

import EscalaFeriadoEmpresas from '@/components/EscalaFeriadoEmpresas'

export default function EscalaFeriadoPage() {
  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        {/* Cabeçalho simples (não aparece no menu, só nessa rota) */}
        <div className="rounded-2xl bg-white p-6 shadow border border-gray-200">
          <h1 className="text-2xl font-extrabold text-[#2687e2]">Escala do próximo feriado</h1>
          <p className="text-sm text-gray-600 mt-1">
            Página exclusiva para marcar quais empresas terão atendimento.
          </p>
        </div>

        {/* O quadro */}
        <EscalaFeriadoEmpresas />
      </div>
    </main>
  )
}
