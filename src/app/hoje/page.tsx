'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Agente = { id: string; nome: string; status: string }

export default function HojePage() {
  const [agentesHoje, setAgentesHoje] = useState<Agente[]>([])
  const [carregando, setCarregando] = useState(true)
  const hoje = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    (async () => {
      setCarregando(true)
      const { data: pres } = await supabase
        .from('presencas')
        .select('agente_id')
        .eq('data_registro', hoje)

      const ids = (pres ?? []).map((p) => p.agente_id)
      if (!ids.length) {
        setAgentesHoje([])
        setCarregando(false)
        return
      }

      const { data: ags } = await supabase
        .from('agentes')
        .select('id, nome, status')
        .in('id', ids)

      setAgentesHoje((ags ?? []).sort((a,b)=>a.nome.localeCompare(b.nome)))
      setCarregando(false)
    })()
  }, [hoje])

  function corStatus(s: string) {
    switch (s) {
      case 'Ativo': return '#46a049'
      case 'Férias': return '#f19a37'
      case 'Atestado': return '#e53935'
      case 'Folga': return '#42a5f5'
      case 'Afastado': return '#9c27b0'
      case 'Licença Maternidade': return '#ff4081'
      case 'Licença Paternidade': return '#5c6bc0'
      default: return '#757575'
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#2687e2]">Logins de Hoje — {hoje}</h1>
          <div className="flex gap-2">
            <a href="/" className="rounded-lg bg-[#2687e2] px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600">Cadastro</a>
            <a href="/chamada" className="rounded-lg bg-[#2687e2] px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600">Chamada</a>
            <a href="/relatorios" className="rounded-lg bg-[#2687e2] px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600">Relatórios</a>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          {carregando ? (
            <p className="text-gray-500">Carregando…</p>
          ) : agentesHoje.length === 0 ? (
            <p className="text-gray-500">Ninguém marcou presença hoje.</p>
          ) : (
            <ul className="space-y-2">
              {agentesHoje.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                  style={{ borderLeft: `6px solid ${corStatus(a.status)}` }}
                >
                  <span><b>{a.nome}</b> — {a.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
