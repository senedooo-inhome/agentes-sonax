'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Agente = { id: string | number; nome: string }
type Empresa = { id: string | number; nome: string }

const STATUS = ['Selecione', 'Aprovado', 'Reprovado', 'Pendente'] as const
type Tabulacao = '' | 'Correto' | 'Incorreto'

type MonitoriaRow = {
  id: string
  created_at: string
  data: string
  agente: string
  empresa: string
  numero_cliente: string
  status: string
  tabulacao: 'Correto' | 'Incorreto'
  observacao: string | null
}

function hojeYYYYMMDD() {
  return new Date().toISOString().slice(0, 10)
}

function csvEscape(v: any) {
  const s = String(v ?? '')
  // se tiver aspas, vírgula ou quebra de linha, envolve com aspas e duplica aspas internas
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) {
    alert('Sem dados para exportar.')
    return
  }

  const headers = Object.keys(rows[0])
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(',')),
  ]
  const csv = lines.join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function MonitoriaQualidadePage() {
  const router = useRouter()

  // ====== Guard (somente supervisao@sonax.net.br) ======
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const email = data.session?.user?.email || ''
      if (email !== 'supervisao@sonax.net.br') {
        router.replace('/') // ou /chamada, como você usa
        return
      }
      setCheckingAuth(false)
    })()
  }, [router])

  // ====== Form ======
  const [form, setForm] = useState({
    data: hojeYYYYMMDD(),
    agente: '',
    empresa: '',
    numero_cliente: '',
    status: '' as string,
    tabulacao: '' as Tabulacao,
    observacao: '',
  })

  const [salvando, setSalvando] = useState(false)

  // ====== Listas (agentes/empresas) ======
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [carregandoListas, setCarregandoListas] = useState(false)

  // Busca (input acima do select)
  const [buscaAgente, setBuscaAgente] = useState('')
  const [buscaEmpresa, setBuscaEmpresa] = useState('')

  const agentesFiltrados = useMemo(() => {
    const q = buscaAgente.trim().toLowerCase()
    if (!q) return agentes
    return agentes.filter((a) => a.nome.toLowerCase().includes(q))
  }, [agentes, buscaAgente])

  const empresasFiltradas = useMemo(() => {
    const q = buscaEmpresa.trim().toLowerCase()
    if (!q) return empresas
    return empresas.filter((e) => e.nome.toLowerCase().includes(q))
  }, [empresas, buscaEmpresa])

  // ====== Relatório / últimos registros ======
  const [filtros, setFiltros] = useState({
    empresa: '',
    agente: '',
    de: '',
    ate: '',
  })

  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false)
  const [relatorio, setRelatorio] = useState<MonitoriaRow[]>([])
  const [ultimas, setUltimas] = useState<MonitoriaRow[]>([])

  useEffect(() => {
    carregarListas()
    carregarUltimas()
    carregarRelatorio()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function carregarListas() {
    try {
      setCarregandoListas(true)

      const [{ data: agData, error: agErr }, { data: empData, error: empErr }] =
        await Promise.all([
          supabase.from('agentes').select('id, nome').order('nome', { ascending: true }),
          supabase.from('empresas').select('id, nome').order('nome', { ascending: true }),
        ])

      if (agErr) throw agErr
      if (empErr) throw empErr

      setAgentes((agData as any) || [])
      setEmpresas((empData as any) || [])
    } catch (err: any) {
      console.error(err)
      alert('Erro ao carregar listas: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCarregandoListas(false)
    }
  }

  async function carregarUltimas() {
    try {
      const { data, error } = await supabase
        .from('monitoria_qualidade')
        .select('id, created_at, data, agente, empresa, numero_cliente, status, tabulacao, observacao')
        .order('created_at', { ascending: false })
        .limit(8)

      if (error) throw error
      setUltimas((data as any) || [])
    } catch (err: any) {
      console.error(err)
      // não trava a tela
    }
  }

  async function carregarRelatorio() {
    try {
      setCarregandoRelatorio(true)

      let q = supabase
        .from('monitoria_qualidade')
        .select('id, created_at, data, agente, empresa, numero_cliente, status, tabulacao, observacao')
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(300)

      if (filtros.empresa) q = q.eq('empresa', filtros.empresa)
      if (filtros.agente) q = q.eq('agente', filtros.agente)
      if (filtros.de) q = q.gte('data', filtros.de)
      if (filtros.ate) q = q.lte('data', filtros.ate)

      const { data, error } = await q
      if (error) throw error

      setRelatorio((data as any) || [])
    } catch (err: any) {
      console.error(err)
      alert('Erro ao carregar relatório: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCarregandoRelatorio(false)
    }
  }

  async function salvarRegistro() {
    if (
      !form.data ||
      !form.agente.trim() ||
      !form.empresa.trim() ||
      !form.numero_cliente.trim() ||
      !form.status ||
      !form.tabulacao
    ) {
      alert('Preencha: Data, Agente, Empresa, Número do cliente, Status e Tabulação.')
      return
    }

    try {
      setSalvando(true)

      const payload = {
        data: form.data,
        agente: form.agente.trim(),
        empresa: form.empresa.trim(),
        numero_cliente: form.numero_cliente.trim(),
        status: form.status,
        tabulacao: form.tabulacao,
        observacao: form.observacao.trim() ? form.observacao.trim() : null,
      }

      const { error } = await supabase.from('monitoria_qualidade').insert([payload])
      if (error) throw error

      alert('Monitoria registrada!')
      setForm({
        data: hojeYYYYMMDD(),
        agente: '',
        empresa: '',
        numero_cliente: '',
        status: '',
        tabulacao: '',
        observacao: '',
      })
      setBuscaAgente('')
      setBuscaEmpresa('')

      await Promise.all([carregarUltimas(), carregarRelatorio()])
    } catch (err: any) {
      console.error(err)
      alert('Erro ao salvar: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setSalvando(false)
    }
  }

  function exportarCSV() {
    const rows = relatorio.map((r) => ({
      data: r.data,
      agente: r.agente,
      empresa: r.empresa,
      numero_cliente: r.numero_cliente,
      status: r.status,
      tabulacao: r.tabulacao,
      observacao: r.observacao ?? '',
      criado_em: r.created_at,
    }))

    downloadCSV(`monitoria_qualidade_${hojeYYYYMMDD()}.csv`, rows)
  }

  if (checkingAuth) {
    return (
      <main className="min-h-[calc(100vh-0px)] bg-[#f5f6f7] p-6">
        <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow">
          Carregando…
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[calc(100vh-0px)] bg-[#f5f6f7] p-6">
      {/* Container largo (16:9) */}
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="rounded-2xl bg-white p-6 shadow flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#2687e2]">Monitoria de Qualidade</h1>
            <p className="text-sm text-[#535151]">Controle, avaliação e evolução do atendimento</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                carregarListas()
                carregarUltimas()
                carregarRelatorio()
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-800 hover:bg-gray-50"
            >
              Recarregar listas
            </button>

            <button
              type="button"
              onClick={exportarCSV}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
            >
              Exportar CSV
            </button>

            <button
              type="button"
              onClick={salvarRegistro}
              disabled={salvando}
              className="rounded-lg bg-[#2687e2] px-4 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {salvando ? 'Salvando…' : 'Salvar registro'}
            </button>
          </div>
        </div>

        {/* FORM (horizontal / 16:9) */}
        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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

            {/* Agente (buscar + dropdown) */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Agente</label>
              <input
                type="text"
                className="w-full rounded-lg border p-2 text-[#535151] mb-2"
                value={buscaAgente}
                onChange={(e) => setBuscaAgente(e.target.value)}
                placeholder="Digite para buscar o agente…"
              />

              <select
                className="w-full rounded-lg border p-2 text-[#535151] bg-white disabled:opacity-60"
                value={form.agente}
                onChange={(e) => setForm({ ...form, agente: e.target.value })}
                disabled={carregandoListas}
              >
                <option value="">
                  {carregandoListas ? 'Carregando agentes…' : 'Selecione um agente'}
                </option>
                {agentesFiltrados.map((a) => (
                  <option key={String(a.id)} value={a.nome}>
                    {a.nome}
                  </option>
                ))}
              </select>

              <p className="text-xs text-gray-500 mt-1">
                Lista vinda de <strong>agentes.nome</strong>
              </p>
            </div>

            {/* Empresa (buscar + dropdown) */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Empresa</label>
              <input
                type="text"
                className="w-full rounded-lg border p-2 text-[#535151] mb-2"
                value={buscaEmpresa}
                onChange={(e) => setBuscaEmpresa(e.target.value)}
                placeholder="Digite para localizar a empresa…"
              />

              <select
                className="w-full rounded-lg border p-2 text-[#535151] bg-white disabled:opacity-60"
                value={form.empresa}
                onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                disabled={carregandoListas}
              >
                <option value="">
                  {carregandoListas ? 'Carregando empresas…' : 'Selecione uma empresa'}
                </option>
                {empresasFiltradas.map((em) => (
                  <option key={String(em.id)} value={em.nome}>
                    {em.nome}
                  </option>
                ))}
              </select>

              <p className="text-xs text-gray-500 mt-1">
                Lista vinda de <strong>empresas.nome</strong>
              </p>
            </div>

            {/* Número do cliente */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Número do cliente
              </label>
              <input
                type="text"
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.numero_cliente}
                onChange={(e) => setForm({ ...form, numero_cliente: e.target.value })}
                placeholder="Ex.: (11) 99999-9999 ou protocolo"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Status</label>
              <select
                className="w-full rounded-lg border p-2 text-[#535151] bg-white"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="">Selecione</option>
                {STATUS.filter((s) => s !== 'Selecione').map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Tabulação (botões) */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Tabulação</label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, tabulacao: 'Correto' })}
                  className={[
                    'rounded-lg border px-4 py-2 font-semibold flex items-center justify-center gap-2',
                    form.tabulacao === 'Correto'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                      : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50',
                  ].join(' ')}
                >
                  ✅ Correto
                </button>

                <button
                  type="button"
                  onClick={() => setForm({ ...form, tabulacao: 'Incorreto' })}
                  className={[
                    'rounded-lg border px-4 py-2 font-semibold flex items-center justify-center gap-2',
                    form.tabulacao === 'Incorreto'
                      ? 'border-rose-600 bg-rose-50 text-rose-700'
                      : 'border-gray-700 bg-white text-gray-800 hover:bg-gray-50',
                  ].join(' ')}
                >
                  ❌ Incorreto
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-1">
                Escolha rápida (sem dropdown) para ficar operacional.
              </p>
            </div>
          </div>

          {/* Observação */}
          <div className="mt-4">
            <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
              Observação (por registro)
            </label>
            <textarea
              rows={4}
              className="w-full rounded-lg border p-3 text-[#535151]"
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              placeholder="Descreva pontos de melhoria, elogios, falhas, orientação, etc."
            />
          </div>
        </div>

      <div className="rounded-2xl bg-gray-50 p-6 shadow border border-gray-200">
  <div className="flex items-center justify-between gap-3 mb-3">
    <h2 className="text-lg font-extrabold text-gray-900">
      Últimas monitorias registradas
    </h2>
    <button
      type="button"
      onClick={carregarUltimas}
      className="rounded-lg border border-gray-400 bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-300 transition"
    >
      Atualizar
    </button>
  </div>

  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="bg-gray-200">
        <tr className="text-left text-gray-900">
          <th className="py-2 pr-3 font-semibold">Data</th>
          <th className="py-2 pr-3 font-semibold">Agente</th>
          <th className="py-2 pr-3 font-semibold">Empresa</th>
          <th className="py-2 pr-3 font-semibold">Cliente</th>
          <th className="py-2 pr-3 font-semibold">Status</th>
          <th className="py-2 pr-3 font-semibold">Tabulação</th>
        </tr>
      </thead>

      <tbody>
        {ultimas.map((r) => (
          <tr
            key={r.id}
            className="border-t border-gray-300 text-gray-900 hover:bg-gray-100 transition"
          >
            <td className="py-2 pr-3 font-medium">{r.data}</td>
            <td className="py-2 pr-3">{r.agente}</td>
            <td className="py-2 pr-3 text-gray-800">{r.empresa}</td>
            <td className="py-2 pr-3 text-gray-800">{r.numero_cliente}</td>
            <td className="py-2 pr-3 text-gray-800">{r.status}</td>
            <td className="py-2 pr-3">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                  r.tabulacao === 'Correto'
                    ? 'bg-emerald-200 text-emerald-900'
                    : 'bg-rose-200 text-rose-900'
                }`}
              >
                {r.tabulacao}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>


        {/* RELATÓRIO COM FILTROS */}
        <div className="rounded-2xl bg-gray-50 p-6 shadow border border-gray-200">

          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#2a2a2a]">Relatório</h2>
              <p className="text-sm text-gray-600">Filtre por empresa, agente e período</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFiltros({ empresa: '', agente: '', de: '', ate: '' })
                  // recarrega “tudo”
                  setTimeout(() => carregarRelatorio(), 0)
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"

              >
                Limpar
              </button>

              <button
                type="button"
                onClick={carregarRelatorio}
                className="rounded-lg bg-[#2687e2] px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
                disabled={carregandoRelatorio}
              >
                {carregandoRelatorio ? 'Carregando…' : 'Aplicar filtros'}
              </button>
            </div>
          </div>

          {/* filtros */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Empresa</label>
              <select
                className="w-full rounded-lg border p-2 text-[#535151] bg-white"
                value={filtros.empresa}
                onChange={(e) => setFiltros({ ...filtros, empresa: e.target.value })}
              >
                <option value="">Todas</option>
                {empresas.map((em) => (
                  <option key={String(em.id)} value={em.nome}>
                    {em.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Agente</label>
              <select
                className="w-full rounded-lg border p-2 text-[#535151] bg-white"
                value={filtros.agente}
                onChange={(e) => setFiltros({ ...filtros, agente: e.target.value })}
              >
                <option value="">Todos</option>
                {agentes.map((a) => (
                  <option key={String(a.id)} value={a.nome}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">De</label>
              <input
                type="date"
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={filtros.de}
                onChange={(e) => setFiltros({ ...filtros, de: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Até</label>
              <input
                type="date"
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={filtros.ate}
                onChange={(e) => setFiltros({ ...filtros, ate: e.target.value })}
              />
            </div>
          </div>

          {/* tabela do relatório */}
          <div className="rounded-2xl bg-gray-50 p-6 shadow border border-gray-200">

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Agente</th>
                  <th className="py-2 pr-3">Empresa</th>
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Tabulação</th>
                  <th className="py-2 pr-3">Observação</th>
                </tr>
              </thead>
              <tbody>
                {carregandoRelatorio ? (
                  <tr>
                    <td className="py-3 text-gray-700" colSpan={7}>
                      Carregando…
                    </td>
                  </tr>
                ) : relatorio.length === 0 ? (
                  <tr>
                    <td className="py-3 text-gray-700" colSpan={7}>
                      Nenhum dado com esses filtros.
                    </td>
                  </tr>
                ) : (
                  relatorio.map((r) => (
                    <tr key={r.id} className="border-t align-top">
                      <td className="py-2 pr-3 whitespace-nowrap">{r.data}</td>
                      <td className="py-2 pr-3">{r.agente}</td>
                      <td className="py-2 pr-3">{r.empresa}</td>
                      <td className="py-2 pr-3">{r.numero_cliente}</td>
                      <td className="py-2 pr-3">{r.status}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={[
                            'inline-flex items-center rounded-full px-3 py-1 text-xs font-bold',
                            r.tabulacao === 'Correto'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700',
                          ].join(' ')}
                        >
                          {r.tabulacao}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-gray-700">
                        {r.observacao ? r.observacao : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            Dica: o botão <strong>Exportar CSV</strong> exporta exatamente o que estiver filtrado acima.
          </p>
        </div>
      </div>
    </main>
  )
}
