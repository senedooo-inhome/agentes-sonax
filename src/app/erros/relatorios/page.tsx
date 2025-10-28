'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type LinhaErro = {
  id: string
  data: string
  supervisor: string
  agente: string
  relato: string
  created_at: string
}

export default function RelatorioErros() {
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
  const [qSupervisor, setQSupervisor] = useState('')
  const [qAgente, setQAgente] = useState('')

  const [linhas, setLinhas] = useState<LinhaErro[]>([])
  const [loading, setLoading] = useState(false)

  function atalhoHoje(){ const d = new Date().toISOString().slice(0,10); setDataIni(d); setDataFim(d) }
  function atalhoSemana() {
    const d = new Date(); const dow = d.getDay() || 7
    const ini = new Date(d); ini.setDate(d.getDate() - (dow-1))
    const fim = new Date(ini); fim.setDate(ini.getDate()+6)
    setDataIni(ini.toISOString().slice(0,10)); setDataFim(fim.toISOString().slice(0,10))
  }
  function atalhoMes() {
    const d = new Date(); const ini = new Date(d.getFullYear(), d.getMonth(), 1)
    const fim = new Date(d.getFullYear(), d.getMonth()+1, 0)
    setDataIni(ini.toISOString().slice(0,10)); setDataFim(fim.toISOString().slice(0,10))
  }

  async function buscar() {
    setLoading(true)
    try {
      // Tabela esperada: public.erros_agentes
      // colunas: id (uuid), created_at (timestamptz), data (date), supervisor (text), agente (text), relato (text)
      const { data, error } = await supabase
        .from('erros_agentes')
        .select('id, created_at, data, supervisor, agente, relato')
        .gte('data', dataIni)
        .lte('data', dataFim)

      if (error) throw error

      let all = (data ?? []) as LinhaErro[]
      const qSup = qSupervisor.trim().toLowerCase()
      const qAgt = qAgente.trim().toLowerCase()
      if (qSup) all = all.filter(l => l.supervisor.toLowerCase().includes(qSup))
      if (qAgt) all = all.filter(l => l.agente.toLowerCase().includes(qAgt))

      all.sort((a,b)=> a.data===b.data ? a.agente.localeCompare(b.agente) : (a.data < b.data ? 1 : -1))
      setLinhas(all)
    } catch (err:any) {
      alert('Erro ao buscar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ buscar() }, [])

  function csvEscape(v: any) { return `"${String(v ?? '').replace(/"/g,'""')}"` }
  function exportarCSV() {
    if (!linhas.length) { alert('Sem dados.'); return }
    const headers = ['Data','Supervisor','Agente','Relato','Criado em']
    const rows = linhas.map(l => [
      l.data, l.supervisor, l.agente, l.relato,
      new Date(l.created_at).toLocaleString('pt-BR')
    ].map(csvEscape).join(';'))
    const conteudo = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n')
    const blob = new Blob([conteudo], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `erros_${dataIni}_a_${dataFim}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#2687e2]">Relatórios — Erros de Agente</h1>
          <div className="flex gap-2">
            <a href="/" className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600">Cadastro</a>
            <a href="/erros" className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600">Formulário</a>
          </div>
        </header>

        {/* Filtros */}
        <div className="rounded-xl bg-white p-6 shadow space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Data inicial</label>
              <input type="date" value={dataIni} onChange={e=>setDataIni(e.target.value)} className="w-full rounded-lg border p-2 text-[#535151] placeholder-[#535151]/60"/>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Data final</label>
              <input type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)} className="w-full rounded-lg border p-2 text-[#535151] placeholder-[#535151]/60"/>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Supervisor</label>
              <input type="text" value={qSupervisor} onChange={e=>setQSupervisor(e.target.value)} className="w-full rounded-lg border p-2 text-[#535151]" placeholder="Filtrar por supervisor"/>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Agente</label>
              <input type="text" value={qAgente} onChange={e=>setQAgente(e.target.value)} className="w-full rounded-lg border p-2 text-[#535151]" placeholder="Filtrar por agente"/>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-2">
              <button onClick={atalhoHoje}   className="rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white">Hoje</button>
              <button onClick={atalhoSemana} className="rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white">Semana</button>
              <button onClick={atalhoMes}    className="rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white">Mês</button>
            </div>

            <div className="ml-auto flex gap-2">
              <button onClick={buscar} disabled={loading} className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50">
                {loading ? 'Buscando…' : 'Aplicar filtros'}
              </button>
              <button onClick={exportarCSV} disabled={!linhas.length} className="rounded-lg border border-[#2687e2] px-4 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white disabled:opacity-40">
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
                    <th className="border-b p-2">Data</th>
                    <th className="border-b p-2">Supervisor</th>
                    <th className="border-b p-2">Agente</th>
                    <th className="border-b p-2">Relato</th>
                    <th className="border-b p-2">Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(l=>(
                    <tr key={l.id} className="text-sm">
                      <td className="border-b p-2 text-[#535151]">{l.data}</td>
                      <td className="border-b p-2 text-[#535151]">{l.supervisor}</td>
                      <td className="border-b p-2 text-[#535151]">{l.agente}</td>
                      <td className="border-b p-2 text-[#535151] whitespace-pre-line">{l.relato}</td>
                      <td className="border-b p-2 text-[#535151]">{new Date(l.created_at).toLocaleString('pt-BR')}</td>
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
