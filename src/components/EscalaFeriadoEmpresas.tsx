'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Empresa = { id: number; nome: string }

function toISODateLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function hojeISO() {
  return toISODateLocal(new Date())
}

export default function EscalaFeriadoEmpresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [proximoFeriado, setProximoFeriado] = useState<{ data: string; feriado: string } | null>(null)
  const [operacaoMap, setOperacaoMap] = useState<Record<number, 'Sim' | 'Não' | null>>({})
  const [salvandoEmpresaId, setSalvandoEmpresaId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function carregar() {
    setLoading(true)
    try {
      // 1) empresas
      const { data: empresasData, error: eEmp } = await supabase
        .from('empresas')
        .select('id, nome')
        .order('nome', { ascending: true })
      if (eEmp) throw eEmp
      setEmpresas((empresasData ?? []) as Empresa[])

      // 2) próximo feriado (primeira data >= hoje)
      const { data: proxData, error: eProx } = await supabase
        .from('operacao_empresas')
        .select('data, feriado')
        .gte('data', hojeISO())
        .order('data', { ascending: true })
        .limit(1)

      if (eProx) throw eProx
      const prox = proxData?.[0] as any

      if (!prox?.data) {
        setProximoFeriado(null)
        setOperacaoMap({})
        return
      }

      const dataFeriado = String(prox.data)
      const nomeFeriado = String(prox.feriado ?? 'Feriado')
      setProximoFeriado({ data: dataFeriado, feriado: nomeFeriado })

      // 3) status por empresa nessa data
      const { data: ops, error: eOps } = await supabase
        .from('operacao_empresas')
        .select('empresa_id, status_operacao')
        .eq('data', dataFeriado)

      if (eOps) throw eOps

      const map: Record<number, 'Sim' | 'Não' | null> = {}
      ;(ops ?? []).forEach((r: any) => {
        const empresaId = Number(r.empresa_id)
        const st = String(r.status_operacao ?? '').trim()
        map[empresaId] = st === 'Sim' ? 'Sim' : st === 'Não' ? 'Não' : null
      })
      setOperacaoMap(map)
    } catch (e: any) {
      console.error(e)
      alert('Erro ao carregar escala: ' + (e?.message ?? String(e)))
    } finally {
      setLoading(false)
    }
  }

  async function marcarOperacao(empresaId: number, status: 'Sim' | 'Não') {
    if (!proximoFeriado?.data) return alert('Nenhum feriado futuro encontrado.')

    setSalvandoEmpresaId(empresaId)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const email = sess.session?.user?.email ?? null

      const { error } = await supabase.from('operacao_empresas').upsert(
        [
          {
            data: proximoFeriado.data,
            empresa_id: empresaId,
            status_operacao: status,
            feriado: proximoFeriado.feriado,
            quem_adicionou: email,
          },
        ],
        { onConflict: 'data,empresa_id' }
      )
      if (error) throw error

      setOperacaoMap((prev) => ({ ...prev, [empresaId]: status }))
    } catch (e: any) {
      console.error(e)
      alert('Erro ao salvar: ' + (e?.message ?? String(e)))
    } finally {
      setSalvandoEmpresaId(null)
    }
  }

  const simCount = useMemo(
    () => empresas.filter((e) => operacaoMap[e.id] === 'Sim').length,
    [empresas, operacaoMap]
  )
  const naoCount = useMemo(
    () => empresas.filter((e) => (operacaoMap[e.id] ?? 'Não') === 'Não').length,
    [empresas, operacaoMap]
  )

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Empresas que vai e não vai ter atendimento no próximo feriado{' '}
            <span className="text-[#2687e2] font-extrabold">
              (
              {proximoFeriado
                ? `${proximoFeriado.feriado} — ${proximoFeriado.data}`
                : 'sem feriado futuro cadastrado'}
              )
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            *Use os botões ✅/❌ para marcar. (✅ = Sim / ❌ = Não)
          </p>
        </div>

        <button
          type="button"
          onClick={carregar}
          className="rounded-lg border border-[#2687e2] px-4 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white"
        >
          {loading ? 'Carregando…' : 'Recarregar'}
        </button>
      </div>

      {!proximoFeriado ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Não encontrei nenhum feriado futuro em <strong>operacao_empresas</strong> (data &gt;= hoje).
        </div>
      ) : (
        <>
          <div className="mt-5 overflow-x-auto">
            <div className="min-w-[780px] rounded-2xl border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-3">
                <div className="p-4 bg-[#2687e2] text-white font-extrabold">EMPRESAS</div>
                <div className="p-4 bg-[#16a34a] text-white font-extrabold text-center">SIM ✅</div>
                <div className="p-4 bg-[#ef4444] text-white font-extrabold text-center">NÃO ❌</div>
              </div>

              <div className="divide-y">
                {empresas.length === 0 ? (
                  <div className="p-4 text-sm text-gray-600">Nenhuma empresa cadastrada.</div>
                ) : (
                  empresas.map((emp) => {
                    const st = operacaoMap[emp.id] ?? null
                    const sim = st === 'Sim'
                    const nao = st === 'Não' || st == null // default visual: Não
                    const salvando = salvandoEmpresaId === emp.id

                    return (
                      <div key={emp.id} className="grid grid-cols-3 items-center">
                        <div className="p-4 text-sm font-semibold text-gray-900 truncate">{emp.nome}</div>

                        <div className="p-4 flex justify-center">
                          <button
                            type="button"
                            disabled={salvando}
                            onClick={() => marcarOperacao(emp.id, 'Sim')}
                            className={`h-10 w-10 rounded-full border flex items-center justify-center text-lg ${
                              sim
                                ? 'bg-[#16a34a] border-[#16a34a] text-white'
                                : 'bg-white border-gray-200 text-gray-400 hover:text-[#16a34a]'
                            } ${salvando ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Vai ter atendimento"
                          >
                            ✓
                          </button>
                        </div>

                        <div className="p-4 flex justify-center">
                          <button
                            type="button"
                            disabled={salvando}
                            onClick={() => marcarOperacao(emp.id, 'Não')}
                            className={`h-10 w-10 rounded-full border flex items-center justify-center text-lg ${
                              nao
                                ? 'bg-[#ef4444] border-[#ef4444] text-white'
                                : 'bg-white border-gray-200 text-gray-400 hover:text-[#ef4444]'
                            } ${salvando ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Não vai ter atendimento"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">SIM (vai ter atendimento)</p>
              <p className="text-2xl font-extrabold text-[#16a34a]">{simCount}</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">NÃO (não vai ter atendimento)</p>
              <p className="text-2xl font-extrabold text-[#ef4444]">{naoCount}</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
