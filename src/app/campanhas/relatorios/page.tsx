'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Linha = {
  id: string
  campanha: 'Elogio Premiado' | 'Reciclagem'
  data: string
  nicho: 'SAC' | 'Clínica'
  nome: string
  empresa?: string | null
  telefone_protocolo?: string | null
  elogio?: string | null
  empresas_prioridade?: string | null
  empresas_dificuldade?: string | null
  preparado?: boolean | null
  preferencia_horario?: string | null
  duas_no_mesmo_dia?: boolean | null
  created_at: string
}

export default function RelatoriosCampanhas() {
  const hoje = new Date().toISOString().slice(0,10)
  const [dataIni, setDataIni] = useState(hoje)
  const [dataFim, setDataFim] = useState(hoje)
  const [fNicho, setFNicho] = useState<string>('Todos')
  const [fCampanha, setFCampanha] = useState<string>('Todas')
  const [qNome, setQNome] = useState('')

  const [linhas, setLinhas] = useState<Linha[]>([])
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
      // ELOGIOS
      const elogiosQ = supabase
        .from('campanha_elogio')
        .select('id, created_at, data, nicho, nome, empresa, telefone_protocolo, elogio')
        .gte('data', dataIni).lte('data', dataFim)

      // RECICLAGENS
      const reciclagemQ = supabase
        .from('campanha_reciclagem')
        .select('id, created_at, data, nicho, nome, empresas_prioridade, empresas_dificuldade, preparado, preferencia_horario, duas_no_mesmo_dia')
        .gte('data', dataIni).lte('data', dataFim)

      const [{ data: elogios, error: e1 }, { data: recs, error: e2 }] = await Promise.all([elogiosQ, reciclagemQ])
      if (e1) throw e1
      if (e2) throw e2

      const L1: Linha[] = (elogios ?? []).map((r:any)=>({
        id: r.id, campanha: 'Elogio Premiado', data: r.data, nicho: r.nicho, nome: r.nome,
        empresa: r.empresa, telefone_protocolo: r.telefone_protocolo, elogio: r.elogio,
        created_at: r.created_at
      }))
      const L2: Linha[] = (recs ?? []).map((r:any)=>({
        id: r.id, campanha: 'Reciclagem', data: r.data, nicho: r.nicho, nome: r.nome,
        empresas_prioridade: r.empresas_prioridade, empresas_dificuldade: r.empresas_dificuldade,
        preparado: r.preparado, preferencia_horario: r.preferencia_horario, duas_no_mesmo_dia: r.duas_no_mesmo_dia,
        created_at: r.created_at
      }))

      let all = [...L1, ...L2]

      if (fCampanha !== 'Todas') {
        all = all.filter(l => l.campanha === fCampanha)
      }
      if (fNicho !== 'Todos') {
        all = all.filter(l => l.nicho === fNicho)
      }
      const nq = qNome.trim().toLowerCase()
      if (nq) {
        all = all.filter(l => l.nome.toLowerCase().includes(nq))
      }

      all.sort((a,b)=> a.data===b.data ? a.nome.localeCompare(b.nome) : (a.data < b.data ? 1 : -1))
      setLinhas(all)
    } catch (err:any) {
      alert('Erro ao buscar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ buscar() }, []) // carga inicial

  function csvEscape(v: any) { return `"${String(v ?? '').replace(/"/g,'""')}"` }
  function exportarCSV() {
    if (!linhas.length) { alert('Sem dados.'); return }
    const headers = [
      'Campanha','Data','Nicho','Nome','Empresa','Telefone/Protocolo','Elogio',
      'Empresas prioridade','Empresas dificuldade','Preparado','Preferência','Duas no mesmo dia','Criado em'
    ]
    const rows = linhas.map(l => [
      l.campanha, l.data, l.nicho, l.nome, l.empresa ?? '', l.telefone_protocolo ?? '', l.elogio ?? '',
      l.empresas_prioridade ?? '', l.empresas_dificuldade ?? '',
      l.preparado === true ? 'Sim' : l.preparado === false ? 'Não' : '',
      l.preferencia_horario ?? '', l.duas_no_mesmo_dia === true ? 'Sim' : l.duas_no_mesmo_dia === false ? 'Não' : '',
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
            {/* novo botão para voltar ao cadastro de agentes */}
            <a
              href="/"
              className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
            >
              Cadastro
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Data inicial</label>
              <input type="date" value={dataIni} onChange={e=>setDataIni(e.target.value)} className="w-full rounded-lg border p-2 text-black"/>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data final</label>
              <input type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)} className="w-full rounded-lg border p-2 text-black"/>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nicho</label>
              <select value={fNicho} onChange={e=>setFNicho(e.target.value)} className="w-full rounded-lg border p-2 text-black">
                {['Todos','SAC','Clínica'].map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Campanha</label>
              <select value={fCampanha} onChange={e=>setFCampanha(e.target.value)} className="w-full rounded-lg border p-2 text-black">
                {['Todas','Elogio Premiado','Reciclagem'].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="grow">
              <label className="block text-sm font-medium mb-1">Filtrar por Nome</label>
              <input type="text" value={qNome} onChange={e=>setQNome(e.target.value)} className="w-full rounded-lg border p-2 text-black" placeholder="Digite o nome"/>
            </div>
            <div className="flex gap-2">
              <button onClick={atalhoHoje}
                className="rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white">
                Hoje
              </button>
              <button onClick={atalhoSemana}
                className="rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white">
                Semana
              </button>
              <button onClick={atalhoMes}
                className="rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white">
                Mês
              </button>
            </div>

            <div className="ml-auto flex gap-2">
              <button onClick={buscar} disabled={loading}
                className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50">
                {loading ? 'Buscando…' : 'Aplicar filtros'}
              </button>
              <button onClick={exportarCSV} disabled={!linhas.length}
                className="rounded-lg border border-[#2687e2] px-4 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white disabled:opacity-40">
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
                    <th className="border-b p-2">Empresa / Protocolo / Preferência</th>
                    <th className="border-b p-2">Detalhes</th>
                    <th className="border-b p-2">Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(l=>(
                    <tr key={`${l.campanha}-${l.id}`} className="text-sm">
                      <td className="border-b p-2">{l.campanha}</td>
                      <td className="border-b p-2 text-black">{l.data}</td>
                      <td className="border-b p-2">{l.nicho}</td>
                      <td className="border-b p-2 text-gray-800 font-medium">{l.nome}</td>

                      <td className="border-b p-2">
                        {l.campanha==='Elogio Premiado' ? (
                          <>
                            <div><b>Empresa:</b> {l.empresa ?? '-'}</div>
                            <div><b>Fone/Protocolo:</b> {l.telefone_protocolo ?? '-'}</div>
                          </>
                        ) : (
                          <>
                            <div><b>Preferência:</b> {l.preferencia_horario ?? '-'}</div>
                            <div><b>Duas no mesmo dia:</b> {l.duas_no_mesmo_dia===true?'Sim':l.duas_no_mesmo_dia===false?'Não':'-'}</div>
                          </>
                        )}
                      </td>

                      <td className="border-b p-2">
                        {l.campanha==='Elogio Premiado' ? (
                          <div className="whitespace-pre-line">{l.elogio}</div>
                        ) : (
                          <>
                            <div><b>Prioridade:</b> {l.empresas_prioridade ?? '-'}</div>
                            <div><b>Dificuldade:</b> {l.empresas_dificuldade ?? '-'}</div>
                            <div><b>Preparado:</b> {l.preparado===true?'Sim':l.preparado===false?'Não':'-'}</div>
                          </>
                        )}
                      </td>

                      <td className="border-b p-2">{new Date(l.created_at).toLocaleString('pt-BR')}</td>
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
