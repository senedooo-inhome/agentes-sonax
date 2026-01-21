'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

// ✅ dnd-kit
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Agente = { id: string; nome: string; status: string; ordem?: number | null }

type TipoMarca =
  | 'Presente'
  | 'Plantão Final de Semana'
  | 'Folga'
  | 'Férias'
  | 'Atestado'
  | 'Afastado'
  | 'Licença Maternidade'
  | 'Licença Paternidade'
  | 'Licença Casamento'
  | 'Ausente'

// data local (Brasil)
function dataLocalYYYYMMDD() {
  const d = new Date()
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/* ====== MESMO MENU DO INÍCIO (com Ausências) ====== */
const menuLinks: Array<{
  href: string
  label: string
  bordered?: boolean
  color?: 'gray'
}> = [
  // adicione seus links aqui se quiser
]

function SortableAgenteItem({
  agente,
  borderColor,
  loading,
  marcado,
  temMarcacaoHoje,
  estaAusentePeloStatus,
  opcoes,
  onChangeSelect,
  reorderEnabled,
}: {
  agente: Agente
  borderColor: string
  loading: boolean
  marcado?: TipoMarca
  temMarcacaoHoje: boolean
  estaAusentePeloStatus: boolean
  opcoes: { value: TipoMarca; label: string; badge: string; cor: string }[]
  onChangeSelect: (val: string) => void
  reorderEnabled: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: agente.id,
    disabled: !reorderEnabled,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={{
        ...style,
        borderLeft: `6px solid ${borderColor}`,
      }}
      className="rounded-lg border p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {/* ✅ HANDLE só aparece quando reorderEnabled */}
          {reorderEnabled && (
            <button
              type="button"
              className="cursor-grab active:cursor-grabbing select-none rounded-md border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              title="Arraste para reordenar"
              {...attributes}
              {...listeners}
            >
              ≡
            </button>
          )}

          <span className="font-medium text-black truncate">
            {agente.nome} — {agente.status}
          </span>
        </div>

        <select
          disabled={loading}
          value={temMarcacaoHoje ? (marcado as any) : ''}
          onChange={(e) => onChangeSelect(e.target.value)}
          className="rounded-lg border p-2 text-black"
        >
          <option value="" disabled={!temMarcacaoHoje} hidden={temMarcacaoHoje}>
            {temMarcacaoHoje ? 'Alterar…' : 'Marcar…'}
          </option>

          {(temMarcacaoHoje || estaAusentePeloStatus) && <option value="__remover">❌ Remover marcação</option>}

          {opcoes.map((op) => (
            <option key={op.value} value={op.value}>
              {op.badge} {op.label}
            </option>
          ))}
        </select>
      </div>
    </li>
  )
}

export default function ChamadaPage() {
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [marcasHoje, setMarcasHoje] = useState<Record<string, TipoMarca>>({})
  const [loading, setLoading] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [q, setQ] = useState('')
  const hoje = dataLocalYYYYMMDD()

  // ✅ reordenar DESABILITADO quando estiver filtrando
  const reorderEnabled = !q.trim() && !savingOrder

  // ✅ presença (não entra como ausência)
  const ehPresenca = (t?: TipoMarca) => t === 'Presente' || t === 'Plantão Final de Semana'

  const opcoes = useMemo(
    () => [
      { value: 'Presente' as const, label: 'Presente', badge: '✅', cor: '#46a049' },
      { value: 'Plantão Final de Semana' as const, label: 'Plantão Final de Semana', badge: '🛡️', cor: '#00897b' },

      { value: 'Folga' as const, label: 'Folga', badge: '🟦', cor: '#42a5f5' },
      { value: 'Férias' as const, label: 'Férias', badge: '🏖️', cor: '#f19a37' },
      { value: 'Atestado' as const, label: 'Atestado', badge: '🩺', cor: '#e53935' },
      { value: 'Afastado' as const, label: 'Afastado', badge: '⛔', cor: '#9c27b0' },
      { value: 'Licença Maternidade' as const, label: 'Licença Maternidade', badge: '👶', cor: '#ff4081' },
      { value: 'Licença Paternidade' as const, label: 'Licença Paternidade', badge: '🍼', cor: '#5c6bc0' },

      { value: 'Licença Casamento' as const, label: 'Licença Casamento', badge: '💍', cor: '#f708d7' },

      { value: 'Ausente' as const, label: 'Ausente', badge: '🚫', cor: '#757575' },
    ],
    []
  )

  // ✅ sensores dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }, // evita arrastar sem querer
    })
  )

  useEffect(() => {
    carregarAgentes()
    carregarPresencas(hoje)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function garantirOrdemInicialSeFaltar(rows: Agente[]) {
    // se muitos estiverem sem ordem, cria uma ordem padrão (mantendo a ordem atual vinda do banco)
    const faltando = rows.some((a) => a.ordem == null)
    if (!faltando) return rows

    const preenchido = rows.map((a, idx) => ({ ...a, ordem: a.ordem ?? idx + 1 }))
    // salva só quem estava null
    try {
      const updates = preenchido
        .filter((a) => rows.find((r) => r.id === a.id)?.ordem == null)
        .map((a) => supabase.from('agentes').update({ ordem: a.ordem }).eq('id', a.id))

      const res = await Promise.all(updates)
      const err = res.find((r) => r.error)?.error
      if (err) throw err
    } catch {
      // se falhar, segue sem travar a tela (só não persiste)
    }
    return preenchido
  }

  async function carregarAgentes() {
    const { data, error } = await supabase
      .from('agentes')
      .select('id, nome, status, ordem')
      .order('ordem', { ascending: true, nullsFirst: false })
      .order('nome', { ascending: true })

    if (error) return

    const lista = ((data ?? []) as Agente[]) || []
    const finalLista = await garantirOrdemInicialSeFaltar(lista)
    setAgentes(finalLista)
  }

  async function carregarPresencas(dia: string) {
    const { data, error } = await supabase.from('presencas').select('agente_id, tipo').eq('data_registro', dia)
    if (error) return
    const map: Record<string, TipoMarca> = {}
    ;(data ?? []).forEach((r: any) => (map[r.agente_id] = r.tipo))
    setMarcasHoje(map)
  }

  async function removerPresenca(agenteId: string) {
    try {
      setLoading(true)
      await supabase.from('presencas').delete().eq('agente_id', agenteId).eq('data_registro', hoje)

      await supabase.from('agentes').update({ status: 'Ativo' }).eq('id', agenteId)

      setMarcasHoje((prev) => {
        const novo = { ...prev }
        delete novo[agenteId]
        return novo
      })

      setAgentes((prev) => prev.map((a) => (a.id === agenteId ? { ...a, status: 'Ativo' } : a)))
    } catch (e: any) {
      alert('Erro ao remover marcação: ' + e.message)
    } finally {
      setLoading(false)
    }
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
        await supabase.from('presencas').delete().eq('agente_id', agenteId).eq('data_registro', hoje)
        const { error: e2 } = await supabase
          .from('presencas')
          .insert([{ agente_id: agenteId, data_registro: hoje, tipo }])
        if (e2) throw e2
      }

      const novoStatus = tipo === 'Presente' ? 'Ativo' : tipo

      await supabase.from('agentes').update({ status: novoStatus }).eq('id', agenteId)

      setMarcasHoje((prev) => ({ ...prev, [agenteId]: tipo }))
      setAgentes((prev) => prev.map((a) => (a.id === agenteId ? { ...a, status: novoStatus } : a)))
    } catch (e: any) {
      alert('Erro ao registrar: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  function corStatusAgente(s: string) {
    switch (s) {
      case 'Ativo':
        return '#46a049'
      case 'Plantão Final de Semana':
        return '#00897b'
      case 'Férias':
        return '#f19a37'
      case 'Atestado':
        return '#e53935'
      case 'Folga':
        return '#42a5f5'
      case 'Afastado':
        return '#9c27b0'
      case 'Licença Maternidade':
        return '#ff4081'
      case 'Licença Paternidade':
        return '#5c6bc0'
      case 'Licença Casamento':
        return '#f708d7'
      case 'Ausente':
        return '#757575'
      default:
        return '#757575'
    }
  }

  function corTipo(t: TipoMarca) {
    return opcoes.find((o) => o.value === t)?.cor ?? '#999'
  }

  function norm(s: string) {
    return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  }

  const agentesFiltrados = useMemo(() => {
    if (!q.trim()) return agentes
    const nq = norm(q)
    return agentes.filter((a) => norm(a.nome).includes(nq))
  }, [agentes, q])

  const listaPresente = agentes.filter((a) => ehPresenca(marcasHoje[a.id]))
  const listaNaoLogou = agentes.filter((a) => a.status === 'Ativo' && !marcasHoje[a.id])

  const listaAusencias = agentes
    .map((a) => {
      const tipoHoje = marcasHoje[a.id] as TipoMarca | undefined
      const motivo: TipoMarca | undefined =
        tipoHoje && !ehPresenca(tipoHoje)
          ? tipoHoje
          : a.status !== 'Ativo' && a.status !== 'Plantão Final de Semana'
          ? (a.status as TipoMarca)
          : undefined

      return { ...a, tipo: motivo }
    })
    .filter((a) => (a as any).tipo) as (Agente & { tipo: TipoMarca })[]

  // ✅ salvar ordem no Supabase após drag (SEM UPSERT: só UPDATE)
  async function salvarOrdemNoSupabase(novaLista: Agente[]) {
    const updates = novaLista.map((a, idx) => {
      const ordem = idx + 1
      return supabase.from('agentes').update({ ordem }).eq('id', a.id)
    })

    const results = await Promise.all(updates)
    const erro = results.find((r) => r.error)?.error
    if (erro) throw erro
  }

  async function onDragEnd(event: any) {
    if (!reorderEnabled) return

    const { active, over } = event
    if (!over) return
    if (active.id === over.id) return

    // ⚠️ sempre reordena a lista COMPLETA (agentes), não a filtrada
    const oldIndex = agentes.findIndex((a) => a.id === active.id)
    const newIndex = agentes.findIndex((a) => a.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const prev = agentes
    const moved = arrayMove(agentes, oldIndex, newIndex)

    // otimista
    setAgentes(moved)
    setSavingOrder(true)

    try {
      await salvarOrdemNoSupabase(moved)
    } catch (e: any) {
      // rollback se falhar
      setAgentes(prev)
      alert('Erro ao salvar ordem: ' + (e?.message || 'Erro desconhecido'))
    } finally {
      setSavingOrder(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6 w-full">
      <div className="w-full max-w-none space-y-6">
        {/* header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold text-[#2687e2]">Data — {hoje}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {menuLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`rounded-lg px-2 py-1 text-sm font-semibold ${
                  link.bordered
                    ? 'border border-[#2687e2] text-[#2687e2] hover:bg-[#2687e2] hover:text-white'
                    : link.color === 'gray'
                    ? 'bg-gray-500 text-white hover:bg-gray-600'
                    : 'bg-[#2687e2] text-white hover:bg-blue-600'
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        {/* ✅ ALTURA FIXA DO GRID */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* CHAMADA */}
          <div className="rounded-xl bg-white p-6 shadow h-[calc(100vh-170px)] flex flex-col">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-lg font-semibold text-[#2687e2]">Chamada de presença</h2>

              {!reorderEnabled && q.trim() && (
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                  Para reordenar, limpe a busca
                </span>
              )}

              {savingOrder && (
                <span className="text-xs text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1 rounded-full">
                  Salvando ordem…
                </span>
              )}
            </div>

            <div className="mb-3 mt-4 flex items-center gap-2">
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

            {/* ✅ rolagem interna */}
            <div className="flex-1 overflow-y-auto pr-1">
              {agentesFiltrados.length === 0 ? (
                <p className="text-gray-500">Nenhum agente encontrado.</p>
              ) : reorderEnabled ? (
                // ✅ DnD só quando reorderEnabled (q vazio)
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={agentes.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                    <ul className="space-y-2">
                      {agentesFiltrados.map((a) => {
                        const marcado = marcasHoje[a.id] as TipoMarca | undefined
                        const temMarcacaoHoje = Boolean(marcado)
                        const estaAusentePeloStatus =
                          !temMarcacaoHoje && a.status !== 'Ativo' && a.status !== 'Plantão Final de Semana'

                        return (
                          <SortableAgenteItem
                            key={a.id}
                            agente={a}
                            borderColor={corStatusAgente(a.status)}
                            loading={loading}
                            marcado={marcado}
                            temMarcacaoHoje={temMarcacaoHoje}
                            estaAusentePeloStatus={estaAusentePeloStatus}
                            opcoes={opcoes as any}
                            reorderEnabled={reorderEnabled}
                            onChangeSelect={(val) => {
                              if (val === '__remover') removerPresenca(a.id)
                              else registrar(a.id, (val || 'Presente') as TipoMarca)
                            }}
                          />
                        )
                      })}
                    </ul>
                  </SortableContext>
                </DndContext>
              ) : (
                // ✅ sem DnD quando filtrado
                <ul className="space-y-2">
                  {agentesFiltrados.map((a) => {
                    const marcado = marcasHoje[a.id] as TipoMarca | undefined
                    const temMarcacaoHoje = Boolean(marcado)
                    const estaAusentePeloStatus =
                      !temMarcacaoHoje && a.status !== 'Ativo' && a.status !== 'Plantão Final de Semana'

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
                            value={temMarcacaoHoje ? (marcado as any) : ''}
                            onChange={(e) => {
                              const val = e.target.value
                              if (val === '__remover') removerPresenca(a.id)
                              else registrar(a.id, (val || 'Presente') as TipoMarca)
                            }}
                            className="rounded-lg border p-2 text-black"
                          >
                            <option value="" disabled={!temMarcacaoHoje} hidden={temMarcacaoHoje}>
                              {temMarcacaoHoje ? 'Alterar…' : 'Marcar…'}
                            </option>

                            {(temMarcacaoHoje || estaAusentePeloStatus) && <option value="__remover">❌ Remover marcação</option>}

                            {opcoes.map((op) => (
                              <option key={op.value} value={op.value}>
                                {op.badge} {op.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* QUEM LOGOU */}
          <div className="rounded-xl bg-white p-6 shadow h-[calc(100vh-170px)] flex flex-col">
            <h2 className="mb-4 text-lg font-semibold text-[#2687e2]">Quem logou hoje</h2>

            <div className="flex-1 overflow-y-auto pr-1">
              {listaPresente.length === 0 ? (
                <p className="text-gray-500">Ninguém marcado como Presente/Plantão.</p>
              ) : (
                <ul className="space-y-2">
                  {listaPresente.map((a) => {
                    const tipo = marcasHoje[a.id]
                    const badge = opcoes.find((o) => o.value === tipo)?.badge ?? '✅'
                    const label = opcoes.find((o) => o.value === tipo)?.label ?? 'Presente'
                    const cor = tipo ? corTipo(tipo) : '#46a049'

                    return (
                      <li
                        key={a.id}
                        className="rounded-lg border p-3 font-medium text-black"
                        style={{ borderLeft: `6px solid ${cor}` }}
                      >
                        {a.nome} — {badge} {label}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* AINDA NÃO LOGARAM */}
          <div className="rounded-xl bg-white p-6 shadow h-[calc(100vh-170px)] flex flex-col">
            <h2 className="mb-4 text-lg font-semibold text-[#2687e2]">Ainda não logaram</h2>

            <div className="flex-1 overflow-y-auto pr-1">
              {listaNaoLogou.length === 0 ? (
                <p className="text-gray-500">Todos já marcaram presença hoje 🎉</p>
              ) : (
                <ul className="space-y-2">
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
          </div>

          {/* AUSÊNCIA */}
          <div className="rounded-xl bg-white p-6 shadow h-[calc(100vh-170px)] flex flex-col">
            <h2 className="mb-4 text-lg font-semibold text-[#2687e2]">Ausência (Motivo)</h2>

            <div className="flex-1 overflow-y-auto pr-1">
              {listaAusencias.length === 0 ? (
                <p className="text-gray-500">Sem ausências registradas hoje.</p>
              ) : (
                <ul className="space-y-2">
                  {listaAusencias.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-lg border p-3 font-medium text-black"
                      style={{ borderLeft: `6px solid ${corTipo(a.tipo)}` }}
                    >
                      {a.nome} — {opcoes.find((o) => o.value === a.tipo)?.badge} {a.tipo}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
