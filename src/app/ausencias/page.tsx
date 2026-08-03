'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

type Agente = { id: string | number; nome: string }

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

  // agentes do Supabase
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [carregandoAgentes, setCarregandoAgentes] = useState(false)
  const [buscaAgente, setBuscaAgente] = useState('')
  const [mostrarListaAgentes, setMostrarListaAgentes] = useState(false)
  const agenteRef = useRef<HTMLDivElement>(null)

  const [buscaAgenteEdicao, setBuscaAgenteEdicao] = useState('')
  const [mostrarListaAgentesEdicao, setMostrarListaAgentesEdicao] = useState(false)
  const agenteEdicaoRef = useRef<HTMLDivElement>(null)

  // lista / filtros
  const [registros, setRegistros] = useState<RegistroAfast[]>([])
  const [buscaNome, setBuscaNome] = useState('')
  const [filtroSegmento, setFiltroSegmento] = useState<Segmento | 'Todos'>('Todos')
  const [filtroDataIni, setFiltroDataIni] = useState<string>('')
  const [filtroDataFim, setFiltroDataFim] = useState<string>('')

  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // edição / exclusão
  const [registroEditando, setRegistroEditando] = useState<RegistroAfast | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editDataInicio, setEditDataInicio] = useState('')
  const [editDataFim, setEditDataFim] = useState('')
  const [editSegmento, setEditSegmento] = useState<Segmento>('Férias')
  const [editObservacao, setEditObservacao] = useState('')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [excluindoId, setExcluindoId] = useState<number | null>(null)

  async function carregarAgentes() {
    try {
      setCarregandoAgentes(true)

      const { data, error } = await supabase
        .from('agentes')
        .select('id, nome')
        .order('nome', { ascending: true })

      if (error) throw error

      setAgentes(((data ?? []) as Agente[]).filter((agente) => agente.nome?.trim()))
    } catch (e: any) {
      alert('Erro ao carregar agentes: ' + (e?.message || 'Erro desconhecido'))
    } finally {
      setCarregandoAgentes(false)
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const alvo = event.target as Node

      if (agenteRef.current && !agenteRef.current.contains(alvo)) {
        setMostrarListaAgentes(false)
      }

      if (agenteEdicaoRef.current && !agenteEdicaoRef.current.contains(alvo)) {
        setMostrarListaAgentesEdicao(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMostrarListaAgentes(false)
        setMostrarListaAgentesEdicao(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

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
    carregarAgentes()
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
      setBuscaAgente('')
      setMostrarListaAgentes(false)
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

  function abrirEdicao(registro: RegistroAfast) {
    if (!isSupervisor) {
      alert('Somente a supervisão pode editar afastamentos.')
      return
    }

    setRegistroEditando(registro)
    setEditNome(registro.nome)
    setBuscaAgenteEdicao(registro.nome)
    setEditDataInicio(registro.data_inicio)
    setEditDataFim(registro.data_fim)
    setEditSegmento(registro.segmento)
    setEditObservacao(registro.observacao ?? '')
  }

  function fecharEdicao() {
    if (salvandoEdicao) return
    setRegistroEditando(null)
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault()

    if (!isSupervisor || !registroEditando) return

    if (!editNome.trim()) {
      alert('Informe o nome completo.')
      return
    }

    if (!editDataInicio || !editDataFim) {
      alert('Informe as datas de início e fim.')
      return
    }

    if (editDataFim < editDataInicio) {
      alert('A data final não pode ser anterior à data inicial.')
      return
    }

    try {
      setSalvandoEdicao(true)

      const { error } = await supabase
        .from('afastamentos')
        .update({
          nome: editNome.trim(),
          data_inicio: editDataInicio,
          data_fim: editDataFim,
          segmento: editSegmento,
          observacao: editObservacao.trim() || null,
        })
        .eq('id', registroEditando.id)

      if (error) throw error

      setRegistroEditando(null)
      await buscarRegistros()
      alert('Afastamento atualizado com sucesso!')
    } catch (e: any) {
      alert('Erro ao atualizar: ' + e.message)
    } finally {
      setSalvandoEdicao(false)
    }
  }

  async function excluirRegistro(registro: RegistroAfast) {
    if (!isSupervisor) {
      alert('Somente a supervisão pode excluir afastamentos.')
      return
    }

    const confirmar = window.confirm(
      `Deseja realmente excluir o afastamento de ${registro.nome}?`,
    )

    if (!confirmar) return

    try {
      setExcluindoId(registro.id)

      const { error } = await supabase
        .from('afastamentos')
        .delete()
        .eq('id', registro.id)

      if (error) throw error

      setRegistros(atual => atual.filter(item => item.id !== registro.id))
      alert('Afastamento excluído com sucesso!')
    } catch (e: any) {
      alert('Erro ao excluir: ' + e.message)
    } finally {
      setExcluindoId(null)
    }
  }

  const agentesFiltrados = useMemo(() => {
    const termo = buscaAgente
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim()

    if (!termo) return agentes

    return agentes.filter((agente) =>
      agente.nome
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .includes(termo),
    )
  }, [agentes, buscaAgente])

  const agentesFiltradosEdicao = useMemo(() => {
    const termo = buscaAgenteEdicao
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim()

    if (!termo) return agentes

    return agentes.filter((agente) =>
      agente.nome
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .includes(termo),
    )
  }, [agentes, buscaAgenteEdicao])

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
              <div ref={agenteRef} className="relative">
                <label className="block text-sm font-semibold mb-1 text-gray-700">
                  Nome completo
                </label>

                <input
                  type="text"
                  className="w-full rounded-lg border p-2 text-black disabled:opacity-60"
                  value={buscaAgente}
                  onChange={e => {
                    setBuscaAgente(e.target.value)
                    setNome('')
                    setMostrarListaAgentes(true)
                  }}
                  onFocus={() => setMostrarListaAgentes(true)}
                  placeholder={
                    carregandoAgentes
                      ? 'Carregando agentes...'
                      : 'Buscar e selecionar agente'
                  }
                  autoComplete="off"
                  disabled={carregandoAgentes}
                />

                {nome && (
                  <p className="mt-1 text-xs font-medium text-green-700">
                    Selecionado: {nome}
                  </p>
                )}

                {mostrarListaAgentes && !carregandoAgentes && (
                  <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-white shadow-lg">
                    {agentesFiltrados.length ? (
                      agentesFiltrados.map(agente => (
                        <button
                          key={String(agente.id)}
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            setNome(agente.nome)
                            setBuscaAgente(agente.nome)
                            setMostrarListaAgentes(false)
                          }}
                          className="block w-full border-b px-3 py-2 text-left text-sm text-black hover:bg-blue-50 last:border-b-0"
                        >
                          {agente.nome}
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-3 text-sm text-gray-500">
                        Nenhum agente encontrado.
                      </p>
                    )}
                  </div>
                )}
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
                    {isSupervisor && <th className="border-b p-2">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.map(r => (
                    <tr key={r.id} className="text-black">
                      <td className="border-b p-2 text-black ">{r.nome}</td>
                      <td className="border-b p-2">{r.data_inicio}</td>
                      <td className="border-b p-2">{r.data_fim}</td>
                      <td className="border-b p-2">{r.segmento}</td>
                      <td className="border-b p-2">{r.observacao || '-'}</td>
                      {isSupervisor && (
                        <td className="border-b p-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => abrirEdicao(r)}
                              className="rounded-lg border border-[#2687e2] px-3 py-1.5 text-xs font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => excluirRegistro(r)}
                              disabled={excluindoId === r.id}
                              className="rounded-lg border border-red-500 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500 hover:text-white disabled:opacity-50"
                            >
                              {excluindoId === r.id ? 'Excluindo…' : 'Excluir'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

        {registroEditando && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-[#2687e2]">Editar afastamento</h2>
                <button
                  type="button"
                  onClick={fecharEdicao}
                  disabled={salvandoEdicao}
                  className="rounded-lg px-3 py-1 text-2xl leading-none text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>

              <form onSubmit={salvarEdicao} className="space-y-4">
                <div ref={agenteEdicaoRef} className="relative">
                  <label className="mb-1 block text-sm font-semibold text-gray-700">
                    Nome completo
                  </label>

                  <input
                    type="text"
                    value={buscaAgenteEdicao}
                    onChange={e => {
                      setBuscaAgenteEdicao(e.target.value)
                      setEditNome('')
                      setMostrarListaAgentesEdicao(true)
                    }}
                    onFocus={() => setMostrarListaAgentesEdicao(true)}
                    className="w-full rounded-lg border p-2 text-black disabled:opacity-60"
                    placeholder={
                      carregandoAgentes
                        ? 'Carregando agentes...'
                        : 'Buscar e selecionar agente'
                    }
                    autoComplete="off"
                    disabled={carregandoAgentes}
                    required
                  />

                  {editNome && (
                    <p className="mt-1 text-xs font-medium text-green-700">
                      Selecionado: {editNome}
                    </p>
                  )}

                  {mostrarListaAgentesEdicao && !carregandoAgentes && (
                    <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-white shadow-lg">
                      {agentesFiltradosEdicao.length ? (
                        agentesFiltradosEdicao.map(agente => (
                          <button
                            key={String(agente.id)}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              setEditNome(agente.nome)
                              setBuscaAgenteEdicao(agente.nome)
                              setMostrarListaAgentesEdicao(false)
                            }}
                            className="block w-full border-b px-3 py-2 text-left text-sm text-black hover:bg-blue-50 last:border-b-0"
                          >
                            {agente.nome}
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-3 text-sm text-gray-500">
                          Nenhum agente encontrado.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-gray-700">
                      Data de início
                    </label>
                    <input
                      type="date"
                      value={editDataInicio}
                      onChange={e => setEditDataInicio(e.target.value)}
                      className="w-full rounded-lg border p-2 text-black"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-gray-700">
                      Data de fim
                    </label>
                    <input
                      type="date"
                      value={editDataFim}
                      onChange={e => setEditDataFim(e.target.value)}
                      className="w-full rounded-lg border p-2 text-black"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-gray-700">
                      Segmento
                    </label>
                    <select
                      value={editSegmento}
                      onChange={e => setEditSegmento(e.target.value as Segmento)}
                      className="w-full rounded-lg border p-2 text-black"
                    >
                      {segmentos.map(item => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">
                    Observação
                  </label>
                  <textarea
                    rows={4}
                    value={editObservacao}
                    onChange={e => setEditObservacao(e.target.value)}
                    className="w-full rounded-lg border p-2 text-black"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={fecharEdicao}
                    disabled={salvandoEdicao}
                    className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={salvandoEdicao}
                    className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
                  >
                    {salvandoEdicao ? 'Salvando…' : 'Salvar alterações'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </main>
  )
}