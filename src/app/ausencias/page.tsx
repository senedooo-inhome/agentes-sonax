'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type RegistroAfast = {
  id: number
  nome: string
  data_inicio: string
  data_fim: string
  segmento: 'Férias' | 'Atestado' | 'Afastamento' | 'Outros'
  observacao: string | null
  criado_em: string
}

const segmentos = ['Férias', 'Atestado', 'Afastamento', 'Outros'] as const
type Segmento = (typeof segmentos)[number]

function dataHoje() {
  return new Date().toISOString().slice(0, 10)
}

export default function AfastamentosPage() {
  // 🔐 controle de permissão
  const [isSupervisor, setIsSupervisor] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  // formulário
  const [nome, setNome] = useState('')
  const [dataInicio, setDataInicio] = useState(dataHoje())
  const [dataFim, setDataFim] = useState(dataHoje())
  const [segmento, setSegmento] = useState<Segmento>('Férias')
  const [observacao, setObservacao] = useState('')

  // lista / filtros
  const [registros, setRegistros] = useState<RegistroAfast[]>([])
  const [buscaNome, setBuscaNome] = useState('')
  const [filtroSegmento, setFiltroSegmento] = useState<Segmento | 'Todos'>('Todos')
  const [filtroDataIni, setFiltroDataIni] = useState<string>('')
  const [filtroDataFim, setFiltroDataFim] = useState<string>('')

  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // 🔐 verifica se é supervisão
  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getSession()
      const email = data.session?.user?.email
      setIsSupervisor(email === 'supervisao@sonax.net.br')
      setAuthChecked(true)
    }
    check()
  }, [])

  // carrega registros
  useEffect(() => {
    if (!authChecked) return
    buscarRegistros()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked])

  async function buscarRegistros() {
    try {
      setCarregando(true)

      let query = supabase
        .from('afastamentos') // 👉 nome da tabela que criamos no SQL
        .select('*')
        .order('data_inicio', { ascending: false })

      if (filtroDataIni) query = query.gte('data_inicio', filtroDataIni)
      if (filtroDataFim) query = query.lte('data_fim', filtroDataFim)
      if (filtroSegmento !== 'Todos') query = query.eq('segmento', filtroSegmento)

      const { data, error } = await query
      if (error) throw error
      setRegistros((data ?? []) as RegistroAfast[])
    } catch (e: any) {
      alert('Erro ao buscar afastamentos: ' + e.message)
    } finally {
      setCarregando(false)
    }
  }

  // 🔐 cadastra só se for supervisão
  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    if (!isSupervisor) {
      alert('Somente a supervisão pode cadastrar afastamentos.')
      return
    }

    if (!nome.trim()) {
      alert('Informe o nome completo.')
      return
    }
    if (!dataInicio || !dataFim) {
      alert('Informe datas de início e fim.')
      return
    }

    try {
      setSalvando(true)
      const { error } = await supabase.from('afastamentos').insert([
        {
          nome: nome.trim(),
          data_inicio: dataInicio,
          data_fim: dataFim,
          segmento,
          observacao: observacao.trim() || null,
        },
      ])
      if (error) throw error

      // limpa e recarrega
      setNome('')
      setDataInicio(dataHoje())
      setDataFim(dataHoje())
      setSegmento('Férias')
      setObservacao('')
      await buscarRegistros()
    } catch (e: any) {
      alert('Erro ao salvar: ' + e.message)
    } finally {
      setSalvando(false)
    }
  }

  // 🔽 filtrar em memória por nome
  const registrosFiltrados = useMemo(() => {
    const norm = (s: string) =>
      s
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()

    if (!buscaNome.trim()) return registros
    const b = norm(buscaNome)
    return registros.filter(r => norm(r.nome).includes(b))
  }, [registros, buscaNome])

  // 📤 exportar CSV/Excel
  function exportarCSV() {
    if (!registrosFiltrados.length) {
      alert('Não há dados para exportar.')
      return
    }

    const csvEscape = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`

    const cabecalho = [
      'Nome',
      'Data início',
      'Data fim',
      'Segmento',
      'Observação',
      'Criado em',
    ]

    const linhas = registrosFiltrados.map(r =>
      [
        csvEscape(r.nome),
        csvEscape(r.data_inicio),
        csvEscape(r.data_fim),
        csvEscape(r.segmento),
        csvEscape(r.observacao ?? ''),
        csvEscape(r.criado_em),
      ].join(';'),
    )

    const conteudo = '\uFEFF' + [cabecalho.join(';'), ...linhas].join('\r\n')
    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'afastamentos.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
      

        {/* FORMULÁRIO – só aparece completo para supervisão */}
        <div className="rounded-xl bg-white p-6 shadow space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-[#2687e2]">Cadastro de afastamento</h2>
            {!isSupervisor && (
              <span className="text-xs text-gray-500">
                Você está em modo <b>visualização</b>. Apenas a supervisão pode cadastrar.
              </span>
            )}
          </div>

          {isSupervisor && (
            <form onSubmit={handleSalvar} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">
                  Nome completo
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border p-2 text-black"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Nome do colaborador"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">
                    Data de início
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-lg border p-2 text-black"
                    value={dataInicio}
                    onChange={e => setDataInicio(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">
                    Data de fim
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-lg border p-2 text-black"
                    value={dataFim}
                    onChange={e => setDataFim(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">
                    Segmento
                  </label>
                  <select
                    className="w-full rounded-lg border p-2 text-black"
                    value={segmento}
                    onChange={e => setSegmento(e.target.value as Segmento)}
                  >
                    {segmentos.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">
                  Observação
                </label>
                <textarea
                  className="w-full rounded-lg border p-2 text-black"
                  rows={3}
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                  placeholder="Detalhes, CID do atestado, período parcial, etc."
                />
              </div>

              <button
                type="submit"
                disabled={salvando}
                className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {salvando ? 'Salvando…' : 'Cadastrar afastamento'}
              </button>
            </form>
          )}
        </div>

        {/* FILTROS + LISTA (todos podem ver) */}
        <div className="rounded-xl bg-white p-6 shadow space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-700">
                Buscar por nome
              </label>
              <input
                type="text"
                className="rounded-lg border p-2 text-black w-64"
                value={buscaNome}
                onChange={e => setBuscaNome(e.target.value)}
                placeholder="Digite o nome do agente"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-700">
                Segmento
              </label>
              <select
                className="rounded-lg border p-2 text-black"
                value={filtroSegmento}
                onChange={e => setFiltroSegmento(e.target.value as Segmento | 'Todos')}
              >
                <option value="Todos">Todos</option>
                {segmentos.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-700">
                Data início (filtro)
              </label>
              <input
                type="date"
                className="rounded-lg border p-2 text-black"
                value={filtroDataIni}
                onChange={e => setFiltroDataIni(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-700">
                Data fim (filtro)
              </label>
              <input
                type="date"
                className="rounded-lg border p-2 text-black"
                value={filtroDataFim}
                onChange={e => setFiltroDataFim(e.target.value)}
              />
            </div>

            <button
              onClick={buscarRegistros}
              disabled={carregando}
              className="ml-auto rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {carregando ? 'Buscando…' : 'Aplicar filtros'}
            </button>

            <button
              onClick={exportarCSV}
              className="rounded-lg border border-[#2687e2] px-4 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white"
            >
              Exportar Excel
            </button>
          </div>

          {registrosFiltrados.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhum afastamento encontrado.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-black">
                    <th className="border-b p-2">Nome</th>
                    <th className="border-b p-2">Início</th>
                    <th className="border-b p-2">Fim</th>
                    <th className="border-b p-2">Segmento</th>
                    <th className="border-b p-2">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.map(r => (
                    <tr key={r.id} className="text-black">
                      <td className="border-b p-2 text-black ">{r.nome}</td>
                      <td className="border-b p-2">{r.data_inicio}</td>
                      <td className="border-b p-2">{r.data_fim}</td>
                      <td className="border-b p-2">{r.segmento}</td>
                      <td className="border-b p-2">{r.observacao}</td>
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
