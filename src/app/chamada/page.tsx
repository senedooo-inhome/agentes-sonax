'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Agente = { id: string; nome: string; status: string }
type TipoMarca = 'Presente' | 'Saiu cedo' | 'Folga'

export default function ChamadaPage() {
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [marcasHoje, setMarcasHoje] = useState<Record<string, TipoMarca>>({})
  const [loading, setLoading] = useState(false)
  const hoje = new Date().toISOString().slice(0, 10)

  const opcoes = useMemo(
    () => [
      { value: 'Presente' as const, label: 'Presente', badge: '✅', cor: '#46a049' },
      { value: 'Saiu cedo' as const, label: 'Saiu cedo', badge: '⏰', cor: '#f19a37' },
      { value: 'Folga' as const, label: 'Folga', badge: '🟦', cor: '#42a5f5' },
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

  const listaPresente = agentes.filter(a => marcasHoje[a.id] === 'Presente')
  const listaSaiuCedo = agentes.filter(a => marcasHoje[a.id] === 'Saiu cedo')
  const listaFolga    = agentes.filter(a => marcasHoje[a.id] === 'Folga')

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
            <ul className="space-y-2 flex-1 overflow-y-auto pr-1">
              {agentes.map((a) => {
                const marcado = marcasHoje[a.id]
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
                        onChange={(e) => registrar(a.id, (e.target.value || 'Presente') as TipoMarca)}
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
              {agentes.length === 0 && (
                <p className="text-gray-500">Nenhum agente cadastrado.</p>
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

          {/* QUADRO 3 — Saiu cedo */}
          <div className="rounded-xl bg-white p-6 shadow h-[70vh] flex flex-col">
            <h2 className="mb-4 text-lg font-semibold text-[#2687e2]">Quem saiu cedo</h2>
            {listaSaiuCedo.length === 0 ? (
              <p className="text-gray-500">Ninguém marcado como Saiu cedo.</p>
            ) : (
              <ul className="space-y-2 flex-1 overflow-y-auto pr-1">
                {listaSaiuCedo.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border p-3 font-medium text-black"
                    style={{ borderLeft: '6px solid #f19a37' }}
                  >
                    {a.nome} — ⏰ Saiu cedo
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* QUADRO 4 — Folga */}
          <div className="rounded-xl bg-white p-6 shadow h-[70vh] flex flex-col">
            <h2 className="mb-4 text-lg font-semibold text-[#2687e2]">Quem está de folga</h2>
            {listaFolga.length === 0 ? (
              <p className="text-gray-500">Ninguém marcado como Folga.</p>
            ) : (
              <ul className="space-y-2 flex-1 overflow-y-auto pr-1">
                {listaFolga.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border p-3 font-medium text-black"
                    style={{ borderLeft: '6px solid #42a5f5' }}
                  >
                    {a.nome} — 🟦 Folga
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
