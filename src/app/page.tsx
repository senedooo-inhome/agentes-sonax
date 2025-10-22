'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Agente = {
  id: string
  nome: string
  status: string
  created_at?: string
}

const statusOptions = [
  { label: 'Ativo', color: '#46a049' },
  { label: 'Férias', color: '#f19a37' },
  { label: 'Atestado', color: '#e53935' },
  { label: 'Folga', color: '#42a5f5' },
  { label: 'Afastado', color: '#9c27b0' },
  { label: 'Licença Maternidade', color: '#ff4081' },
  { label: 'Licença Paternidade', color: '#5c6bc0' },
  { label: 'Ausente', color: '#757575' },
]

export default function CadastroAgentesPage() {
  const [nome, setNome] = useState('')
  const [status, setStatus] = useState('Ativo')
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [loading, setLoading] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  useEffect(() => {
    carregarAgentes()
  }, [])

  async function carregarAgentes() {
    const { data, error } = await supabase
      .from('agentes')
      .select('id, nome, status, created_at')
      .order('nome', { ascending: true })
    if (!error) setAgentes((data ?? []) as Agente[])
  }

  async function cadastrarAgente() {
    if (!nome.trim()) return alert('Digite o nome do agente.')
    try {
      setLoading(true)
      const { error } = await supabase.from('agentes').insert([{ nome, status }])
      if (error) throw error
      setNome('')
      setStatus('Ativo')
      await carregarAgentes()
    } catch (e: any) {
      alert('Erro ao cadastrar: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function atualizarStatus(id: string, novoStatus: string) {
    try {
      setLoading(true)
      const { error } = await supabase.from('agentes').update({ status: novoStatus }).eq('id', id)
      if (error) throw error
      setEditandoId(null)
      await carregarAgentes()
    } catch (e: any) {
      alert('Erro ao atualizar: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  function corStatus(s: string) {
    const map: Record<string, string> = Object.fromEntries(
      statusOptions.map(o => [o.label, o.color])
    )
    return map[s] ?? '#ccc'
  }

  return (
    <main className="relative min-h-screen bg-[#f5f6f7] p-8 overflow-hidden">
      {/* Imagens decorativas */}
      <img
        src="/nuvem-esq.png"
        alt=""
        className="pointer-events-none select-none absolute left-[-60px] top-[40px] w-72 opacity-80 hidden md:block"
      />
      <img
        src="/nuvem-dir.png"
        alt=""
        className="pointer-events-none select-none absolute right-[-60px] top-[0px] w-60 opacity-70 hidden md:block"
      />
      <img
        src="/mascote.png"
        alt="Mascote Sonax"
        className="pointer-events-none select-none absolute right-6 bottom-[-10px] w-80 hidden xl:block"
      />

      <div className="mx-auto max-w-6xl space-y-6 relative z-10">
        {/* HEADER – padrão de navegação */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#2687e2]">Cadastro de Agentes</h1>
          <div className="flex gap-2">
            <span
              className="rounded-lg bg-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 cursor-default"
              aria-current="page"
              title="Você está em Cadastro"
            >
              Cadastro
            </span>
            <a
              href="/chamada"
              className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
            >
              Chamada
            </a>
            <a
              href="/relatorios"
              className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
            >
              Relatórios
            </a>
          </div>
        </div>

        {/* DUAS COLUNAS */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Coluna esquerda: formulário (altura fixa) */}
          <div className="rounded-xl bg-white p-6 shadow h-[70vh] flex flex-col">
            <h2 className="mb-4 text-lg font-semibold text-[#2687e2]">Novo agente</h2>
            <div className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Nome do agente"
                className="rounded-lg border p-2 text-black placeholder-gray-400"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-lg border p-2 text-black"
              >
                {statusOptions.map((s) => (
                  <option key={s.label} value={s.label}>
                    {s.label}
                  </option>
                ))}
              </select>

              <button
                onClick={cadastrarAgente}
                disabled={loading}
                className="rounded-lg bg-[#2687e2] px-4 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Salvando…' : 'Cadastrar'}
              </button>
            </div>

            {/* Logo Sonax */}
            <div className="mt-auto flex items-center justify-center pt-6">
              <img src="/logo-sonax.png" alt="Sonax In Home" className="w-64 opacity-95" />
            </div>
          </div>

          {/* Coluna direita: lista (altura fixa + scroll interno) */}
          <div className="rounded-xl bg-white p-6 shadow h-[70vh] flex flex-col">
            <h2 className="mb-4 text-lg font-semibold text-[#2687e2]">Agentes cadastrados</h2>
            <ul className="space-y-2 flex-1 overflow-y-auto pr-1">
              {agentes.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                  style={{ borderLeft: `6px solid ${corStatus(a.status)}` }}
                >
                  <span className="font-medium text-black">
                    {a.nome} — {a.status}
                  </span>

                  {editandoId === a.id ? (
                    <select
                      autoFocus
                      className="rounded-lg border p-2 text-black"
                      defaultValue={a.status}
                      onChange={(e) => atualizarStatus(a.id, e.target.value)}
                      onBlur={() => setEditandoId(null)}
                    >
                      {statusOptions.map((s) => (
                        <option key={s.label} value={s.label}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      className="text-sm text-[#2687e2] hover:underline"
                      onClick={() => setEditandoId(a.id)}
                    >
                      Editar
                    </button>
                  )}
                </li>
              ))}
              {agentes.length === 0 && (
                <p className="text-gray-500">Nenhum agente cadastrado ainda.</p>
              )}
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}
