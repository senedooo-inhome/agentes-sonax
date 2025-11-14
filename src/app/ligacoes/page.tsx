'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const NICHOS = ['Clínica', 'SAC'] as const
const STATUS = [
  { value: 'Resolvido', label: 'Resolvido', color: '#46a049' },
  { value: 'Pendente', label: 'Pendente', color: '#f5a623' },
] as const

export default function LigacoesPage() {
  const hoje = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    data: hoje,
    nicho: '' as '' | (typeof NICHOS)[number],
    responsavel: '',
    cliente_protocolo: '',
    empresa: '',
    status: '' as '' | (typeof STATUS)[number]['value'],
    supervisao: '',
    detalhe: '',
  })
  const [salvando, setSalvando] = useState(false)

async function salvar(e: React.FormEvent) {
  e.preventDefault()
  if (
    !form.data ||
    !form.nicho ||
    !form.responsavel.trim() ||
    !form.cliente_protocolo.trim() ||
    !form.empresa.trim() ||
    !form.status ||
    !form.supervisao.trim() ||
    !form.detalhe.trim()
  ) {
    alert('Preencha todos os campos.')
    return
  }

  try {
    setSalvando(true)
    const { error } = await supabase.from('ligacoes_ativas').insert([
      {
        data: form.data,
        nicho: form.nicho,
        responsavel: form.responsavel.trim(),
        cliente_protocolo: form.cliente_protocolo.trim(),
        contato: form.cliente_protocolo.trim(), // 👈 preenche a coluna contato
        empresa: form.empresa.trim(),
        status: form.status,
        supervisao: form.supervisao.trim(),
        detalhe: form.detalhe.trim(),
      },
    ])

    if (error) throw error

    alert('Ligação registrada!')
    setForm({
      data: new Date().toISOString().slice(0, 10),
      nicho: '',
      responsavel: '',
      cliente_protocolo: '',
      empresa: '',
      status: '',
      supervisao: '',
      detalhe: '',
    })
  } catch (err: any) {
    alert('Erro ao salvar: ' + err.message)
  } finally {
    setSalvando(false)
  }
}


  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* NAV PRINCIPAL */}
        

        <div className="rounded-xl bg-white p-6 shadow space-y-4">
          <p className="text-sm text-[#535151]">
            Registre aqui as ligações que foram feitas pela operação para clientes.
          </p>

          <form onSubmit={salvar} className="space-y-4">
            {/* Data */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Data
              </label>
              <input
                type="date"
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </div>

            {/* Nicho / Responsável */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Nicho
                </label>
                <select
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  value={form.nicho}
                  onChange={(e) =>
                    setForm({ ...form, nicho: e.target.value as any })
                  }
                >
                  <option value="">Selecione</option>
                  {NICHOS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Pessoa responsável pela ligação
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  value={form.responsavel}
                  onChange={(e) =>
                    setForm({ ...form, responsavel: e.target.value })
                  }
                  placeholder="Ex.: MARCO"
                />
              </div>
            </div>

            {/* Cliente / protocolo + Empresa */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Nº do cliente ou protocolo
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  value={form.cliente_protocolo}
                  onChange={(e) =>
                    setForm({ ...form, cliente_protocolo: e.target.value })
                  }
                  placeholder="Ex.: (11) 99999-9999 ou 123456"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Empresa
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  value={form.empresa}
                  onChange={(e) =>
                    setForm({ ...form, empresa: e.target.value })
                  }
                  placeholder="Ex.: SONAX / clínica XPTO"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Status
              </label>
              <select
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as any })
                }
              >
                <option value="">Selecione</option>
                {STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Resolvido = verde | Pendente = amarelo
              </p>
            </div>

            {/* Supervisão responsável */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Supervisão responsável
              </label>
              <input
                type="text"
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.supervisao}
                onChange={(e) =>
                  setForm({ ...form, supervisao: e.target.value })
                }
                placeholder="Ex.: supervisao@sonax.net.br"
              />
            </div>

            {/* Detalhe */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Detalhe sobre a ligação
              </label>
              <textarea
                rows={4}
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.detalhe}
                onChange={(e) =>
                  setForm({ ...form, detalhe: e.target.value })
                }
                placeholder="Descreva o motivo da ligação, retorno do cliente, encaminhamento, etc."
              />
            </div>

            <button
              type="submit"
              disabled={salvando}
              className="rounded-lg bg-[#2687e2] px-4 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
