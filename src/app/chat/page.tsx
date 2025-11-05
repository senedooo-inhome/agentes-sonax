// src/app/chat/page.tsx
'use client'

import { useState } from 'react'

type Msg = {
  from: 'user' | 'bot'
  text: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      from: 'bot',
      text: 'Oi! Pode perguntar sobre atestados, presenças, advertências, elogios ou vale. Ex: "quantas pessoas solicitaram vale esse mês", "elogios de hoje", "advertências hoje".',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return

    // joga mensagem do usuário na tela
    const userMsg: Msg = { from: 'user', text: input }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      })
      const data = await res.json()

      // se a API disser que não deu certo, mostra o erro que ela mandou
      if (!data.ok) {
        setMessages((prev) => [
          ...prev,
          { from: 'bot', text: data.error || 'Não consegui buscar agora 🤕' },
        ])
      } else {
        // agora a API já devolve o texto pronto em data.message
        setMessages((prev) => [
          ...prev,
          {
            from: 'bot',
            text: data.message || 'Certo 👍',
          },
        ])
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { from: 'bot', text: 'Erro ao falar com o servidor.' },
      ])
    } finally {
      setLoading(false)
      setInput('')
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4 gap-4">
      <h1 className="text-xl font-semibold">Assistente interno</h1>

      <div className="flex-1 border rounded-md p-3 overflow-y-auto bg-white/5 space-y-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.from === 'user' ? 'text-right' : 'text-left'}
          >
            <span
              className={`inline-block px-3 py-2 rounded-lg whitespace-pre-line ${
                m.from === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-900'
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
        {loading && <p className="text-sm text-gray-400">Buscando...</p>}
      </div>

      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          className="flex-1 border rounded-md px-3 py-2 bg-black/20"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='ex: "quantas pessoas solicitaram vale esse mês"'
        />
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded-md disabled:opacity-50"
          disabled={loading}
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
