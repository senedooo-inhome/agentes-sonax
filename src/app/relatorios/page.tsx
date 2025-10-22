'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Linha = {
  agente_id: string
  nome: string
  status_agente: string
  data_registro: string
  tipo: string
}

const TIPOS = ['Presente', 'Saiu cedo', 'Folga'] as const
type Tipo = typeof TIPOS[number]

export default function RelatoriosPage() {
  const hojeISO = new Date().toISOString().slice(0, 10)
  const [dataIni, setDataIni] = useState(hojeISO)
  const [dataFim, setDataFim] = useState(hojeISO)
  const [tiposSelecionados, setTiposSelecionados] = useState<Tipo[]>([...TIPOS])
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(false)

  const tipoMarcado = (t: Tipo) => tiposSelecionados.includes(t)
  const toggleTipo = (t: Tipo) =>
    setTiposSelecionados(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    )

  function atalhoHoje() {
    const d = new Date().toISOString().slice(0, 10)
    setDataIni(d); setDataFim(d)
  }
  function atalhoSemana() {
    const d = new Date()
    const diaSemana = d.getDay() || 7
    const inicio = new Date(d); inicio.setDate(d.getDate() - (diaSemana - 1))
    const fim = new Date(inicio); fim.setDate(inicio.getDate() + 6)
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
        .select(`
          agente_id,
          data_registro,
          tipo,
          agentes (
            nome,
            status
          )
        `)
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
      }))

      linhasFmt.sort((a, b) =>
        a.data_registro === b.data_registro
          ? a.nome.localeCompare(b.nome)
          : b.data_registro.localeCompare(a.data_registro)
      )

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
      case 'Saiu cedo': return '#f19a37'
      case 'Folga': return '#42a5f5'
      default: return '#000'
    }
  }

  // --------- EXPORTAÇÃO CSV ----------
  function csvEscape(value: string) {
    // coloca aspas e escapa aspas internas => Excel/Sheets friendly
    return `"${(value ?? '').replace(/"/g, '""')}"`
  }

  function exportarCSV() {
    if (!linhas.length) {
      alert('Não há dados para exportar.')
      return
    }
    const headers = ['Data', 'Nome', 'Status agente', 'Tipo']
    const linhasCSV = linhas.map(l =>
      [l.data_registro, l.nome, l.status_agente, l.tipo].map(csvEscape).join(';')
    )
    // BOM para acentuação correta no Excel (UTF-8)
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
  // -----------------------------------

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* HEADER padronizado */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#2687e2]">Relatórios</h1>
          <div className="flex gap-2">
            <a
              href="/"
              className="rounded-lg bg-[#2687e2] px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600"
            >
              Cadastro
            </a>
            <a
              href="/chamada"
              className="rounded-lg bg-[#2687e2] px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600"
            >
              Chamada
            </a>
            <span
              className="rounded-lg bg-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 cursor-default"
              aria-current="page"
            >
              Relatórios
            </span>
          </div>
        </div>

        {/* FILTROS */}
        <div className="rounded-xl bg-white p-6 shadow">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Data inicial</label>
              <input
                type="date"
                className="w-full rounded-lg border p-2 text-black"
                value={dataIni}
                onChange={(e) => setDataIni(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Data final</label>
              <input
                type="date"
                className="w-full rounded-lg border p-2 text-black"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <button onClick={atalhoHoje}
                className="rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white">
                Hoje
              </button>
              <button onClick={atalhoSemana}
                className="rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white">
                Semana
              </button>
              <button onClick={atalhoMes}
                className="rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white">
                Mês
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Tipos:</span>
            {TIPOS.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={tipoMarcado(t)}
                  onChange={() => toggleTipo(t)}
                />
                <span className="font-medium" style={{ color: corTipo(t) }}>
                  {t}
                </span>
              </label>
            ))}

            <div className="ml-auto flex gap-2">
              <button
                onClick={buscar}
                disabled={carregando}
                className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {carregando ? 'Buscando…' : 'Aplicar filtros'}
              </button>

              <button
                onClick={exportarCSV}
                disabled={!linhas.length}
                className="rounded-lg border border-[#2687e2] px-4 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white disabled:opacity-40"
                title={linhas.length ? 'Exportar resultados em CSV' : 'Sem dados para exportar'}
              >
                Exportar CSV
              </button>
            </div>
          </div>
        </div>

        {/* TABELA */}
        <div className="rounded-xl bg-white p-6 shadow">
          {linhas.length === 0 ? (
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
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={i} className="text-sm">
                      <td className="border-b p-2 text-black">{l.data_registro}</td>
                      <td className="border-b p-2 text-gray-700 font-medium">{l.nome}</td>
                      <td className="border-b p-2 text-gray-600">{l.status_agente}</td>
                      <td className="border-b p-2 font-semibold" style={{ color: corTipo(l.tipo) }}>
                        {l.tipo}
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
