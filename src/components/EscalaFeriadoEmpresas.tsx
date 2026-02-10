'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Calendar, Building2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

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

// Formatar data de YYYY-MM-DD para DD/MM/YYYY
function formatarData(dataISO: string) {
  const [y, m, d] = dataISO.split('-')
  return `${d}/${m}/${y}`
}

export default function EscalaFeriadoEmpresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [proximoFeriado, setProximoFeriado] = useState<{ data: string; feriado: string } | null>(null)
  const [operacaoMap, setOperacaoMap] = useState<Record<number, 'Sim' | 'Não' | null>>({})
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

  const empresasFuncionam = useMemo(
    () => empresas.filter((e) => operacaoMap[e.id] === 'Sim'),
    [empresas, operacaoMap]
  )

  const empresasNaoFuncionam = useMemo(
    () => empresas.filter((e) => (operacaoMap[e.id] ?? 'Não') === 'Não'),
    [empresas, operacaoMap]
  )

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow border border-gray-200 p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando informações do feriado...</p>
        </div>
      </div>
    )
  }

  if (!proximoFeriado) {
    return (
      <div className="bg-white rounded-2xl shadow border border-gray-200 p-8">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Nenhum feriado futuro encontrado</h2>
          <p className="text-gray-600 mb-4">
            Não encontrei nenhum feriado cadastrado em <strong>operacao_empresas</strong> com data maior ou igual a hoje.
          </p>
          <button
            type="button"
            onClick={carregar}
            className="rounded-lg border border-[#2687e2] px-4 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Info do Feriado */}
      <div className="bg-white rounded-2xl shadow border border-gray-200 p-6">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Calendar className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">
            {proximoFeriado.feriado}
          </h2>
        </div>
        <p className="text-center text-lg text-gray-600">
          📅 {formatarData(proximoFeriado.data)}
        </p>
      </div>

      {/* Cards Grid - Sempre lado a lado */}
      <div className="grid grid-cols-2 gap-4 sm:gap-6">
        {/* Empresas que FUNCIONAM */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow border-2 border-green-100 overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-3 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-white/20 backdrop-blur-sm p-1.5 sm:p-2 rounded-lg">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div>
                <h3 className="text-base sm:text-xl font-bold text-white">
                  Funcionam
                </h3>
                <p className="text-green-50 text-xs sm:text-sm">
                  {empresasFuncionam.length} {empresasFuncionam.length === 1 ? 'empresa' : 'empresas'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-6 space-y-3 sm:space-y-4 max-h-[500px] sm:max-h-[600px] overflow-y-auto">
            {empresasFuncionam.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <Building2 className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-3" />
                <p className="text-xs sm:text-sm text-gray-500">Nenhuma empresa funcionará</p>
              </div>
            ) : (
              empresasFuncionam.map((empresa) => (
                <div
                  key={empresa.id}
                  className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg sm:rounded-xl p-3 sm:p-5 border-2 border-green-100 hover:border-green-200 transition-all duration-200 hover:shadow-md"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="bg-green-500 rounded-full p-1 sm:p-1.5 flex-shrink-0">
                      <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm sm:text-base font-semibold text-gray-800 truncate">
                        {empresa.nome}
                      </h4>
                      <p className="text-xs sm:text-sm text-green-600 mt-0.5 sm:mt-1 font-medium">
                        Atendimento confirmado ✓
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Empresas que NÃO funcionam */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow border-2 border-red-100 overflow-hidden">
          <div className="bg-gradient-to-r from-red-500 to-rose-600 px-3 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-white/20 backdrop-blur-sm p-1.5 sm:p-2 rounded-lg">
                <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div>
                <h3 className="text-base sm:text-xl font-bold text-white">
                  Não Funcionam
                </h3>
                <p className="text-red-50 text-xs sm:text-sm">
                  {empresasNaoFuncionam.length} {empresasNaoFuncionam.length === 1 ? 'empresa' : 'empresas'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-6 space-y-3 sm:space-y-4 max-h-[500px] sm:max-h-[600px] overflow-y-auto">
            {empresasNaoFuncionam.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <Building2 className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-3" />
                <p className="text-xs sm:text-sm text-gray-500">Todas funcionarão</p>
              </div>
            ) : (
              empresasNaoFuncionam.map((empresa) => (
                <div
                  key={empresa.id}
                  className="bg-gradient-to-r from-red-50 to-rose-50 rounded-lg sm:rounded-xl p-3 sm:p-5 border-2 border-red-100 hover:border-red-200 transition-all duration-200 hover:shadow-md"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="bg-red-500 rounded-full p-1 sm:p-1.5 flex-shrink-0">
                      <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm sm:text-base font-semibold text-gray-800 truncate">
                        {empresa.nome}
                      </h4>
                      <p className="text-xs sm:text-sm text-red-600 mt-0.5 sm:mt-1 font-medium">
                        Fechado ✕
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className="bg-white rounded-xl sm:rounded-2xl shadow border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-center">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-green-100 rounded-full p-2 sm:p-3">
              <CheckCircle2 className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
            </div>
            <div className="text-left">
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                {empresasFuncionam.length}
              </p>
              <p className="text-xs sm:text-sm text-gray-600">Funcionando</p>
            </div>
          </div>

          <div className="hidden sm:block h-12 w-px bg-gray-300"></div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-red-100 rounded-full p-2 sm:p-3">
              <XCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
            </div>
            <div className="text-left">
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                {empresasNaoFuncionam.length}
              </p>
              <p className="text-xs sm:text-sm text-gray-600">Fechadas</p>
            </div>
          </div>

          <div className="hidden sm:block h-12 w-px bg-gray-300"></div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-blue-100 rounded-full p-2 sm:p-3">
              <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                {empresas.length}
              </p>
              <p className="text-xs sm:text-sm text-gray-600">Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Aviso */}
      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 sm:p-6">
        <div className="flex items-start gap-2 sm:gap-3">
          <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-amber-900 mb-1 sm:mb-2">
              Informação Importante
            </h3>
            <p className="text-xs sm:text-sm text-amber-800">
              Os horários e escalas podem sofrer alterações de última hora. 
              Em caso de dúvidas, entre em contato com seu supervisor ou coordenador.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
