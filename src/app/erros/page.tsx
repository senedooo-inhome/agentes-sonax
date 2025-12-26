'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Agente = {
  id: string
  nomeBruto: string
  nomeLimpo: string
  status: string
}

function limparNomeAgente(nomeBruto: string): string {
  if (!nomeBruto) return ''

  let nome = nomeBruto

  // remove prefixo "05 - " ou "123 - "
  nome = nome.replace(/^\d+\s*-\s*/, '')

  // remove parte do horário "07h as 15h12" pra frente
  nome = nome.replace(/\d{1,2}h.*$/i, '')

  return nome.trim()
}

export default function ErrosFormPage() {
  const hoje = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    data: hoje,
    supervisor: '',
    agente: '',
    nicho: '',
    tipo: '',
    relato: '',
  })
  const [salvando, setSalvando] = useState(false)

  // Lista de agentes cadastrados
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [carregandoAgentes, setCarregandoAgentes] = useState(true)

  // Carregar TODOS os agentes da tabela "agentes"
  useEffect(() => {
    async function carregarAgentes() {
      try {
        setCarregandoAgentes(true)
        const { data, error } = await supabase
          .from('agentes')
          .select('id, nome, status')
          .order('nome', { ascending: true })

        if (error) throw error

        const lista: Agente[] =
          (data || []).map((a: any) => ({
            id: a.id,
            nomeBruto: a.nome,
            nomeLimpo: limparNomeAgente(a.nome),
            status: a.status,
          })) ?? []

        setAgentes(lista)
      } catch (err) {
        console.error('Erro ao carregar agentes', err)
        alert('Não foi possível carregar a lista de agentes.')
      } finally {
        setCarregandoAgentes(false)
      }
    }

    carregarAgentes()
  }, [])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (
      !form.supervisor.trim() ||
      !form.agente.trim() ||
      !form.nicho.trim() ||
      !form.tipo.trim() ||
      !form.relato.trim()
    ) {
      alert('Preencha Data, Supervisor, Agente, Nicho, Tipo e Relato.')
      return
    }

    try {
      setSalvando(true)
      const { error } = await supabase.from('erros_agentes').insert([
        {
          data: form.data,
          supervisor: form.supervisor.trim(),
          // salvamos o NOME LIMPO na tabela de erros
          agente: form.agente.trim(),
          nicho: form.nicho.trim(),
          tipo: form.tipo.trim(),
          relato: form.relato.trim(),
        },
      ])
      if (error) throw error
      alert('Registro salvo!')
      setForm({
        data: hoje,
        supervisor: '',
        agente: '',
        nicho: '',
        tipo: '',
        relato: '',
      })
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  const tiposErro = [
    'Factorial',
    'Pontualidade',
    'Erro atendimento Tel',
    'Problemas tec.',
    'Erro atendimento chat',
    'Mat. Trab. inadequado',
    'Tabulação incorreta',
    'Falta de atenção Bitrix',
    'Outros',
  ]

  const nichos = ['Clínica', 'SAC']

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow space-y-4">
          <form onSubmit={salvar} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Data
              </label>
              <input
                type="date"
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Nome do supervisor
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  value={form.supervisor}
                  onChange={(e) =>
                    setForm({ ...form, supervisor: e.target.value })
                  }
                  placeholder="Ex.: MARCO"
                />
              </div>

              {/* SELECT de agentes (nome limpo + status) */}
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Nome do agente pontuado
                </label>
                <select
                  className="w-full rounded-lg border p-2 text-[#535151] bg-white"
                  value={form.agente}
                  onChange={(e) =>
                    setForm({ ...form, agente: e.target.value })
                  }
                  disabled={carregandoAgentes}
                >
                  <option value="">
                    {carregandoAgentes
                      ? 'Carregando agentes...'
                      : 'Selecione o agente'}
                  </option>
                  {agentes.map((a) => (
                    <option key={a.id} value={a.nomeLimpo}>
                      {a.nomeLimpo} {a.status !== 'Ativo' ? '(Inativo)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Nicho */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Nicho do agente
              </label>
              <select
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.nicho}
                onChange={(e) => setForm({ ...form, nicho: e.target.value })}
              >
                <option value="">Selecione o nicho</option>
                {nichos.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo do erro */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Tipo do erro
              </label>
              <select
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                <option value="">Selecione o motivo</option>
                {tiposErro.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Relato */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Relato do erro
              </label>
              <textarea
                rows={5}
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.relato}
                onChange={(e) =>
                  setForm({ ...form, relato: e.target.value })
                }
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