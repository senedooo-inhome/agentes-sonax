'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Agente = { id: string | number; nome: string }
type Empresa = { id: string | number; nome: string }

type TipoRegistro = 'avaliacao_monitoria' | 'reclamacao'
type StatusAtendimento = '' | 'Atendida' | 'Não atendida'

// ✅ canal apenas Chat & Ligação
type Canal = '' | 'Chat' | 'Ligação'

type Motivo = '' | 'Internet' | 'Cobrança' | 'Atendimento' | 'Técnico' | 'Cancelamento' | 'Outros'
type StatusReclamacao = '' | 'Aberta' | 'Em andamento' | 'Resolvida'

type RegistroRow = {
  id: string
  created_at: string
  tipo: TipoRegistro
  data: string
  telefone: string
  agente: string | null
  empresa: string | null

  status_atendimento: 'Atendida' | 'Não atendida' | null
  link_monitoria: string | null
  nota_monitoria: number | null

  canal: string | null
  motivo: string | null
  descricao_reclamacao: string | null
  acao_tomada: string | null
  status_reclamacao: string | null
}

function hojeYYYYMMDD() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * ✅ CSV em colunas no Excel BR:
 * usa ; como separador (ponto e vírgula)
 */
function csvEscape(v: any) {
  const s = String(v ?? '')
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) {
    alert('Sem dados para exportar.')
    return
  }
  const headers = Object.keys(rows[0])
  const sep = ';'
  const lines = [
    headers.map(csvEscape).join(sep),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(sep)),
  ]
  const csv = lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function labelTipo(t: TipoRegistro) {
  return t === 'avaliacao_monitoria' ? 'Avaliação' : 'Reclamação'
}

export default function QualidadeRegistrosPage() {
  const router = useRouter()

  // ✅ restrita
  const [checkingAuth, setCheckingAuth] = useState(true)
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const email = data.session?.user?.email || ''
      if (email !== 'supervisao@sonax.net.br') {
        router.replace('/')
        return
      }
      setCheckingAuth(false)
    })()
  }, [router])

  // ===== FORM =====
  const [tipo, setTipo] = useState<TipoRegistro>('avaliacao_monitoria')

  const [form, setForm] = useState({
    data: hojeYYYYMMDD(),
    telefone: '',

    agente: '',
    empresa: '',

    // avaliação
    status_atendimento: '' as StatusAtendimento,
    link_monitoria: '',
    nota_monitoria: '' as string,

    // reclamação
    canal: '' as Canal,
    motivo: '' as Motivo,
    descricao_reclamacao: '',
    acao_tomada: '',
    status_reclamacao: '' as StatusReclamacao,
  })

  const [salvando, setSalvando] = useState(false)

  // ===== LISTAS =====
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [carregandoListas, setCarregandoListas] = useState(false)

  const [buscaAgente, setBuscaAgente] = useState('')
  const [buscaEmpresa, setBuscaEmpresa] = useState('')

  const agentesFiltrados = useMemo(() => {
    const q = buscaAgente.trim().toLowerCase()
    if (!q) return agentes
    return agentes.filter((a) => a.nome.toLowerCase().includes(q))
  }, [agentes, buscaAgente])

  const empresasFiltradas = useMemo(() => {
    const q = buscaEmpresa.trim().toLowerCase()
    if (!q) return empresas
    return empresas.filter((e) => e.nome.toLowerCase().includes(q))
  }, [empresas, buscaEmpresa])

  // ===== ÚLTIMOS + RELATÓRIO =====
  const [ultimos, setUltimos] = useState<RegistroRow[]>([])
  const [relatorio, setRelatorio] = useState<RegistroRow[]>([])
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false)
  const [carregandoUltimos, setCarregandoUltimos] = useState(false)

  const [filtros, setFiltros] = useState({
    // ✅ relatório agora é de reclamações — então filtros focados nisso
    empresa: '',
    agente: '',
    canal: '' as '' | 'Chat' | 'Ligação',
    de: '',
    ate: '',
  })

  useEffect(() => {
    carregarListas()
    carregarUltimos()
    carregarRelatorio()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function carregarListas() {
    try {
      setCarregandoListas(true)
      const [{ data: agData, error: agErr }, { data: empData, error: empErr }] =
        await Promise.all([
          supabase.from('agentes').select('id, nome').order('nome', { ascending: true }),
          supabase.from('empresas').select('id, nome').order('nome', { ascending: true }),
        ])
      if (agErr) throw agErr
      if (empErr) throw empErr
      setAgentes((agData as any) || [])
      setEmpresas((empData as any) || [])
    } catch (err: any) {
      console.error(err)
      alert('Erro ao carregar listas: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCarregandoListas(false)
    }
  }

  async function carregarUltimos() {
    try {
      setCarregandoUltimos(true)
      const { data, error } = await supabase
        .from('qualidade_registros')
        .select(
          'id, created_at, tipo, data, telefone, agente, empresa, status_atendimento, link_monitoria, nota_monitoria, canal, motivo, descricao_reclamacao, acao_tomada, status_reclamacao'
        )
        .order('created_at', { ascending: false })
        .limit(8)

      if (error) throw error
      setUltimos((data as any) || [])
    } catch (err) {
      console.error(err)
    } finally {
      setCarregandoUltimos(false)
    }
  }

  // ✅ RELATÓRIO = só reclamações + colunas específicas
  async function carregarRelatorio() {
    try {
      setCarregandoRelatorio(true)

      let q = supabase
        .from('qualidade_registros')
        .select(
          'id, created_at, tipo, data, telefone, agente, empresa, canal, descricao_reclamacao, acao_tomada'
        )
        .eq('tipo', 'reclamacao')
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500)

      if (filtros.empresa) q = q.eq('empresa', filtros.empresa)
      if (filtros.agente) q = q.eq('agente', filtros.agente)
      if (filtros.canal) q = q.eq('canal', filtros.canal)
      if (filtros.de) q = q.gte('data', filtros.de)
      if (filtros.ate) q = q.lte('data', filtros.ate)

      const { data, error } = await q
      if (error) throw error

      setRelatorio((data as any) || [])
    } catch (err: any) {
      console.error(err)
      alert('Erro ao carregar relatório: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCarregandoRelatorio(false)
    }
  }

  function resetForm() {
    setForm({
      data: hojeYYYYMMDD(),
      telefone: '',
      agente: '',
      empresa: '',
      status_atendimento: '',
      link_monitoria: '',
      nota_monitoria: '',
      canal: '',
      motivo: '',
      descricao_reclamacao: '',
      acao_tomada: '',
      status_reclamacao: '',
    })
    setBuscaAgente('')
    setBuscaEmpresa('')
  }

  async function salvar() {
    // comuns
    if (!form.data) return alert('Preencha a Data.')
    if (!form.telefone.trim()) return alert('Preencha o Telefone.')
    if (!form.agente.trim()) return alert('Selecione o Agente.')
    if (!form.empresa.trim()) return alert('Selecione a Empresa.')

    const payload: any = {
      tipo,
      data: form.data,
      telefone: form.telefone.trim(),
      agente: form.agente.trim(),
      empresa: form.empresa.trim(),
    }

    if (tipo === 'avaliacao_monitoria') {
      if (!form.status_atendimento) return alert('Selecione o Status (Atendida/Não atendida).')
      if (!form.link_monitoria.trim()) return alert('Informe o link da Avaliação da Monitoria.')
      if (form.nota_monitoria.trim() === '') return alert('Informe a nota da monitoria.')

      const nota = Number(form.nota_monitoria)
      if (Number.isNaN(nota) || nota < 0 || nota > 100) {
        return alert('A nota deve ser um número entre 0 e 100.')
      }

      payload.status_atendimento = form.status_atendimento
      payload.link_monitoria = form.link_monitoria.trim()
      payload.nota_monitoria = nota
    }

    if (tipo === 'reclamacao') {
      if (!form.canal) return alert('Selecione o Canal.')
      if (!form.motivo) return alert('Selecione o Motivo.')
      if (!form.descricao_reclamacao.trim()) return alert('Descreva a reclamação.')
      if (!form.status_reclamacao) return alert('Selecione o Status da reclamação.')

      payload.canal = form.canal
      payload.motivo = form.motivo
      payload.descricao_reclamacao = form.descricao_reclamacao.trim()
      payload.acao_tomada = form.acao_tomada.trim() ? form.acao_tomada.trim() : null
      payload.status_reclamacao = form.status_reclamacao
    }

    try {
      setSalvando(true)
      const { error } = await supabase.from('qualidade_registros').insert([payload])
      if (error) throw error

      alert('Registro salvo!')
      resetForm()

      await Promise.all([carregarUltimos(), carregarRelatorio()])
    } catch (err: any) {
      console.error(err)
      alert('Erro ao salvar: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setSalvando(false)
    }
  }

  // ✅ EXPORTA só reclamações com colunas pedidas
  function exportarCSVReclamacoes() {
    const rows = relatorio.map((r) => ({
      data: r.data,
      telefone: r.telefone,
      tipo: 'Reclamação',
      agente: r.agente ?? '',
      empresa: r.empresa ?? '',
      canal: r.canal ?? '',
      descricao_reclamacao: r.descricao_reclamacao ?? '',
      acao_tomada: r.acao_tomada ?? '',
      criado_em: r.created_at,
    }))

    downloadCSV(`reclamacoes_${hojeYYYYMMDD()}.csv`, rows)
  }

  if (checkingAuth) {
    return (
      <main className="min-h-[calc(100vh-0px)] bg-[#f5f6f7] p-6">
        <div className="w-full rounded-2xl bg-white p-6 shadow">Carregando…</div>
      </main>
    )
  }

  return (
    <main className="min-h-[calc(100vh-0px)] bg-[#f5f6f7] p-6">
      {/* ✅ 16:9: largura total, sem max-w estreitando */}
      <div className="w-full space-y-6">
        {/* HEADER */}
        <div className="rounded-2xl bg-white p-6 shadow flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#2687e2]">
              Qualidade — Avaliação & Reclamações
            </h1>
            <p className="text-sm text-[#535151]">Registro operacional com foco em melhoria contínua</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                carregarListas()
                carregarUltimos()
                carregarRelatorio()
              }}
              className="rounded-lg border border-[#334155] bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#111827]"
            >
              Recarregar
            </button>

            <button
              type="button"
              onClick={exportarCSVReclamacoes}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Exportar Reclamações (CSV)
            </button>

            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {salvando ? 'Salvando…' : 'Salvar registro'}
            </button>
          </div>
        </div>

        {/* FORM */}
        <div className="rounded-2xl bg-[#f1f5f9] p-6 shadow border border-[#cbd5e1] space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Tipo</label>
              <select
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoRegistro)}
              >
                <option value="avaliacao_monitoria">Avaliação da monitoria</option>
                <option value="reclamacao">Reclamação</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Data</label>
              <input
                type="date"
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Telefone</label>
              <input
                type="text"
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                placeholder="Ex.: (11) 99999-9999"
              />
            </div>
          </div>

          {/* Agente / Empresa */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Agente</label>
              <input
                type="text"
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white mb-2"
                value={buscaAgente}
                onChange={(e) => setBuscaAgente(e.target.value)}
                placeholder="Digite para buscar o agente…"
              />
              <select
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white disabled:opacity-60"
                value={form.agente}
                onChange={(e) => setForm({ ...form, agente: e.target.value })}
                disabled={carregandoListas}
              >
                <option value="">
                  {carregandoListas ? 'Carregando agentes…' : 'Selecione um agente'}
                </option>
                {agentesFiltrados.map((a) => (
                  <option key={String(a.id)} value={a.nome}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Empresa</label>
              <input
                type="text"
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white mb-2"
                value={buscaEmpresa}
                onChange={(e) => setBuscaEmpresa(e.target.value)}
                placeholder="Digite para localizar a empresa…"
              />
              <select
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white disabled:opacity-60"
                value={form.empresa}
                onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                disabled={carregandoListas}
              >
                <option value="">
                  {carregandoListas ? 'Carregando empresas…' : 'Selecione uma empresa'}
                </option>
                {empresasFiltradas.map((em) => (
                  <option key={String(em.id)} value={em.nome}>
                    {em.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* CAMPOS CONDICIONAIS */}
          {tipo === 'avaliacao_monitoria' ? (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Status</label>
                <select
                  className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white"
                  value={form.status_atendimento}
                  onChange={(e) =>
                    setForm({ ...form, status_atendimento: e.target.value as StatusAtendimento })
                  }
                >
                  <option value="">Selecione</option>
                  <option value="Atendida">Atendida</option>
                  <option value="Não atendida">Não atendida</option>
                </select>

                {form.status_atendimento && (
                  <div className="mt-2">
                    <span
                      className={[
                        'inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold',
                        form.status_atendimento === 'Atendida'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800',
                      ].join(' ')}
                    >
                      {form.status_atendimento}
                    </span>
                  </div>
                )}
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Avaliação da Monitoria (link)
                </label>
                <input
                  type="url"
                  className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white"
                  value={form.link_monitoria}
                  onChange={(e) => setForm({ ...form, link_monitoria: e.target.value })}
                  placeholder="Cole aqui o link da monitoria"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Nota (0–100)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white"
                  value={form.nota_monitoria}
                  onChange={(e) => setForm({ ...form, nota_monitoria: e.target.value })}
                  placeholder="Ex.: 95"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Canal</label>
                <select
                  className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white"
                  value={form.canal}
                  onChange={(e) => setForm({ ...form, canal: e.target.value as Canal })}
                >
                  <option value="">Selecione</option>
                  <option value="Chat">Chat</option>
                  <option value="Ligação">Ligação</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Motivo</label>
                <select
                  className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white"
                  value={form.motivo}
                  onChange={(e) => setForm({ ...form, motivo: e.target.value as Motivo })}
                >
                  <option value="">Selecione</option>
                  <option value="Internet">Internet</option>
                  <option value="Cobrança">Cobrança</option>
                  <option value="Atendimento">Atendimento</option>
                  <option value="Técnico">Técnico</option>
                  <option value="Cancelamento">Cancelamento</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Status</label>
                <select
                  className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white"
                  value={form.status_reclamacao}
                  onChange={(e) =>
                    setForm({ ...form, status_reclamacao: e.target.value as StatusReclamacao })
                  }
                >
                  <option value="">Selecione</option>
                  <option value="Aberta">Aberta</option>
                  <option value="Em andamento">Em andamento</option>
                  <option value="Resolvida">Resolvida</option>
                </select>
              </div>

              <div className="lg:col-span-3">
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Descrição da reclamação
                </label>
                <textarea
                  rows={4}
                  className="w-full rounded-lg border border-[#cbd5e1] p-3 text-[#111827] bg-white"
                  value={form.descricao_reclamacao}
                  onChange={(e) => setForm({ ...form, descricao_reclamacao: e.target.value })}
                  placeholder="Descreva o que aconteceu, contexto e detalhes."
                />
              </div>

              <div className="lg:col-span-3">
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Ação tomada (opcional)
                </label>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-[#cbd5e1] p-3 text-[#111827] bg-white"
                  value={form.acao_tomada}
                  onChange={(e) => setForm({ ...form, acao_tomada: e.target.value })}
                  placeholder="Ex.: orientado o cliente, aberto chamado técnico, ajustado cobrança..."
                />
              </div>
            </div>
          )}
        </div>

        {/* RELATÓRIO (somente Reclamações) */}
        <div className="rounded-2xl bg-[#f1f5f9] p-6 shadow border border-[#cbd5e1]">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#0f172a]">Relatório — Reclamações</h2>
              <p className="text-sm text-[#334155]">
                Data, telefone, agente, empresa, canal, descrição e ação tomada
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFiltros({ empresa: '', agente: '', canal: '', de: '', ate: '' })
                  setTimeout(() => carregarRelatorio(), 0)
                }}
                className="rounded-lg border border-[#334155] bg-white px-3 py-2 text-sm font-semibold text-[#0f172a] hover:bg-[#e2e8f0]"
              >
                Limpar
              </button>

              <button
                type="button"
                onClick={carregarRelatorio}
                className="rounded-lg bg-[#2687e2] px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
                disabled={carregandoRelatorio}
              >
                {carregandoRelatorio ? 'Carregando…' : 'Aplicar filtros'}
              </button>
            </div>
          </div>

          {/* filtros */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Empresa</label>
              <select
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white"
                value={filtros.empresa}
                onChange={(e) => setFiltros({ ...filtros, empresa: e.target.value })}
              >
                <option value="">Todas</option>
                {empresas.map((em) => (
                  <option key={String(em.id)} value={em.nome}>
                    {em.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Agente</label>
              <select
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white"
                value={filtros.agente}
                onChange={(e) => setFiltros({ ...filtros, agente: e.target.value })}
              >
                <option value="">Todos</option>
                {agentes.map((a) => (
                  <option key={String(a.id)} value={a.nome}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Canal</label>
              <select
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white"
                value={filtros.canal}
                onChange={(e) => setFiltros({ ...filtros, canal: e.target.value as any })}
              >
                <option value="">Todos</option>
                <option value="Chat">Chat</option>
                <option value="Ligação">Ligação</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">De</label>
              <input
                type="date"
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white"
                value={filtros.de}
                onChange={(e) => setFiltros({ ...filtros, de: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Até</label>
              <input
                type="date"
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#111827] bg-white"
                value={filtros.ate}
                onChange={(e) => setFiltros({ ...filtros, ate: e.target.value })}
              />
            </div>
          </div>

          {/* tabela */}
          <div className="rounded-2xl bg-white p-4 border border-[#cbd5e1]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-[#111827]">
                <thead>
                  <tr className="text-left text-[#0f172a]">
                    <th className="py-2 pr-3 font-bold whitespace-nowrap">Data</th>
                    <th className="py-2 pr-3 font-bold whitespace-nowrap">Telefone</th>
                    <th className="py-2 pr-3 font-bold whitespace-nowrap">Tipo</th>
                    <th className="py-2 pr-3 font-bold whitespace-nowrap">Agente</th>
                    <th className="py-2 pr-3 font-bold whitespace-nowrap">Empresa</th>
                    <th className="py-2 pr-3 font-bold whitespace-nowrap">Canal</th>
                    <th className="py-2 pr-3 font-bold min-w-[360px]">Descrição</th>
                    <th className="py-2 pr-3 font-bold min-w-[280px]">Ação tomada</th>
                  </tr>
                </thead>

                <tbody>
                  {carregandoRelatorio ? (
                    <tr>
                      <td className="py-3 text-[#334155]" colSpan={8}>
                        Carregando…
                      </td>
                    </tr>
                  ) : relatorio.length === 0 ? (
                    <tr>
                      <td className="py-3 text-[#334155]" colSpan={8}>
                        Nenhuma reclamação com esses filtros.
                      </td>
                    </tr>
                  ) : (
                    relatorio.map((r) => (
                      <tr key={r.id} className="border-t border-[#e2e8f0] hover:bg-[#f8fafc] align-top">
                        <td className="py-2 pr-3 whitespace-nowrap">{r.data}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{r.telefone}</td>
                        <td className="py-2 pr-3 font-semibold">Reclamação</td>
                        <td className="py-2 pr-3">{r.agente ?? '—'}</td>
                        <td className="py-2 pr-3">{r.empresa ?? '—'}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{r.canal ?? '—'}</td>
                        <td className="py-2 pr-3 text-[#334155]">{r.descricao_reclamacao ?? '—'}</td>
                        <td className="py-2 pr-3 text-[#334155]">{r.acao_tomada ?? '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-[#334155] mt-3">
              Exportação abre em colunas no Excel (separador <strong>;</strong>).
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
