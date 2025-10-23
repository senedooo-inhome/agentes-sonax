'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Agente = { id: string; nome: string; status: string }

// Todos os tipos de marcação do dia
type TipoMarca =
  | 'Presente'
  | 'Folga'
  | 'Férias'
  | 'Atestado'
  | 'Afastado'
  | 'Licença Maternidade'
  | 'Licença Paternidade'
  | 'Ausente'

export default function ChamadaPage() {
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [marcasHoje, setMarcasHoje] = useState<Record<string, TipoMarca>>({})
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('') // busca
  const hoje = new Date().toISOString().slice(0, 10)

  // Opções de marcação (inclui todos os motivos)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function registrar(agenteId: string, tipo: TipoMarca) {
    try {
      setLoading(true)
      const { error } = await supabase
        .from('presencas')
        .upsert([{ agente_id: agenteId, data_registro: hoje, tipo }], {
          onConflict: 'agente_id,data_registro',
        })

      if (error) {
        // fallback se não existir índice único
        await supabase.from('presencas').delete().eq('agente_id', agenteId).eq('data_registro', hoje)
        const { error: e2 } = await supabase
          .from('presencas')
          .insert([{ agente_id: agenteId, data_registro: hoje, tipo }])
        if (e2) throw e2
      }

      setMarcasHoje(prev => ({ ...prev, [agenteId]: tipo }))
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
      default: return '#757575'
    }
  }
  function corTipo(t: TipoMarca) {
    return opcoes.find(o => o.value === t)?.cor ?? '#999'
  }

  // ---- Busca (remove acentos e ignora maiúsculas/minúsculas)
  function norm(s: string) {
    return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  }

  const agentesFiltrados = useMemo(() => {
    if (!q.trim()) return agentes
    const nq = norm(q)
    return agentes.filter(a => norm(a.nome).includes(nq))
  }, [agentes, q])

  // Listas da coluna direita
  const listaPresente = agentes.filter(a => marcasHoje[a.id] === 'Presente')

  // Ainda não logaram = status Ativo e sem marcação hoje
  const listaNaoLogou = agentes.filter(a => a.status === 'Ativo' && !marcasHoje[a.id])

  // Ausências = qualquer marcação diferente de Presente
  const listaAusencias = agentes
    .map(a => ({ ...a, tipo: marcasHoje[a.id] as TipoMarca | undefined }))
    .filter(a => a.tipo && a.tipo !== 'Presente') as (Agente & { tipo: TipoMarca })[]

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#2687e2]">
            Chamada de Presença — {hoje}
          </h1>

          <div className="flex items-center gap-2">
            <a
              href="/"
              className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
            >
              Cadastro
            </a>
            <span
              className="rounded-lg bg-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 cursor-default"
              aria-current="page"
              title="Você está em Chamada"
            >
              Chamada
            </span>
            <a
              href="/relatorios"
              className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
            >
              Relatórios
            </a>
          </div>
        </div>

        {/* GRID 2x2: quatro quadros */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* QUADRO 1 — Chamada */}
          <div className="rounded-xl bg-white p-6 shadow h-[70vh] flex flex-col">
            <h2 className="mb-4 text-lg font-semibold text-[#2687e2]">Chamada de presença</h2>

            {/* Barra de busca */}
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
                  title="Limpar"
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
                const podeMarcar = a.status === 'Ativo' || Boolean(marcado)
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
                        disabled={!podeMarcar || loading}
                        value={marcado ?? ''}
                        onChange={(e) =>
                          registrar(a.id, (e.target.value || 'Presente') as TipoMarca)
                        }
                        className="rounded-lg border p-2 text-black"
                      >
                        <option value="" disabled hidden>
                          {marcado ? 'Alterar…' : 'Marcar…'}
                        </option>
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

          {/* QUADRO 2 — Presente */}
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

          {/* QUADRO 3 — Ainda não logaram */}
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

          {/* QUADRO 4 — Ausência (Motivo) */}
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
