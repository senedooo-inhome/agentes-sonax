'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Aprovacao = '' | 'Aprovado' | 'Não aprovado' | 'Ligação não localizada'

type ElogioRow = {
  id: string
  created_at: string
  data: string
  nicho: string | null
  nome: string | null
  empresa: string | null
  telefone_protocolo: string | null
  elogio: string | null
  tipo_elogio: string | null
  observacao: string | null
  aprovacao: Aprovacao | null
  avaliado_em: string | null
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

function badgeAprovacao(ap: string | null) {
  if (ap === 'Aprovado') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (ap === 'Não aprovado') return 'bg-rose-100 text-rose-800 border-rose-200'
  if (ap === 'Ligação não localizada') return 'bg-amber-100 text-amber-900 border-amber-200'
  return 'bg-slate-100 text-slate-800 border-slate-200'
}

export default function MonitoriaElogiosPage() {
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

  // filtros
  const [mes, setMes] = useState(() => hojeYYYYMMDD().slice(0, 7)) // yyyy-mm
  const [filtros, setFiltros] = useState({
    nicho: '',
    empresa: '',
    aprovacao: '' as Aprovacao,
    q: '',
  })

  const [relatorio, setRelatorio] = useState<ElogioRow[]>([])
  const [ultimosAvaliados, setUltimosAvaliados] = useState<ElogioRow[]>([])
  const [carregando, setCarregando] = useState(false)
  const [carregandoUltimos, setCarregandoUltimos] = useState(false)

  // edição inline
  const [edit, setEdit] = useState<Record<string, { observacao: string; aprovacao: Aprovacao }>>(
    {}
  )
  const [salvandoId, setSalvandoId] = useState<string | null>(null)

  const rangeDe = useMemo(() => firstDayOfMonth(mes), [mes])
  const rangeAte = useMemo(() => lastDayOfMonth(mes), [mes])

  async function carregarRelatorio() {
    try {
      setCarregando(true)

      let q = supabase
        .from('campanha_elogio')
        .select(
          'id, created_at, data, nicho, nome, empresa, telefone_protocolo, elogio, tipo_elogio, observacao, aprovacao, avaliado_em'
        )
        .gte('data', rangeDe)
        .lte('data', rangeAte)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500)

      if (filtros.nicho.trim()) q = q.ilike('nicho', `%${filtros.nicho.trim()}%`)
      if (filtros.empresa.trim()) q = q.ilike('empresa', `%${filtros.empresa.trim()}%`)
      if (filtros.aprovacao) q = q.eq('aprovacao', filtros.aprovacao)

      const search = filtros.q.trim()
      if (search) {
        q = q.or(
          `nome.ilike.%${search}%,empresa.ilike.%${search}%,telefone_protocolo.ilike.%${search}%`
        )
      }

      const { data, error } = await q
      if (error) throw error

      const rows = ((data as any) || []) as ElogioRow[]
      setRelatorio(rows)

      // prepara estado de edição
      const nextEdit: Record<string, { observacao: string; aprovacao: Aprovacao }> = {}
      for (const r of rows) {
        nextEdit[r.id] = {
          observacao: r.observacao ?? '',
          aprovacao: (r.aprovacao ?? '') as Aprovacao,
        }
      }
      setEdit(nextEdit)
    } catch (err: any) {
      console.error(err)
      alert('Erro ao carregar relatório: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCarregando(false)
    }
  }

  async function carregarUltimosAvaliados() {
    try {
      setCarregandoUltimos(true)
      const { data, error } = await supabase
        .from('campanha_elogio')
        .select(
          'id, created_at, data, nicho, nome, empresa, telefone_protocolo, elogio, tipo_elogio, observacao, aprovacao, avaliado_em'
        )
        .not('aprovacao', 'is', null)
        .order('avaliado_em', { ascending: false })
        .limit(8)

      if (error) throw error
      setUltimosAvaliados(((data as any) || []) as ElogioRow[])
    } catch (err) {
      console.error(err)
    } finally {
      setCarregandoUltimos(false)
    }
  }

  useEffect(() => {
    carregarRelatorio()
    carregarUltimosAvaliados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes])

  async function salvarLinha(id: string) {
    const payload = edit[id]
    if (!payload) return

    if (!payload.aprovacao) {
      alert('Selecione a Aprovação antes de salvar.')
      return
    }

    try {
      setSalvandoId(id)
      const { error } = await supabase
        .from('campanha_elogio')
        .update({
          observacao: payload.observacao.trim() ? payload.observacao.trim() : null,
          aprovacao: payload.aprovacao,
          avaliado_em: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      await Promise.all([carregarRelatorio(), carregarUltimosAvaliados()])
    } catch (err: any) {
      console.error(err)
      alert('Erro ao salvar: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setSalvandoId(null)
    }
  }

  function exportarCSV() {
    if (!relatorio.length) return alert('Sem dados para exportar.')

    const headers = [
      'data',
      'nicho',
      'nome',
      'empresa',
      'telefone_protocolo',
      'elogio',
      'tipo_elogio',
      'aprovacao',
      'observacao',
      'avaliado_em',
      'created_at',
    ]

    const escape = (v: any) => {
      const s = String(v ?? '')
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const lines = [
      headers.join(','),
      ...relatorio.map((r) => headers.map((h) => escape((r as any)[h])).join(',')),
    ]

    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `elogios_${mes}.csv`
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
      {/* ✅ mais largo (16:9), respeita menu lateral */}
      <div className="mx-auto w-full max-w-[1800px] space-y-6">
        {/* HEADER (cara do 2º print) */}
        <div className="rounded-2xl bg-white p-6 shadow flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#2687e2]">Elogios</h1>
            <p className="text-sm text-[#475569]">
              Monitoria mensal — avaliação e aprovação dos elogios registrados
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                carregarRelatorio()
                carregarUltimosAvaliados()
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
          </div>
        </div>

        {/* ÚLTIMOS AVALIADOS (mantém o 2º print) */}
        <div className="rounded-2xl bg-[#f1f5f9] p-6 shadow border border-[#cbd5e1]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-extrabold text-[#0f172a]">Últimos elogios avaliados</h2>
            <button
              type="button"
              onClick={carregarUltimosAvaliados}
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
                  <th className="py-3 px-4 font-extrabold w-[220px]">Nome</th>
                  <th className="py-3 px-4 font-extrabold">Empresa</th>
                  <th className="py-3 px-4 font-extrabold w-[220px]">Aprovação</th>
                  <th className="py-3 px-4 font-extrabold">Observação</th>
                </tr>
              </thead>
              <tbody>
                {ultimosAvaliados.length === 0 ? (
                  <tr>
                    <td className="py-4 px-4 text-[#334155]" colSpan={5}>
                      Nenhum elogio avaliado ainda.
                    </td>
                  </tr>
                ) : (
                  ultimosAvaliados.map((r) => (
                    <tr key={r.id} className="border-t border-[#eef2f7] hover:bg-[#f8fafc]">
                      <td className="py-3 px-4 whitespace-nowrap">{r.data}</td>
                      <td className="py-3 px-4 break-words">{r.nome ?? '—'}</td>
                      <td className="py-3 px-4 break-words">{r.empresa ?? '—'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={[
                            'inline-flex items-center rounded-full border px-3 py-1 text-xs font-extrabold',
                            badgeAprovacao(r.aprovacao),
                          ].join(' ')}
                        >
                          {r.aprovacao ?? '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#334155] break-words">
                        {r.observacao ?? '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RELATÓRIO (cara do 2º print + tabela do 1º que cabe tudo) */}
        <div className="rounded-2xl bg-[#f1f5f9] p-6 shadow border border-[#cbd5e1]">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#0f172a]">Relatório</h2>
              <p className="text-sm text-[#334155]">Filtre por mês e avalie com observação + aprovação</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFiltros({ nicho: '', empresa: '', aprovacao: '' as Aprovacao, q: '' })
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
                disabled={carregando}
              >
                {carregando ? 'Carregando…' : 'Aplicar filtros'}
              </button>
            </div>
          </div>

          {/* filtros */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Mês</label>
              <input
                type="month"
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white placeholder:text-[#64748b]"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
              />
              <p className="text-xs text-[#64748b] mt-1">
                Período: {rangeDe} até {rangeAte}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Nicho</label>
              <input
                type="text"
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white placeholder:text-[#64748b]"
                value={filtros.nicho}
                onChange={(e) => setFiltros({ ...filtros, nicho: e.target.value })}
                placeholder="Ex.: SAC / Clínica"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Empresa</label>
              <input
                type="text"
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white placeholder:text-[#64748b]"
                value={filtros.empresa}
                onChange={(e) => setFiltros({ ...filtros, empresa: e.target.value })}
                placeholder="Ex.: BRASILIS"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Aprovação</label>
              <select
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white"
                value={filtros.aprovacao}
                onChange={(e) => setFiltros({ ...filtros, aprovacao: e.target.value as Aprovacao })}
              >
                <option value="">Todas</option>
                <option value="Aprovado">Aprovado</option>
                <option value="Não aprovado">Não aprovado</option>
                <option value="Ligação não localizada">Ligação não localizada</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Busca</label>
              <input
                type="text"
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white placeholder:text-[#64748b]"
                value={filtros.q}
                onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
                placeholder="Nome, empresa ou telefone"
              />
            </div>
          </div>

          {/* ✅ tabela: SEM rolagem horizontal e SEM cortar Observação/Salvar */}
          <div className="rounded-2xl bg-white p-4 border border-[#cbd5e1] overflow-hidden">
            <table className="w-full text-sm text-[#0f172a] table-fixed">
              <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                <tr className="text-left">
                  {/* Larguras equilibradas para caber tudo */}
                  <th className="py-3 px-3 font-extrabold w-[92px]">Data</th>
                  <th className="py-3 px-3 font-extrabold w-[70px]">Nicho</th>
                  <th className="py-3 px-3 font-extrabold w-[150px]">Nome</th>
                  <th className="py-3 px-3 font-extrabold w-[120px]">Empresa</th>
                  <th className="py-3 px-3 font-extrabold w-[150px]">Telefone</th>
                  <th className="py-3 px-3 font-extrabold w-[250px]">Elogio</th>
                  <th className="py-3 px-3 font-extrabold w-[80px]">Tipo</th>
                  <th className="py-3 px-3 font-extrabold w-[150px]">Aprovação</th>
                  <th className="py-3 px-3 font-extrabold w-[220px]">Observação</th>
                  <th className="py-3 px-3 font-extrabold w-[92px] text-right">Salvar</th>
                </tr>
              </thead>

              <tbody>
                {carregando ? (
                  <tr>
                    <td className="py-4 px-3 text-[#334155]" colSpan={10}>
                      Carregando…
                    </td>
                  </tr>
                ) : relatorio.length === 0 ? (
                  <tr>
                    <td className="py-4 px-3 text-[#334155]" colSpan={10}>
                      Nenhum elogio nesse mês/filtro.
                    </td>
                  </tr>
                ) : (
                  relatorio.map((r) => {
                    const e =
                      edit[r.id] || ({
                        observacao: r.observacao ?? '',
                        aprovacao: (r.aprovacao ?? '') as Aprovacao,
                      } as { observacao: string; aprovacao: Aprovacao })

                    return (
                      <tr key={r.id} className="border-t border-[#eef2f7] align-top hover:bg-[#f8fafc]">
                        <td className="py-3 px-3 whitespace-nowrap">{r.data}</td>
                        <td className="py-3 px-3 whitespace-nowrap">{r.nicho ?? '—'}</td>

                        <td className="py-3 px-3 break-words whitespace-normal leading-snug">
                          {r.nome ?? '—'}
                        </td>

                        <td className="py-3 px-3 break-words whitespace-normal">{r.empresa ?? '—'}</td>

                        <td className="py-3 px-3 break-words whitespace-normal leading-snug">
                          {r.telefone_protocolo ?? '—'}
                        </td>

                        <td className="py-3 px-3 break-words whitespace-normal leading-snug text-[#334155]">
                          {r.elogio ?? '—'}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">{r.tipo_elogio ?? '—'}</td>

                        <td className="py-3 px-3">
                          <select
                            className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white"
                            value={e.aprovacao}
                            onChange={(ev) =>
                              setEdit((prev) => ({
                                ...prev,
                                [r.id]: { ...e, aprovacao: ev.target.value as Aprovacao },
                              }))
                            }
                          >
                            <option value="">Selecione</option>
                            <option value="Aprovado">Aprovado</option>
                            <option value="Não aprovado">Não aprovado</option>
                            <option value="Ligação não localizada">Ligação não localizada</option>
                          </select>

                          <div className="mt-2">
                            <span
                              className={[
                                'inline-flex items-center rounded-full border px-3 py-1 text-xs font-extrabold',
                                badgeAprovacao(e.aprovacao || null),
                              ].join(' ')}
                            >
                              {e.aprovacao || '—'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <textarea
                            rows={3}
                            className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white placeholder:text-[#64748b] resize-none"
                            value={e.observacao}
                            onChange={(ev) =>
                              setEdit((prev) => ({
                                ...prev,
                                [r.id]: { ...e, observacao: ev.target.value },
                              }))
                            }
                            placeholder="Observação da monitoria…"
                          />
                        </td>

                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => salvarLinha(r.id)}
                            disabled={salvandoId === r.id}
                            className="inline-flex justify-center rounded-lg bg-[#2687e2] px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
                          >
                            {salvandoId === r.id ? 'Salvando…' : 'Salvar'}
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>

            <p className="text-xs text-[#334155] mt-3">
              Exportar CSV usa exatamente os dados filtrados (mês + filtros).
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
