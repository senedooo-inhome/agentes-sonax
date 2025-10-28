'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Agente = {
  id: string
  nome: string
  status: string
  created_at?: string
}

const statusOptions = [
  { label: 'Ativo', color: '#46a049' },
 
]

export default function CadastroAgentesPage() {
  const router = useRouter()

  // Gate de permissão
  const [authChecked, setAuthChecked] = useState(false)
  const [allowed, setAllowed] = useState(false)

  const [nome, setNome] = useState('')
  const [status, setStatus] = useState('Ativo')
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [loading, setLoading] = useState(false)

  // edição de NOME
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')

  // exclusão
  const [deletandoId, setDeletandoId] = useState<string | null>(null)

  useEffect(() => {
    async function verificarPermissao() {
      const { data } = await supabase.auth.getSession()
      const email = data.session?.user?.email

      if (!email) {
        router.replace('/login?next=' + encodeURIComponent(window.location.pathname))
        return
      }

      if (email !== 'supervisao@sonax.net.br') {
        alert('Acesso restrito à supervisão.')
        router.replace('/chamada')
        return
      }

      setAllowed(true)
      setAuthChecked(true)
    }
    verificarPermissao()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!allowed) return
    carregarAgentes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed])

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

  // ====== EDIÇÃO DE NOME ======
  function iniciarEdicao(a: Agente) {
    setEditandoId(a.id)
    setEditNome(a.nome)
  }

  async function salvarNome() {
    if (!editandoId) return
    const novo = editNome.trim()
    if (!novo) return alert('O nome não pode ficar vazio.')
    try {
      setLoading(true)
      const { error } = await supabase
        .from('agentes')
        .update({ nome: novo })
        .eq('id', editandoId)
      if (error) throw error
      setEditandoId(null)
      setEditNome('')
      await carregarAgentes()
    } catch (e: any) {
      alert('Erro ao atualizar nome: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEditNome('')
  }

  // ====== EXCLUSÃO ======
  async function excluirAgente(id: string) {
    if (!confirm('Tem certeza que deseja excluir este agente? Essa ação não pode ser desfeita.'))
      return
    try {
      setDeletandoId(id)
      // Se não houver FK com ON DELETE CASCADE, limpe presenças primeiro:
      await supabase.from('presencas').delete().eq('agente_id', id)
      const { error } = await supabase.from('agentes').delete().eq('id', id)
      if (error) throw error
      await carregarAgentes()
    } catch (e: any) {
      alert('Erro ao excluir: ' + e.message)
    } finally {
      setDeletandoId(null)
    }
  }

  function corStatus(s: string) {
    const map: Record<string, string> = Object.fromEntries(
      statusOptions.map(o => [o.label, o.color])
    )
    return map[s] ?? '#ccc'
  }

  // Enquanto verifica permissão, não mostra conteúdo
  if (!authChecked && !allowed) {
    return (
      <main className="min-h-screen bg-[#f5f6f7] p-8 flex items-center justify-center">
        <span className="text-gray-600">Verificando permissão…</span>
      </main>
    )
  }

  if (!allowed) return null

  return (
    <main className="relative min-h-screen bg-[#f5f6f7] p-8 overflow-hidden">
      {/* Decorações (opcionais) */}
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
        {/* HEADER de navegação */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#2687e2]">Cadastro de Agentes</h1>
          <div className="flex gap-2">
            <span className="rounded-lg bg-gray-300 px-2 py-1 text-sm font-semibold text-gray-800 cursor-default">
              Cadastro de Agentes
            </span>
            <a
              href="/chamada"
              className="rounded-lg bg-[#2687e2] px-2 py-1 text-sm font-semibold text-white hover:bg-blue-600"
            >
              Chamada
            </a>
            <a
              href="/relatorios"
              className="rounded-lg bg-[#2687e2] px-2 py-1 text-sm font-semibold text-white hover:bg-blue-600"
            >
              Relatórios Chamada
            </a>
            <a
              href="/campanhas"
              className="rounded-lg bg-[#2687e2] px-2 py-1 text-sm font-semibold text-white hover:bg-blue-600"
            >
               Campanhas
  </a>
  <a
    href="/campanhas/relatorios"
    className="rounded-lg bg-[#2687e2] px-2 py-1 text-sm font-semibold text-white hover:bg-blue-600"
  >
    Rel. campanhas
  </a>
  <a
    href="/erros"
    className="rounded-lg bg-[#2687e2] px-2 py-1 text-sm font-semibold text-white hover:bg-blue-600"
  >
    Erros
  </a>
  <a
    href="/atestados"
    className="rounded-lg bg-[#2687e2] px-2 py-1 text-sm font-semibold text-white hover:bg-blue-600"
  >
    Atestados
  </a>
  <a
    href="/login?logout=1"
    className="rounded-lg bg-gray-500 px-2 py-1 text-sm font-semibold text-white hover:bg-gray-600"
  >
    Sair
  </a>
</div>

        </div>

        {/* COLUNAS */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Formulário */}
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

            <div className="mt-auto flex items-center justify-center pt-6">
              <img src="/logo-sonax.png" alt="Sonax In Home" className="w-64 opacity-95" />
            </div>
          </div>

          {/* Lista de agentes */}
          <div className="rounded-xl bg-white p-6 shadow h-[70vh] flex flex-col">
            <h2 className="mb-4 text-lg font-semibold text-[#2687e2]">Agentes cadastrados</h2>
            <ul className="space-y-2 flex-1 overflow-y-auto pr-1">
              {agentes.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                  style={{ borderLeft: `6px solid ${corStatus(a.status)}` }}
                >
                  {/* Exibição do nome + status */}
                  <span className="font-medium text-black">
                    {editandoId === a.id ? (
                      <input
                        autoFocus
                        className="rounded-lg border p-2 text-black"
                        value={editNome}
                        onChange={(e) => setEditNome(e.target.value)}
                      />
                    ) : (
                      <>
                        {a.nome} — {a.status}
                      </>
                    )}
                  </span>

                  {/* Ações */}
                  <div className="flex items-center gap-3">
                    {editandoId === a.id ? (
                      <>
                        <button
                          className="text-sm text-[#2687e2] hover:underline disabled:opacity-50"
                          onClick={salvarNome}
                          disabled={loading || !editNome.trim()}
                        >
                          Salvar
                        </button>
                        <button
                          className="text-sm text-gray-600 hover:underline"
                          onClick={cancelarEdicao}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        className="text-sm text-[#2687e2] hover:underline"
                        onClick={() => iniciarEdicao(a)}
                      >
                        Editar
                      </button>
                    )}

                    <button
                      className="text-sm text-red-500 hover:underline disabled:opacity-50"
                      onClick={() => excluirAgente(a.id)}
                      disabled={deletandoId === a.id}
                    >
                      {deletandoId === a.id ? 'Excluindo…' : 'Excluir'}
                    </button>
                  </div>
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
