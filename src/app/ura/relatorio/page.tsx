'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import * as XLSX from 'xlsx'

type Empresa = {
  id: string
  nome: string
}

type Linha = {
  id: string
  data: string
  status_operacao: 'Sim' | 'Não'
  dias_sem_atendimento: number[] | null
  responsavel: string
  observacao: string | null
  empresa: { nome: string } | null
}

export default function OperacaoEmpresaRelatorioPage() {
  const hoje = new Date().toISOString().slice(0, 10)

  const [filtros, setFiltros] = useState({
    dataInicio: hoje.slice(0, 8) + '01', // 1º dia do mês
    dataFim: hoje,
    empresaId: 'todas',
    status: 'todos', // 'todos' | 'Sim' | 'Não'
  })

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(false)

  const resumo = useMemo(() => {
    const total = linhas.length
    const sim = linhas.filter((l) => l.status_operacao === 'Sim').length
    const nao = linhas.filter((l) => l.status_operacao === 'Não').length
    return { total, sim, nao }
  }, [linhas])

  useEffect(() => {
    async function carregarEmpresas() {
      const { data, error } = await supabase
        .from('empresas')
        .select('id, nome')
        .order('nome', { ascending: true })

      if (error) {
        console.error(error)
        alert('Erro ao carregar empresas.')
        return
      }

      setEmpresas(data || [])
    }

    carregarEmpresas()
  }, [])

  async function buscar() {
    try {
      setCarregando(true)

      // IMPORTANTE: confirme que sua tabela é "operacao_empresas"
      // e que existe relacionamento com empresas via FK (empresa_id)
      let q = supabase
        .from('operacao_empresas')
        .select(
          `
          id,
          data,
          status_operacao,
          dias_sem_atendimento,
          responsavel,
          observacao,
          empresa:empresas ( nome )
        `
        )
        .gte('data', filtros.dataInicio)
        .lte('data', filtros.dataFim)
        .order('data', { ascending: false })

      if (filtros.empresaId !== 'todas') q = q.eq('empresa_id', filtros.empresaId)
      if (filtros.status !== 'todos') q = q.eq('status_operacao', filtros.status)

      const { data, error } = await q
      if (error) throw error

      setLinhas((data as any) || [])
    } catch (err: any) {
      console.error(err)
      alert('Erro ao buscar relatório: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCarregando(false)
    }
  }

  function formatDias(dias: number[] | null) {
    if (!dias || dias.length === 0) return '-'
    return dias
      .slice()
      .sort((a, b) => a - b)
      .map((d) => String(d).padStart(2, '0'))
      .join(', ')
  }

  function exportarExcel() {
    const rows = linhas.map((l) => ({
      Data: l.data,
      Empresa: l.empresa?.nome || '',
      Status: l.status_operacao,
      'Dias sem atendimento': formatDias(l.dias_sem_atendimento),
      Responsável: l.responsavel,
      Observação: l.observacao || '',
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório')

    const nomeArquivo = `relatorio_operacao_${filtros.dataInicio}_a_${filtros.dataFim}.xlsx`
    XLSX.writeFile(wb, nomeArquivo)
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Card filtros */}
        <div className="rounded-xl bg-white p-6 shadow space-y-4">
          <h1 className="text-lg font-bold text-gray-800">
            Relatório — Operação por Empresa
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Data inicial
              </label>
              <input
                type="date"
                className="w-full rounded-lg border p-2 text-gray-800"
                value={filtros.dataInicio}
                onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Data final
              </label>
              <input
                type="date"
                className="w-full rounded-lg border p-2 text-gray-800"
                value={filtros.dataFim}
                onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Empresa
              </label>
              <select
                className="w-full rounded-lg border p-2 text-gray-800 bg-white"
                value={filtros.empresaId}
                onChange={(e) => setFiltros({ ...filtros, empresaId: e.target.value })}
              >
                <option value="todas">Todas</option>
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Status da operação
              </label>
              <select
                className="w-full rounded-lg border p-2 text-gray-800 bg-white"
                value={filtros.status}
                onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
              >
                <option value="todos">Todos</option>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={buscar}
              disabled={carregando}
              className="rounded-lg bg-[#2687e2] px-5 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {carregando ? 'Buscando…' : 'Buscar'}
            </button>

            <button
              onClick={exportarExcel}
              disabled={linhas.length === 0}
              className="rounded-lg bg-gray-800 px-5 py-2 font-semibold text-white hover:bg-gray-900 disabled:opacity-50"
            >
              Exportar Excel
            </button>

            <div className="text-sm font-semibold text-gray-800">
              Total: {resumo.total} &nbsp;&nbsp; Sim: {resumo.sim} &nbsp;&nbsp; Não: {resumo.nao}
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="rounded-xl bg-white p-6 shadow">
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-bold text-gray-900">Data</th>
                  <th className="text-left p-3 font-bold text-gray-900">Empresa</th>
                  <th className="text-left p-3 font-bold text-gray-900">Status</th>
                  <th className="text-left p-3 font-bold text-gray-900">Dias sem atendimento</th>
                  <th className="text-left p-3 font-bold text-gray-900">Responsável</th>
                  <th className="text-left p-3 font-bold text-gray-900">Observação</th>
                </tr>
              </thead>

              <tbody className="text-gray-800">
                {linhas.length === 0 ? (
                  <tr>
                    <td className="p-3 text-gray-700" colSpan={6}>
                      Nenhum registro encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  linhas.map((l) => (
                    <tr key={l.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-900">{l.data}</td>
                      <td className="p-3 text-gray-800">{l.empresa?.nome || '-'}</td>
                      <td className="p-3">
                        <span
                          className={[
                            'px-2 py-1 rounded-full text-xs font-bold',
                            l.status_operacao === 'Sim'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800',
                          ].join(' ')}
                        >
                          {l.status_operacao}
                        </span>
                      </td>
                      <td className="p-3 text-gray-800">{formatDias(l.dias_sem_atendimento)}</td>
                      <td className="p-3 text-gray-800">{l.responsavel}</td>
                      <td className="p-3 text-gray-800">{l.observacao || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
