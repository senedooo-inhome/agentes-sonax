'use client'

import React, { useState } from 'react'

type ChatMessage =
  | { from: 'bot'; text: string }
  | { from: 'user'; text: string }

export default function AssistantChat() {
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
          { from: 'bot', text: data.error || 'Não consegui buscar agora 🥺' },
        ])
      } else {
        const reply =
          data.message ?? `Encontrei ${data.count} registro(s) de ${data.intent || 'dados'}.`
        setMessages(prev => [...prev, { from: 'bot', text: reply }])
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: 'Erro ao falar com o servidor.' },
      ])
    } finally {
      setLoading(false)
      setInput('')
    }
  }

  return (
    <>
      {/* botão flutuante */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-24 right-6 z-50 bg-[#2687e2] hover:bg-[#1f6bb6] text-white rounded-full w-14 h-14 shadow-lg flex items-center justify-center text-2xl"
        aria-label="Abrir chat"
      >
        💬
      </button>

      {/* janela */}
      {open && (
        <div
          className="fixed bottom-40 right-6 z-50 w-80 bg-white rounded-xl shadow-2xl border border-blue-100 flex flex-col"
          style={{ maxHeight: '65vh' }}
        >
          <div className="flex items-center justify-between bg-[#2687e2] text-white rounded-t-xl px-3 py-2">
            <div>
              <div className="text-sm font-semibold">Assistente Sonax</div>
              <div className="text-[11px] opacity-80">online</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 text-lg">
              ×
            </button>
          </div>

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
