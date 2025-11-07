'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Agente = { id: string; nome: string; status: string }

type TipoMarca =
  | 'Presente'
  | 'Folga'
  | 'Férias'
  | 'Atestado'
  | 'Afastado'
  | 'Licença Maternidade'
  | 'Licença Paternidade'
  | 'Ausente'

// data local (Brasil)
function dataLocalYYYYMMDD() {
  const d = new Date()
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export default function ChamadaPage() {
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [marcasHoje, setMarcasHoje] = useState<Record<string, TipoMarca>>({})
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const hoje = dataLocalYYYYMMDD()

  const opcoes = useMemo(
    () => [
      { value: 'Presente' as const, label: 'Presente', badge: '✅', cor: '#46a049' },
      { value: 'Folga' as const, label: 'Folga', badge: '🟦', cor: '#42a5f5' },
      { value: 'Férias' as const, label: 'Férias', badge: '🏖️', cor: '#f19a37' },
      { value: 'Atestado' as const, label: 'Atestado', badge: '🩺', cor: '#e53935' },
      { value: 'Afastado' as const, label: 'Afastado', badge: '⛔', cor: '#9c27b0' },
      { value: 'Licença Maternidade' as const, label: 'Licença Maternidade', badge: '👶', cor: '#ff4081' },
      { value: 'Licença Paternidade' as const, label: 'Licença Paternidade', badge: '🍼', cor: '#5c6bc0' },
      { value: 'Ausente' as const, label: 'Ausente', badge: '🚫', cor: '#757575' },
    ],
    []
  )

  useEffect(() => {
    carregarAgentes()
    carregarPresencas(hoje)
  }, [])

  async function carregarAgentes() {
    const { data, error } = await supabase
      .from('agentes')
      .select('id, nome, status')
      .order('nome')
    if (!error) setAgentes((data ?? []) as Agente[])
  }

  async function carregarPresencas(dia: string) {
    const { data, error } = await supabase
      .from('presencas')
      .select('agente_id, tipo')
      .eq('data_registro', dia)
    if (error) return
    const map: Record<string, TipoMarca> = {}
    ;(data ?? []).forEach((r: any) => (map[r.agente_id] = r.tipo))
    setMarcasHoje(map)
  }

  // remover marcação do dia e voltar agente para Ativo
  async function removerPresenca(agenteId: string) {
    try {
      setLoading(true)
      await supabase
        .from('presencas')
        .delete()
        .eq('agente_id', agenteId)
        .eq('data_registro', hoje)

      await supabase.from('agentes').update({ status: 'Ativo' }).eq('id', agenteId)

      setMarcasHoje(prev => {
        const novo = { ...prev }
        delete novo[agenteId]
        return novo
      })

      setAgentes(prev =>
        prev.map(a => (a.id === agenteId ? { ...a, status: 'Ativo' } : a))
      )
    } catch (e: any) {
      alert('Erro ao remover marcação: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  // marcar e gravar o mesmo motivo no agente
  async function registrar(agenteId: string, tipo: TipoMarca) {
    try {
      setLoading(true)
      const { error } = await supabase
        .from('presencas')
        .upsert([{ agente_id: agenteId, data_registro: hoje, tipo }], {
          onConflict: 'agente_id,data_registro',
        })

      if (error) {
        await supabase.from('presencas').delete().eq('agente_id', agenteId).eq('data_registro', hoje)
        const { error: e2 } = await supabase
          .from('presencas')
          .insert([{ agente_id: agenteId, data_registro: hoje, tipo }])
        if (e2) throw e2
      }

      const novoStatus = tipo === 'Presente' ? 'Ativo' : tipo
      await supabase.from('agentes').update({ status: novoStatus }).eq('id', agenteId)

      setMarcasHoje(prev => ({ ...prev, [agenteId]: tipo }))
      setAgentes(prev =>
        prev.map(a => (a.id === agenteId ? { ...a, status: novoStatus } : a))
      )
    } catch (e: any) {
      alert('Erro ao registrar: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  function corStatusAgente(s: string) {
    switch (s) {
      case 'Ativo': return '#46a049'
      case 'Férias': return '#f19a37'
      case 'Atestado': return '#e53935'
      case 'Folga': return '#42a5f5'
      case 'Afastado': return '#9c27b0'
      case 'Licença Maternidade': return '#ff4081'
      case 'Licença Paternidade': return '#5c6bc0'
      case 'Ausente': return '#757575'
      default: return '#757575'
    }
  }

  function corTipo(t: TipoMarca) {
    return opcoes.find(o => o.value === t)?.cor ?? '#999'
  }

  function norm(s: string) {
    return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  }

  const agentesFiltrados = useMemo(() => {
    if (!q.trim()) return agentes
    const nq = norm(q)
    return agentes.filter(a => norm(a.nome).includes(nq))
  }, [agentes, q])

  const listaPresente = agentes.filter(a => marcasHoje[a.id] === 'Presente')
  const listaNaoLogou = agentes.filter(a => a.status === 'Ativo' && !marcasHoje[a.id])

  // ausência = marcou hoje OU status diferente de Ativo
  const listaAusencias = agentes
    .map(a => {
      const tipoHoje = marcasHoje[a.id] as TipoMarca | undefined
      const motivo: TipoMarca | undefined =
        tipoHoje && tipoHoje !== 'Presente'
          ? tipoHoje
          : (a.status !== 'Ativo' ? (a.status as TipoMarca) : undefined)
      return { ...a, tipo: motivo }
    })
    .filter(a => a.tipo && a.tipo !== 'Presente') as (Agente & { tipo: TipoMarca })[]

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#2687e2]">Data — {hoje}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <a href="/" className="rounded-lg bg-[#2687e2] px-1 py-1 text-sm font-semibold text-white hover:bg-blue-600">Início</a>
            <span className="rounded-lg bg-gray-300 px-1 py-1 text-sm font-semibold text-gray-800 cursor-default">Chamada</span>
            <a href="/relatorios" className="rounded-lg border border-[#2687e2] px-2 py-1 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white">Relatórios</a>
            <a href="/campanhas" className="rounded-lg bg-[#2687e2] px-1 py-1 text-sm font-semibold text-white hover:bg-blue-600">Campanhas</a>
            <a href="/erros" className="rounded-lg bg-[#2687e2] px-1 py-1 text-sm font-semibold text-white hover:bg-blue-600">Erros</a>
            <a href="/advertencias" className="rounded-lg bg-[#2687e2] px-1 py-1 text-sm font-semibold text-white hover:bg-blue-600">Advertências</a>
            <a href="/atestados" className="rounded-lg bg-[#2687e2] px-1 py-1 text-sm font-semibold text-white hover:bg-blue-600">Atestados</a>
            <a href="/ligacoes" className="rounded-lg bg-[#2687e2] px-1 py-1 text-sm font-semibold text-white hover:bg-blue-600">Ligações Ativas</a>
            <a href="/login?logout=1" className="rounded-lg bg-gray-500 px-2 py-1 text-sm font-semibold text-white hover:bg-gray-600">Sair</a>
          </div>
        </div>

        {/* grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* chamada */}
          <div className="rounded-xl bg-white p-6 shadow h-[70vh] flex flex-col">
            <h2 className="mb-4 text-lg font-semibold text-[#2687e2]">Chamada de presença</h2>
            <div className="mb-3 flex items-center gap-2">
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar agente…"
                className="w-full rounded-lg border p-2 text-black"
              />
              {q && (
                <button
                  onClick={() => setQ('')}
                  className="rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Limpar
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-2">
              {agentesFiltrados.length} de {agentes.length} agentes
            </p>

            <ul className="space-y-2 flex-1 overflow-y-auto pr-1">
              {agentesFiltrados.map((a) => {
                const marcado = marcasHoje[a.id] as TipoMarca | undefined
                const temMarcacaoHoje = Boolean(marcado)
                const estaAusentePeloStatus = !temMarcacaoHoje && a.status !== 'Ativo'

                // ⬇️ valor que o select deve mostrar
                const valorSelect = temMarcacaoHoje
                  ? marcado!
                  : estaAusentePeloStatus
                    ? (a.status as TipoMarca)
                    : ''

                return (
                  <li
                    key={a.id}
                    className="rounded-lg border p-3"
                    style={{ borderLeft: `6px solid ${corStatusAgente(a.status)}` }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-black">
                        {a.nome} — {a.status}
                      </span>

                      <select
                        disabled={loading}
                        value={valorSelect}
                        onChange={(e) => {
                          const val = e.target.value
                          if (val === '__remover') {
                            removerPresenca(a.id)
                          } else {
                            registrar(a.id, (val || 'Presente') as TipoMarca)
                          }
                        }}
                        className="rounded-lg border p-2 text-black"
                      >
                        {/* quando não tem nada nem status, aparece Marcar… */}
                        <option
                          value=""
                          disabled={valorSelect !== ''}
                          hidden={valorSelect !== ''}
                        >
                          {valorSelect ? 'Alterar…' : 'Marcar…'}
                        </option>

                        {/* se ele está ausente só pelo status (ex: Atestado), mostra o remover */}
                        {(temMarcacaoHoje || estaAusentePeloStatus) && (
                          <option value="__remover">❌ Remover marcação</option>
                        )}

                        {opcoes.map(op => (
                          <option key={op.value} value={op.value}>
                            {op.badge} {op.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                )
              })}
              {agentesFiltrados.length === 0 && (
                <p className="text-gray-500">Nenhum agente encontrado.</p>
              )}
            </ul>
          </div>

          {/* quem logou */}
          <div className="rounded-xl bg-white p-6 shadow h-[70vh] flex flex-col">
            <h2 className="mb-4 text-lg font-semibold text-[#2687e2]">Quem logou hoje</h2>
            {listaPresente.length === 0 ? (
              <p className="text-gray-500">Ninguém marcado como Presente.</p>
            ) : (
              <ul className="space-y-2 flex-1 overflow-y-auto pr-1">
                {listaPresente.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border p-3 font-medium text-black"
                    style={{ borderLeft: '6px solid #46a049' }}
                  >
                    {a.nome} — ✅ Presente
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ainda não logaram */}
          <div className="rounded-xl bg-white p-6 shadow h-[70vh] flex flex-col">
            <h2 className="mb-4 text-lg font-semibold text-[#2687e2]">Ainda não logaram</h2>
            {listaNaoLogou.length === 0 ? (
              <p className="text-gray-500">Todos já marcaram presença hoje 🎉</p>
            ) : (
              <ul className="space-y-2 flex-1 overflow-y-auto pr-1">
                {listaNaoLogou.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border p-3 font-medium text-black"
                    style={{ borderLeft: '6px solid #f19a37' }}
                  >
                    {a.nome} — ⏳ Ainda não logou
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ausência */}
          <div className="rounded-xl bg-white p-6 shadow h-[70vh] flex flex-col">
            <h2 className="mb-4 text-lg font-semibold text-[#2687e2]">Ausência (Motivo)</h2>
            {listaAusencias.length === 0 ? (
              <p className="text-gray-500">Sem ausências registradas hoje.</p>
            ) : (
              <ul className="space-y-2 flex-1 overflow-y-auto pr-1">
                {listaAusencias.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border p-3 font-medium text-black"
                    style={{ borderLeft: `6px solid ${corTipo(a.tipo)}` }}
                  >
                    {a.nome} — {opcoes.find(o => o.value === a.tipo)?.badge} {a.tipo}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
