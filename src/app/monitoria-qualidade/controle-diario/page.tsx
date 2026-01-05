'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Agente = { id: string | number; nome: string }
type Marcacao = {
  id: string
  mes: string
  dia: number
  agente: string
  avaliado: boolean
  marcado_por: string | null
  updated_at: string
}

function yyyyMm(d: Date) {
  return d.toISOString().slice(0, 7)
}
function dd(d: Date) {
  return Number(d.toISOString().slice(8, 10))
}
function yyyymmdd(d: Date) {
  return d.toISOString().slice(0, 10)
}
function formatPtBrLong(d: Date) {
  // ex: 05 de janeiro de 2026
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default function ControleDiarioMonitoriaPage() {
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

  // Data do dia (pode evoluir depois para selecionar qualquer data)
  const [dataDia, setDataDia] = useState(() => new Date())

  const mes = useMemo(() => yyyyMm(dataDia), [dataDia])
  const dia = useMemo(() => dd(dataDia), [dataDia])

  const [agentes, setAgentes] = useState<Agente[]>([])
  const [marcadosHoje, setMarcadosHoje] = useState<Marcacao[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvandoNome, setSalvandoNome] = useState<string | null>(null)

  // Busca / filtro visual
  const [buscaNao, setBuscaNao] = useState('')
  const [buscaSim, setBuscaSim] = useState('')

  async function carregarTudo() {
    try {
      setCarregando(true)

      const [agRes, mkRes] = await Promise.all([
        supabase.from('agentes').select('id, nome').order('nome', { ascending: true }),
        supabase
          .from('monitoria_agente_dias')
          .select('id, mes, dia, agente, avaliado, marcado_por, updated_at')
          .eq('mes', mes)
          .eq('dia', dia)
          .eq('avaliado', true)
          .order('updated_at', { ascending: false }),
      ])

      if (agRes.error) throw agRes.error
      if (mkRes.error) throw mkRes.error

      setAgentes(((agRes.data as any) || []) as Agente[])
      setMarcadosHoje(((mkRes.data as any) || []) as Marcacao[])
    } catch (err: any) {
      console.error(err)
      alert('Erro ao carregar: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (!checkingAuth) carregarTudo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingAuth, mes, dia])

  const setMarcados = useMemo(() => {
    const s = new Set<string>()
    for (const r of marcadosHoje) s.add(r.agente)
    return s
  }, [marcadosHoje])

  const naoAvaliados = useMemo(() => {
    const list = agentes.filter((a) => !setMarcados.has(a.nome))
    const q = buscaNao.trim().toLowerCase()
    if (!q) return list
    return list.filter((a) => a.nome.toLowerCase().includes(q))
  }, [agentes, setMarcados, buscaNao])

  const avaliados = useMemo(() => {
    const q = buscaSim.trim().toLowerCase()
    const base = marcadosHoje
    if (!q) return base
    return base.filter((r) => (r.agente || '').toLowerCase().includes(q))
  }, [marcadosHoje, buscaSim])

  async function marcarComoAvaliado(nome: string) {
    try {
      setSalvandoNome(nome)
      const { data: sess } = await supabase.auth.getSession()
      const email = sess.session?.user?.email || null

      const { error } = await supabase.from('monitoria_agente_dias').upsert(
        [
          {
            mes,
            dia,
            agente: nome,
            avaliado: true,
            marcado_por: email,
          },
        ],
        { onConflict: 'mes,dia,agente' }
      )
      if (error) throw error

      await carregarTudo()
    } catch (err: any) {
      console.error(err)
      alert('Erro ao marcar: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setSalvandoNome(null)
    }
  }

  async function voltarParaNaoAvaliado(nome: string) {
    try {
      setSalvandoNome(nome)

      const { error } = await supabase
        .from('monitoria_agente_dias')
        .delete()
        .eq('mes', mes)
        .eq('dia', dia)
        .eq('agente', nome)

      if (error) throw error

      await carregarTudo()
    } catch (err: any) {
      console.error(err)
      alert('Erro ao voltar: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setSalvandoNome(null)
    }
  }

  function exportarCSV() {
    if (!agentes.length) return alert('Sem agentes para exportar.')

    const dataStr = yyyymmdd(dataDia)
    const headers = ['data', 'agente', 'status', 'marcado_por', 'updated_at']

    const mapMarcado = new Map<string, Marcacao>()
    for (const r of marcadosHoje) mapMarcado.set(r.agente, r)

    const rows = agentes.map((a) => {
      const mk = mapMarcado.get(a.nome)
      return {
        data: dataStr,
        agente: a.nome,
        status: mk ? 'Avaliados' : 'Não avaliados',
        marcado_por: mk?.marcado_por ?? '',
        updated_at: mk?.updated_at ?? '',
      }
    })

    const escape = (v: any) => {
      const s = String(v ?? '')
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const lines = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => escape((r as any)[h])).join(',')),
    ]

    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `controle_monitoria_${dataStr}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (checkingAuth) {
    return (
      <main className="min-h-[calc(100vh-0px)] bg-[#f5f6f7] p-6">
        <div className="w-full rounded-2xl bg-white p-6 shadow">Carregando…</div>
      </main>
    )
  }

  return (
    <main className="min-h-[calc(100vh-0px)] bg-[#f5f6f7] p-6">
      <div className="w-full space-y-6">
        {/* HEADER */}
        <div className="rounded-2xl bg-white p-6 shadow flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#2687e2]">Controle Diário</h1>
            <p className="text-sm text-[#475569]">
              {formatPtBrLong(dataDia)} — marque quem já foi avaliado hoje
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={carregarTudo}
              className="rounded-lg border border-[#334155] bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#111827]"
            >
              {carregando ? 'Recarregando…' : 'Recarregar'}
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

        {/* DOIS QUADROS */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* NÃO AVALIADOS */}
          <div className="rounded-2xl bg-rose-50/70 p-6 shadow border border-rose-200">
            <div className="flex items-end justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-extrabold text-rose-900">
                  Não avaliados hoje
                </h2>
                <p className="text-sm text-rose-800/80">
                  Total: <strong>{naoAvaliados.length}</strong>
                </p>
              </div>

              <input
                type="text"
                value={buscaNao}
                onChange={(e) => setBuscaNao(e.target.value)}
                className="w-64 rounded-lg border border-rose-200 bg-white p-2 text-[#0f172a]"
                placeholder="Buscar agente…"
              />
            </div>

            <div className="rounded-xl bg-white border border-rose-100 overflow-hidden">
              <div className="max-h-[62vh] overflow-auto">
                <table className="w-full text-sm text-[#0f172a]">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="text-left">
                      <th className="py-3 px-4 font-extrabold">Agente</th>
                      <th className="py-3 px-4 font-extrabold w-[180px]">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {naoAvaliados.length === 0 ? (
                      <tr>
                        <td className="py-4 px-4 text-[#334155]" colSpan={2}>
                          Nenhum agente pendente hoje 🎉
                        </td>
                      </tr>
                    ) : (
                      naoAvaliados.map((a) => (
                        <tr key={String(a.id)} className="border-t border-rose-100">
                          <td className="py-3 px-4 font-semibold">{a.nome}</td>
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => marcarComoAvaliado(a.nome)}
                              disabled={salvandoNome === a.nome}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {salvandoNome === a.nome ? 'Marcando…' : 'Marcar como avaliado'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* AVALIADOS */}
          <div className="rounded-2xl bg-emerald-50/70 p-6 shadow border border-emerald-200">
            <div className="flex items-end justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-extrabold text-emerald-900">
                  Agentes já avaliados hoje
                </h2>
                <p className="text-sm text-emerald-800/80">
                  Total: <strong>{avaliados.length}</strong>
                </p>
              </div>

              <input
                type="text"
                value={buscaSim}
                onChange={(e) => setBuscaSim(e.target.value)}
                className="w-64 rounded-lg border border-emerald-200 bg-white p-2 text-[#0f172a]"
                placeholder="Buscar agente…"
              />
            </div>

            <div className="rounded-xl bg-white border border-emerald-100 overflow-hidden">
              <div className="max-h-[62vh] overflow-auto">
                <table className="w-full text-sm text-[#0f172a]">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="text-left">
                      <th className="py-3 px-4 font-extrabold">Agente</th>
                      <th className="py-3 px-4 font-extrabold w-[220px]">Marcado em</th>
                      <th className="py-3 px-4 font-extrabold w-[200px]">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {avaliados.length === 0 ? (
                      <tr>
                        <td className="py-4 px-4 text-[#334155]" colSpan={3}>
                          Nenhum agente avaliado ainda hoje.
                        </td>
                      </tr>
                    ) : (
                      avaliados.map((r) => (
                        <tr key={r.id} className="border-t border-emerald-100">
                          <td className="py-3 px-4 font-semibold">{r.agente}</td>
                          <td className="py-3 px-4 text-[#334155]">
                            {r.updated_at ? new Date(r.updated_at).toLocaleString('pt-BR') : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => voltarParaNaoAvaliado(r.agente)}
                              disabled={salvandoNome === r.agente}
                              className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                            >
                              {salvandoNome === r.agente ? 'Voltando…' : 'Voltar para não avaliados'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs text-emerald-900/70 mt-3">
              Se marcou errado, é só clicar em <strong>Voltar para não avaliados</strong>.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
