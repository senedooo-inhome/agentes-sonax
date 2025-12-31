'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const NICHOS = ['Clínica', 'SAC'] as const
const STATUS = [
  { value: 'Resolvido', label: 'Resolvido', color: '#46a049' },
  { value: 'Pendente', label: 'Pendente', color: '#f5a623' },
] as const

type Agente = { id: string | number; nome: string }
type Supervisao = { id: string | number; nome: string }
type Empresa = { id: string | number; nome: string }

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

  // ✅ Listas
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [supervisoes, setSupervisoes] = useState<Supervisao[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])

  const [carregandoAgentes, setCarregandoAgentes] = useState(false)
  const [carregandoSupervisoes, setCarregandoSupervisoes] = useState(false)
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(false)

  // ✅ Busca (digitável)
  const [buscaAgente, setBuscaAgente] = useState('')
  const [buscaEmpresa, setBuscaEmpresa] = useState('')

  useEffect(() => {
    carregarListas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function carregarListas() {
    try {
      setCarregandoAgentes(true)
      setCarregandoSupervisoes(true)
      setCarregandoEmpresas(true)

      const [
        { data: agData, error: agErr },
        { data: supData, error: supErr },
        { data: empData, error: empErr },
      ] = await Promise.all([
        supabase.from('agentes').select('id, nome').order('nome', { ascending: true }),
        supabase.from('supervisoes').select('id, nome').order('nome', { ascending: true }),
        supabase.from('empresas').select('id, nome').order('nome', { ascending: true }),
      ])

      if (agErr) throw agErr
      if (supErr) throw supErr
      if (empErr) throw empErr

      setAgentes((agData as any) || [])
      setSupervisoes((supData as any) || [])
      setEmpresas((empData as any) || [])
    } catch (err: any) {
      console.error(err)
      alert('Erro ao carregar listas: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCarregandoAgentes(false)
      setCarregandoSupervisoes(false)
      setCarregandoEmpresas(false)
    }
  }

  // ✅ Filtradas (sem travar UI)
  const agentesFiltrados = useMemo(() => {
    const q = buscaAgente.trim().toLowerCase()
    if (!q) return agentes
    return agentes.filter((a) => (a.nome || '').toLowerCase().includes(q))
  }, [agentes, buscaAgente])

  const empresasFiltradas = useMemo(() => {
    const q = buscaEmpresa.trim().toLowerCase()
    if (!q) return empresas
    return empresas.filter((e) => (e.nome || '').toLowerCase().includes(q))
  }, [empresas, buscaEmpresa])

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
          contato: form.cliente_protocolo.trim(),
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
      setBuscaAgente('')
      setBuscaEmpresa('')
    } catch (err: any) {
      console.error(err)
      alert('Erro ao salvar: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] px-4 py-6">
      {/* ✅ 16:9 / desktop-first: mais largura e menos “aperto” */}
      <div className="mx-auto w-full max-w-6xl">
        <div className="rounded-2xl bg-white p-6 md:p-8 shadow space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-[#1f2a37]">Registro de Ligações</h1>
              <p className="text-sm text-[#535151]">
                Registre aqui as ligações que foram feitas pela operação para clientes.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={carregarListas}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-800 hover:bg-gray-50"
              >
                Recarregar listas
              </button>
            </div>
          </div>

          <form onSubmit={salvar} className="space-y-6">
            {/* Linha 1: Data / Nicho / Status (horizontal) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Data</label>
                <input
                  type="date"
                  className="w-full rounded-lg border p-2 text-[#535151] bg-white"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                />
              </div>

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
            </div>

            {/* Linha 2: Responsável (busca + select) / Empresa (busca + select) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Responsável */}
              <div className="rounded-xl border bg-white p-4">
                <label className="block text-sm font-semibold mb-2 text-[#ff751f]">
                  Pessoa responsável pela ligação
                </label>

                <input
                  type="text"
                  className="w-full rounded-lg border p-2 text-[#535151] bg-white mb-3"
                  value={buscaAgente}
                  onChange={(e) => setBuscaAgente(e.target.value)}
                  placeholder="Digite para buscar o agente..."
                />

                <select
                  className="w-full rounded-lg border p-2 text-[#535151] bg-white disabled:opacity-60"
                  value={form.responsavel}
                  onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                  disabled={carregandoAgentes}
                >
                  <option value="">
                    {carregandoAgentes ? 'Carregando agentes…' : 'Selecione um agente'}
                  </option>
                  {agentesFiltrados.map((a) => (
                    <option key={String(a.id)} value={a.nome}>
                      {a.nome}
                    </option>
                  ))}
                </select>

                <p className="text-xs text-gray-500 mt-2">
                  Lista vinda de <strong>agentes.nome</strong>
                </p>
              </div>

              {/* Empresa */}
              <div className="rounded-xl border bg-white p-4">
                <label className="block text-sm font-semibold mb-2 text-[#ff751f]">Empresa</label>

                <input
                  type="text"
                  className="w-full rounded-lg border p-2 text-[#535151] bg-white mb-3"
                  value={buscaEmpresa}
                  onChange={(e) => setBuscaEmpresa(e.target.value)}
                  placeholder="Digite para localizar a empresa..."
                />

                <select
                  className="w-full rounded-lg border p-2 text-[#535151] bg-white disabled:opacity-60"
                  value={form.empresa}
                  onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                  disabled={carregandoEmpresas}
                >
                  <option value="">
                    {carregandoEmpresas ? 'Carregando empresas…' : 'Selecione uma empresa'}
                  </option>
                  {empresasFiltradas.map((em) => (
                    <option key={String(em.id)} value={em.nome}>
                      {em.nome}
                    </option>
                  ))}
                </select>

                <p className="text-xs text-gray-500 mt-2">
                  Lista vinda de <strong>empresas.nome</strong>
                </p>
              </div>
            </div>

            {/* Linha 3: Cliente/protocolo / Supervisão */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Nº do cliente ou protocolo
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border p-2 text-[#535151] bg-white"
                  value={form.cliente_protocolo}
                  onChange={(e) => setForm({ ...form, cliente_protocolo: e.target.value })}
                  placeholder="Ex.: (11) 99999-9999 ou 123456"
                />
              </div>

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
            </div>

            {/* Linha 4: Detalhe (mais largo, menos “alto”) */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Detalhe sobre a ligação
              </label>
              <textarea
                rows={3}
                className="w-full rounded-lg border p-3 text-[#535151] bg-white"
                value={form.detalhe}
                onChange={(e) => setForm({ ...form, detalhe: e.target.value })}
                placeholder="Descreva o motivo da ligação, retorno do cliente, encaminhamento, etc."
              />
            </div>

            {/* Ações */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={salvando}
                className="rounded-lg bg-[#2687e2] px-5 py-2.5 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
