'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Agente = { id: string | number; nome: string }
type Monitora = '' | 'Rosário' | 'Marcilene'

type Linha = {
  id: string
  mes: string
  agente: string

  pos1: boolean
  pos2: boolean
  pos3: boolean

  des1: boolean
  des2: boolean
  des3: boolean

  monitora: string | null
  marked_by: string | null
  updated_at: string
}

function mesAtualYYYYMM() {
  return new Date().toISOString().slice(0, 7)
}

function labelMes(yyyyMm: string) {
  const [y, m] = yyyyMm.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  const nome = d.toLocaleDateString('pt-BR', { month: 'long' })
  return `${nome.charAt(0).toUpperCase() + nome.slice(1)} ${y}`
}

function sumBools(...b: boolean[]) {
  return b.filter(Boolean).length
}

function csvEscape(v: any) {
  const s = String(v ?? '')
  // Excel PT-BR costuma abrir melhor em colunas usando ; (ponto e vírgula)
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return alert('Sem dados para exportar.')
  const headers = Object.keys(rows[0])
  const lines = [
    headers.map(csvEscape).join(';'),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(';')),
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

export default function ControleDriveMensalPage() {
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

  // Mês selecionado (padrão: mês atual)
  const [mes, setMes] = useState(() => mesAtualYYYYMM())

  // Dados
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvandoKey, setSalvandoKey] = useState<string | null>(null)

  // Relatório
  const [relatorio, setRelatorio] = useState<any[]>([])
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false)
  const [filtros, setFiltros] = useState({
    mes: mesAtualYYYYMM(),
    monitora: '' as Monitora,
    minPos: '',
    minDes: '',
  })

  async function carregarMes() {
    try {
      setCarregando(true)

      const [agRes, rowsRes] = await Promise.all([
        supabase.from('agentes').select('id, nome').order('nome', { ascending: true }),
        supabase
          .from('monitoria_drive_mensal')
          .select('id, mes, agente, pos1, pos2, pos3, des1, des2, des3, monitora, marked_by, updated_at')
          .eq('mes', mes)
          .order('agente', { ascending: true }),
      ])

      if (agRes.error) throw agRes.error
      if (rowsRes.error) throw rowsRes.error

      const ags = ((agRes.data as any) || []) as Agente[]
      const rows = ((rowsRes.data as any) || []) as Linha[]

      setAgentes(ags)

      const map = new Map<string, Linha>()
      for (const r of rows) map.set(r.agente, r)

      // sempre mostra TODOS os agentes, mesmo sem registro ainda
      const merged: Linha[] = ags.map((a) => {
        const r = map.get(a.nome)
        if (r) return r
        return {
          id: '',
          mes,
          agente: a.nome,
          pos1: false,
          pos2: false,
          pos3: false,
          des1: false,
          des2: false,
          des3: false,
          monitora: null,
          marked_by: null,
          updated_at: '',
        }
      })

      setLinhas(merged)
    } catch (err: any) {
      console.error(err)
      alert('Erro ao carregar: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (!checkingAuth) carregarMes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingAuth, mes])

  async function upsertLinha(agente: string, patch: Partial<Linha>) {
    const key = `${mes}:${agente}`
    try {
      setSalvandoKey(key)

      const { data: sess } = await supabase.auth.getSession()
      const email = sess.session?.user?.email || null

      const atual = linhas.find((l) => l.agente === agente)

      const payload = {
        mes,
        agente,
        pos1: atual?.pos1 ?? false,
        pos2: atual?.pos2 ?? false,
        pos3: atual?.pos3 ?? false,
        des1: atual?.des1 ?? false,
        des2: atual?.des2 ?? false,
        des3: atual?.des3 ?? false,
        monitora: atual?.monitora ?? null,
        ...patch,
        marked_by: email,
      }

      const { error } = await supabase
        .from('monitoria_drive_mensal')
        .upsert([payload], { onConflict: 'mes,agente' })

      if (error) throw error

      setLinhas((prev) => prev.map((l) => (l.agente === agente ? { ...l, ...payload } as any : l)))
    } catch (err: any) {
      console.error(err)
      alert('Erro ao salvar: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setSalvandoKey(null)
    }
  }

  // ===== RELATÓRIO =====
  async function carregarRelatorio() {
    try {
      setCarregandoRelatorio(true)

      let q = supabase
        .from('monitoria_drive_mensal')
        .select('id, mes, agente, pos1, pos2, pos3, des1, des2, des3, monitora, marked_by, updated_at')
        .order('mes', { ascending: false })
        .order('agente', { ascending: true })
        .limit(2000)

      if (filtros.mes) q = q.eq('mes', filtros.mes)
      if (filtros.monitora) q = q.eq('monitora', filtros.monitora)

      const { data, error } = await q
      if (error) throw error

      let rows = ((data as any) || []) as Linha[]

      const minPos = filtros.minPos.trim() === '' ? null : Number(filtros.minPos)
      const minDes = filtros.minDes.trim() === '' ? null : Number(filtros.minDes)

      if (minPos !== null && !Number.isNaN(minPos)) {
        rows = rows.filter((r) => sumBools(r.pos1, r.pos2, r.pos3) >= minPos)
      }
      if (minDes !== null && !Number.isNaN(minDes)) {
        rows = rows.filter((r) => sumBools(r.des1, r.des2, r.des3) >= minDes)
      }

      const final = rows.map((r) => ({
        mes: r.mes,
        agente: r.agente,
        monitora: r.monitora ?? '',
        ligacoes_positivas: sumBools(r.pos1, r.pos2, r.pos3),
        ligacoes_a_desejar: sumBools(r.des1, r.des2, r.des3),
        marcado_por: r.marked_by ?? '',
        updated_at: r.updated_at ?? '',
      }))

      setRelatorio(final)
    } catch (err: any) {
      console.error(err)
      alert('Erro ao carregar relatório: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCarregandoRelatorio(false)
    }
  }

  useEffect(() => {
    if (!checkingAuth) carregarRelatorio()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingAuth])

  function exportarCSV() {
    downloadCSV(`controle_drive_${filtros.mes || mesAtualYYYYMM()}.csv`, relatorio)
  }

  const totalPosMes = useMemo(
    () => linhas.reduce((acc, l) => acc + sumBools(l.pos1, l.pos2, l.pos3), 0),
    [linhas]
  )
  const totalDesMes = useMemo(
    () => linhas.reduce((acc, l) => acc + sumBools(l.des1, l.des2, l.des3), 0),
    [linhas]
  )

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
            <h1 className="text-3xl font-extrabold text-[#2687e2]">{labelMes(mes)}</h1>
            <p className="text-sm text-[#475569]">
              Controle mensal do Drive — Totais: <strong>{totalPosMes}</strong> positivas |{' '}
              <strong>{totalDesMes}</strong> a desejar
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl bg-[#f1f5f9] border border-[#cbd5e1] px-4 py-2">
              <label className="block text-xs font-bold text-[#0f172a] mb-1">Mês</label>
              <input
                type="month"
                className="rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
              />
            </div>

            <button
              type="button"
              onClick={carregarMes}
              className="rounded-lg border border-[#334155] bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#111827]"
            >
              {carregando ? 'Recarregando…' : 'Recarregar'}
            </button>
          </div>
        </div>

        {/* TABELA PRINCIPAL */}
        <div className="rounded-2xl bg-[#f1f5f9] p-6 shadow border border-[#cbd5e1]">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#0f172a]">Controle por agente</h2>
              <p className="text-sm text-[#334155]">
                Marque se já colocou as ligações no Drive (positivas / a desejar) e selecione a monitora
              </p>
            </div>

            <div className="text-xs text-[#64748b]">
              Clique nos checks e selecione a monitora — salva automaticamente.
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-[#cbd5e1] p-4">
            <table className="w-full text-sm text-[#0f172a] table-fixed">
              <thead>
                <tr className="text-left text-[#0f172a]">
                  <th className="py-2 pr-2 font-extrabold w-[220px]">Agente</th>

                  <th className="py-2 pr-2 font-extrabold w-[90px] text-center">Pos 1</th>
                  <th className="py-2 pr-2 font-extrabold w-[90px] text-center">Pos 2</th>
                  <th className="py-2 pr-2 font-extrabold w-[90px] text-center">Pos 3</th>

                  <th className="py-2 pr-2 font-extrabold w-[110px] text-center">Desejar 1</th>
                  <th className="py-2 pr-2 font-extrabold w-[110px] text-center">Desejar 2</th>
                  <th className="py-2 pr-2 font-extrabold w-[110px] text-center">Desejar 3</th>

                  <th className="py-2 pr-2 font-extrabold w-[200px]">Monitora</th>
                </tr>
              </thead>

              <tbody>
                {linhas.map((l) => {
                  const busy = salvandoKey === `${mes}:${l.agente}`
                  return (
                    <tr key={l.agente} className="border-t border-[#e2e8f0]">
                      <td className="py-2 pr-2 font-semibold truncate">{l.agente}</td>

                      {(['pos1', 'pos2', 'pos3'] as const).map((k) => (
                        <td key={k} className="py-2 pr-2 text-center">
                          <button
                            type="button"
                            onClick={() => upsertLinha(l.agente, { [k]: !l[k] } as any)}
                            disabled={busy}
                            className={[
                              'inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-extrabold',
                              l[k]
                                ? 'bg-emerald-600 border-emerald-700 text-white'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100',
                              busy ? 'opacity-60' : '',
                            ].join(' ')}
                          >
                            {l[k] ? '✓' : ''}
                          </button>
                        </td>
                      ))}

                      {(['des1', 'des2', 'des3'] as const).map((k) => (
                        <td key={k} className="py-2 pr-2 text-center">
                          <button
                            type="button"
                            onClick={() => upsertLinha(l.agente, { [k]: !l[k] } as any)}
                            disabled={busy}
                            className={[
                              'inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-extrabold',
                              l[k]
                                ? 'bg-rose-600 border-rose-700 text-white'
                                : 'bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100',
                              busy ? 'opacity-60' : '',
                            ].join(' ')}
                          >
                            {l[k] ? '✓' : ''}
                          </button>
                        </td>
                      ))}

                      <td className="py-2 pr-2">
                        <select
                          className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white"
                          value={(l.monitora ?? '') as Monitora}
                          onChange={(e) => upsertLinha(l.agente, { monitora: e.target.value || null })}
                          disabled={busy}
                        >
                          <option value="">—</option>
                          <option value="Rosário">Rosário</option>
                          <option value="Marcilene">Marcilene</option>
                        </select>

                        <div className="mt-1 text-[11px] text-[#64748b]">{busy ? 'Salvando…' : ''}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RELATÓRIO */}
        <div className="rounded-2xl bg-[#f1f5f9] p-6 shadow border border-[#cbd5e1]">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#0f172a]">Relatório</h2>
              <p className="text-sm text-[#334155]">Filtre por mês, monitora e quantidade de ligações</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const m = mesAtualYYYYMM()
                  setFiltros({ mes: m, monitora: '' as Monitora, minPos: '', minDes: '' })
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

              <button
                type="button"
                onClick={exportarCSV}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Exportar CSV
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Mês</label>
              <input
                type="month"
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white"
                value={filtros.mes}
                onChange={(e) => setFiltros({ ...filtros, mes: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Monitora</label>
              <select
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white"
                value={filtros.monitora}
                onChange={(e) => setFiltros({ ...filtros, monitora: e.target.value as Monitora })}
              >
                <option value="">Todas</option>
                <option value="Rosário">Rosário</option>
                <option value="Marcilene">Marcilene</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Mín. Positivas</label>
              <input
                type="number"
                min={0}
                max={3}
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white"
                value={filtros.minPos}
                onChange={(e) => setFiltros({ ...filtros, minPos: e.target.value })}
                placeholder="0–3"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Mín. A desejar</label>
              <input
                type="number"
                min={0}
                max={3}
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white"
                value={filtros.minDes}
                onChange={(e) => setFiltros({ ...filtros, minDes: e.target.value })}
                placeholder="0–3"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 border border-[#cbd5e1]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-[#111827]">
                <thead>
                  <tr className="text-left text-[#0f172a]">
                    <th className="py-2 pr-3 font-bold">Mês</th>
                    <th className="py-2 pr-3 font-bold">Agente</th>
                    <th className="py-2 pr-3 font-bold">Monitora</th>
                    <th className="py-2 pr-3 font-bold">Positivas</th>
                    <th className="py-2 pr-3 font-bold">A desejar</th>
                    <th className="py-2 pr-3 font-bold">Atualizado em</th>
                  </tr>
                </thead>
                <tbody>
                  {carregandoRelatorio ? (
                    <tr>
                      <td className="py-3 text-[#334155]" colSpan={6}>
                        Carregando…
                      </td>
                    </tr>
                  ) : relatorio.length === 0 ? (
                    <tr>
                      <td className="py-3 text-[#334155]" colSpan={6}>
                        Nenhum dado com esses filtros.
                      </td>
                    </tr>
                  ) : (
                    relatorio.map((r, idx) => (
                      <tr key={idx} className="border-t border-[#e2e8f0] hover:bg-[#f8fafc]">
                        <td className="py-2 pr-3 whitespace-nowrap">{r.mes}</td>
                        <td className="py-2 pr-3 font-semibold">{r.agente}</td>
                        <td className="py-2 pr-3">{r.monitora || '—'}</td>
                        <td className="py-2 pr-3">
                          <span className="inline-flex rounded-full px-3 py-1 text-xs font-extrabold bg-emerald-100 text-emerald-800">
                            {r.ligacoes_positivas}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <span className="inline-flex rounded-full px-3 py-1 text-xs font-extrabold bg-rose-100 text-rose-800">
                            {r.ligacoes_a_desejar}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-[#334155]">
                          {r.updated_at ? new Date(r.updated_at).toLocaleString('pt-BR') : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-[#334155] mt-3">
              Exportação CSV sai em <strong>colunas no Excel</strong> (separador “;”).
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
