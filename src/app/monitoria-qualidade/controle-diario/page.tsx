'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Agente = { nome: string }

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

function diasDoMes(yyyyMm: string) {
  const [y, m] = yyyyMm.split('-').map(Number)
  const total = new Date(y, m, 0).getDate()
  return Array.from({ length: total }, (_, i) => i + 1)
}

function nomeMesTopo(yyyyMm: string) {
  const [y, m] = yyyyMm.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  const mesNome = d.toLocaleDateString('pt-BR', { month: 'long' })
  const mesCapitalizado = mesNome.charAt(0).toUpperCase() + mesNome.slice(1)
  return `${mesCapitalizado} de ${y}`
}

function normKey(s: string) {
  return (s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function ControleDiarioMonitoriaPage() {
  const router = useRouter()

  // ✅ restrita
  const [checkingAuth, setCheckingAuth] = useState(true)
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const email = (data.session?.user?.email || '').toLowerCase()
      if (email !== 'supervisao@sonax.net.br') {
        router.replace('/')
        return
      }
      setCheckingAuth(false)
    })()
  }, [router])

  // ✅ sempre mês atual
  const [mes, setMes] = useState(() => yyyyMm(new Date()))

  useEffect(() => {
    const timer = setInterval(() => {
      const mm = yyyyMm(new Date())
      setMes((prev) => (prev === mm ? prev : mm))
    }, 30_000)
    return () => clearInterval(timer)
  }, [])

  const dias = useMemo(() => diasDoMes(mes), [mes])

  const [agentes, setAgentes] = useState<Agente[]>([])
  const [carregandoAgentes, setCarregandoAgentes] = useState(false)
  const [carregandoMarcacoes, setCarregandoMarcacoes] = useState(false)

  // grid: chave "agente__dia" => boolean
  const key = (agenteNome: string, dia: number) => `${normKey(agenteNome)}__${dia}`
  const [grid, setGrid] = useState<Record<string, boolean>>({})
  const [salvandoKey, setSalvandoKey] = useState<string | null>(null)

  // ✅ cadastrar agente
  const [novoAgente, setNovoAgente] = useState('')
  const [cadastrando, setCadastrando] = useState(false)

  // ✅ excluir agente
  const [excluindoAgente, setExcluindoAgente] = useState<string | null>(null)

  async function carregarAgentes() {
    try {
      setCarregandoAgentes(true)

      const { data, error } = await supabase
        .from('monitoria_agente_dias')
        .select('agente')
        .eq('mes', mes)
        .not('agente', 'is', null)

      if (error) throw error

      const uniq = Array.from(
        new Set((data ?? []).map((r: any) => normKey(String(r.agente))).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

      setAgentes(uniq.map((nome) => ({ nome })))
    } catch (err: any) {
      console.error(err)
      alert('Erro ao carregar agentes: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCarregandoAgentes(false)
    }
  }

  async function carregarMarcacoesDoMes() {
    try {
      setCarregandoMarcacoes(true)

      const { data, error } = await supabase
        .from('monitoria_agente_dias')
        .select('id, mes, dia, agente, avaliado, marcado_por, updated_at')
        .eq('mes', mes)
        .eq('avaliado', true)

      if (error) throw error

      const rows = (((data as any) || []) as Marcacao[]) || []

      const next: Record<string, boolean> = {}
      for (const r of rows) {
        if (!r.agente) continue
        next[key(r.agente, r.dia)] = true
      }
      setGrid(next)
    } catch (err: any) {
      console.error(err)
      alert('Erro ao carregar marcações: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCarregandoMarcacoes(false)
    }
  }

  useEffect(() => {
    if (!checkingAuth) carregarAgentes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingAuth, mes])

  useEffect(() => {
    if (!checkingAuth) carregarMarcacoesDoMes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, checkingAuth])

  async function cadastrarAgente() {
    const nome = normKey(novoAgente)
    if (!nome) return alert('Digite o nome do agente.')

    if (agentes.some((a) => normKey(a.nome) === nome)) {
      alert('Esse agente já está cadastrado neste mês.')
      setNovoAgente('')
      return
    }

    try {
      setCadastrando(true)
      const { data: sess } = await supabase.auth.getSession()
      const email = sess.session?.user?.email || null

      // cria um registro base no mês
      const { error } = await supabase.from('monitoria_agente_dias').upsert(
        [
          {
            mes,
            dia: 1,
            agente: nome,
            avaliado: false,
            marcado_por: email,
          },
        ],
        { onConflict: 'mes,dia,agente' }
      )

      if (error) throw error

      setNovoAgente('')
      await carregarAgentes()
      alert('Agente cadastrado com sucesso!')
    } catch (err: any) {
      console.error(err)
      alert('Erro ao cadastrar agente: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCadastrando(false)
    }
  }

  async function excluirAgente(nomeAgente: string) {
    const nome = normKey(nomeAgente)
    const ok = confirm(
      `Excluir o agente "${nomeAgente}" deste mês (${mes})?\n\nIsso vai apagar TODOS os checks desse agente no mês.`
    )
    if (!ok) return

    try {
      setExcluindoAgente(nome)

      const { error } = await supabase
        .from('monitoria_agente_dias')
        .delete()
        .eq('mes', mes)
        .eq('agente', nome)

      if (error) throw error

      // remove da lista
      setAgentes((prev) => prev.filter((a) => normKey(a.nome) !== nome))

      // remove do grid (todas as chaves desse agente)
      setGrid((prev) => {
        const next = { ...prev }
        for (const d of dias) {
          delete next[key(nome, d)]
        }
        return next
      })

      alert('Agente excluído com sucesso.')
    } catch (err: any) {
      console.error(err)
      alert('Erro ao excluir agente: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setExcluindoAgente(null)
    }
  }

  async function toggle(agenteNome: string, dia: number) {
    const k = key(agenteNome, dia)
    const atual = !!grid[k]
    const proximo = !atual

    setGrid((prev) => ({ ...prev, [k]: proximo }))
    setSalvandoKey(k)

    try {
      const { data: sess } = await supabase.auth.getSession()
      const email = sess.session?.user?.email || null

      if (proximo) {
        const { error } = await supabase.from('monitoria_agente_dias').upsert(
          [
            {
              mes,
              dia,
              agente: normKey(agenteNome),
              avaliado: true,
              marcado_por: email,
            },
          ],
          { onConflict: 'mes,dia,agente' }
        )
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('monitoria_agente_dias')
          .delete()
          .eq('mes', mes)
          .eq('dia', dia)
          .eq('agente', normKey(agenteNome))
        if (error) throw error
      }
    } catch (err: any) {
      console.error(err)
      setGrid((prev) => ({ ...prev, [k]: atual }))
      alert('Erro ao salvar: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setSalvandoKey(null)
    }
  }

  function exportarCSV() {
    if (!agentes.length) return alert('Sem agentes para exportar.')

    const headers = ['mes', 'dia', 'agente', 'avaliado']
    const lines: string[] = []
    lines.push(headers.join(','))

    const escape = (v: any) => {
      const s = String(v ?? '')
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    for (const a of agentes) {
      for (const d of dias) {
        const checked = !!grid[key(a.nome, d)]
        const row = {
          mes,
          dia: d,
          agente: a.nome,
          avaliado: checked ? 'Sim' : 'Não',
        }
        lines.push(headers.map((h) => escape((row as any)[h])).join(','))
      }
    }

    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `controle_monitoria_${mes}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalMarcados = useMemo(() => Object.values(grid).filter(Boolean).length, [grid])

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
            <h1 className="text-3xl font-extrabold text-[#0f172a]">{nomeMesTopo(mes)}</h1>
            <p className="text-sm text-[#475569]">
              Marque os dias em que cada agente foi avaliado (controle mensal)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl bg-[#0f172a] text-white px-4 py-2 text-sm font-semibold">
              Checks no mês: <span className="font-extrabold">{totalMarcados}</span>
            </div>

            {/* CADASTRAR AGENTE */}
            <div className="flex items-center gap-2">
              <input
                value={novoAgente}
                onChange={(e) => setNovoAgente(e.target.value)}
                placeholder="Cadastrar agente..."
                className="rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm text-[#0f172a] bg-white w-[260px]"
              />
              <button
                type="button"
                onClick={cadastrarAgente}
                disabled={cadastrando}
                className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {cadastrando ? 'Salvando…' : 'Adicionar'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                carregarAgentes()
                carregarMarcacoesDoMes()
              }}
              className="rounded-lg border border-[#334155] bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#111827]"
            >
              {carregandoAgentes || carregandoMarcacoes ? 'Recarregando…' : 'Recarregar'}
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

        {/* TABELA */}
        <div className="rounded-2xl bg-[#f1f5f9] p-6 shadow border border-[#cbd5e1]">
          <div className="rounded-2xl bg-white p-4 border border-[#cbd5e1]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-[#0f172a]">
                <thead>
                  <tr className="text-left">
                    <th className="sticky left-0 z-10 bg-white py-2 pr-3 font-extrabold min-w-[260px]">
                      Agente
                    </th>

                    {dias.map((d) => (
                      <th key={d} className="py-2 px-2 text-center font-extrabold w-[44px]">
                        {d}
                      </th>
                    ))}

                    <th className="py-2 pl-3 text-center font-extrabold w-[90px]">Total</th>
                  </tr>
                </thead>

                <tbody>
                  {agentes.length === 0 ? (
                    <tr>
                      <td className="py-4 text-[#334155]" colSpan={dias.length + 2}>
                        Nenhum agente encontrado.
                      </td>
                    </tr>
                  ) : (
                    agentes.map((a) => {
                      let total = 0
                      for (const d of dias) if (grid[key(a.nome, d)]) total++

                      return (
                        <tr key={a.nome} className="border-t border-[#e2e8f0]">
                          <td className="sticky left-0 z-10 bg-white py-2 pr-3 font-semibold">
                            <div className="flex items-center justify-between gap-3">
                              <span>{a.nome}</span>

                              <button
                                type="button"
                                onClick={() => excluirAgente(a.nome)}
                                disabled={excluindoAgente === normKey(a.nome)}
                                className="rounded-lg border border-red-500 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                title="Excluir agente do mês (apaga todos os checks)"
                              >
                                {excluindoAgente === normKey(a.nome) ? 'Excluindo…' : 'Excluir'}
                              </button>
                            </div>
                          </td>

                          {dias.map((d) => {
                            const k = key(a.nome, d)
                            const checked = !!grid[k]
                            const saving = salvandoKey === k

                            return (
                              <td key={d} className="py-2 px-2 text-center">
                                <label className="inline-flex items-center justify-center">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggle(a.nome, d)}
                                    disabled={saving}
                                    className="h-4 w-4 accent-emerald-600"
                                  />
                                </label>
                              </td>
                            )
                          })}

                          <td className="py-2 pl-3 text-center">
                            <span className="inline-flex rounded-full bg-[#0f172a] px-3 py-1 text-xs font-extrabold text-white">
                              {total}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-[#334155] mt-3">
              Ao virar o mês, o controle “zera” automaticamente porque a tela passa a usar o próximo{' '}
              <strong>YYYY-MM</strong>. Os dados anteriores ficam salvos no Supabase.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
