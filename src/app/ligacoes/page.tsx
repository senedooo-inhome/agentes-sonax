'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const NICHOS = ['Clínica', 'SAC'] as const
const STATUS = [
  { value: 'Resolvido', label: 'Resolvido', color: '#46a049' },
  { value: 'Pendente', label: 'Pendente', color: '#f5a623' },
] as const

type Agente = { id: string | number; nome: string }
type Supervisao = { id: string | number; nome: string }

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

  // ✅ Listas para os dropdowns
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [supervisoes, setSupervisoes] = useState<Supervisao[]>([])
  const [carregandoAgentes, setCarregandoAgentes] = useState(false)
  const [carregandoSupervisoes, setCarregandoSupervisoes] = useState(false)

  useEffect(() => {
    carregarListas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function carregarListas() {
    try {
      setCarregandoAgentes(true)
      setCarregandoSupervisoes(true)

      const [{ data: agData, error: agErr }, { data: supData, error: supErr }] =
        await Promise.all([
          supabase.from('agentes').select('id, nome').order('nome', { ascending: true }),
          supabase.from('supervisoes').select('id, nome').order('nome', { ascending: true }),
        ])

      if (agErr) throw agErr
      if (supErr) throw supErr

      setAgentes((agData as any) || [])
      setSupervisoes((supData as any) || [])
    } catch (err: any) {
      console.error(err)
      alert('Erro ao carregar listas: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCarregandoAgentes(false)
      setCarregandoSupervisoes(false)
    }
  }

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
          contato: form.cliente_protocolo.trim(), // 👈 mantém como você fez
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
      console.error(err)
      alert('Erro ao salvar: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow space-y-4">
          <p className="text-sm text-[#535151]">
            Registre aqui as ligações que foram feitas pela operação para clientes.
          </p>

          <form onSubmit={salvar} className="space-y-4">
            {/* Data */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Data</label>
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
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Nicho</label>
                <select
                  className="w-full rounded-lg border p-2 text-[#535151] bg-white"
                  value={form.nicho}
                  onChange={(e) => setForm({ ...form, nicho: e.target.value as any })}
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

                <select
                  className="w-full rounded-lg border p-2 text-[#535151] bg-white disabled:opacity-60"
                  value={form.responsavel}
                  onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                  disabled={carregandoAgentes}
                >
                  <option value="">
                    {carregandoAgentes ? 'Carregando agentes…' : 'Selecione um agente'}
                  </option>
                  {agentes.map((a) => (
                    <option key={String(a.id)} value={a.nome}>
                      {a.nome}
                    </option>
                  ))}
                </select>

                <p className="text-xs text-gray-500 mt-1">
                  Lista vinda de <strong>agentes.nome</strong>
                </p>
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
                  onChange={(e) => setForm({ ...form, cliente_protocolo: e.target.value })}
                  placeholder="Ex.: (11) 99999-9999 ou 123456"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Empresa</label>
                <input
                  type="text"
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  value={form.empresa}
                  onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                  placeholder="Ex.: SONAX / clínica XPTO"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Status</label>
              <select
                className="w-full rounded-lg border p-2 text-[#535151] bg-white"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as any })}
              >
                <option value="">Selecione</option>
                {STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Resolvido = verde | Pendente = amarelo</p>
            </div>

            {/* Supervisão responsável */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Supervisão responsável
              </label>

              <select
                className="w-full rounded-lg border p-2 text-[#535151] bg-white disabled:opacity-60"
                value={form.supervisao}
                onChange={(e) => setForm({ ...form, supervisao: e.target.value })}
                disabled={carregandoSupervisoes}
              >
                <option value="">
                  {carregandoSupervisoes ? 'Carregando supervisões…' : 'Selecione uma supervisão'}
                </option>
                {supervisoes.map((s) => (
                  <option key={String(s.id)} value={s.nome}>
                    {s.nome}
                  </option>
                ))}
              </select>

              <p className="text-xs text-gray-500 mt-1">
                Lista vinda de <strong>supervisoes.nome</strong>
              </p>
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
                onChange={(e) => setForm({ ...form, detalhe: e.target.value })}
                placeholder="Descreva o motivo da ligação, retorno do cliente, encaminhamento, etc."
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={salvando}
                className="rounded-lg bg-[#2687e2] px-4 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>

              <button
                type="button"
                onClick={carregarListas}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-800 hover:bg-gray-50"
              >
                Recarregar listas
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
