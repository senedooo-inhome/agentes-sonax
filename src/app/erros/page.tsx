'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ErrosFormPage() {
  const hoje = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    data: hoje,
    supervisor: '',
    agente: '',
    nicho: '',
    tipo: '',
    relato: '',
  })
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (
      !form.supervisor.trim() ||
      !form.agente.trim() ||
      !form.nicho.trim() ||
      !form.tipo.trim() ||
      !form.relato.trim()
    ) {
      alert('Preencha Data, Supervisor, Agente, Nicho, Tipo e Relato.')
      return
    }

    try {
      setSalvando(true)
      const { error } = await supabase.from('erros_agentes').insert([
        {
          data: form.data,
          supervisor: form.supervisor.trim(),
          agente: form.agente.trim(),
          nicho: form.nicho.trim(),
          tipo: form.tipo.trim(),
          relato: form.relato.trim(),
        },
      ])
      if (error) throw error
      alert('Registro salvo!')
      setForm({
        data: hoje,
        supervisor: '',
        agente: '',
        nicho: '',
        tipo: '',
        relato: '',
      })
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  const tiposErro = [
    'Factorial',
    'Pontualidade',
    'Erro atendimento Tel',
    'Problemas tec.',
    'Erro atendimento chat',
    'Mat. Trab. inadequado',
    'Tabulação incorreta',
    'Falta de atenção Bitrix',
    'Outros',
  ]

  const nichos = ['Clínica', 'SAC']

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6">
      <div className="mx-auto max-w-3xl space-y-6">
   

        <div className="rounded-xl bg-white p-6 shadow space-y-4">
          <form onSubmit={salvar} className="space-y-4">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Nome do supervisor
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  value={form.supervisor}
                  onChange={(e) =>
                    setForm({ ...form, supervisor: e.target.value })
                  }
                  placeholder="Ex.: MARCO"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Nome do agente pontuado
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  value={form.agente}
                  onChange={(e) =>
                    setForm({ ...form, agente: e.target.value })
                  }
                  placeholder="Ex.: JOANA"
                />
              </div>
            </div>

            {/* Novo campo: Nicho */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Nicho do agente
              </label>
              <select
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.nicho}
                onChange={(e) => setForm({ ...form, nicho: e.target.value })}
              >
                <option value="">Selecione o nicho</option>
                {nichos.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Tipo do erro
              </label>
              <select
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                <option value="">Selecione o motivo</option>
                {tiposErro.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Relato do erro
              </label>
              <textarea
                rows={5}
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.relato}
                onChange={(e) =>
                  setForm({ ...form, relato: e.target.value })
                }
                placeholder="Descreva o ocorrido, contexto e evidências…"
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
