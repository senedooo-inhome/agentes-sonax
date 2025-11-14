'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type LinhaLigacao = {
  id: string
  data: string
  nicho: string | null
  responsavel: string
  cliente_protocolo: string
  empresa: string | null
  status: string | null
  supervisao: string
  detalhe: string
  created_at: string
}

const NICHOS = ['Clínica', 'SAC'] as const
const STATUS = ['Resolvido', 'Pendente'] as const

export default function RelatoriosLigacoes() {
  const router = useRouter()

// ====== PROTEÇÃO (mesmo esquema dos outros relatórios) ======
useEffect(() => {
  (async () => {
    const { data } = await supabase.auth.getSession()
    const email = data.session?.user?.email

    if (!email) {
      router.replace('/login?next=' + window.location.pathname)
      return
    }

    // lista de e-mails que PODEM ver o relatório
    const permitidos = [
      'supervisao@sonax.net.br',
      'sonaxinhome@gmail.com',
    ]

    if (!permitidos.includes(email)) {
      alert('Acesso restrito.')
      router.replace('/')
    }
  })()
}, [router])

  // ============================================================

  const hoje = new Date().toISOString().slice(0, 10)
  const [dataIni, setDataIni] = useState(hoje)
  const [dataFim, setDataFim] = useState(hoje)
  const [fNicho, setFNicho] = useState<'Todos' | (typeof NICHOS)[number]>('Todos')
  const [fStatus, setFStatus] = useState<'Todos' | (typeof STATUS)[number]>('Todos')
  const [qResp, setQResp] = useState('')
  const [qSup, setQSup] = useState('')
  const [qEmpresa, setQEmpresa] = useState('')

  const [linhas, setLinhas] = useState<LinhaLigacao[]>([])
  const [loading, setLoading] = useState(false)

  function atalhoHoje() {
    const d = new Date().toISOString().slice(0, 10)
    setDataIni(d)
    setDataFim(d)
  }
  function atalhoSemana() {
    const d = new Date()
    const dow = d.getDay() || 7
    const ini = new Date(d)
    ini.setDate(d.getDate() - (dow - 1))
    const fim = new Date(ini)
    fim.setDate(ini.getDate() + 6)
    setDataIni(ini.toISOString().slice(0, 10))
    setDataFim(fim.toISOString().slice(0, 10))
  }
  function atalhoMes() {
    const d = new Date()
    const ini = new Date(d.getFullYear(), d.getMonth(), 1)
    const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    setDataIni(ini.toISOString().slice(0, 10))
    setDataFim(fim.toISOString().slice(0, 10))
  }

  async function buscar() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('ligacoes_ativas')
        .select(
          'id, created_at, data, nicho, responsavel, cliente_protocolo, empresa, status, supervisao, detalhe'
        )
        .gte('data', dataIni)
        .lte('data', dataFim)

      if (error) throw error

      let all = (data ?? []) as LinhaLigacao[]

      // filtros de texto
      const r = qResp.trim().toLowerCase()
      const s = qSup.trim().toLowerCase()
      const e = qEmpresa.trim().toLowerCase()

      if (fNicho !== 'Todos') {
        all = all.filter((l) => (l.nicho ?? '') === fNicho)
      }
      if (fStatus !== 'Todos') {
        all = all.filter((l) => (l.status ?? '') === fStatus)
      }
      if (r) {
        all = all.filter((l) => (l.responsavel ?? '').toLowerCase().includes(r))
      }
      if (s) {
        all = all.filter((l) => (l.supervisao ?? '').toLowerCase().includes(s))
      }
      if (e) {
        all = all.filter((l) => (l.empresa ?? '').toLowerCase().includes(e))
      }

      // ordenar mais recente primeiro
      all.sort((a, b) =>
        a.data === b.data ? a.responsavel.localeCompare(b.responsavel) : a.data < b.data ? 1 : -1
      )

      setLinhas(all)
    } catch (err: any) {
      alert('Erro ao buscar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    buscar()
  }, []) // carga inicial

  // ===== CSV (Excel) =====
  function csvEscape(v: any) {
    return `"${String(v ?? '').replace(/"/g, '""')}"`
  }
  function exportarCSV() {
    if (!linhas.length) {
      alert('Sem dados.')
      return
    }
    const headers = [
      'Data',
      'Nicho',
      'Responsável',
      'Cliente/Protocolo',
      'Empresa',
      'Status',
      'Supervisão',
      'Detalhe',
      'Criado em',
    ]
    const rows = linhas.map((l) =>
      [
        l.data,
        l.nicho ?? '',
        l.responsavel,
        l.cliente_protocolo,
        l.empresa ?? '',
        l.status ?? '',
        l.supervisao,
        l.detalhe,
        new Date(l.created_at).toLocaleString('pt-BR'),
      ]
        .map(csvEscape)
        .join(';')
    )
    const conteudo = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n')
    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ligacoes_${dataIni}_a_${dataFim}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* topo */}
      


        {/* filtros */}
        <div className="rounded-xl bg-white p-6 shadow space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Data inicial</label>
              <input
                type="date"
                value={dataIni}
                onChange={(e) => setDataIni(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Data final</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Nicho</label>
              <select
                value={fNicho}
                onChange={(e) => setFNicho(e.target.value as any)}
                className="w-full rounded-lg border p-2 text-[#535151]"
              >
                <option value="Todos">Todos</option>
                {NICHOS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Status</label>
              <select
                value={fStatus}
                onChange={(e) => setFStatus(e.target.value as any)}
                className="w-full rounded-lg border p-2 text-[#535151]"
              >
                <option value="Todos">Todos</option>
                {STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">
                Responsável
              </label>
              <input
                type="text"
                value={qResp}
                onChange={(e) => setQResp(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
                placeholder="Filtrar por quem ligou"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Supervisão</label>
              <input
                type="text"
                value={qSup}
                onChange={(e) => setQSup(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
                placeholder="Filtrar por supervisão"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Empresa</label>
              <input
                type="text"
                value={qEmpresa}
                onChange={(e) => setQEmpresa(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
                placeholder="Filtrar por empresa"
              />
            </div>

            <div className="md:col-span-3 flex flex-wrap gap-2 justify-end">
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

        {/* tabela */}
        <div className="rounded-xl bg-white p-6 shadow">
          {!linhas.length ? (
            <p className="text-gray-500">Nenhum registro no período/critério.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-sm text-gray-600">
                    <th className="border-b p-2">Data</th>
                    <th className="border-b p-2">Nicho</th>
                    <th className="border-b p-2">Responsável</th>
                    <th className="border-b p-2">Cliente/Protocolo</th>
                    <th className="border-b p-2">Empresa</th>
                    <th className="border-b p-2">Status</th>
                    <th className="border-b p-2">Supervisão</th>
                    <th className="border-b p-2">Detalhe</th>
                    <th className="border-b p-2">Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.id} className="text-sm">
                      <td className="border-b p-2 text-[#535151]">{l.data}</td>
                      <td className="border-b p-2 text-[#535151]">{l.nicho ?? '-'}</td>
                      <td className="border-b p-2 text-[#535151]">{l.responsavel}</td>
                      <td className="border-b p-2 text-[#535151]">{l.cliente_protocolo}</td>
                      <td className="border-b p-2 text-[#535151]">{l.empresa ?? '-'}</td>
                      <td className="border-b p-2 text-[#535151]">{l.status ?? '-'}</td>
                      <td className="border-b p-2 text-[#535151]">{l.supervisao}</td>
                      <td className="border-b p-2 text-[#535151] whitespace-pre-line">{l.detalhe}</td>
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
