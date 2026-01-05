'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Empresa = { id: string | number; nome: string }
type Agente = { id: string | number; nome: string }

type NpsRow = {
  id: string
  created_at: string
  data: string
  empresa: string
  agente: string
  telefone_protocolo: string
  observacao: string | null
  solicitou_avaliacao: boolean
}

function hojeYYYYMMDD() {
  return new Date().toISOString().slice(0, 10)
}

function firstDayOfMonth(yyyyMm: string) {
  return `${yyyyMm}-01`
}

function lastDayOfMonth(yyyyMm: string) {
  const [y, m] = yyyyMm.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${yyyyMm}-${String(last).padStart(2, '0')}`
}

function badgeSolicitou(v: boolean) {
  return v
    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
    : 'bg-rose-100 text-rose-800 border-rose-200'
}

export default function NpsSolicitadoPage() {
  const router = useRouter()

  // ✅ restrita
  const [checkingAuth, setCheckingAuth] = useState(true)
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const email = data.session?.user?.email || ''
      if (email !== 'supervisao@sonax.net.br') {
        router.replace('/')
        return
      }
      setCheckingAuth(false)
    })()
  }, [router])

  // Form
  const [form, setForm] = useState({
    data: hojeYYYYMMDD(),
    empresa: '',
    agente: '',
    telefone_protocolo: '',
    observacao: '',
    solicitou_avaliacao: true,
  })
  const [salvando, setSalvando] = useState(false)

  // Listas
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [carregandoListas, setCarregandoListas] = useState(false)

  // Últimos
  const [ultimos, setUltimos] = useState<NpsRow[]>([])
  const [carregandoUltimos, setCarregandoUltimos] = useState(false)

  // Relatório + filtros
  const [mes, setMes] = useState(() => hojeYYYYMMDD().slice(0, 7)) // yyyy-mm
  const rangeDe = useMemo(() => firstDayOfMonth(mes), [mes])
  const rangeAte = useMemo(() => lastDayOfMonth(mes), [mes])

  const [filtros, setFiltros] = useState({
    empresa: '',
    agente: '',
    solicitou: '' as '' | 'sim' | 'nao',
    q: '',
  })

  const [relatorio, setRelatorio] = useState<NpsRow[]>([])
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false)

  async function carregarListas() {
    try {
      setCarregandoListas(true)
      const [{ data: em, error: emErr }, { data: ag, error: agErr }] = await Promise.all([
        supabase.from('empresas').select('id, nome').order('nome', { ascending: true }),
        supabase.from('agentes').select('id, nome').order('nome', { ascending: true }),
      ])
      if (emErr) throw emErr
      if (agErr) throw agErr

      setEmpresas((em as any) || [])
      setAgentes((ag as any) || [])
    } catch (err: any) {
      console.error(err)
      alert('Erro ao carregar listas: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCarregandoListas(false)
    }
  }

  async function carregarUltimos() {
    try {
      setCarregandoUltimos(true)
      const { data, error } = await supabase
        .from('nps_solicitado')
        .select('id, created_at, data, empresa, agente, telefone_protocolo, observacao, solicitou_avaliacao')
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setUltimos(((data as any) || []) as NpsRow[])
    } catch (err: any) {
      console.error(err)
      alert('Erro ao carregar últimos: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCarregandoUltimos(false)
    }
  }

  async function carregarRelatorio() {
    try {
      setCarregandoRelatorio(true)

      let q = supabase
        .from('nps_solicitado')
        .select('id, created_at, data, empresa, agente, telefone_protocolo, observacao, solicitou_avaliacao')
        .gte('data', rangeDe)
        .lte('data', rangeAte)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(800)

      if (filtros.empresa) q = q.eq('empresa', filtros.empresa)
      if (filtros.agente) q = q.eq('agente', filtros.agente)

      if (filtros.solicitou === 'sim') q = q.eq('solicitou_avaliacao', true)
      if (filtros.solicitou === 'nao') q = q.eq('solicitou_avaliacao', false)

      const search = filtros.q.trim()
      if (search) {
        q = q.or(
          `telefone_protocolo.ilike.%${search}%,empresa.ilike.%${search}%,agente.ilike.%${search}%`
        )
      }

      const { data, error } = await q
      if (error) throw error

      setRelatorio(((data as any) || []) as NpsRow[])
    } catch (err: any) {
      console.error(err)
      alert('Erro ao carregar relatório: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCarregandoRelatorio(false)
    }
  }

  useEffect(() => {
    if (checkingAuth) return
    carregarListas()
    carregarUltimos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingAuth])

  useEffect(() => {
    if (checkingAuth) return
    carregarRelatorio()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes])

  async function salvarRegistro() {
    if (
      !form.data ||
      !form.empresa.trim() ||
      !form.agente.trim() ||
      !form.telefone_protocolo.trim()
    ) {
      alert('Preencha Data, Empresa, Agente e Telefone/Protocolo.')
      return
    }

    try {
      setSalvando(true)
      const { error } = await supabase.from('nps_solicitado').insert([
        {
          data: form.data,
          empresa: form.empresa.trim(),
          agente: form.agente.trim(),
          telefone_protocolo: form.telefone_protocolo.trim(),
          observacao: form.observacao.trim() ? form.observacao.trim() : null,
          solicitou_avaliacao: form.solicitou_avaliacao,
          avaliado_em: new Date().toISOString(),
        },
      ])
      if (error) throw error

      alert('Registro salvo!')
      setForm({
        data: hojeYYYYMMDD(),
        empresa: '',
        agente: '',
        telefone_protocolo: '',
        observacao: '',
        solicitou_avaliacao: true,
      })

      await Promise.all([carregarUltimos(), carregarRelatorio()])
    } catch (err: any) {
      console.error(err)
      alert('Erro ao salvar: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setSalvando(false)
    }
  }

  function exportarCSV() {
    if (!relatorio.length) return alert('Sem dados para exportar.')

    const headers = [
      'data',
      'empresa',
      'agente',
      'telefone_protocolo',
      'solicitou_avaliacao',
      'observacao',
      'created_at',
    ]

    const escape = (v: any) => {
      const s = String(v ?? '')
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const lines = [
      headers.join(','),
      ...relatorio.map((r) =>
        headers
          .map((h) => {
            const v = (r as any)[h]
            // boolean legível
            if (h === 'solicitou_avaliacao') return escape(v ? 'Sim' : 'Não')
            return escape(v)
          })
          .join(',')
      ),
    ]

    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nps_solicitado_${mes}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-[#f5f6f7] p-6">
        <div className="mx-auto w-full max-w-[1800px] rounded-2xl bg-white p-6 shadow text-[#0f172a]">
          Carregando…
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-6">
        {/* HEADER */}
        <div className="rounded-2xl bg-white p-6 shadow flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#2687e2]">NPS solicitado</h1>
            <p className="text-sm text-[#475569]">
              Registro operacional — controle se foi solicitada avaliação ao cliente
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                carregarListas()
                carregarUltimos()
                carregarRelatorio()
              }}
              className="rounded-lg border border-[#334155] bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#111827]"
            >
              Recarregar
            </button>

            <button
              type="button"
              onClick={exportarCSV}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Exportar CSV
            </button>

            <button
              type="button"
              onClick={salvarRegistro}
              disabled={salvando}
              className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {salvando ? 'Salvando…' : 'Salvar registro'}
            </button>
          </div>
        </div>

        {/* FORM */}
        <div className="rounded-2xl bg-[#f1f5f9] p-6 shadow border border-[#cbd5e1]">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Data */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Data</label>
              <input
                type="date"
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </div>

            {/* Empresa */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Empresa</label>
              <select
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white disabled:opacity-60"
                value={form.empresa}
                onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                disabled={carregandoListas}
              >
                <option value="">
                  {carregandoListas ? 'Carregando empresas…' : 'Selecione uma empresa'}
                </option>
                {empresas.map((em) => (
                  <option key={String(em.id)} value={em.nome}>
                    {em.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Agente */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Agente</label>
              <select
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white disabled:opacity-60"
                value={form.agente}
                onChange={(e) => setForm({ ...form, agente: e.target.value })}
                disabled={carregandoListas}
              >
                <option value="">
                  {carregandoListas ? 'Carregando agentes…' : 'Selecione um agente'}
                </option>
                {agentes.map((a) => (
                  <option key={String(a.id)} value={a.nome}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Telefone/Protocolo */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Telefone/Protocolo
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white"
                value={form.telefone_protocolo}
                onChange={(e) => setForm({ ...form, telefone_protocolo: e.target.value })}
                placeholder="Ex.: (11) 99999-9999 ou 18339..."
              />
            </div>

            {/* Toggle */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Solicitou avaliação?
              </label>

              <div className="flex items-center gap-3">
                {/* Switch */}
                <button
                  type="button"
                  onClick={() => setForm({ ...form, solicitou_avaliacao: !form.solicitou_avaliacao })}
                  className={[
                    'relative inline-flex h-10 w-24 items-center rounded-full border transition',
                    form.solicitou_avaliacao
                      ? 'bg-emerald-600 border-emerald-700'
                      : 'bg-rose-600 border-rose-700',
                  ].join(' ')}
                  aria-label="Alternar solicitou avaliação"
                >
                  <span className="absolute left-3 text-xs font-extrabold text-white">
                    {form.solicitou_avaliacao ? 'SIM' : 'NÃO'}
                  </span>

                  <span
                    className={[
                      'inline-block h-8 w-8 transform rounded-full bg-white shadow transition',
                      form.solicitou_avaliacao ? 'translate-x-14' : 'translate-x-2',
                    ].join(' ')}
                  />
                </button>

                {/* badge */}
                <span
                  className={[
                    'inline-flex items-center rounded-full border px-3 py-1 text-xs font-extrabold',
                    form.solicitou_avaliacao
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-rose-100 text-rose-800 border-rose-200',
                  ].join(' ')}
                >
                  {form.solicitou_avaliacao ? 'Solicitado' : 'Não solicitado'}
                </span>
              </div>

              <p className="text-xs text-[#64748b] mt-1">Interruptor deslizante (Sim/Não).</p>
            </div>

            {/* Observação */}
            <div className="lg:col-span-3">
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Observação</label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white resize-none"
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                placeholder="Ex.: cliente estava com pressa / solicitou via SMS / recusou, etc."
              />
            </div>
          </div>
        </div>

        {/* ÚLTIMOS REGISTROS */}
        <div className="rounded-2xl bg-[#f1f5f9] p-6 shadow border border-[#cbd5e1]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-extrabold text-[#0f172a]">Últimos registros</h2>
            <button
              type="button"
              onClick={carregarUltimos}
              className="rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm font-semibold text-white hover:bg-[#111827]"
              disabled={carregandoUltimos}
            >
              {carregandoUltimos ? 'Atualizando…' : 'Atualizar'}
            </button>
          </div>

          <div className="overflow-hidden rounded-xl bg-white border border-[#e2e8f0]">
            <table className="w-full text-sm text-[#0f172a] table-fixed">
              <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                <tr className="text-left">
                  <th className="py-3 px-4 font-extrabold w-[110px]">Data</th>
                  <th className="py-3 px-4 font-extrabold w-[160px]">Agente</th>
                  <th className="py-3 px-4 font-extrabold w-[160px]">Empresa</th>
                  <th className="py-3 px-4 font-extrabold w-[180px]">Telefone/Prot.</th>
                  <th className="py-3 px-4 font-extrabold w-[170px]">Solicitou?</th>
                  <th className="py-3 px-4 font-extrabold">Observação</th>
                </tr>
              </thead>
              <tbody>
                {ultimos.length === 0 ? (
                  <tr>
                    <td className="py-4 px-4 text-[#334155]" colSpan={6}>
                      Nenhum registro ainda.
                    </td>
                  </tr>
                ) : (
                  ultimos.map((r) => (
                    <tr key={r.id} className="border-t border-[#eef2f7] hover:bg-[#f8fafc] align-top">
                      <td className="py-3 px-4 whitespace-nowrap">{r.data}</td>
                      <td className="py-3 px-4 break-words">{r.agente}</td>
                      <td className="py-3 px-4 break-words">{r.empresa}</td>
                      <td className="py-3 px-4 break-words">{r.telefone_protocolo}</td>
                      <td className="py-3 px-4">
                        <span
                          className={[
                            'inline-flex items-center rounded-full border px-3 py-1 text-xs font-extrabold',
                            badgeSolicitou(r.solicitou_avaliacao),
                          ].join(' ')}
                        >
                          {r.solicitou_avaliacao ? 'Sim' : 'Não'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#334155] break-words">
                        {r.observacao ? r.observacao : <span className="text-[#94a3b8]">—</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RELATÓRIO */}
        <div className="rounded-2xl bg-[#f1f5f9] p-6 shadow border border-[#cbd5e1]">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#0f172a]">Relatório</h2>
              <p className="text-sm text-[#334155]">Filtre por mês, empresa, agente e status (Sim/Não)</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFiltros({ empresa: '', agente: '', solicitou: '', q: '' })
                  setTimeout(() => carregarRelatorio(), 0)
                }}
                className="rounded-lg border border-[#334155] bg-white px-3 py-2 text-sm font-semibold text-[#0f172a] hover:bg-[#e2e8f0]"
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

          {/* Filtros */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Mês</label>
              <input
                type="month"
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
              />
              <p className="text-xs text-[#64748b] mt-1">
                Período: {rangeDe} até {rangeAte}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Empresa</label>
              <select
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white"
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
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white"
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
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Solicitou?</label>
              <select
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white"
                value={filtros.solicitou}
                onChange={(e) => setFiltros({ ...filtros, solicitou: e.target.value as any })}
              >
                <option value="">Todos</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Busca</label>
              <input
                type="text"
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white"
                value={filtros.q}
                onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
                placeholder="Telefone, empresa ou agente"
              />
            </div>
          </div>

          {/* Tabela */}
          <div className="rounded-2xl bg-white p-4 border border-[#cbd5e1] overflow-hidden">
            <table className="w-full text-sm text-[#0f172a] table-fixed">
              <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                <tr className="text-left">
                  <th className="py-3 px-3 font-extrabold w-[100px]">Data</th>
                  <th className="py-3 px-3 font-extrabold w-[160px]">Agente</th>
                  <th className="py-3 px-3 font-extrabold w-[160px]">Empresa</th>
                  <th className="py-3 px-3 font-extrabold w-[190px]">Telefone/Protocolo</th>
                  <th className="py-3 px-3 font-extrabold w-[140px]">Solicitou?</th>
                  <th className="py-3 px-3 font-extrabold">Observação</th>
                </tr>
              </thead>

              <tbody>
                {carregandoRelatorio ? (
                  <tr>
                    <td className="py-4 px-3 text-[#334155]" colSpan={6}>
                      Carregando…
                    </td>
                  </tr>
                ) : relatorio.length === 0 ? (
                  <tr>
                    <td className="py-4 px-3 text-[#334155]" colSpan={6}>
                      Nenhum dado com esses filtros.
                    </td>
                  </tr>
                ) : (
                  relatorio.map((r) => (
                    <tr key={r.id} className="border-t border-[#eef2f7] hover:bg-[#f8fafc] align-top">
                      <td className="py-3 px-3 whitespace-nowrap">{r.data}</td>
                      <td className="py-3 px-3 break-words">{r.agente}</td>
                      <td className="py-3 px-3 break-words">{r.empresa}</td>
                      <td className="py-3 px-3 break-words">{r.telefone_protocolo}</td>
                      <td className="py-3 px-3">
                        <span
                          className={[
                            'inline-flex items-center rounded-full border px-3 py-1 text-xs font-extrabold',
                            badgeSolicitou(r.solicitou_avaliacao),
                          ].join(' ')}
                        >
                          {r.solicitou_avaliacao ? 'Sim' : 'Não'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#334155] break-words">
                        {r.observacao ? r.observacao : <span className="text-[#94a3b8]">—</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <p className="text-xs text-[#334155] mt-3">
              Exportar CSV exporta exatamente o que estiver filtrado (mês + filtros).
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
