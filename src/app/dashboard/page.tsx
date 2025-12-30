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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend
)

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

type PlantaoLinha = {
  nome: string
  qtd: number
}

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
  const [mesLabel, setMesLabel] = useState('')
  const [atualizando, setAtualizando] = useState(false)

  // ✅ PLANTÕES (mês)
  const [plantoesPorAgente, setPlantoesPorAgente] = useState<PlantaoLinha[]>([])

  // ✅ NOVO: NOMES dos agentes em férias
  const [agentesFerias, setAgentesFerias] = useState<string[]>([])

  useEffect(() => {
    carregarDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function carregarDashboard() {
    setAtualizando(true)
    try {
      const { inicio, fim, label } = getMesAtualInfo()
      setMesLabel(label)

      // 1) Total de agentes
      const { count: totalAgentes } = await supabase
        .from('agentes')
        .select('*', { count: 'exact', head: true })

      // 2) Férias / Folgas (status atual) + nomes
      const [{ count: ferias }, { count: folgas }] = await Promise.all([
        supabase.from('agentes').select('*', { count: 'exact', head: true }).eq('status', 'Férias'),
        supabase.from('agentes').select('*', { count: 'exact', head: true }).eq('status', 'Folga'),
      ])

      // ✅ nomes em férias
      const { data: feriasNomesData, error: feriasNomesErr } = await supabase
        .from('agentes')
        .select('nome')
        .eq('status', 'Férias')
        .order('nome', { ascending: true })

      if (feriasNomesErr) throw feriasNomesErr
      setAgentesFerias((feriasNomesData || []).map((x: any) => x.nome).filter(Boolean))

      // 3) Atestados do mês
      const { count: atestados } = await supabase
        .from('atestados')
        .select('*', { count: 'exact', head: true })
        .gte('data', inicio)
        .lte('data', fim)

      // 4) Resumo status (presencas.tipo)
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

      // ✅ 5) Plantões do mês por agente (join com agentes)
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

      // 6) Erros clínicas / SAC do mês
      const { data: errosClinicasData } = await supabase
        .from('erros_agentes')
        .select('id, nicho, data, agente')
        .in('nicho', ['Clínica', 'Clinica'])
        .gte('data', inicio)
        .lte('data', fim)

      const { data: errosSacData } = await supabase
        .from('erros_agentes')
        .select('id, nicho, data, agente')
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

      // 7) Ligações ativas clínicas / SAC do mês
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

      // 8) Cards
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

  // ======== GRÁFICO: RESUMO STATUS =========
  const statusBarData = useMemo(
    () => ({
      labels: resumoStatus.map((r) => r.label),
      datasets: [
        {
          label: 'Quantidade',
          data: resumoStatus.map((r) => r.valor),
          backgroundColor: '#2687e2',
          borderRadius: 10,
        },
      ],
    }),
    [resumoStatus]
  )

  const statusBarOptions: any = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      x: { ticks: { color: '#374151' }, grid: { color: '#e5e7eb' }, beginAtZero: true },
      y: { ticks: { color: '#111827' }, grid: { color: '#f3f4f6' } },
    },
  }

  // ======== GRÁFICO: TOP 5 ERROS =========
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

  // ✅ TOP 10 plantões
  const topPlantoes = useMemo(() => plantoesPorAgente.slice(0, 10), [plantoesPorAgente])

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
            onClick={carregarDashboard}
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
          <Card titulo="Ligações Clínicas no mês" valor={stats.ligacoesClinicas} />
          <Card titulo="Ligações SAC no mês" valor={stats.ligacoesSac} />
          <Card titulo="Total de Agentes" valor={stats.totalAgentes} destaque />
        </section>

        {/* GRÁFICOS */}
        <section className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-2xl shadow p-6 h-[360px]">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Status dos Agentes (Mês Atual)</h2>
            <div className="h-[280px]">
              <Bar data={statusBarData} options={statusBarOptions} />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl shadow p-6 h-[360px]">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Top 5 Agentes com Mais Erros (Mês Atual)
            </h2>
            <div className="h-[280px]">
              <Bar data={topBarData} options={topBarOptions} />
            </div>
          </div>
        </section>

        {/* ✅ PLANTÕES NO MÊS + NOMES EM FÉRIAS */}
        <section className="mt-6 bg-white border border-gray-200 rounded-2xl shadow p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900">Plantões no mês (por agente)</h2>

            <span className="text-xs text-gray-500">
              {plantoesPorAgente.length} agentes com plantão registrado
            </span>
          </div>

          {plantoesPorAgente.length === 0 ? (
            <p className="text-sm text-gray-600 mt-3">
              Nenhum registro de <strong>Plantão Final de Semana</strong> neste mês.
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* TOP 10 */}
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

              {/* ✅ NOVO BLOCO: NOMES DOS AGENTES EM FÉRIAS */}
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">Nomes dos agentes em férias</p>
                  <span className="text-xs text-gray-500">{agentesFerias.length} agentes</span>
                </div>

                {agentesFerias.length === 0 ? (
                  <p className="text-sm text-gray-600 mt-3">Nenhum agente está com status <strong>Férias</strong>.</p>
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
      <p
        className="text-3xl font-extrabold"
        style={{ color: destaque ? '#2687e2' : corValor || '#111827' }}
      >
        {valor}
      </p>
    </div>
  )
}
