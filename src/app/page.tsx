'use client'

import React, {
  useEffect,
  useState,
  type CSSProperties,
} from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/* =========================================================
   Widget de chat flutuante
   ========================================================= */

type ChatMessage = {
  from: 'bot' | 'user'
  text: string
}

function AssistantChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      from: 'bot',
      text: 'Oi! Posso te dizer sobre atestados, presenças, advertências e campanhas 👋',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault()
    if (!input.trim()) return

    const userMsg: ChatMessage = { from: 'user', text: input }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      })
      const data = await res.json()

      if (!data.ok) {
        setMessages(prev => [
          ...prev,
          {
            from: 'bot',
            text: data.error || 'Não consegui buscar agora 🥺',
          },
        ])
      } else {
        const reply =
          data.message ??
          `Encontrei ${data.count} registro(s) de ${data.intent || 'dados'}.`
        setMessages(prev => [...prev, { from: 'bot', text: reply }])
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: 'Erro ao falar com o servidor.' },
      ])
    } finally {
      setLoading(false)
      setInput('')
    }
  }

  // posição do botão (em cima da mão)
  const buttonStyle: CSSProperties = {
    position: 'fixed',
    bottom: '13.5rem',
    right: '17.5rem',
    zIndex: 50,
  }

  return (
    <>
      {/* botão flutuante */}
      <button
        onClick={() => setOpen(o => !o)}
        style={buttonStyle}
        className="bg-[#2687e2] hover:bg-[#1f6bb6] text-white rounded-full w-14 h-14 shadow-lg flex items-center justify-center text-2xl border-2 border-white"
        aria-label="Abrir chat"
      >
        💬
      </button>

      {/* janela do chat */}
      {open && (
        <div
          className="fixed bottom-40 right-6 z-50 w-80 bg-white rounded-xl shadow-2xl border border-blue-100 flex flex-col"
          style={{ maxHeight: '65vh' }}
        >
          {/* header */}
          <div className="flex items-center justify-between bg-[#2687e2] text-white rounded-t-xl px-3 py-2">
            <div>
              <div className="text-sm font-semibold">Assistente Sonax</div>
              <div className="text-[11px] opacity-80">online</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 text-lg">
              ×
            </button>
          </div>

          {/* mensagens */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-slate-50">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                    m.from === 'user'
                      ? 'bg-white text-black border border-[#2687e2] rounded-br-sm'
                      : 'bg-white text-slate-900 border border-slate-100 rounded-bl-sm'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && <p className="text-xs text-slate-400">Digitando…</p>}
          </div>

          {/* input */}
          <form onSubmit={sendMessage} className="flex gap-2 p-2 border-t bg-white rounded-b-xl">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              className="flex-1 text-sm border rounded-md px-2 py-1 text-black focus:outline-none focus:ring-1 focus:ring-[#2687e2]"
              placeholder="ex: advertências hoje"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-[#2687e2] hover:bg-[#1f6bb6] text-white text-sm px-3 py-1 rounded-md"
            >
              Enviar
            </button>
          </form>
        </div>
      )}
    </>
  )
}

/* =========================================================
   Página de Cadastro de Agentes
   ========================================================= */

type Agente = {
  id: string
  nome: string
  status: string
  created_at?: string
}

const statusOptions = [
  { label: 'Presente', color: '#46a049' },           // ✅
  { label: 'Folga', color: '#3399ff' },              // 🟦
  { label: 'Férias', color: '#f4c542' },             // 🏖️
  { label: 'Atestado', color: '#ff9999' },           // 🩺
  { label: 'Afastado', color: '#ff4d4d' },           // 🚫
  { label: 'Licença Maternidade', color: '#ffb6c1' },// 👶
  { label: 'Licença Paternidade', color: '#add8e6' },// 🍼
  { label: 'Ausente', color: '#a9a9a9' },            // ⛔
  { label: 'Ativo', color: '#46a049' }               // original
];


export default function CadastroAgentesPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [nome, setNome] = useState('')
  const [status, setStatus] = useState('Ativo')
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [loading, setLoading] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [deletandoId, setDeletandoId] = useState<string | null>(null)

  // auth
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
  }, [router])

  // carrega agentes quando permitido
  useEffect(() => {
    if (!allowed) return
    carregarAgentes()
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

  async function salvarNome() {
    if (!editandoId) return
    const novo = editNome.trim()
    if (!novo) return alert('O nome não pode ficar vazio.')
    try {
      setLoading(true)
      const { error } = await supabase.from('agentes').update({ nome: novo }).eq('id', editandoId)
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

  async function excluirAgente(id: string) {
    if (!confirm('Tem certeza que deseja excluir este agente? Essa ação não pode ser desfeita.'))
      return
    try {
      setDeletandoId(id)
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
      statusOptions.map(o => [o.label, o.color]),
    )
    return map[s] ?? '#ccc'
  }

  if (!authChecked && !allowed) {
    return (
      <main className="min-h-screen bg-[#f5f6f7] p-8 flex items-center justify-center">
        <span className="text-gray-600">Verificando permissão…</span>
        <AssistantChat />
      </main>
    )
  }

  if (!allowed) return null

  // 🔧 AQUI está a correção: usamos objetos, não arrays misturadas
  const menuLinks: Array<{
    href: string
    label: string
    bordered?: boolean
    color?: 'gray'
  }> = [
    { href: '/', label: 'Início' },
    { href: '/chamada', label: 'Chamada' },
    { href: '/campanhas', label: 'Campanhas' },
    { href: '/campanhas/relatorios', label: 'Rel. campanhas', bordered: true },
    { href: '/erros', label: 'Erros' },
    { href: '/advertencias', label: 'Advertências' },
    { href: '/atestados', label: 'Atestados' },
    { href: '/ligacoes', label: 'Ligações Ativas' },
    { href: '/ligacoes/relatorios', label: 'Rel. ligações', bordered: true },
    { href: '/login?logout=1', label: 'Sair', color: 'gray' },
  ]

  return (
    <main className="relative min-h-screen bg-[#f5f6f7] p-8 overflow-hidden">
      {/* fundos */}
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
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#2687e2]">Cadastro de Agentes</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {menuLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                className={`rounded-lg px-2 py-1 text-sm font-semibold ${
                  link.bordered
                    ? 'border border-[#2687e2] text-[#2687e2] hover:bg-[#2687e2] hover:text-white'
                    : link.color === 'gray'
                    ? 'bg-gray-500 text-white hover:bg-gray-600'
                    : 'bg-[#2687e2] text-white hover:bg-blue-600'
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        {/* CONTEÚDO */}
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
                onChange={e => setNome(e.target.value)}
              />
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="rounded-lg border p-2 text-black"
              >
                {statusOptions.map(s => (
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
              {agentes.map(a => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                  style={{ borderLeft: `6px solid ${corStatus(a.status)}` }}
                >
                  <span className="font-medium text-black">
                    {editandoId === a.id ? (
                      <input
                        autoFocus
                        className="rounded-lg border p-2 text-black"
                        value={editNome}
                        onChange={e => setEditNome(e.target.value)}
                      />
                    ) : (
                      <>
                        {a.nome} — {a.status}
                      </>
                    )}
                  </span>
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
                          onClick={() => setEditandoId(null)}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        className="text-sm text-[#2687e2] hover:underline"
                        onClick={() => {
                          setEditandoId(a.id)
                          setEditNome(a.nome)
                        }}
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

      {/* chat flutuante */}
      <AssistantChat />
    </main>
  )
}
