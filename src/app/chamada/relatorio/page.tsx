'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Linha = {
  agente_id: string
  nome: string
  status_agente: string
  data_registro: string
  tipo: string
  created_at: string
}

// ✅ inclui plantão
const TIPOS = [
  'Presente',
  'Plantão Final de Semana',
  'Folga',
  'Férias',
  'Atestado',
  'Afastado',
  'Licença Maternidade',
  'Licença Paternidade',
  'Ausente',
] as const
type Tipo = (typeof TIPOS)[number]

export default function RelatoriosPage() {
  const hojeISO = new Date().toISOString().slice(0, 10)
  const [dataIni, setDataIni] = useState(hojeISO)
  const [dataFim, setDataFim] = useState(hojeISO)
  const [tiposSelecionados, setTiposSelecionados] = useState<Tipo[]>([...TIPOS])
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(false)

  // filtro por nome
  const [q, setQ] = useState('')

  const tipoMarcado = (t: Tipo) => tiposSelecionados.includes(t)
  const toggleTipo = (t: Tipo) =>
    setTiposSelecionados(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    )

  function selecionarSomentePlantoes() {
    setTiposSelecionados(['Plantão Final de Semana'])
  }

  function selecionarTodos() {
    setTiposSelecionados([...TIPOS])
  }

  function atalhoHoje() {
    const d = new Date().toISOString().slice(0, 10)
    setDataIni(d)
    setDataFim(d)
  }
  function atalhoSemana() {
    const d = new Date()
    const diaSemana = d.getDay() || 7
    const inicio = new Date(d)
    inicio.setDate(d.getDate() - (diaSemana - 1))
    const fim = new Date(inicio)
    fim.setDate(inicio.getDate() + 6)
    setDataIni(inicio.toISOString().slice(0, 10))
    setDataFim(fim.toISOString().slice(0, 10))
  }
  function atalhoMes() {
    const d = new Date()
    const inicio = new Date(d.getFullYear(), d.getMonth(), 1)
    const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    setDataIni(inicio.toISOString().slice(0, 10))
    setDataFim(fim.toISOString().slice(0, 10))
  }

  async function buscar() {
    setCarregando(true)
    try {
      const { data, error } = await supabase
        .from('presencas')
        .select(
          `
          agente_id,
          data_registro,
          tipo,
          created_at,
          agentes (
            nome,
            status
          )
        `
        )
        .gte('data_registro', dataIni)
        .lte('data_registro', dataFim)

      if (error) throw error

      const filtradas = (data ?? []).filter((p: any) =>
        tiposSelecionados.includes(p.tipo)
      )

      const linhasFmt: Linha[] = filtradas.map((p: any) => ({
        agente_id: p.agente_id,
        nome: p.agentes?.nome ?? '(sem nome)',
        status_agente: p.agentes?.status ?? '-',
        data_registro: p.data_registro,
        tipo: p.tipo,
        created_at: p.created_at,
      }))

      linhasFmt.sort((a, b) => {
        if (a.created_at && b.created_at) return b.created_at.localeCompare(a.created_at)
        return b.data_registro.localeCompare(a.data_registro)
      })

      setLinhas(linhasFmt)
    } catch (e: any) {
      alert('Erro ao buscar: ' + e.message)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    buscar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function corTipo(tipo: string) {
    switch (tipo) {
      case 'Presente': return '#46a049'
      case 'Plantão Final de Semana': return '#7c3aed' // ✅ roxo
      case 'Folga': return '#42a5f5'
      case 'Férias': return '#f19a37'
      case 'Atestado': return '#e53935'
      case 'Afastado': return '#9c27b0'
      case 'Licença Maternidade': return '#ff4081'
      case 'Licença Paternidade': return '#5c6bc0'
      case 'Ausente': return '#757575'
      default: return '#000'
    }
  }

  function norm(s: string) {
    return (s || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
  }

  const linhasVisiveis = useMemo(() => {
    if (!q.trim()) return linhas
    const nq = norm(q)
    return linhas.filter(l => norm(l.nome).includes(nq))
  }, [linhas, q])

  function csvEscape(value: string) {
    return `"${(value ?? '').replace(/"/g, '""')}"`
  }

  function exportarCSV() {
    if (!linhasVisiveis.length) {
      alert('Não há dados para exportar.')
      return
    }
    const headers = ['Data', 'Nome', 'Status agente', 'Tipo', 'Criado em']
    const linhasCSV = linhasVisiveis.map(l =>
      [
        l.data_registro,
        l.nome,
        l.status_agente,
        l.tipo,
        l.created_at ? new Date(l.created_at).toLocaleString('pt-BR') : '',
      ]
        .map(csvEscape)
        .join(';')
    )
    const conteudo = '\uFEFF' + [headers.join(';'), ...linhasCSV].join('\r\n')
    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio_${dataIni}_a_${dataFim}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* FILTROS */}
        <div className="rounded-xl bg-white p-6 shadow space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Data inicial</label>
              <input
                type="date"
                className="w-full rounded-lg border p-2 text-black"
                value={dataIni}
                onChange={e => setDataIni(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Data final</label>
              <input
                type="date"
                className="w-full rounded-lg border p-2 text-black"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={atalhoHoje}
                className="rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white"
              >
                Hoje
              </button>
              <button
                onClick={atalhoSemana}
                className="rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white"
              >
                Semana
              </button>
              <button
                onClick={atalhoMes}
                className="rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white"
              >
                Mês
              </button>
            </div>
          </div>

          {/* Filtro por nome */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar por nome do agente…"
              className="w-full md:w-96 rounded-lg border p-2 text-black"
            />
            {q && (
              <button
                onClick={() => setQ('')}
                className="rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                title="Limpar busca"
              >
                Limpar
              </button>
            )}
            <span className="ml-auto text-xs text-gray-500">
              {linhasVisiveis.length} de {linhas.length} registros
            </span>
          </div>

          {/* Tipos + Atalhos */}
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Tipos:</span>

            {TIPOS.map(t => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={tipoMarcado(t)} onChange={() => toggleTipo(t)} />
                <span className="font-medium" style={{ color: corTipo(t) }}>
                  {t}
                </span>
              </label>
            ))}

            <div className="ml-auto flex flex-wrap gap-2">
              <button
                onClick={selecionarSomentePlantoes}
                className="rounded-lg border border-[#7c3aed] px-3 py-2 text-sm font-semibold text-[#7c3aed] hover:bg-[#7c3aed] hover:text-white"
                title="Filtrar apenas Plantão Final de Semana"
              >
                Somente Plantões
              </button>

              <button
                onClick={selecionarTodos}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                title="Marcar todos os tipos"
              >
                Selecionar todos
              </button>

              <button
                onClick={buscar}
                disabled={carregando}
                className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {carregando ? 'Buscando…' : 'Aplicar filtros'}
              </button>

              <button
                onClick={exportarCSV}
                disabled={!linhasVisiveis.length}
                className="rounded-lg border border-[#2687e2] px-4 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white disabled:opacity-40"
                title={linhasVisiveis.length ? 'Exportar resultados em CSV' : 'Sem dados para exportar'}
              >
                Exportar CSV
              </button>
            </div>
          </div>
        </div>

        {/* TABELA */}
        <div className="rounded-xl bg-white p-6 shadow">
          {linhasVisiveis.length === 0 ? (
            <p className="text-gray-500">Nenhum registro no período selecionado.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-sm text-gray-600">
                    <th className="border-b p-2">Data</th>
                    <th className="border-b p-2">Nome</th>
                    <th className="border-b p-2">Status agente</th>
                    <th className="border-b p-2">Tipo</th>
                    <th className="border-b p-2">Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasVisiveis.map((l, i) => (
                    <tr key={i} className="text-sm">
                      <td className="border-b p-2 text-black">{l.data_registro}</td>
                      <td className="border-b p-2 text-gray-700 font-medium">{l.nome}</td>
                      <td className="border-b p-2 text-gray-600">{l.status_agente}</td>
                      <td className="border-b p-2 font-semibold" style={{ color: corTipo(l.tipo) }}>
                        {l.tipo}
                      </td>
                      <td className="border-b p-2 text-gray-600">
                        {l.created_at ? new Date(l.created_at).toLocaleString('pt-BR') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
