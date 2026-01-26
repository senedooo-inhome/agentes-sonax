'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend)

// ✅ Plugin para escrever valor em cima das barras (tema claro)
const topValuePlugin: any = {
  id: 'topValue',
  afterDatasetsDraw(chart: any) {
    const { ctx } = chart
    const dataset = chart.data.datasets[0]
    const meta = chart.getDatasetMeta(0)

    ctx.save()
    ctx.font = '700 12px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = '#111827'

    meta.data.forEach((bar: any, index: number) => {
      const value = dataset.data[index] as number
      if (value == null) return
      const pos = bar.tooltipPosition()
      ctx.fillText(String(value), pos.x, pos.y - 6)
    })

    ctx.restore()
  },
}
ChartJS.register(topValuePlugin)

type Stats = {
  ferias: number
  atestados: number
  folgas: number
  errosClinicas: number
  errosSac: number
  ligacoesClinicas: number
  ligacoesSac: number
  totalAgentes: number
}

type ResumoStatus = { label: string; valor: number }
type ErrosAgenteMap = Record<string, number>
type ErrosEmpresaMap = Record<string, number>

type PlantaoLinha = { nome: string; qtd: number }

// ✅ Data local (Brasil) -> "YYYY-MM-DD"
function toISODateLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMesAtualInfo() {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mesIndex = hoje.getMonth()
  const primeiroDia = new Date(ano, mesIndex, 1)
  const ultimoDia = new Date(ano, mesIndex + 1, 0)

  const meses = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ]

  return {
    ano,
    mesIndex,
    label: `${meses[mesIndex]} de ${ano}`,
    inicio: toISODateLocal(primeiroDia),
    fim: toISODateLocal(ultimoDia),
  }
}

/** ✅ Normaliza texto (para comparar e filtrar valores "Não informado" etc.) */
function normText(s: any) {
  return String(s ?? '')
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** ✅ Decide se a empresa é válida para aparecer no TOP */
function empresaValida(emp: any) {
  const n = normText(emp)
  if (!n) return false

  const blacklist = new Set([
    'nao informado',
    'não informado',
    'nao se aplica',
    'não se aplica',
    'n/a',
    'na',
    'sem empresa',
    'sem informacao',
    'sem informação',
    'undefined',
    'null',
    '-',
    '--',
    '0',
  ])

  if (blacklist.has(n)) return false
  if (!/[a-z0-9]/i.test(n)) return false
  return true
}

// =======================
// ✅ NOVO: Quadro feriado
// =======================
type Empresa = { id: number; nome: string }
type OperacaoRegistro = {
  id: number
  data: string // YYYY-MM-DD
  empresa_id: number
  status_operacao: string | null // "Sim" | "Não" (ou null)
  feriado: string | null
  observacao: string | null
  responsavel: string | null
  quem_adicionou: string | null
  created_at?: string | null
}

function hojeISO() {
  return toISODateLocal(new Date())
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    ferias: 0,
    atestados: 0,
    folgas: 0,
    errosClinicas: 0,
    errosSac: 0,
    ligacoesClinicas: 0,
    ligacoesSac: 0,
    totalAgentes: 0,
  })

  const [resumoStatus, setResumoStatus] = useState<ResumoStatus[]>([])

  const [errosPorAgente, setErrosPorAgente] = useState<ErrosAgenteMap>({})
  const [errosPorEmpresa, setErrosPorEmpresa] = useState<ErrosEmpresaMap>({})
  const [mesLabel, setMesLabel] = useState('')
  const [atualizando, setAtualizando] = useState(false)

  const [plantoesPorAgente, setPlantoesPorAgente] = useState<PlantaoLinha[]>([])
  const [agentesFerias, setAgentesFerias] = useState<string[]>([])

  // ✅ NOVO: dados do quadro feriado
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [proximoFeriado, setProximoFeriado] = useState<{ data: string; feriado: string } | null>(null)
  const [operacaoMap, setOperacaoMap] = useState<Record<number, 'Sim' | 'Não' | null>>({})
  const [salvandoEmpresaId, setSalvandoEmpresaId] = useState<number | null>(null)

  useEffect(() => {
    carregarDashboard()
    carregarQuadroFeriado()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function carregarQuadroFeriado() {
    try {
      // 1) lista de empresas
      const { data: empresasData, error: eEmp } = await supabase
        .from('empresas')
        .select('id, nome')
        .order('nome', { ascending: true })
      if (eEmp) throw eEmp
      setEmpresas((empresasData ?? []) as Empresa[])

      // 2) descobre o "próximo feriado" baseado na tabela operacao_empresas (primeira data >= hoje)
      const hoje = hojeISO()
      const { data: proxData, error: eProx } = await supabase
        .from('operacao_empresas')
        .select('data, feriado')
        .gte('data', hoje)
        .order('data', { ascending: true })
        .limit(1)

      if (eProx) throw eProx

      const prox = (proxData && proxData[0]) ? (proxData[0] as any) : null
      if (!prox?.data) {
        // sem feriado cadastrado futuro
        setProximoFeriado(null)
        setOperacaoMap({})
        return
      }

      const dataFeriado = String(prox.data)
      const nomeFeriado = String(prox.feriado ?? 'Feriado')

      setProximoFeriado({ data: dataFeriado, feriado: nomeFeriado })

      // 3) pega status_operacao de TODAS as empresas para essa data
      const { data: ops, error: eOps } = await supabase
        .from('operacao_empresas')
        .select('empresa_id, status_operacao')
        .eq('data', dataFeriado)

      if (eOps) throw eOps

      const map: Record<number, 'Sim' | 'Não' | null> = {}
      ;(ops ?? []).forEach((r: any) => {
        const empresaId = Number(r.empresa_id)
        const st = String(r.status_operacao ?? '').trim()
        map[empresaId] = st === 'Sim' ? 'Sim' : st === 'Não' ? 'Não' : null
      })
      setOperacaoMap(map)
    } catch (e: any) {
      console.error(e)
      alert('Erro ao carregar quadro do feriado: ' + (e?.message ?? String(e)))
    }
  }

  async function marcarOperacao(empresaId: number, status: 'Sim' | 'Não') {
    if (!proximoFeriado?.data) {
      return alert('Nenhum feriado futuro encontrado na tabela operacao_empresas.')
    }

    setSalvandoEmpresaId(empresaId)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const email = sess.session?.user?.email ?? null

      // ✅ upsert por (data, empresa_id) — precisa do UNIQUE que passei acima
      const { error } = await supabase.from('operacao_empresas').upsert(
        [
          {
            data: proximoFeriado.data,
            empresa_id: empresaId,
            status_operacao: status,
            feriado: proximoFeriado.feriado,
            quem_adicionou: email,
          },
        ],
        { onConflict: 'data,empresa_id' }
      )

      if (error) throw error

      setOperacaoMap((prev) => ({ ...prev, [empresaId]: status }))
    } catch (e: any) {
      console.error(e)
      alert('Erro ao salvar operação: ' + (e?.message ?? String(e)))
    } finally {
      setSalvandoEmpresaId(null)
    }
  }

  async function carregarDashboard() {
    setAtualizando(true)
    try {
      const { inicio, fim, label } = getMesAtualInfo()
      setMesLabel(label)

      const { count: totalAgentes } = await supabase.from('agentes').select('*', { count: 'exact', head: true })

      const [{ count: ferias }, { count: folgas }] = await Promise.all([
        supabase.from('agentes').select('*', { count: 'exact', head: true }).eq('status', 'Férias'),
        supabase.from('agentes').select('*', { count: 'exact', head: true }).eq('status', 'Folga'),
      ])

      const { data: feriasNomesData, error: feriasNomesErr } = await supabase
        .from('agentes')
        .select('nome')
        .eq('status', 'Férias')
        .order('nome', { ascending: true })

      if (feriasNomesErr) throw feriasNomesErr
      setAgentesFerias((feriasNomesData || []).map((x: any) => x.nome).filter(Boolean))

      const { count: atestados } = await supabase
        .from('atestados')
        .select('*', { count: 'exact', head: true })
        .gte('data', inicio)
        .lte('data', fim)

      const { data: presencasMes } = await supabase
        .from('presencas')
        .select('tipo')
        .gte('data_registro', inicio)
        .lte('data_registro', fim)

      const contagemPorTipo: Record<string, number> = {}
      presencasMes?.forEach((p: any) => {
        const tipo = (p.tipo || '').trim()
        if (!tipo) return
        contagemPorTipo[tipo] = (contagemPorTipo[tipo] || 0) + 1
      })

      const categorias = [
        { label: 'Presente', keys: ['Presente'] },
        { label: 'Plantão Final de Semana', keys: ['Plantão Final de Semana'] },
        { label: 'Folga', keys: ['Folga'] },
        { label: 'Férias', keys: ['Férias', 'Ferias'] },
        { label: 'Atestado', keys: ['Atestado', 'Atestados'] },
        { label: 'Afastado', keys: ['Afastado'] },
        { label: 'Licença Maternidade', keys: ['Licença Maternidade', 'Licenca Maternidade'] },
        { label: 'Licença Paternidade', keys: ['Licença Paternidade', 'Licenca Paternidade'] },
        { label: 'Ausente', keys: ['Ausente'] },
      ]

      const resumo: ResumoStatus[] = categorias.map((cat) => {
        let soma = 0
        cat.keys.forEach((k) => (soma += contagemPorTipo[k] || 0))
        return { label: cat.label, valor: soma }
      })
      setResumoStatus(resumo)

      const { data: plantoesData, error: ePlantao } = await supabase
        .from('presencas')
        .select(`tipo, agentes ( nome )`)
        .eq('tipo', 'Plantão Final de Semana')
        .gte('data_registro', inicio)
        .lte('data_registro', fim)

      if (ePlantao) throw ePlantao

      const mapPlantao: Record<string, number> = {}
      ;(plantoesData || []).forEach((r: any) => {
        const nome = r.agentes?.nome ?? '(sem nome)'
        mapPlantao[nome] = (mapPlantao[nome] || 0) + 1
      })

      const listaPlantao = Object.entries(mapPlantao)
        .map(([nome, qtd]) => ({ nome, qtd }))
        .sort((a, b) => b.qtd - a.qtd)

      setPlantoesPorAgente(listaPlantao)

      const { data: errosClinicasData } = await supabase
        .from('erros_agentes')
        .select('id, nicho, data, agente, empresa')
        .in('nicho', ['Clínica', 'Clinica'])
        .gte('data', inicio)
        .lte('data', fim)

      const { data: errosSacData } = await supabase
        .from('erros_agentes')
        .select('id, nicho, data, agente, empresa')
        .eq('nicho', 'SAC')
        .gte('data', inicio)
        .lte('data', fim)

      const todosErros = [...(errosClinicasData || []), ...(errosSacData || [])]

      const contadorErrosPorAgente: ErrosAgenteMap = todosErros.reduce((acc: any, item: any) => {
        const nome = item.agente || 'Não informado'
        acc[nome] = (acc[nome] || 0) + 1
        return acc
      }, {})

      const top5 = Object.entries(contadorErrosPorAgente)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)

      setErrosPorAgente(Object.fromEntries(top5))

      const contadorErrosPorEmpresa: ErrosEmpresaMap = todosErros.reduce((acc: any, item: any) => {
        const empRaw = item.empresa
        if (!empresaValida(empRaw)) return acc
        const empLabel = String(empRaw).trim()
        acc[empLabel] = (acc[empLabel] || 0) + 1
        return acc
      }, {})

      const top10Emp = Object.entries(contadorErrosPorEmpresa)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)

      setErrosPorEmpresa(Object.fromEntries(top10Emp))

      const { count: ligClinicas } = await supabase
        .from('ligacoes_ativas')
        .select('*', { count: 'exact', head: true })
        .in('nicho', ['Clínica', 'Clinica'])
        .gte('data', inicio)
        .lte('data', fim)

      const { count: ligSac } = await supabase
        .from('ligacoes_ativas')
        .select('*', { count: 'exact', head: true })
        .eq('nicho', 'SAC')
        .gte('data', inicio)
        .lte('data', fim)

      setStats({
        ferias: ferias || 0,
        atestados: atestados || 0,
        folgas: folgas || 0,
        errosClinicas: errosClinicasData?.length || 0,
        errosSac: errosSacData?.length || 0,
        ligacoesClinicas: ligClinicas || 0,
        ligacoesSac: ligSac || 0,
        totalAgentes: totalAgentes || 0,
      })
    } catch (e: any) {
      alert('Erro ao carregar dashboard: ' + (e?.message ?? String(e)))
    } finally {
      setAtualizando(false)
    }
  }

  const empresaTopBarData = useMemo(
    () => ({
      labels: Object.keys(errosPorEmpresa),
      datasets: [
        {
          label: 'Quantidade de erros (mês)',
          data: Object.values(errosPorEmpresa),
          backgroundColor: '#F5C542',
          borderRadius: 10,
        },
      ],
    }),
    [errosPorEmpresa]
  )

  const empresaTopBarOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      x: { ticks: { color: '#374151' }, grid: { color: '#e5e7eb' }, beginAtZero: true },
      y: { ticks: { color: '#111827' }, grid: { color: '#f3f4f6' } },
    },
  }

  const topBarData = useMemo(
    () => ({
      labels: Object.keys(errosPorAgente),
      datasets: [
        {
          label: 'Erros por agente (mês)',
          data: Object.values(errosPorAgente),
          backgroundColor: '#ef4444',
          borderRadius: 10,
        },
      ],
    }),
    [errosPorAgente]
  )

  const topBarOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      x: { ticks: { color: '#374151' }, grid: { color: '#e5e7eb' }, beginAtZero: true },
      y: { ticks: { color: '#111827' }, grid: { color: '#f3f4f6' } },
    },
  }

  const topPlantoes = useMemo(() => plantoesPorAgente.slice(0, 10), [plantoesPorAgente])

  const simCount = useMemo(
    () => empresas.filter((e) => operacaoMap[e.id] === 'Sim').length,
    [empresas, operacaoMap]
  )
  const naoCount = useMemo(
    () => empresas.filter((e) => (operacaoMap[e.id] ?? 'Não') === 'Não').length,
    [empresas, operacaoMap]
  )

  return (
    <main className="w-full min-h-screen bg-[#f5f6f7]">
      <div className="w-full px-6 py-6">
        {/* HEADER */}
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#2687e2]">
              Dashboard Sonax In Home
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Visão do mês de <span className="font-semibold capitalize">{mesLabel}</span>
            </p>
          </div>

          <button
            onClick={() => {
              carregarDashboard()
              carregarQuadroFeriado()
            }}
            className="rounded-lg border border-[#2687e2] px-4 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white disabled:opacity-50"
            disabled={atualizando}
            title="Atualizar dados"
          >
            {atualizando ? 'Atualizando…' : 'Atualizar'}
          </button>
        </header>

        {/* CARDS */}
        <section className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card titulo="Férias (status atual)" valor={stats.ferias} />
          <Card titulo="Atestados no mês" valor={stats.atestados} />
          <Card titulo="Folgas (status atual)" valor={stats.folgas} />
          <Card titulo="Erros Clínicas no mês" valor={stats.errosClinicas} corValor="#ef4444" />
          <Card titulo="Erros SAC no mês" valor={stats.errosSac} corValor="#ef4444" />
          <Card titulo="Ligações ativas Clínicas no mês" valor={stats.ligacoesClinicas} />
          <Card titulo="Ligações ativas SAC no mês" valor={stats.ligacoesSac} />
          <Card titulo="Total de Agentes" valor={stats.totalAgentes} destaque />
        </section>

        {/* GRÁFICOS */}
        <section className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-2xl shadow p-6 h-[360px]">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Empresas com mais erros (Top 10)</h2>
            <div className="h-[280px]">
              <Bar data={empresaTopBarData} options={empresaTopBarOptions} />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              *Somente empresas válidas (remove “Não informado” e “Não se aplica”).
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl shadow p-6 h-[360px]">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Agentes com Mais Erros (Mês Atual)</h2>
            <div className="h-[280px]">
              <Bar data={topBarData} options={topBarOptions} />
            </div>
          </div>
        </section>

        {/* ✅ NOVO QUADRO (abaixo dos dois gráficos) */}
        <section className="mt-6">
          <div className="bg-white border border-gray-200 rounded-2xl shadow p-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Empresas que vai e não vai ter atendimento no próximo feriado{' '}
                  <span className="text-[#2687e2] font-extrabold">
                    (
                    {proximoFeriado
                      ? `${proximoFeriado.feriado} — ${proximoFeriado.data}`
                      : 'sem feriado futuro cadastrado'}
                    )
                  </span>
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Fonte: <strong>empresas</strong> + <strong>operacao_empresas</strong> (status_operacao = “Sim/Não”).
                </p>
              </div>

              <button
                type="button"
                onClick={carregarQuadroFeriado}
                className="rounded-lg border border-[#2687e2] px-4 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white"
              >
                Recarregar quadro
              </button>
            </div>

            {!proximoFeriado ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Não encontrei nenhum feriado futuro em <strong>operacao_empresas</strong> (data &gt;= hoje).
                <br />
                Cadastre pelo menos 1 linha (com <strong>data</strong> e <strong>feriado</strong>) e o quadro volta a funcionar.
              </div>
            ) : (
              <>
                <div className="mt-5 overflow-x-auto">
                  <div className="min-w-[780px] rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="grid grid-cols-3">
                      <div className="p-4 bg-[#2687e2] text-white font-extrabold">EMPRESAS</div>
                      <div className="p-4 bg-[#16a34a] text-white font-extrabold text-center">SIM ✅</div>
                      <div className="p-4 bg-[#ef4444] text-white font-extrabold text-center">NÃO ❌</div>
                    </div>

                    <div className="divide-y">
                      {empresas.length === 0 ? (
                        <div className="p-4 text-sm text-gray-600">Nenhuma empresa encontrada em empresas.</div>
                      ) : (
                        empresas.map((emp) => {
                          const st = operacaoMap[emp.id] ?? null
                          const sim = st === 'Sim'
                          const nao = st === 'Não' || st == null // default: Não
                          const salvando = salvandoEmpresaId === emp.id

                          return (
                            <div key={emp.id} className="grid grid-cols-3 items-center">
                              <div className="p-4 text-sm font-semibold text-gray-900 truncate">{emp.nome}</div>

                              <div className="p-4 flex justify-center">
                                <button
                                  type="button"
                                  disabled={salvando}
                                  onClick={() => marcarOperacao(emp.id, 'Sim')}
                                  className={`h-10 w-10 rounded-full border flex items-center justify-center text-lg ${
                                    sim
                                      ? 'bg-[#16a34a] border-[#16a34a] text-white'
                                      : 'bg-white border-gray-200 text-gray-400 hover:text-[#16a34a]'
                                  } ${salvando ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  title="Vai ter atendimento"
                                >
                                  ✓
                                </button>
                              </div>

                              <div className="p-4 flex justify-center">
                                <button
                                  type="button"
                                  disabled={salvando}
                                  onClick={() => marcarOperacao(emp.id, 'Não')}
                                  className={`h-10 w-10 rounded-full border flex items-center justify-center text-lg ${
                                    nao
                                      ? 'bg-[#ef4444] border-[#ef4444] text-white'
                                      : 'bg-white border-gray-200 text-gray-400 hover:text-[#ef4444]'
                                  } ${salvando ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  title="Não vai ter atendimento"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">SIM (vai ter atendimento)</p>
                    <p className="text-2xl font-extrabold text-[#16a34a]">{simCount}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">NÃO (não vai ter atendimento)</p>
                    <p className="text-2xl font-extrabold text-[#ef4444]">{naoCount}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* PLANTÕES NO MÊS + NOMES EM FÉRIAS */}
        <section className="mt-6 bg-white border border-gray-200 rounded-2xl shadow p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900">Plantões no mês (por agente)</h2>
            <span className="text-xs text-gray-500">{plantoesPorAgente.length} agentes com plantão registrado</span>
          </div>

          {plantoesPorAgente.length === 0 ? (
            <p className="text-sm text-gray-600 mt-3">
              Nenhum registro de <strong>Plantão Final de Semana</strong> neste mês.
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-sm font-semibold text-gray-900 mb-3">Top 10 (mais plantões)</p>
                <ul className="space-y-2">
                  {topPlantoes.map((p, idx) => (
                    <li
                      key={p.nome + idx}
                      className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
                    >
                      <span className="text-sm font-medium text-gray-900">
                        {idx + 1}. {p.nome}
                      </span>
                      <span className="text-sm font-extrabold text-[#00897b]">{p.qtd}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">Nomes dos agentes em férias</p>
                  <span className="text-xs text-gray-500">{agentesFerias.length} agentes</span>
                </div>

                {agentesFerias.length === 0 ? (
                  <p className="text-sm text-gray-600 mt-3">
                    Nenhum agente está com status <strong>Férias</strong>.
                  </p>
                ) : (
                  <div className="mt-3 max-h-[320px] overflow-auto rounded-lg border border-gray-100">
                    <ul className="divide-y">
                      {agentesFerias.map((nome, i) => (
                        <li key={nome + i} className="p-3 text-sm text-gray-900 font-medium">
                          {nome}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-2">
                  *Lista baseada em <strong>agentes.status = "Férias"</strong>.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function Card({
  titulo,
  valor,
  destaque,
  corValor,
}: {
  titulo: string
  valor: number
  destaque?: boolean
  corValor?: string
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow p-4">
      <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{titulo}</p>
      <p className="text-3xl font-extrabold" style={{ color: destaque ? '#2687e2' : corValor || '#111827' }}>
        {valor}
      </p>
    </div>
  )
}
