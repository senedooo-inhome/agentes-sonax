'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Empresa = {
  id: string
  nome: string
}

type Linha = {
  id: number
  data: string
  empresa_id: string
  status_operacao: string
  quem_adicionou: string | null
  responsavel_ura: string | null
  observacao: string | null
  feriado: string | null
  created_at?: string | null
  empresa: { nome: string } | null
}

export default function OperacaoEmpresaRelatorioPage() {
  const hoje = new Date().toISOString().slice(0, 10)

  const [filtros, setFiltros] = useState({
    dataInicio: hoje.slice(0, 8) + '01',
    dataFim: hoje,
    empresaId: 'todas',
    status: 'todos',
    feriado: '',
    quemAdicionou: '',
    responsavelUra: '',
  })

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(false)

  const resumo = useMemo(() => {
    const total = linhas.length
    const sim = linhas.filter((l) => String(l.status_operacao).toLowerCase() === 'sim').length
    const nao = linhas.filter((l) => {
      const v = String(l.status_operacao).toLowerCase()
      return v === 'não' || v === 'nao'
    }).length
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

      setEmpresas(((data as any) || []) as Empresa[])
    }

    carregarEmpresas()
  }, [])

  async function buscar() {
    try {
      setCarregando(true)

      let q = supabase
        .from('operacao_empresas')
        .select(
          `
          id,
          data,
          empresa_id,
          status_operacao,
          quem_adicionou,
          responsavel_ura,
          observacao,
          feriado,
          created_at,
          empresa:empresas ( nome )
        `,
        )
        .gte('data', filtros.dataInicio)
        .lte('data', filtros.dataFim)
        .order('data', { ascending: false })

      if (filtros.empresaId !== 'todas') q = q.eq('empresa_id', filtros.empresaId)
      if (filtros.status !== 'todos') q = q.eq('status_operacao', filtros.status)

      if (filtros.feriado.trim()) q = q.ilike('feriado', `%${filtros.feriado.trim()}%`)
      if (filtros.quemAdicionou.trim())
        q = q.ilike('quem_adicionou', `%${filtros.quemAdicionou.trim()}%`)
      if (filtros.responsavelUra.trim())
        q = q.ilike('responsavel_ura', `%${filtros.responsavelUra.trim()}%`)

      const { data, error } = await q
      if (error) throw error

      setLinhas(((data as any) || []) as Linha[])
    } catch (err: any) {
      console.error(err)
      alert('Erro ao buscar relatório: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCarregando(false)
    }
  }

  function exportarCSV() {
    if (!linhas.length) {
      alert('Não há dados para exportar.')
      return
    }

    const headers = [
      'Data',
      'Empresa',
      'Feriado',
      'Call Center vai atender?',
      'Quem adicionou',
      'Responsável pela URA',
      'Observação',
      'Criado em',
    ]

    const linhasCSV = linhas.map((l) =>
      [
        l.data,
        l.empresa?.nome || '',
        l.feriado || '',
        l.status_operacao || '',
        l.quem_adicionou || '',
        l.responsavel_ura || '',
        l.observacao || '',
        l.created_at || '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(';'),
    )

    const conteudo = '\uFEFF' + [headers.join(';'), ...linhasCSV].join('\r\n')
    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio_operacao_${filtros.dataInicio}_a_${filtros.dataFim}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Card filtros */}
        <div className="rounded-xl bg-white p-6 shadow space-y-4">
          <h1 className="text-lg font-bold text-gray-800">Relatório — Operação por Empresa</h1>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#2687e2]">Data inicial</label>
              <input
                type="date"
                className="w-full rounded-lg border p-2 text-gray-800"
                value={filtros.dataInicio}
                onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#2687e2]">Data final</label>
              <input
                type="date"
                className="w-full rounded-lg border p-2 text-gray-800"
                value={filtros.dataFim}
                onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#2687e2]">Empresa</label>
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
              <label className="block text-sm font-semibold mb-1 text-[#2687e2]">Status</label>
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

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#2687e2]">Feriado</label>
              <input
                className="w-full rounded-lg border p-2 text-gray-800"
                placeholder="Ex.: Natal"
                value={filtros.feriado}
                onChange={(e) => setFiltros({ ...filtros, feriado: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#2687e2]">Quem adicionou</label>
              <input
                className="w-full rounded-lg border p-2 text-gray-800"
                placeholder="Ex.: Marco"
                value={filtros.quemAdicionou}
                onChange={(e) => setFiltros({ ...filtros, quemAdicionou: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#2687e2]">Responsável URA</label>
              <input
                className="w-full rounded-lg border p-2 text-gray-800"
                placeholder="Ex.: Fulano"
                value={filtros.responsavelUra}
                onChange={(e) => setFiltros({ ...filtros, responsavelUra: e.target.value })}
              />
            </div>

            <div className="flex items-end gap-3">
              <button
                onClick={buscar}
                disabled={carregando}
                className="rounded-lg bg-[#2687e2] px-5 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {carregando ? 'Buscando…' : 'Buscar'}
              </button>

              <button
                onClick={exportarCSV}
                disabled={linhas.length === 0}
                className="rounded-lg bg-gray-800 px-5 py-2 font-semibold text-white hover:bg-gray-900 disabled:opacity-50"
              >
                Exportar CSV
              </button>
            </div>

            <div className="flex items-end">
              <div className="text-sm font-semibold text-gray-800">
                Total: {resumo.total} &nbsp;&nbsp; Sim: {resumo.sim} &nbsp;&nbsp; Não: {resumo.nao}
              </div>
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
                  <th className="text-left p-3 font-bold text-gray-900">Feriado</th>
                  <th className="text-left p-3 font-bold text-gray-900">Call Center vai atender?</th>
                  <th className="text-left p-3 font-bold text-gray-900">Quem adicionou</th>
                  <th className="text-left p-3 font-bold text-gray-900">Responsável URA</th>
                  <th className="text-left p-3 font-bold text-gray-900">Observação</th>
                </tr>
              </thead>

              <tbody className="text-gray-800">
                {linhas.length === 0 ? (
                  <tr>
                    <td className="p-3 text-gray-700" colSpan={7}>
                      Nenhum registro encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  linhas.map((l) => (
                    <tr key={l.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-900">{l.data}</td>
                      <td className="p-3">{l.empresa?.nome || '-'}</td>
                      <td className="p-3">{l.feriado || '-'}</td>
                      <td className="p-3">
                        <span
                          className={[
                            'px-2 py-1 rounded-full text-xs font-bold',
                            String(l.status_operacao).toLowerCase() === 'sim'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800',
                          ].join(' ')}
                        >
                          {l.status_operacao}
                        </span>
                      </td>
                      <td className="p-3">{l.quem_adicionou || '-'}</td>
                      <td className="p-3">{l.responsavel_ura || '-'}</td>
                      <td className="p-3">{l.observacao || '-'}</td>
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
