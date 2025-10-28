'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function ErrosFormPage() {
  const router = useRouter()
  const hoje = new Date().toISOString().slice(0,10)

  // Guard simples: exige sessão (supervisores)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login?next=/erros')
    })
  }, [router])

  const [form, setForm] = useState({
    data: hoje,
    supervisor: '',
    agente: '',
    relato: ''
  })
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.supervisor.trim() || !form.agente.trim() || !form.relato.trim()) {
      alert('Preencha Supervisor, Agente e Relato.'); return
    }
    try {
      setSalvando(true)
      const { error } = await supabase.from('erros_agentes').insert([{
        data: form.data,
        supervisor: form.supervisor.trim(),
        agente: form.agente.trim(),
        relato: form.relato.trim(),
      }])
      if (error) throw error
      alert('Registro salvo!')
      setForm({ data: hoje, supervisor: '', agente: '', relato: '' })
    } catch (err:any) {
      alert('Erro ao salvar: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#2687e2]">Erros do Agente</h1>
          <div className="flex gap-2">
            <a href="/" className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600">Formulario</a>
            <a href="/erros/relatorios" className="rounded-lg border border-[#2687e2] px-4 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white">Relatórios</a>
          </div>
        </header>

        <div className="rounded-xl bg-white p-6 shadow space-y-4">
          <form onSubmit={salvar} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Data</label>
              <input
                type="date"
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.data}
                onChange={e=>setForm({...form, data: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Nome do supervisor</label>
                <input
                  type="text"
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  value={form.supervisor}
                  onChange={e=>setForm({...form, supervisor: e.target.value})}
                  placeholder="Ex.: MARCO"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Nome do agente pontuado</label>
                <input
                  type="text"
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  value={form.agente}
                  onChange={e=>setForm({...form, agente: e.target.value})}
                  placeholder="Ex.: JOANA"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Relato do erro</label>
              <textarea
                rows={5}
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.relato}
                onChange={e=>setForm({...form, relato: e.target.value})}
                placeholder="Descreva o ocorrido, contexto e evidências…"
              />
            </div>

            <button
              type="submit"
              disabled={salvando}
              className="rounded-lg bg-[#2687e2] px-4 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
