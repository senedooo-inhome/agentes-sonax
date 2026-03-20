'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import type { AgenteInfo } from '@/app/types/agente'
import { supabase } from '@/lib/supabaseClient'

const NICHOS_FIXOS = ['SAC', 'CLINICA']

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

type UserRole = 'supervisao' | 'lider' | 'marketing'

type FormState = {
  nome_completo: string
  nome_abreviado: string
  carga_horaria: string
  cargo: string
  cep: string
  endereco: string
  cidade: string
  estado: string
  data_admissao: string
  data_nascimento: string
  dependentes: string
  nicho: string
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

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function gerarNomeAbreviado(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return ''
  if (partes.length === 1) return partes[0]
  return `${partes[0]} ${partes[partes.length - 1]}`
}

function montarEnderecoCompleto(
  endereco: string | null,
  cidade: string | null,
  estado: string | null
): string {
  return [endereco, cidade, estado].filter(Boolean).join(', ')
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTAÇÃO VIA PLANILHA
// ─────────────────────────────────────────────────────────────────────────────

type RowImport = {
  nome_completo: string | null
  nome_abreviado: string | null
  cargo: string | null
  nicho: string | null
  carga_horaria: string | null
  data_admissao: string | null
  data_nascimento: string | null
  cidade: string | null
  estado: string | null
  endereco: string | null
  telefone: string | null
  dependentes: number
  previsao_ferias: string | null
  dias_ferias: number | null
  ramal: string | null
}

type ImportStatus = 'idle' | 'preview' | 'importing' | 'done'

function parseExcelDate(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (date) return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
  }
  if (typeof value === 'string') {
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
    const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
    if (br) return `${br[3]}-${br[2]}-${br[1]}`
  }
  return null
}

function parseCidadeEstado(cidadeRaw: unknown): { cidade: string | null; estado: string | null } {
  if (!cidadeRaw || typeof cidadeRaw !== 'string') return { cidade: null, estado: null }
  const match = cidadeRaw.match(/^(.+?)\s*[-\/]\s*([A-Z]{2})$/i)
  if (match) return { cidade: match[1].trim(), estado: match[2].trim().toUpperCase() }
  return { cidade: cidadeRaw.trim(), estado: null }
}

function normalizarTexto(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null
  return value.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizarNicho(value: unknown): string | null {
  const nicho = normalizarTexto(value)
  if (!nicho) return null
  if (['**', 'COORD.'].includes(nicho)) return null
  return nicho
}

function mapRow(row: Record<string, unknown>): RowImport {
  const { cidade, estado } = parseCidadeEstado(row['CIDADE'])
  const nomeCompleto = (row['NOME COMPLETO'] as string)?.trim() || null
  const nomeAbreviadoPlanilha = (row['ATENDENTES'] as string)?.trim()
  const nomeAbreviado = nomeAbreviadoPlanilha || (nomeCompleto ? gerarNomeAbreviado(nomeCompleto) : null)

  return {
    nome_completo: nomeCompleto,
    nome_abreviado: nomeAbreviado,
    cargo: normalizarTexto(row['CARGO']),
    nicho: normalizarNicho(row['NICHO']),
    carga_horaria: (row['CARGA HORÁRIA'] as string)?.trim() || null,
    data_admissao: parseExcelDate(row['DATA DE ADMISSÃO']),
    data_nascimento: parseExcelDate(row['DATA DE NASCIMENTO']),
    cidade,
    estado,
    endereco: (row['ENDEREÇO'] as string)?.trim() || null,
    telefone: String(row['TELEFONE'] || '').trim() || null,
    dependentes: Number(row['DEPENDENTES ATÉ 14 ANOS'] || 0) || 0,
    previsao_ferias: parseExcelDate(row['PREVISÃO DE FÉRIAS']),
    dias_ferias: row['QTD. DIA DE FÉRIAS'] ? Number(row['QTD. DIA DE FÉRIAS']) : null,
    ramal: row['RAMAL'] ? String(row['RAMAL']).trim() : null,
  }
}

function ImportarAgentes({ onImportado }: { onImportado: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [rows, setRows] = useState<RowImport[]>([])
  const [progress, setProgress] = useState(0)
  const [erros, setErros] = useState<string[]>([])
  const [sucessos, setSucessos] = useState(0)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
      setRows(json.map(mapRow).filter((r) => !!r.nome_completo))
      setStatus('preview')
    }
    reader.readAsArrayBuffer(file)
  }

  async function confirmarImportacao() {
    setStatus('importing')
    setProgress(0)
    const novosErros: string[] = []
    let count = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const { error } = await supabase.from('informacoes_agentes').insert({
        nome_completo: row.nome_completo,
        nome_abreviado: row.nome_abreviado,
        cargo: row.cargo,
        nicho: row.nicho,
        carga_horaria: row.carga_horaria,
        data_admissao: row.data_admissao,
        data_nascimento: row.data_nascimento,
        cidade: row.cidade,
        estado: row.estado,
        endereco: row.endereco,
        telefone: row.telefone,
        dependentes: row.dependentes,
        previsao_ferias: row.previsao_ferias,
        dias_ferias: row.dias_ferias,
        ramal: row.ramal,
        cep: null,
      })
      if (error) novosErros.push(`Linha ${i + 1} (${row.nome_completo}): ${error.message}`)
      else count++
      setProgress(Math.round(((i + 1) / rows.length) * 100))
    }

    setSucessos(count)
    setErros(novosErros)
    setStatus('done')
    if (count > 0) onImportado()
  }

  function resetar() {
    setStatus('idle')
    setRows([])
    setProgress(0)
    setErros([])
    setSucessos(0)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      {status === 'idle' && (
        <>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" id="import-xlsx" />
          <label htmlFor="import-xlsx"
            className="cursor-pointer rounded-2xl border border-[#28a3fe] px-5 py-3 text-sm font-semibold text-[#28a3fe] hover:bg-[#f0f9ff] transition-colors">
            📥 Importar planilha
          </label>
        </>
      )}

      {status === 'preview' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-[#1d1d1f]">Prévia da importação</h3>
                <p className="text-sm text-gray-500 mt-1">{rows.length} agente(s) encontrado(s). Confirme para importar.</p>
              </div>
              <button onClick={resetar} className="rounded-xl border px-4 py-2 text-sm">Cancelar</button>
            </div>
            <div className="overflow-auto rounded-2xl border border-[#d8edf9]">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-[#28a3fe] text-white">
                  <tr>
                    {['Nome completo', 'Abreviado', 'Cargo', 'Nicho', 'Admissão', 'Nascimento', 'Cidade/UF', 'Ramal'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-[#e9f5fd]">
                      <td className="px-3 py-2 font-semibold text-[#1d1d1f]">{r.nome_completo}</td>
                      <td className="px-3 py-2 text-gray-700">{r.nome_abreviado || '-'}</td>
                      <td className="px-3 py-2 text-gray-700">{r.cargo || '-'}</td>
                      <td className="px-3 py-2 text-gray-700">{r.nicho || '-'}</td>
                      <td className="px-3 py-2 text-gray-700">{r.data_admissao || '-'}</td>
                      <td className="px-3 py-2 text-gray-700">{r.data_nascimento || '-'}</td>
                      <td className="px-3 py-2 text-gray-700">{r.cidade ? `${r.cidade}${r.estado ? `/${r.estado}` : ''}` : '-'}</td>
                      <td className="px-3 py-2 text-gray-700">{r.ramal || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={resetar} className="rounded-2xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700">Cancelar</button>
              <button onClick={confirmarImportacao} className="rounded-2xl bg-[#28a3fe] px-5 py-3 text-sm font-semibold text-white hover:opacity-90">
                ✅ Confirmar importação ({rows.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {status === 'importing' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-8 shadow-2xl text-center">
            <p className="text-lg font-bold text-[#1d1d1f] mb-4">Importando agentes...</p>
            <div className="h-3 w-full rounded-full bg-[#e8f4fe] overflow-hidden">
              <div className="h-full rounded-full bg-[#28a3fe] transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-3 text-sm text-gray-500">{progress}% concluído</p>
          </div>
        </div>
      )}

      {status === 'done' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-2xl">
            <h3 className="text-xl font-extrabold text-[#1d1d1f] mb-4">
              {erros.length === 0 ? '🎉 Importação concluída!' : '⚠️ Importação com erros'}
            </h3>
            <div className="space-y-2 mb-6">
              <p className="text-sm text-gray-700">✅ <span className="font-bold text-green-600">{sucessos}</span> agente(s) importado(s) com sucesso.</p>
              {erros.length > 0 && <p className="text-sm text-gray-700">❌ <span className="font-bold text-red-600">{erros.length}</span> erro(s):</p>}
              {erros.length > 0 && (
                <ul className="max-h-40 overflow-auto rounded-xl bg-red-50 p-3 text-xs text-red-700 space-y-1">
                  {erros.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
            <button onClick={resetar} className="w-full rounded-2xl bg-[#28a3fe] px-5 py-3 text-sm font-semibold text-white">Fechar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function InformacoesAgentesPage() {
  const [agentes, setAgentes] = useState<AgenteInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [openModal, setOpenModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [role, setRole] = useState<UserRole | null>(null)

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
    if (error) { console.error(error); alert('Erro ao carregar agentes.') }
    else setAgentes((data as AgenteInfo[]) || [])
    setLoading(false)
  }

  useEffect(() => { carregarAgentes() }, [])

  useEffect(() => {
    async function carregarRole() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      if (profile?.role) setRole(profile.role as UserRole)
    }
    carregarRole()
  }, [])

  const cargosDisponiveis = useMemo(() => {
    return [...new Set(agentes.map((a) => a.cargo).filter((c): c is string => !!c))].sort()
  }, [agentes])

  const nichosDisponiveis = useMemo(() => {
    const dosBanco = agentes.map((a) => a.nicho).filter((n): n is string => !!n)
    return [...new Set([...NICHOS_FIXOS, ...dosBanco])].sort()
  }, [agentes])

  function handleChange<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => {
      const updated = { ...prev, [field]: value }
      if (field === 'nome_completo' && typeof value === 'string') {
        const abreviadoEsperado = gerarNomeAbreviado(prev.nome_completo)
        if (!prev.nome_abreviado || prev.nome_abreviado === abreviadoEsperado) {
          updated.nome_abreviado = gerarNomeAbreviado(value)
        }
      }
      return updated
    })
  }

  async function buscarCep(cep: string) {
    const cepLimpo = cep.replace(/\D/g, '')
    if (cepLimpo.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
      const data: ViaCepResponse = await res.json()
      if (data.erro) { alert('CEP não encontrado.'); return }
      setForm((prev) => ({
        ...prev,
        endereco: `${data.logradouro || ''}${data.bairro ? ` - ${data.bairro}` : ''}`.trim(),
        cidade: data.localidade || '',
        estado: data.uf || '',
      }))
    } catch (err) { console.error(err); alert('Erro ao buscar CEP.') }
  }

  function abrirNovo() {
    if (role === 'marketing') return
    setEditingId(null)
    setForm(emptyForm)
    setOpenModal(true)
  }

  function abrirEdicao(agente: AgenteInfo) {
    if (role === 'marketing') return
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
    if (role === 'marketing') return
    if (!form.nome_completo.trim()) { alert('Preencha o nome completo.'); return }
    setSaving(true)
    const payload = {
      nome_completo: form.nome_completo,
      nome_abreviado: form.nome_abreviado || gerarNomeAbreviado(form.nome_completo) || null,
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
      const result = await supabase.from('informacoes_agentes').update(payload).eq('id', editingId)
      error = result.error
    } else {
      const result = await supabase.from('informacoes_agentes').insert(payload)
      error = result.error
    }
    setSaving(false)
    if (error) { console.error(error); alert('Erro ao salvar agente.'); return }
    setOpenModal(false)
    setForm(emptyForm)
    setEditingId(null)
    await carregarAgentes()
  }

  async function excluirAgente(id: string) {
    if (role === 'marketing') return
    if (!confirm('Deseja excluir este agente?')) return
    const { error } = await supabase.from('informacoes_agentes').delete().eq('id', id)
    if (error) { console.error(error); alert('Erro ao excluir.'); return }
    await carregarAgentes()
  }

  const estados = useMemo(() => {
    return [...new Set(agentes.map((a) => a.estado).filter((uf): uf is string => !!uf))].sort()
  }, [agentes])

  const anosAdmissao = useMemo(() => {
    return [...new Set(agentes.map((a) => a.data_admissao?.slice(0, 4)).filter((ano): ano is string => !!ano))].sort()
  }, [agentes])

  const agentesFiltrados = useMemo(() => {
    return agentes.filter((a) => {
      const texto = busca.toLowerCase()
      const mesNascimento = a.data_nascimento?.slice(5, 7) || ''
      return (
        (!texto || a.nome_completo.toLowerCase().includes(texto) || (a.nome_abreviado ?? '').toLowerCase().includes(texto) || (a.cidade ?? '').toLowerCase().includes(texto)) &&
        (!filtroCargo || (a.cargo ?? '').trim() === filtroCargo.trim()) &&
        (!filtroNicho || a.nicho === filtroNicho) &&
        (!filtroEstado || a.estado === filtroEstado) &&
        (!filtroAdmissaoAno || a.data_admissao?.slice(0, 4) === filtroAdmissaoAno) &&
        (!filtroMesAniversario || mesNascimento === filtroMesAniversario)
      )
    })
  }, [agentes, busca, filtroCargo, filtroNicho, filtroEstado, filtroAdmissaoAno, filtroMesAniversario])

  const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0')
  const mesSeguinte = String(((new Date().getMonth() + 1) % 12) + 1).padStart(2, '0')

  const aniversariantesDoMes = useMemo(() => {
    const mesBase = filtroMesAniversario || mesAtual
    return [...agentes]
      .filter((a) => a.data_nascimento?.slice(5, 7) === mesBase)
      .sort((a, b) => Number(a.data_nascimento?.slice(8, 10) || 0) - Number(b.data_nascimento?.slice(8, 10) || 0))
  }, [agentes, filtroMesAniversario, mesAtual])

  const proximosAniversarios = useMemo(() => {
    return [...agentes]
      .filter((a) => a.data_nascimento?.slice(5, 7) === mesSeguinte)
      .sort((a, b) => Number(a.data_nascimento?.slice(8, 10) || 0) - Number(b.data_nascimento?.slice(8, 10) || 0))
      .slice(0, 6)
  }, [agentes, mesSeguinte])

  const anoAtualComemor = new Date().getFullYear()

  const comemoracaoTempoServico = useMemo(() => {
    return [...agentes]
      .filter((a) => {
        if (!a.data_admissao) return false
        const anoAdmissao = Number(a.data_admissao.slice(0, 4))
        const mesAdmissao = a.data_admissao.slice(5, 7)
        // Mês bate E é de um ano anterior (não contratados este ano)
        return mesAdmissao === mesAtual && anoAdmissao < anoAtualComemor
      })
      .sort((a, b) => Number(a.data_admissao?.slice(8, 10) || 0) - Number(b.data_admissao?.slice(8, 10) || 0))
  }, [agentes, mesAtual, anoAtualComemor])

  const proximasComemoracoes = useMemo(() => {
    return [...agentes]
      .filter((a) => {
        if (!a.data_admissao) return false
        const anoAdmissao = Number(a.data_admissao.slice(0, 4))
        const mesAdmissao = a.data_admissao.slice(5, 7)
        return mesAdmissao === mesSeguinte && anoAdmissao < anoAtualComemor
      })
      .sort((a, b) => Number(a.data_admissao?.slice(8, 10) || 0) - Number(b.data_admissao?.slice(8, 10) || 0))
      .slice(0, 6)
  }, [agentes, mesSeguinte, anoAtualComemor])

  const totalAgentes = agentesFiltrados.length
  const totalSac = agentesFiltrados.filter((a) => a.nicho === 'SAC').length
  const totalClinica = agentesFiltrados.filter((a) => a.nicho === 'CLINICA').length
  const totalDependentes = agentesFiltrados.reduce((acc, item) => acc + (item.dependentes || 0), 0)

  const nomeMesAniversarioSelecionado = MESES.find((m) => m.value === (filtroMesAniversario || mesAtual))?.label || 'Mês atual'
  const nomeMesSeguinte = MESES.find((m) => m.value === mesSeguinte)?.label || 'Próximo mês'

  return (
    <main className="min-h-screen bg-[#ddf1ff] p-6">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">

        {/* Header */}
        <div className="rounded-[28px] border border-[#bfe3fb] bg-white/80 p-6 shadow-[0_12px_40px_rgba(40,163,254,0.10)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-wide text-[#1d1d1f] md:text-5xl">INFORMAÇÕES DE OPERADORES</h1>
              <p className="mt-2 text-sm text-gray-600">Cadastro, consulta e filtros inteligentes dos agentes.</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {role !== 'marketing' && <ImportarAgentes onImportado={carregarAgentes} />}
              {role === 'marketing' ? (
                <button type="button" disabled title="Cadastro bloqueado para marketing"
                  className="cursor-not-allowed rounded-2xl bg-[#9fd6ff] px-5 py-3 text-sm font-semibold text-white shadow opacity-70">
                  + Novo Agente
                </button>
              ) : (
                <button onClick={abrirNovo}
                  className="rounded-2xl bg-[#28a3fe] px-5 py-3 text-sm font-semibold text-white shadow hover:opacity-95">
                  + Novo Agente
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filtros */}
        <section className="rounded-[28px] border border-[#bfe3fb] bg-white p-5 shadow-[0_12px_35px_rgba(40,163,254,0.08)]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <input value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, abreviação ou cidade"
              className="rounded-2xl border border-[#cde9fb] px-4 py-3 outline-none focus:border-[#28a3fe]" />
            <select value={filtroCargo} onChange={(e) => setFiltroCargo(e.target.value)}
              className="rounded-2xl border border-[#cde9fb] px-4 py-3 outline-none focus:border-[#28a3fe]">
              <option value="">Todos os cargos</option>
              {cargosDisponiveis.map((cargo) => <option key={cargo} value={cargo}>{cargo}</option>)}
            </select>
            <select value={filtroNicho} onChange={(e) => setFiltroNicho(e.target.value)}
              className="rounded-2xl border border-[#cde9fb] px-4 py-3 outline-none focus:border-[#28a3fe]">
              <option value="">Todos os nichos</option>
              {nichosDisponiveis.map((nicho) => <option key={nicho} value={nicho}>{nicho}</option>)}
            </select>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
              className="rounded-2xl border border-[#cde9fb] px-4 py-3 outline-none focus:border-[#28a3fe]">
              <option value="">Todos os estados</option>
              {estados.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
            <select value={filtroAdmissaoAno} onChange={(e) => setFiltroAdmissaoAno(e.target.value)}
              className="rounded-2xl border border-[#cde9fb] px-4 py-3 outline-none focus:border-[#28a3fe]">
              <option value="">Ano de admissão</option>
              {anosAdmissao.map((ano) => <option key={ano} value={ano}>{ano}</option>)}
            </select>
            <select value={filtroMesAniversario} onChange={(e) => setFiltroMesAniversario(e.target.value)}
              className="rounded-2xl border border-[#cde9fb] px-4 py-3 outline-none focus:border-[#28a3fe]">
              <option value="">Mês de aniversário</option>
              {MESES.map((mes) => <option key={mes.value} value={mes.value}>{mes.label}</option>)}
            </select>
          </div>
        </section>

        {/* Cards resumo */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CardResumo titulo="Total de agentes" valor={String(totalAgentes)} />
          <CardResumo titulo="Nicho SAC" valor={String(totalSac)} />
          <CardResumo titulo="Nicho Clínica" valor={String(totalClinica)} />
          <CardResumo titulo="Dependentes" valor={String(totalDependentes)} />
        </section>

        {/* Aniversariantes */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-[28px] border border-[#ffd8e8] bg-white p-5 shadow-[0_12px_35px_rgba(255,102,163,0.10)]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#1d1d1f]">🎈 Aniversariantes de {nomeMesAniversarioSelecionado}</h2>
                <p className="text-sm text-gray-500">Nome abreviado e data de nascimento dos aniversariantes do mês.</p>
              </div>
              <span className="rounded-full bg-[#fff0f7] px-3 py-1 text-xs font-bold text-[#d94c8a]">{aniversariantesDoMes.length} no mês</span>
            </div>
            {aniversariantesDoMes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#ffd6e6] bg-[#fff8fb] p-6 text-center text-sm text-gray-500">
                Nenhum aniversariante encontrado para este mês.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {aniversariantesDoMes.map((agente) => (
                  <div key={agente.id} className="rounded-[22px] border border-[#ffd6e6] bg-[#fff8fb] p-4 shadow-[0_8px_24px_rgba(255,102,163,0.08)]">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#d94c8a]">🎈 Aniversariante</p>
                    <h3 className="mt-2 text-lg font-extrabold text-[#1d1d1f]">{agente.nome_abreviado || agente.nome_completo}</h3>
                    <p className="mt-1 text-sm text-gray-600">Data: {formatDate(agente.data_nascimento)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-[28px] border border-[#ffd8e8] bg-[#fffafc] p-5 shadow-[0_12px_35px_rgba(255,102,163,0.08)]">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-[#1d1d1f]">🎈 Próximos aniversários</h3>
              <p className="text-sm text-gray-500">{nomeMesSeguinte}</p>
            </div>
            {proximosAniversarios.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum registro para o próximo mês.</p>
            ) : (
              <div className="space-y-3">
                {proximosAniversarios.map((agente) => (
                  <div key={agente.id} className="rounded-2xl border border-[#ffe0ec] bg-white px-4 py-3">
                    <p className="text-sm font-bold text-[#1d1d1f]">{agente.nome_abreviado || agente.nome_completo}</p>
                    <p className="text-xs text-gray-500">{formatDate(agente.data_nascimento)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Tempo de serviço */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-[28px] border border-[#ffe6bf] bg-white p-5 shadow-[0_12px_35px_rgba(255,171,64,0.12)]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#1d1d1f]">🚀 Comemoração de Tempo de Serviço</h2>
                <p className="text-sm text-gray-500">Colaboradores que estão completando mais um ano de empresa neste mês.</p>
              </div>
              <span className="rounded-full bg-[#fff6e8] px-3 py-1 text-xs font-bold text-[#d88b1f]">{comemoracaoTempoServico.length} no mês</span>
            </div>
            {comemoracaoTempoServico.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#ffe0ad] bg-[#fffaf1] p-6 text-center text-sm text-gray-500">
                Nenhuma comemoração de tempo de serviço neste mês.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {comemoracaoTempoServico.map((agente) => (
                  <div key={agente.id} className="rounded-[22px] border border-[#ffe0ad] bg-[#fffaf1] p-4 shadow-[0_8px_24px_rgba(255,171,64,0.10)]">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#d88b1f]">🚀 Tempo de serviço</p>
                    <h3 className="mt-2 text-lg font-extrabold text-[#1d1d1f]">{agente.nome_abreviado || agente.nome_completo}</h3>
                    <p className="mt-1 text-sm text-gray-600">Admissão: {formatDate(agente.data_admissao)}</p>
                    <p className="mt-1 text-sm font-semibold text-[#8a5a13]">
                      🎉 Completando {calcularAnosEmpresa(agente.data_admissao)} ano(s) de empresa
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-[28px] border border-[#ffe6bf] bg-[#fffaf3] p-5 shadow-[0_12px_35px_rgba(255,171,64,0.10)]">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-[#1d1d1f]">🚀 Próximas comemorações</h3>
              <p className="text-sm text-gray-500">{nomeMesSeguinte}</p>
            </div>
            {proximasComemoracoes.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum registro para o próximo mês.</p>
            ) : (
              <div className="space-y-3">
                {proximasComemoracoes.map((agente) => (
                  <div key={agente.id} className="rounded-2xl border border-[#ffe7c1] bg-white px-4 py-3">
                    <p className="text-sm font-bold text-[#1d1d1f]">{agente.nome_abreviado || agente.nome_completo}</p>
                    <p className="text-xs text-gray-500">{formatDate(agente.data_admissao)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Tabela — colunas: Nome completo, Nome abreviado, Cargo, Nicho, Endereço, Admissão, Nascimento, Ramal, Ações */}
        <section className="rounded-[28px] border border-[#bfe3fb] bg-white p-5 shadow-[0_12px_35px_rgba(40,163,254,0.08)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#1d1d1f]">Lista de agentes</h2>
            <span className="text-sm text-gray-500">{agentesFiltrados.length} registro(s)</span>
          </div>
          <div className="overflow-auto rounded-2xl border border-[#d8edf9]">
            <table className="w-full text-sm">
              <thead className="bg-[#28a3fe] text-white">
                <tr>
                  <Th>Nome completo</Th>
                  <Th>Nome abreviado</Th>
                  <Th>Cargo</Th>
                  <Th>Nicho</Th>
                  <Th>Endereço completo</Th>
                  <Th>Admissão</Th>
                  <Th>Nascimento</Th>
                  <Th>Ramal</Th>
                  <Th>Ações</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="p-6 text-center text-gray-500">Carregando...</td></tr>
                ) : agentesFiltrados.length === 0 ? (
                  <tr><td colSpan={9} className="p-6 text-center text-gray-500">Nenhum agente encontrado.</td></tr>
                ) : (
                  agentesFiltrados.map((agente) => (
                    <tr key={agente.id} className="border-t border-[#e9f5fd] hover:bg-[#f7fbff] transition-colors">
                      <Td strong>{agente.nome_completo}</Td>
                      <Td>{agente.nome_abreviado || '-'}</Td>
                      <Td>
                        {agente.cargo ? (
                          <span className="rounded-full bg-[#e8f4fe] px-2.5 py-1 text-xs font-semibold text-[#1a7fd4]">
                            {agente.cargo}
                          </span>
                        ) : '-'}
                      </Td>
                      <Td>
                        {agente.nicho ? (
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            agente.nicho === 'SAC'
                              ? 'bg-[#e6f9f0] text-[#1a8a56]'
                              : agente.nicho === 'CLINICA'
                              ? 'bg-[#f3eeff] text-[#7c3aed]'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {agente.nicho}
                          </span>
                        ) : '-'}
                      </Td>
                      <Td>{montarEnderecoCompleto(agente.endereco ?? null, agente.cidade ?? null, agente.estado ?? null) || '-'}</Td>
                      <Td>{formatDate(agente.data_admissao)}</Td>
                      <Td>{formatDate(agente.data_nascimento)}</Td>
                      <Td>{agente.ramal || '-'}</Td>
                      <Td>
                        <div className="flex gap-2">
                          {role === 'marketing' ? (
                            <>
                              <button type="button" disabled title="Edição bloqueada para marketing"
                                className="cursor-not-allowed rounded-xl border border-[#9fd6ff] px-3 py-1.5 text-xs font-semibold text-[#7abce8] opacity-70">Editar</button>
                              <button type="button" disabled title="Exclusão bloqueada para marketing"
                                className="cursor-not-allowed rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-300 opacity-70">Excluir</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => abrirEdicao(agente)}
                                className="rounded-xl border border-[#28a3fe] px-3 py-1.5 text-xs font-semibold text-[#28a3fe] hover:bg-[#e8f4fe] transition-colors">Editar</button>
                              <button onClick={() => excluirAgente(agente.id)}
                                className="rounded-xl border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors">Excluir</button>
                            </>
                          )}
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

      {/* Modal novo/editar */}
      {openModal && role !== 'marketing' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[95vh] w-full max-w-5xl overflow-auto rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-2xl font-extrabold text-[#1d1d1f]">{editingId ? 'Editar Agente' : 'Novo Agente'}</h3>
              <button onClick={() => setOpenModal(false)} className="rounded-xl border px-4 py-2 text-sm">Fechar</button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Nome completo">
                <input value={form.nome_completo} onChange={(e) => handleChange('nome_completo', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Nome abreviado">
                <input value={form.nome_abreviado} onChange={(e) => handleChange('nome_abreviado', e.target.value)}
                  placeholder="Auto-gerado do nome completo" className={inputClass} />
              </Field>
              <Field label="Carga horária">
                <input value={form.carga_horaria} onChange={(e) => handleChange('carga_horaria', e.target.value)}
                  placeholder="Ex: 07h às 15h12" className={inputClass} />
              </Field>
              <Field label="Cargo">
                <input value={form.cargo} onChange={(e) => handleChange('cargo', e.target.value)}
                  placeholder="Ex: TELEFONISTA" list="lista-cargos" className={inputClass} />
                <datalist id="lista-cargos">
                  {cargosDisponiveis.map((c) => <option key={c} value={c} />)}
                </datalist>
              </Field>
              <Field label="CEP">
                <input value={form.cep} onChange={(e) => handleChange('cep', e.target.value)}
                  onBlur={() => buscarCep(form.cep)} className={inputClass} />
              </Field>
              <Field label="Endereço">
                <input value={form.endereco} onChange={(e) => handleChange('endereco', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Cidade">
                <input value={form.cidade} onChange={(e) => handleChange('cidade', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Estado">
                <input value={form.estado} onChange={(e) => handleChange('estado', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Data de admissão">
                <input type="date" value={form.data_admissao} onChange={(e) => handleChange('data_admissao', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Data de nascimento">
                <input type="date" value={form.data_nascimento} onChange={(e) => handleChange('data_nascimento', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Dependentes">
                <input type="number" value={form.dependentes} onChange={(e) => handleChange('dependentes', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Nicho">
                <input value={form.nicho} onChange={(e) => handleChange('nicho', e.target.value)}
                  placeholder="Ex: SAC" list="lista-nichos" className={inputClass} />
                <datalist id="lista-nichos">
                  {nichosDisponiveis.map((n) => <option key={n} value={n} />)}
                </datalist>
              </Field>
              <Field label="Previsão de férias">
                <input type="date" value={form.previsao_ferias} onChange={(e) => handleChange('previsao_ferias', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Dias de férias">
                <input type="number" value={form.dias_ferias} onChange={(e) => handleChange('dias_ferias', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Ramal">
                <input value={form.ramal} onChange={(e) => handleChange('ramal', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Telefone">
                <input value={form.telefone} onChange={(e) => handleChange('telefone', e.target.value)} className={inputClass} />
              </Field>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setOpenModal(false)}
                className="rounded-2xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700">Cancelar</button>
              <button onClick={salvarAgente} disabled={saving}
                className="rounded-2xl bg-[#28a3fe] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTES
// ─────────────────────────────────────────────────────────────────────────────

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
  return <th className="px-4 py-3 text-left text-sm font-bold whitespace-nowrap">{children}</th>
}

function Td({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <td className={`px-4 py-3 align-middle text-sm ${strong ? 'font-semibold text-[#1d1d1f]' : 'text-gray-700'}`}>
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

const inputClass = 'h-12 rounded-2xl border border-[#cde9fb] px-4 outline-none focus:border-[#28a3fe]'
