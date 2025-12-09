'use client'

import { useEffect, useState } from 'react'
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
  Legend,
)

// Plugin para escrever o valor em negrito em cima das barras do TOP 5
const topErrorsValuePlugin: any = {
  id: 'topErrorsValue',
  afterDatasetsDraw(chart: any) {
    const { ctx } = chart
    const dataset = chart.data.datasets[0]
    const meta = chart.getDatasetMeta(0)

    ctx.save()
    ctx.font = 'bold 12px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = '#f9fafb' // branco

    meta.data.forEach((bar: any, index: number) => {
      const value = dataset.data[index] as number
      if (value == null) return
      const pos = bar.tooltipPosition()
      ctx.fillText(String(value), pos.x, pos.y - 6)
    })

    ctx.restore()
  },
}

ChartJS.register(topErrorsValuePlugin)

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

type ResumoStatus = {
  label: string
  valor: number
}

type ErrosAgenteMap = Record<string, number>

function getMesAtualInfo() {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mesIndex = hoje.getMonth()
  const primeiroDia = new Date(ano, mesIndex, 1)
  const ultimoDia = new Date(ano, mesIndex + 1, 0)

  const toISODate = (d: Date) => d.toISOString().split('T')[0]

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
    inicio: toISODate(primeiroDia),
    fim: toISODate(ultimoDia),
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
  const [proximosTreinamentos, setProximosTreinamentos] = useState<any[]>([])
  const [mesLabel, setMesLabel] = useState('')

  useEffect(() => {
    carregarDashboard()
  }, [])

  async function carregarDashboard() {
    const { inicio, fim, label } = getMesAtualInfo()
    setMesLabel(label)

    // 1) Total de agentes (todos)
    const { count: totalAgentes } = await supabase
      .from('agentes')
      .select('*', { count: 'exact', head: true })

    // 2) Férias e Folgas (status atual dos agentes)
    const { count: ferias } = await supabase
      .from('agentes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Férias')

    const { count: folgas } = await supabase
      .from('agentes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Folga')

    // 3) Atestados do mês
    const { count: atestados } = await supabase
      .from('atestados')
      .select('*', { count: 'exact', head: true })
      .gte('data', inicio)
      .lte('data', fim)

    // 4) Resumo de status (tabela PRESENCAS, campo tipo)
    const { data: presencasMes } = await supabase
      .from('presencas')
      .select('tipo')
      .gte('data_registro', inicio)
      .lte('data_registro', fim)

    const contagemPorTipo: Record<string, number> = {}
    presencasMes?.forEach(p => {
      const tipo = (p.tipo || '').trim()
      if (!tipo) return
      if (!contagemPorTipo[tipo]) contagemPorTipo[tipo] = 0
      contagemPorTipo[tipo]++
    })

    const categorias = [
      { label: 'Presente', keys: ['Presente'] },
      { label: 'Folga', keys: ['Folga'] },
      { label: 'Férias', keys: ['Férias', 'Ferias'] },
      { label: 'Atestado', keys: ['Atestado', 'Atestados'] },
      { label: 'Afastado', keys: ['Afastado'] },
      {
        label: 'Licença Maternidade',
        keys: ['Licença Maternidade', 'Licenca Maternidade'],
      },
      {
        label: 'Licença Paternidade',
        keys: ['Licença Paternidade', 'Licenca Paternidade'],
      },
      { label: 'Ausente', keys: ['Ausente'] },
    ]

    const resumo: ResumoStatus[] = categorias.map(cat => {
      let soma = 0
      cat.keys.forEach(k => {
        soma += contagemPorTipo[k] || 0
      })
      return { label: cat.label, valor: soma }
    })

    setResumoStatus(resumo)

    // 5) Erros clínicas / SAC do mês (trazendo AGENTE)
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

    // TOP 5 agentes com mais erros
    const todosErros = [
      ...(errosClinicasData || []),
      ...(errosSacData || []),
    ]

    const contadorErrosPorAgente: ErrosAgenteMap =
      todosErros.reduce((acc: ErrosAgenteMap, item: any) => {
        const nome = item.agente || 'Não informado'
        if (!acc[nome]) acc[nome] = 0
        acc[nome]++
        return acc
      }, {})

    const agentesOrdenados = Object.entries(contadorErrosPorAgente)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    setErrosPorAgente(Object.fromEntries(agentesOrdenados))

    // 6) Ligações ativas clínicas / SAC do mês
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

    // 7) Próximos treinamentos (a partir de hoje)
    const hojeISO = new Date().toISOString().split('T')[0]
    const { data: futuros } = await supabase
      .from('treinamentos')
      .select('*')
      .gte('data_treinamento', hojeISO)
      .order('data_treinamento', { ascending: true })
      .limit(5)

    setProximosTreinamentos(futuros || [])

    // 8) Atualizar cards
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
  }

  // ======== GRÁFICO: RESUMO STATUS (BARRAS HORIZONTAIS) =========
  const statusBarData = {
    labels: resumoStatus.map(r => r.label),
    datasets: [
      {
        label: 'Quantidade',
        data: resumoStatus.map(r => r.valor),
        backgroundColor: '#f97316', // laranja
      },
    ],
  }

  const statusBarOptions = {
    indexAxis: 'y' as const, // barras horizontais
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
      },
    },
    scales: {
      x: {
        ticks: { color: '#9ca3af' },
        grid: { color: '#1f2937' },
        beginAtZero: true,
      },
      y: {
        ticks: { color: '#e5e7eb' },
        grid: { color: '#111827' },
      },
    },
  }

  // ======== GRÁFICO: TOP 5 AGENTES COM MAIS ERROS =========
  const topBarData = {
    labels: Object.keys(errosPorAgente),
    datasets: [
      {
        label: 'Erros por agente (mês)',
        data: Object.values(errosPorAgente),
        backgroundColor: '#f97316',
      },
    ],
  }

  const topBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
      },
    },
    scales: {
      x: {
        ticks: { color: '#9ca3af' },
        grid: { color: '#1f2937' },
        beginAtZero: true,
      },
      y: {
        ticks: { color: '#e5e7eb' },
        grid: { color: '#111827' },
      },
    },
  }

  return (
    <div className="w-full min-h-screen bg-[#050816] text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* HEADER */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-wide text-[#0ea5e9] uppercase">
              Dashboard Sonax In Home
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Visão do mês de{' '}
              <span className="font-semibold capitalize">{mesLabel}</span>
            </p>
          </div>
          {/* espaço pra logo no futuro */}
        </header>

        {/* CARDS SUPERIORES */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card titulo="Férias (status atual)" valor={stats.ferias} />
          <Card titulo="Atestados no mês" valor={stats.atestados} />
          <Card titulo="Folgas (status atual)" valor={stats.folgas} />
          <Card titulo="Erros Clínicas no mês" valor={stats.errosClinicas} />
          <Card titulo="Erros SAC no mês" valor={stats.errosSac} />
          <Card
            titulo="Ligações Clínicas no mês"
            valor={stats.ligacoesClinicas}
          />
          <Card titulo="Ligações SAC no mês" valor={stats.ligacoesSac} />
          <Card titulo="Total de Agentes" valor={stats.totalAgentes} destaque />
        </section>

        {/* GRÁFICOS PRINCIPAIS */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Resumo Status */}
          <div className="bg-[#0b1020] border border-[#161b2b] rounded-2xl shadow-xl shadow-black/40 p-6 h-[360px]">
            <h2 className="text-lg md:text-xl font-semibold text-slate-100 mb-4">
              Status dos Agentes (Mês Atual)
            </h2>
            <div className="h-[280px]">
              <Bar data={statusBarData} options={statusBarOptions} />
            </div>
          </div>

          {/* Top 5 Agentes com mais erros */}
          <div className="bg-[#0b1020] border border-[#161b2b] rounded-2xl shadow-xl shadow-black/40 p-6 h-[360px]">
            <h2 className="text-lg md:text-xl font-semibold text-slate-100 mb-4">
              Top 5 Agentes com Mais Erros (Mês Atual)
            </h2>
            <div className="h-[280px]">
              <Bar data={topBarData} options={topBarOptions} />
            </div>
          </div>
        </section>

        {/* PRÓXIMOS TREINAMENTOS */}
        <section className="bg-[#0b1020] border border-[#161b2b] rounded-2xl shadow-xl shadow-black/40 p-6">
          <h2 className="text-lg md:text-xl font-semibold text-slate-100 mb-4">
            Próximos Treinamentos
          </h2>

          {proximosTreinamentos.length === 0 && (
            <p className="text-sm text-slate-300">
              Nenhum treinamento futuro encontrado.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {proximosTreinamentos.map(t => (
              <div
                key={t.id}
                className="border border-[#1f2937] rounded-xl p-4 bg-[#050816]"
              >
                <p className="text-sm text-slate-200">
                  <strong className="text-[#f97316]">Data:</strong>{' '}
                  {t.data_treinamento
                    ? new Date(t.data_treinamento).toLocaleDateString('pt-BR')
                    : '-'}
                </p>

                <p className="text-sm text-slate-200">
                  <strong className="text-[#f97316]">Agente:</strong>{' '}
                  {t.operador}
                </p>

                <p className="text-sm text-slate-200">
                  <strong className="text-[#f97316]">Líder:</strong>{' '}
                  {t.lider}
                </p>

                <p className="text-sm text-slate-200">
                  <strong className="text-[#f97316]">Empresa:</strong>{' '}
                  {t.empresa}
                </p>

                <p className="text-sm text-slate-200">
                  <strong className="text-[#f97316]">Status:</strong>{' '}
                  {t.status}
                </p>

                {t.observacoes && (
                  <p className="text-sm text-slate-200 mt-1">
                    <strong className="text-[#f97316]">OBS:</strong>{' '}
                    {t.observacoes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

// COMPONENTE DE CARD DE MÉTRICA
function Card({
  titulo,
  valor,
  destaque,
}: {
  titulo: string
  valor: number
  destaque?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border shadow-lg shadow-black/40 p-4 bg-[#0b1020] border-[#161b2b] flex flex-col justify-between`}
    >
      <p className="text-xs md:text-sm text-slate-400 mb-1 uppercase tracking-wide">
        {titulo}
      </p>
      <p
        className={`text-2xl md:text-3xl font-extrabold ${
          destaque ? 'text-[#0ea5e9]' : 'text-[#f97316]'
        }`}
      >
        {valor}
      </p>
    </div>
  )
}
