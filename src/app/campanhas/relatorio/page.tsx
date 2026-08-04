'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type StatusFone =
  | 'Aguardando aprovação'
  | 'Solicitação aprovada'
  | 'Enviado fone'
  | 'Recebido o fone'

type Linha = {
  id: string
  campanha: 'Elogio Premiado' | 'Reciclagem' | 'Vale' | 'Solicitar novo fone'
  data: string
  nicho?: 'SAC' | 'Clínica' | '-'   // Vale não tem nicho → '-'
  nome: string
  // Elogio
  tipo_elogio?: string | null        // 👈 novo
  empresa?: string | null
  telefone_protocolo?: string | null
  elogio?: string | null
  // Reciclagem
  empresas_prioridade?: string | null
  empresas_dificuldade?: string | null
  preparado?: boolean | null
  preferencia_horario?: string | null
  duas_no_mesmo_dia?: boolean | null
  // Vale
  valor?: number | null
  ciente?: boolean | null
  // Solicitação de fone
  cep?: string | null
  rua?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  cpf?: string | null
  telefone?: string | null
  email?: string | null
  status_fone?: StatusFone | null

  created_at: string
}

export default function RelatoriosCampanhas() {
  const router = useRouter()

  // --------- PROTEÇÃO: somente supervisão ----------
  useEffect(() => {
    async function verificarPermissao() {
      const { data } = await supabase.auth.getSession()
      const email = data.session?.user?.email
      if (!email) {
        router.replace('/login?next=' + window.location.pathname)
        return
      }
      if (email !== 'supervisao@sonax.net.br') {
        alert('Acesso restrito à supervisão.')
        router.replace('/')
      }
    }
    verificarPermissao()
  }, [router])
  // --------------------------------------------------

  const hoje = new Date().toISOString().slice(0,10)
  const [dataIni, setDataIni] = useState(hoje)
  const [dataFim, setDataFim] = useState(hoje)
  const [fNicho, setFNicho] = useState<string>('Todos')
  const [fCampanha, setFCampanha] = useState<string>('Todas')
  const [fTipoElogio, setFTipoElogio] = useState<'Todos' | 'Ligação' | 'Chat'>('Todos') // 👈 novo filtro
  const [qNome, setQNome] = useState('')

  const [linhas, setLinhas] = useState<Linha[]>([])
  const [loading, setLoading] = useState(false)
  const [salvandoStatusId, setSalvandoStatusId] = useState<string | null>(null)

  function atalhoHoje(){
    const d = new Date().toISOString().slice(0,10)
    setDataIni(d); setDataFim(d)
  }
  function atalhoSemana() {
    const d = new Date(); const dow = d.getDay() || 7
    const ini = new Date(d); ini.setDate(d.getDate() - (dow-1))
    const fim = new Date(ini); fim.setDate(ini.getDate()+6)
    setDataIni(ini.toISOString().slice(0,10)); setDataFim(fim.toISOString().slice(0,10))
  }
  function atalhoMes() {
    const d = new Date()
    const ini = new Date(d.getFullYear(), d.getMonth(), 1)
    const fim = new Date(d.getFullYear(), d.getMonth()+1, 0)
    setDataIni(ini.toISOString().slice(0,10)); setDataFim(fim.toISOString().slice(0,10))
  }

  async function buscar() {
    setLoading(true)
    try {
      // ELOGIOS (já trazendo tipo_elogio)
      const elogiosQ = supabase
        .from('campanha_elogio')
        .select('id, created_at, data, nicho, nome, empresa, telefone_protocolo, elogio, tipo_elogio')
        .gte('data', dataIni).lte('data', dataFim)

      // RECICLAGENS
      const reciclagemQ = supabase
        .from('campanha_reciclagem')
        .select('id, created_at, data, nicho, nome, empresas_prioridade, empresas_dificuldade, preparado, preferencia_horario, duas_no_mesmo_dia')
        .gte('data', dataIni).lte('data', dataFim)

      // VALE
      const valeQ = supabase
        .from('campanha_vale')
        .select('id, created_at, data, nome, valor, ciente')
        .gte('data', dataIni).lte('data', dataFim)

      // SOLICITAÇÕES DE NOVO FONE
      const foneQ = supabase
        .from('solicitacoes_fone')
        .select('id, created_at, data, nome, cep, rua, numero, bairro, cidade, estado, cpf, telefone, email, ciente, status_fone')
        .gte('data', dataIni).lte('data', dataFim)

      const [
        { data: elogios, error: e1 },
        { data: recs, error: e2 },
        { data: vales, error: e3 },
        { data: fones, error: e4 }
      ] = await Promise.all([elogiosQ, reciclagemQ, valeQ, foneQ])

      if (e1) throw e1
      if (e2) throw e2
      if (e3) throw e3
      if (e4) {
        console.error('Erro ao consultar solicitacoes_fone:', e4)
        throw new Error(`Não foi possível consultar as solicitações de fone: ${e4.message}. Verifique a política SELECT/RLS da tabela solicitacoes_fone.`)
      }

      const L1: Linha[] = (elogios ?? []).map((r:any)=>({
        id: r.id,
        campanha: 'Elogio Premiado',
        data: r.data,
        nicho: r.nicho,
        nome: r.nome,
        tipo_elogio: r.tipo_elogio ?? null, // 👈 guardando
        empresa: r.empresa,
        telefone_protocolo: r.telefone_protocolo,
        elogio: r.elogio,
        created_at: r.created_at
      }))
      const L2: Linha[] = (recs ?? []).map((r:any)=>({
        id: r.id,
        campanha: 'Reciclagem',
        data: r.data,
        nicho: r.nicho,
        nome: r.nome,
        empresas_prioridade: r.empresas_prioridade,
        empresas_dificuldade: r.empresas_dificuldade,
        preparado: r.preparado,
        preferencia_horario: r.preferencia_horario,
        duas_no_mesmo_dia: r.duas_no_mesmo_dia,
        created_at: r.created_at
      }))
      const L3: Linha[] = (vales ?? []).map((r:any)=>({
        id: r.id,
        campanha: 'Vale',
        data: r.data,
        nicho: '-',
        nome: r.nome,
        valor: typeof r.valor === 'number' ? r.valor : (r.valor ? Number(r.valor) : null),
        ciente: r.ciente,
        created_at: r.created_at
      }))
      const L4: Linha[] = (fones ?? []).map((r:any)=>({
        id: r.id,
        campanha: 'Solicitar novo fone',
        data: r.data,
        nicho: '-',
        nome: r.nome,
        cep: r.cep,
        rua: r.rua,
        numero: r.numero,
        bairro: r.bairro,
        cidade: r.cidade,
        estado: r.estado,
        cpf: r.cpf,
        telefone: r.telefone,
        email: r.email,
        ciente: r.ciente,
        status_fone: r.status_fone ?? 'Aguardando aprovação',
        created_at: r.created_at
      }))

      let all = [...L1, ...L2, ...L3, ...L4]

      // Filtros de campanha/nicho/nome
      if (fCampanha !== 'Todas') all = all.filter(l => l.campanha === fCampanha as any)
      if (fNicho !== 'Todos')   all = all.filter(l => l.nicho === fNicho)
      const nq = qNome.trim().toLowerCase()
      if (nq) all = all.filter(l => l.nome.toLowerCase().includes(nq))

      // 👇 filtro de tipo de elogio: aplica só em Elogio Premiado
      if (fTipoElogio !== 'Todos') {
        all = all.filter(l => {
          if (l.campanha !== 'Elogio Premiado') return true // não filtra os outros
          return (l.tipo_elogio ?? '').toLowerCase() === fTipoElogio.toLowerCase()
        })
      }

      // Ordenação: data desc, depois nome
      all.sort((a,b)=> a.data===b.data ? a.nome.localeCompare(b.nome) : (a.data < b.data ? 1 : -1))
      setLinhas(all)
    } catch (err:any) {
      alert('Erro ao buscar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ buscar() }, [])

  const statusFoneOpcoes: StatusFone[] = [
    'Aguardando aprovação',
    'Solicitação aprovada',
    'Enviado fone',
    'Recebido o fone'
  ]

  function classeStatusFone(status: StatusFone | null | undefined) {
    switch (status) {
      case 'Solicitação aprovada':
        return 'border-green-300 bg-green-50 text-green-700'
      case 'Enviado fone':
        return 'border-blue-300 bg-blue-50 text-blue-700'
      case 'Recebido o fone':
        return 'border-purple-300 bg-purple-50 text-purple-700'
      default:
        return 'border-amber-300 bg-amber-50 text-amber-700'
    }
  }

  async function atualizarStatusFone(id: string, status: StatusFone) {
    setSalvandoStatusId(id)

    const statusAnterior = linhas.find(l => l.id === id && l.campanha === 'Solicitar novo fone')?.status_fone

    setLinhas(atual => atual.map(l =>
      l.id === id && l.campanha === 'Solicitar novo fone'
        ? { ...l, status_fone: status }
        : l
    ))

    const { error } = await supabase
      .from('solicitacoes_fone')
      .update({ status_fone: status })
      .eq('id', id)

    if (error) {
      setLinhas(atual => atual.map(l =>
        l.id === id && l.campanha === 'Solicitar novo fone'
          ? { ...l, status_fone: statusAnterior ?? 'Aguardando aprovação' }
          : l
      ))
      alert('Erro ao atualizar o status do fone: ' + error.message)
    }

    setSalvandoStatusId(null)
  }

  // CSV
  function csvEscape(v: any) { return `"${String(v ?? '').replace(/"/g,'""')}"` }
  function exportarCSV() {
    if (!linhas.length) { alert('Sem dados.'); return }
    const headers = [
      'Campanha','Data','Nicho','Nome',
      'Tipo de elogio',              // 👈 novo cabeçalho
      'Empresa','Telefone/Protocolo','Elogio',
      'Empresas prioridade','Empresas dificuldade','Preparado','Preferência','Duas no mesmo dia',
      'Valor','Ciente',
      'CEP','Rua','Número','Bairro','Cidade','Estado','CPF','Telefone','E-mail','Status do fone',
      'Criado em'
    ]
    const rows = linhas.map(l => [
      l.campanha,
      l.data,
      l.nicho ?? '',
      l.nome,
      l.campanha === 'Elogio Premiado' ? (l.tipo_elogio ?? '') : '',   // 👈 só pros elogios
      // Elogio
      l.empresa ?? '',
      l.telefone_protocolo ?? '',
      l.elogio ?? '',
      // Reciclagem
      l.empresas_prioridade ?? '',
      l.empresas_dificuldade ?? '',
      l.preparado === true ? 'Sim' : l.preparado === false ? 'Não' : '',
      l.preferencia_horario ?? '',
      l.duas_no_mesmo_dia === true ? 'Sim' : l.duas_no_mesmo_dia === false ? 'Não' : '',
      // Vale
      (l.valor ?? '') as any,
      l.ciente === true ? 'Sim' : l.ciente === false ? 'Não' : '',
      // Solicitação de fone
      l.cep ?? '',
      l.rua ?? '',
      l.numero ?? '',
      l.bairro ?? '',
      l.cidade ?? '',
      l.estado ?? '',
      l.cpf ?? '',
      l.telefone ?? '',
      l.email ?? '',
      l.campanha === 'Solicitar novo fone' ? (l.status_fone ?? 'Aguardando aprovação') : '',
      // fim
      new Date(l.created_at).toLocaleString('pt-BR')
    ].map(csvEscape).join(';'))
    const conteudo = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n')
    const blob = new Blob([conteudo], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `campanhas_${dataIni}_a_${dataFim}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#2687e2]">Relatórios — Campanhas</h1>
          <div className="flex gap-2">
            <a
              href="/"
              className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
            >
              Inicio
            </a>
            <a
              href="/campanhas"
              className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
            >
              Formulário
            </a>
          </div>
        </header>

        {/* Filtros */}
        <div className="rounded-xl bg-white p-6 shadow space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Data inicial</label>
              <input
                type="date"
                value={dataIni}
                onChange={e=>setDataIni(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Data final</label>
              <input
                type="date"
                value={dataFim}
                onChange={e=>setDataFim(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Nicho</label>
              <select
                value={fNicho}
                onChange={e=>setFNicho(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
              >
                {['Todos','SAC','Clínica'].map(n=><option key={n} value={n}>{n}</option>)}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                * Registros de Vale e Solicitar novo fone aparecem apenas quando Nicho = “Todos”.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Campanha</label>
              <select
                value={fCampanha}
                onChange={e=>setFCampanha(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
              >
                {['Todas','Elogio Premiado','Reciclagem','Vale','Solicitar novo fone'].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {/* Filtro novo */}
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">
                Tipo de elogio
              </label>
              <select
                value={fTipoElogio}
                onChange={e=>setFTipoElogio(e.target.value as any)}
                className="w-full rounded-lg border p-2 text-[#535151]"
              >
                <option value="Todos">Todos</option>
                <option value="Ligação">Ligação</option>
                <option value="Chat">Chat</option>
              </select>
              <p className="text-[11px] text-gray-400">
                (Só afeta “Elogio Premiado”)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="grow">
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Filtrar por Nome</label>
              <input
                type="text"
                value={qNome}
                onChange={e=>setQNome(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
                placeholder="Digite o nome"
              />
            </div>
            <div className="flex gap-2">
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

            <div className="ml-auto flex gap-2">
              <button
                onClick={buscar}
                disabled={loading}
                className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Buscando…' : 'Aplicar filtros'}
              </button>
              <button
                onClick={exportarCSV}
                disabled={!linhas.length}
                className="rounded-lg border border-[#2687e2] px-4 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white disabled:opacity-40"
              >
                Exportar CSV
              </button>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="rounded-xl bg-white p-6 shadow">
          {!linhas.length ? (
            <p className="text-gray-500">Nenhum registro no período/critério.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-sm text-gray-600">
                    <th className="border-b p-2">Campanha</th>
                    <th className="border-b p-2">Data</th>
                    <th className="border-b p-2">Nicho</th>
                    <th className="border-b p-2">Nome</th>
                    <th className="border-b p-2">Informações principais</th>
                    <th className="border-b p-2">Detalhes</th>
                    <th className="border-b p-2">Status do fone</th>
                    <th className="border-b p-2">Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(l=>(
                    <tr key={`${l.campanha}-${l.id}`} className="text-sm">
                      <td className="border-b p-2 text-[#535151]">
                        {l.campanha}
                        {l.campanha === 'Elogio Premiado' && l.tipo_elogio ? (
                          <div className="text-[11px] text-gray-400">({l.tipo_elogio})</div>
                        ) : null}
                      </td>
                      <td className="border-b p-2 text-[#535151]">{l.data}</td>
                      <td className="border-b p-2 text-[#535151]">{l.nicho ?? '-'}</td>
                      <td className="border-b p-2 text-[#535151] font-medium">{l.nome}</td>

                      <td className="border-b p-2 text-[#535151]">
                        {l.campanha==='Elogio Premiado' ? (
                          <>
                            <div>
                              <span className="font-semibold" style={{color:'#ff751f'}}>Tipo:</span> {l.tipo_elogio ?? '-'}
                            </div>
                            <div>
                              <span className="font-semibold" style={{color:'#ff751f'}}>Empresa:</span> {l.empresa ?? '-'}
                            </div>
                            <div>
                              <span className="font-semibold" style={{color:'#ff751f'}}>Fone/Protocolo:</span> {l.telefone_protocolo ?? '-'}
                            </div>
                          </>
                        ) : l.campanha==='Reciclagem' ? (
                          <>
                            <div>
                              <span className="font-semibold" style={{color:'#ff751f'}}>Preferência:</span> {l.preferencia_horario ?? '-'}
                            </div>
                            <div>
                              <span className="font-semibold" style={{color:'#ff751f'}}>Duas no mesmo dia:</span> {l.duas_no_mesmo_dia===true?'Sim':l.duas_no_mesmo_dia===false?'Não':'-'}
                            </div>
                          </>
                        ) : l.campanha==='Vale' ? (
                          <>
                            <div>
                              <span className="font-semibold" style={{color:'#ff751f'}}>Valor:</span>{' '}
                              {typeof l.valor==='number'
                                ? l.valor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
                                : '-'}
                            </div>
                            <div>
                              <span className="font-semibold" style={{color:'#ff751f'}}>Ciente:</span> {l.ciente===true?'Sim':l.ciente===false?'Não':'-'}
                            </div>
                          </>
                        ) : (
                          <>
                            <div><span className="font-semibold" style={{color:'#ff751f'}}>Telefone:</span> {l.telefone ?? '-'}</div>
                            <div><span className="font-semibold" style={{color:'#ff751f'}}>E-mail:</span> {l.email ?? '-'}</div>
                            <div><span className="font-semibold" style={{color:'#ff751f'}}>CPF:</span> {l.cpf ?? '-'}</div>
                          </>
                        )}
                      </td>

                      <td className="border-b p-2 text-[#535151]">
                        {l.campanha==='Elogio Premiado' ? (
                          <div className="whitespace-pre-line">{l.elogio}</div>
                        ) : l.campanha==='Reciclagem' ? (
                          <>
                            <div>
                              <span className="font-semibold" style={{color:'#ff751f'}}>Prioridade:</span> {l.empresas_prioridade ?? '-'}
                            </div>
                            <div>
                              <span className="font-semibold" style={{color:'#ff751f'}}>Dificuldade:</span> {l.empresas_dificuldade ?? '-'}
                            </div>
                            <div>
                              <span className="font-semibold" style={{color:'#ff751f'}}>Preparado:</span> {l.preparado===true?'Sim':l.preparado===false?'Não':'-'}
                            </div>
                          </>
                        ) : l.campanha==='Vale' ? (
                          '-'
                        ) : (
                          <>
                            <div><span className="font-semibold" style={{color:'#ff751f'}}>CEP:</span> {l.cep ?? '-'}</div>
                            <div><span className="font-semibold" style={{color:'#ff751f'}}>Endereço:</span> {l.rua ?? '-'}, {l.numero ?? '-'}</div>
                            <div><span className="font-semibold" style={{color:'#ff751f'}}>Bairro:</span> {l.bairro ?? '-'}</div>
                            <div><span className="font-semibold" style={{color:'#ff751f'}}>Cidade/UF:</span> {l.cidade ?? '-'} / {l.estado ?? '-'}</div>
                            <div><span className="font-semibold" style={{color:'#ff751f'}}>Dados conferidos:</span> {l.ciente===true?'Sim':l.ciente===false?'Não':'-'}</div>
                          </>
                        )}
                      </td>

                      <td className="border-b p-2 text-[#535151]">
                        {l.campanha === 'Solicitar novo fone' ? (
                          <div className="min-w-[190px]">
                            <select
                              value={l.status_fone ?? 'Aguardando aprovação'}
                              onChange={e => atualizarStatusFone(l.id, e.target.value as StatusFone)}
                              disabled={salvandoStatusId === l.id}
                              className={`w-full rounded-lg border px-3 py-2 text-xs font-semibold outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${classeStatusFone(l.status_fone)}`}
                            >
                              {statusFoneOpcoes.map(status => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                            {salvandoStatusId === l.id && (
                              <div className="mt-1 text-[11px] text-gray-400">Salvando status...</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      <td className="border-b p-2 text-[#535151]">
                        {new Date(l.created_at).toLocaleString('pt-BR')}
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