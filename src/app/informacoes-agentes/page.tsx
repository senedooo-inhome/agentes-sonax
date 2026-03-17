'use client'

import { useEffect, useMemo, useState } from 'react'
import type { AgenteInfo, CargoAgente, NichoAgente } from '@/app/types/agente'
import { supabase } from '@/lib/supabaseClient'

const CARGOS: CargoAgente[] = [
  'TELEFONISTA',
  'SUPERVISOR',
  'LIDER',
  'CEO',
  'COORDENADOR',
]

const NICHOS: NichoAgente[] = ['SAC', 'CLINICA']

const MESES = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
] as const

type FormState = {
  nome_completo: string
  nome_abreviado: string
  carga_horaria: string
  cargo: '' | CargoAgente
  cep: string
  endereco: string
  cidade: string
  estado: string
  data_admissao: string
  data_nascimento: string
  dependentes: string
  nicho: '' | NichoAgente
  previsao_ferias: string
  dias_ferias: string
  ramal: string
  telefone: string
}

const emptyForm: FormState = {
  nome_completo: '',
  nome_abreviado: '',
  carga_horaria: '',
  cargo: '',
  cep: '',
  endereco: '',
  cidade: '',
  estado: '',
  data_admissao: '',
  data_nascimento: '',
  dependentes: '',
  nicho: '',
  previsao_ferias: '',
  dias_ferias: '',
  ramal: '',
  telefone: '',
}

type ViaCepResponse = {
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean
}

export default function InformacoesAgentesPage() {
  const [agentes, setAgentes] = useState<AgenteInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [openModal, setOpenModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  const [filtroCargo, setFiltroCargo] = useState('')
  const [filtroNicho, setFiltroNicho] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroAdmissaoAno, setFiltroAdmissaoAno] = useState('')
  const [filtroMesAniversario, setFiltroMesAniversario] = useState('')
  const [busca, setBusca] = useState('')

  async function carregarAgentes() {
    setLoading(true)

    const { data, error } = await supabase
      .from('informacoes_agentes')
      .select('*')
      .order('nome_completo', { ascending: true })

    if (error) {
      console.error(error)
      alert('Erro ao carregar agentes.')
    } else {
      setAgentes((data as AgenteInfo[]) || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    carregarAgentes()
  }, [])

  function handleChange<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function buscarCep(cep: string) {
    const cepLimpo = cep.replace(/\D/g, '')
    if (cepLimpo.length !== 8) return

    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
      const data: ViaCepResponse = await res.json()

      if (data.erro) {
        alert('CEP não encontrado.')
        return
      }

      setForm((prev) => ({
        ...prev,
        endereco: `${data.logradouro || ''}${data.bairro ? ` - ${data.bairro}` : ''}`.trim(),
        cidade: data.localidade || '',
        estado: data.uf || '',
      }))
    } catch (err) {
      console.error(err)
      alert('Erro ao buscar CEP.')
    }
  }

  function abrirNovo() {
    setEditingId(null)
    setForm(emptyForm)
    setOpenModal(true)
  }

  function abrirEdicao(agente: AgenteInfo) {
    setEditingId(agente.id)
    setForm({
      nome_completo: agente.nome_completo || '',
      nome_abreviado: agente.nome_abreviado || '',
      carga_horaria: agente.carga_horaria || '',
      cargo: agente.cargo || '',
      cep: agente.cep || '',
      endereco: agente.endereco || '',
      cidade: agente.cidade || '',
      estado: agente.estado || '',
      data_admissao: agente.data_admissao || '',
      data_nascimento: agente.data_nascimento || '',
      dependentes: String(agente.dependentes ?? ''),
      nicho: agente.nicho || '',
      previsao_ferias: agente.previsao_ferias || '',
      dias_ferias: String(agente.dias_ferias ?? ''),
      ramal: agente.ramal || '',
      telefone: agente.telefone || '',
    })
    setOpenModal(true)
  }

  async function salvarAgente() {
    if (!form.nome_completo.trim()) {
      alert('Preencha o nome completo.')
      return
    }

    setSaving(true)

    const payload = {
      nome_completo: form.nome_completo,
      nome_abreviado: form.nome_abreviado || null,
      carga_horaria: form.carga_horaria || null,
      cargo: form.cargo || null,
      cep: form.cep || null,
      endereco: form.endereco || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
      data_admissao: form.data_admissao || null,
      data_nascimento: form.data_nascimento || null,
      dependentes: form.dependentes ? Number(form.dependentes) : 0,
      nicho: form.nicho || null,
      previsao_ferias: form.previsao_ferias || null,
      dias_ferias: form.dias_ferias ? Number(form.dias_ferias) : null,
      ramal: form.ramal || null,
      telefone: form.telefone || null,
    }

    let error: Error | null = null

    if (editingId) {
      const result = await supabase
        .from('informacoes_agentes')
        .update(payload)
        .eq('id', editingId)

      error = result.error
    } else {
      const result = await supabase
        .from('informacoes_agentes')
        .insert(payload)

      error = result.error
    }

    setSaving(false)

    if (error) {
      console.error(error)
      alert('Erro ao salvar agente.')
      return
    }

    setOpenModal(false)
    setForm(emptyForm)
    setEditingId(null)
    await carregarAgentes()
  }

  async function excluirAgente(id: string) {
    const ok = confirm('Deseja excluir este agente?')
    if (!ok) return

    const { error } = await supabase
      .from('informacoes_agentes')
      .delete()
      .eq('id', id)

    if (error) {
      console.error(error)
      alert('Erro ao excluir.')
      return
    }

    await carregarAgentes()
  }

  const estados = useMemo(() => {
    return [
      ...new Set(
        agentes
          .map((a) => a.estado)
          .filter((uf): uf is string => !!uf)
      ),
    ].sort()
  }, [agentes])

  const anosAdmissao = useMemo(() => {
    return [
      ...new Set(
        agentes
          .map((a) => a.data_admissao?.slice(0, 4))
          .filter((ano): ano is string => !!ano)
      ),
    ].sort()
  }, [agentes])

  const agentesFiltrados = useMemo(() => {
    return agentes.filter((a) => {
      const texto = busca.toLowerCase()
      const mesNascimento = a.data_nascimento?.slice(5, 7) || ''

      const matchBusca =
        !texto ||
        a.nome_completo.toLowerCase().includes(texto) ||
        (a.nome_abreviado ?? '').toLowerCase().includes(texto) ||
        (a.cidade ?? '').toLowerCase().includes(texto)

      const matchCargo = !filtroCargo || a.cargo === filtroCargo
      const matchNicho = !filtroNicho || a.nicho === filtroNicho
      const matchEstado = !filtroEstado || a.estado === filtroEstado
      const matchAno =
        !filtroAdmissaoAno || a.data_admissao?.slice(0, 4) === filtroAdmissaoAno
      const matchMesAniversario =
        !filtroMesAniversario || mesNascimento === filtroMesAniversario

      return (
        matchBusca &&
        matchCargo &&
        matchNicho &&
        matchEstado &&
        matchAno &&
        matchMesAniversario
      )
    })
  }, [
    agentes,
    busca,
    filtroCargo,
    filtroNicho,
    filtroEstado,
    filtroAdmissaoAno,
    filtroMesAniversario,
  ])

  const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0')
  const mesSeguinte = String(((new Date().getMonth() + 1) % 12) + 1).padStart(2, '0')

  const aniversariantesDoMes = useMemo(() => {
    const mesBase = filtroMesAniversario || mesAtual

    return [...agentes]
      .filter((a) => a.data_nascimento?.slice(5, 7) === mesBase)
      .sort((a, b) => {
        const diaA = Number(a.data_nascimento?.slice(8, 10) || '0')
        const diaB = Number(b.data_nascimento?.slice(8, 10) || '0')
        return diaA - diaB
      })
  }, [agentes, filtroMesAniversario, mesAtual])

  const proximosAniversarios = useMemo(() => {
    return [...agentes]
      .filter((a) => a.data_nascimento?.slice(5, 7) === mesSeguinte)
      .sort((a, b) => {
        const diaA = Number(a.data_nascimento?.slice(8, 10) || '0')
        const diaB = Number(b.data_nascimento?.slice(8, 10) || '0')
        return diaA - diaB
      })
      .slice(0, 6)
  }, [agentes, mesSeguinte])

  const comemoracaoTempoServico = useMemo(() => {
    return [...agentes]
      .filter((a) => a.data_admissao?.slice(5, 7) === mesAtual)
      .sort((a, b) => {
        const diaA = Number(a.data_admissao?.slice(8, 10) || '0')
        const diaB = Number(b.data_admissao?.slice(8, 10) || '0')
        return diaA - diaB
      })
  }, [agentes, mesAtual])

  const proximasComemoracoes = useMemo(() => {
    return [...agentes]
      .filter((a) => a.data_admissao?.slice(5, 7) === mesSeguinte)
      .sort((a, b) => {
        const diaA = Number(a.data_admissao?.slice(8, 10) || '0')
        const diaB = Number(b.data_admissao?.slice(8, 10) || '0')
        return diaA - diaB
      })
      .slice(0, 6)
  }, [agentes, mesSeguinte])

  const totalAgentes = agentesFiltrados.length
  const totalSac = agentesFiltrados.filter((a) => a.nicho === 'SAC').length
  const totalClinica = agentesFiltrados.filter((a) => a.nicho === 'CLINICA').length
  const totalDependentes = agentesFiltrados.reduce((acc, item) => acc + (item.dependentes || 0), 0)

  const nomeMesAniversarioSelecionado =
    MESES.find((mes) => mes.value === (filtroMesAniversario || mesAtual))?.label || 'Mês atual'

  const nomeMesSeguinte =
    MESES.find((mes) => mes.value === mesSeguinte)?.label || 'Próximo mês'

  return (
    <main className="min-h-screen bg-[#ddf1ff] p-6">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
        <div className="rounded-[28px] border border-[#bfe3fb] bg-white/80 p-6 shadow-[0_12px_40px_rgba(40,163,254,0.10)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-wide text-[#1d1d1f] md:text-5xl">
                INFORMAÇÕES DE OPERADORES
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Cadastro, consulta e filtros inteligentes dos agentes.
              </p>
            </div>

            <button
              onClick={abrirNovo}
              className="rounded-2xl bg-[#28a3fe] px-5 py-3 text-sm font-semibold text-white shadow hover:opacity-95"
            >
              + Novo Agente
            </button>
          </div>
        </div>

        <section className="rounded-[28px] border border-[#bfe3fb] bg-white p-5 shadow-[0_12px_35px_rgba(40,163,254,0.08)]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, abreviação ou cidade"
              className="rounded-2xl border border-[#cde9fb] px-4 py-3 outline-none focus:border-[#28a3fe]"
            />

            <select
              value={filtroCargo}
              onChange={(e) => setFiltroCargo(e.target.value)}
              className="rounded-2xl border border-[#cde9fb] px-4 py-3 outline-none focus:border-[#28a3fe]"
            >
              <option value="">Todos os cargos</option>
              {CARGOS.map((cargo) => (
                <option key={cargo} value={cargo}>
                  {cargo}
                </option>
              ))}
            </select>

            <select
              value={filtroNicho}
              onChange={(e) => setFiltroNicho(e.target.value)}
              className="rounded-2xl border border-[#cde9fb] px-4 py-3 outline-none focus:border-[#28a3fe]"
            >
              <option value="">Todos os nichos</option>
              {NICHOS.map((nicho) => (
                <option key={nicho} value={nicho}>
                  {nicho}
                </option>
              ))}
            </select>

            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="rounded-2xl border border-[#cde9fb] px-4 py-3 outline-none focus:border-[#28a3fe]"
            >
              <option value="">Todos os estados</option>
              {estados.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>

            <select
              value={filtroAdmissaoAno}
              onChange={(e) => setFiltroAdmissaoAno(e.target.value)}
              className="rounded-2xl border border-[#cde9fb] px-4 py-3 outline-none focus:border-[#28a3fe]"
            >
              <option value="">Ano de admissão</option>
              {anosAdmissao.map((ano) => (
                <option key={ano} value={ano}>
                  {ano}
                </option>
              ))}
            </select>

            <select
              value={filtroMesAniversario}
              onChange={(e) => setFiltroMesAniversario(e.target.value)}
              className="rounded-2xl border border-[#cde9fb] px-4 py-3 outline-none focus:border-[#28a3fe]"
            >
              <option value="">Mês de aniversário</option>
              {MESES.map((mes) => (
                <option key={mes.value} value={mes.value}>
                  {mes.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CardResumo titulo="Total de agentes" valor={String(totalAgentes)} />
          <CardResumo titulo="Nicho SAC" valor={String(totalSac)} />
          <CardResumo titulo="Nicho Clínica" valor={String(totalClinica)} />
          <CardResumo titulo="Dependentes" valor={String(totalDependentes)} />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-[28px] border border-[#ffd8e8] bg-white p-5 shadow-[0_12px_35px_rgba(255,102,163,0.10)]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#1d1d1f]">
                  🎈 Aniversariantes de {nomeMesAniversarioSelecionado}
                </h2>
                <p className="text-sm text-gray-500">
                  Nome abreviado e data de nascimento dos aniversariantes do mês.
                </p>
              </div>
              <span className="rounded-full bg-[#fff0f7] px-3 py-1 text-xs font-bold text-[#d94c8a]">
                {aniversariantesDoMes.length} no mês
              </span>
            </div>

            {aniversariantesDoMes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#ffd6e6] bg-[#fff8fb] p-6 text-center text-sm text-gray-500">
                Nenhum aniversariante encontrado para este mês.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {aniversariantesDoMes.map((agente) => (
                  <div
                    key={agente.id}
                    className="rounded-[22px] border border-[#ffd6e6] bg-[#fff8fb] p-4 shadow-[0_8px_24px_rgba(255,102,163,0.08)]"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#d94c8a]">
                      🎈 Aniversariante
                    </p>
                    <h3 className="mt-2 text-lg font-extrabold text-[#1d1d1f]">
                      {agente.nome_abreviado || agente.nome_completo}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Data: {formatDate(agente.data_nascimento)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-[#ffd8e8] bg-[#fffafc] p-5 shadow-[0_12px_35px_rgba(255,102,163,0.08)]">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-[#1d1d1f]">
                🎈 Próximos aniversários
              </h3>
              <p className="text-sm text-gray-500">{nomeMesSeguinte}</p>
            </div>

            {proximosAniversarios.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum registro para o próximo mês.</p>
            ) : (
              <div className="space-y-3">
                {proximosAniversarios.map((agente) => (
                  <div
                    key={agente.id}
                    className="rounded-2xl border border-[#ffe0ec] bg-white px-4 py-3"
                  >
                    <p className="text-sm font-bold text-[#1d1d1f]">
                      {agente.nome_abreviado || agente.nome_completo}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(agente.data_nascimento)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-[28px] border border-[#ffe6bf] bg-white p-5 shadow-[0_12px_35px_rgba(255,171,64,0.12)]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#1d1d1f]">
                  🚀 Comemoração de Tempo de Serviço
                </h2>
                <p className="text-sm text-gray-500">
                  Colaboradores que estão completando mais um ano de empresa neste mês.
                </p>
              </div>
              <span className="rounded-full bg-[#fff6e8] px-3 py-1 text-xs font-bold text-[#d88b1f]">
                {comemoracaoTempoServico.length} no mês
              </span>
            </div>

            {comemoracaoTempoServico.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#ffe0ad] bg-[#fffaf1] p-6 text-center text-sm text-gray-500">
                Nenhuma comemoração de tempo de serviço neste mês.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {comemoracaoTempoServico.map((agente) => (
                  <div
                    key={agente.id}
                    className="rounded-[22px] border border-[#ffe0ad] bg-[#fffaf1] p-4 shadow-[0_8px_24px_rgba(255,171,64,0.10)]"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#d88b1f]">
                      🚀 Tempo de serviço
                    </p>
                    <h3 className="mt-2 text-lg font-extrabold text-[#1d1d1f]">
                      {agente.nome_abreviado || agente.nome_completo}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Admissão: {formatDate(agente.data_admissao)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#8a5a13]">
                      {calcularAnosEmpresa(agente.data_admissao)} ano(s) de empresa
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-[#ffe6bf] bg-[#fffaf3] p-5 shadow-[0_12px_35px_rgba(255,171,64,0.10)]">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-[#1d1d1f]">
                🚀 Próximas comemorações
              </h3>
              <p className="text-sm text-gray-500">{nomeMesSeguinte}</p>
            </div>

            {proximasComemoracoes.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum registro para o próximo mês.</p>
            ) : (
              <div className="space-y-3">
                {proximasComemoracoes.map((agente) => (
                  <div
                    key={agente.id}
                    className="rounded-2xl border border-[#ffe7c1] bg-white px-4 py-3"
                  >
                    <p className="text-sm font-bold text-[#1d1d1f]">
                      {agente.nome_abreviado || agente.nome_completo}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(agente.data_admissao)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-[#bfe3fb] bg-white p-5 shadow-[0_12px_35px_rgba(40,163,254,0.08)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#1d1d1f]">Lista de agentes</h2>
            <span className="text-sm text-gray-500">{agentesFiltrados.length} registro(s)</span>
          </div>

          <div className="overflow-auto rounded-2xl border border-[#d8edf9]">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-[#28a3fe] text-white">
                <tr>
                  <Th>Nome completo</Th>
                  <Th>Nome abreviado</Th>
                  <Th>Cargo</Th>
                  <Th>Nicho</Th>
                  <Th>Cidade/UF</Th>
                  <Th>Admissão</Th>
                  <Th>Nascimento</Th>
                  <Th>Dependentes</Th>
                  <Th>Férias</Th>
                  <Th>Ramal</Th>
                  <Th>Telefone</Th>
                  <Th>Ações</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="p-6 text-center text-gray-500">
                      Carregando...
                    </td>
                  </tr>
                ) : agentesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-6 text-center text-gray-500">
                      Nenhum agente encontrado.
                    </td>
                  </tr>
                ) : (
                  agentesFiltrados.map((agente) => (
                    <tr key={agente.id} className="border-t border-[#e9f5fd]">
                      <Td strong>{agente.nome_completo}</Td>
                      <Td>{agente.nome_abreviado || '-'}</Td>
                      <Td>{agente.cargo || '-'}</Td>
                      <Td>{agente.nicho || '-'}</Td>
                      <Td>{agente.cidade ? `${agente.cidade}/${agente.estado ?? ''}` : '-'}</Td>
                      <Td>{formatDate(agente.data_admissao)}</Td>
                      <Td>{formatDate(agente.data_nascimento)}</Td>
                      <Td>{String(agente.dependentes ?? 0)}</Td>
                      <Td>
                        {agente.previsao_ferias
                          ? `${formatDate(agente.previsao_ferias)} (${agente.dias_ferias ?? 0} dias)`
                          : '-'}
                      </Td>
                      <Td>{agente.ramal || '-'}</Td>
                      <Td>{agente.telefone || '-'}</Td>
                      <Td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => abrirEdicao(agente)}
                            className="rounded-xl border border-[#28a3fe] px-3 py-1.5 text-xs font-semibold text-[#28a3fe]"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => excluirAgente(agente.id)}
                            className="rounded-xl border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600"
                          >
                            Excluir
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[95vh] w-full max-w-5xl overflow-auto rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-2xl font-extrabold text-[#1d1d1f]">
                {editingId ? 'Editar Agente' : 'Novo Agente'}
              </h3>
              <button
                onClick={() => setOpenModal(false)}
                className="rounded-xl border px-4 py-2 text-sm"
              >
                Fechar
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Nome completo">
                <input
                  value={form.nome_completo}
                  onChange={(e) => handleChange('nome_completo', e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Nome abreviado">
                <input
                  value={form.nome_abreviado}
                  onChange={(e) => handleChange('nome_abreviado', e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Carga horária">
                <input
                  value={form.carga_horaria}
                  onChange={(e) => handleChange('carga_horaria', e.target.value)}
                  placeholder="Ex: 07h às 15h12"
                  className={inputClass}
                />
              </Field>

              <Field label="Cargo">
                <select
                  value={form.cargo}
                  onChange={(e) => handleChange('cargo', e.target.value as FormState['cargo'])}
                  className={inputClass}
                >
                  <option value="">Selecione</option>
                  {CARGOS.map((cargo) => (
                    <option key={cargo} value={cargo}>
                      {cargo}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="CEP">
                <input
                  value={form.cep}
                  onChange={(e) => handleChange('cep', e.target.value)}
                  onBlur={() => buscarCep(form.cep)}
                  className={inputClass}
                />
              </Field>

              <Field label="Endereço">
                <input
                  value={form.endereco}
                  onChange={(e) => handleChange('endereco', e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Cidade">
                <input
                  value={form.cidade}
                  onChange={(e) => handleChange('cidade', e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Estado">
                <input
                  value={form.estado}
                  onChange={(e) => handleChange('estado', e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Data de admissão">
                <input
                  type="date"
                  value={form.data_admissao}
                  onChange={(e) => handleChange('data_admissao', e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Data de nascimento">
                <input
                  type="date"
                  value={form.data_nascimento}
                  onChange={(e) => handleChange('data_nascimento', e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Dependentes">
                <input
                  type="number"
                  value={form.dependentes}
                  onChange={(e) => handleChange('dependentes', e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Nicho">
                <select
                  value={form.nicho}
                  onChange={(e) => handleChange('nicho', e.target.value as FormState['nicho'])}
                  className={inputClass}
                >
                  <option value="">Selecione</option>
                  {NICHOS.map((nicho) => (
                    <option key={nicho} value={nicho}>
                      {nicho}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Previsão de férias">
                <input
                  type="date"
                  value={form.previsao_ferias}
                  onChange={(e) => handleChange('previsao_ferias', e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Dias de férias">
                <input
                  type="number"
                  value={form.dias_ferias}
                  onChange={(e) => handleChange('dias_ferias', e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Ramal">
                <input
                  value={form.ramal}
                  onChange={(e) => handleChange('ramal', e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Telefone">
                <input
                  value={form.telefone}
                  onChange={(e) => handleChange('telefone', e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setOpenModal(false)}
                className="rounded-2xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700"
              >
                Cancelar
              </button>

              <button
                onClick={salvarAgente}
                disabled={saving}
                className="rounded-2xl bg-[#28a3fe] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function CardResumo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-[24px] border border-[#bfe3fb] bg-white p-5 shadow-[0_10px_30px_rgba(40,163,254,0.08)]">
      <p className="text-sm font-medium text-gray-500">{titulo}</p>
      <h3 className="mt-2 text-3xl font-extrabold text-[#1d1d1f]">{valor}</h3>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-gray-700">{label}</span>
      {children}
    </label>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-sm font-bold">{children}</th>
}

function Td({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <td className={`px-4 py-3 align-top text-sm ${strong ? 'font-semibold text-[#1d1d1f]' : 'text-gray-700'}`}>
      {children}
    </td>
  )
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

function calcularAnosEmpresa(dataAdmissao?: string | null) {
  if (!dataAdmissao) return 0

  const anoAdmissao = Number(dataAdmissao.slice(0, 4))
  const anoAtual = new Date().getFullYear()

  if (!anoAdmissao) return 0

  return Math.max(anoAtual - anoAdmissao, 0)
}

const inputClass =
  'h-12 rounded-2xl border border-[#cde9fb] px-4 outline-none focus:border-[#28a3fe]'