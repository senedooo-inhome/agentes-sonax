'use client'

import { useEffect, useMemo, useState } from 'react'
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

function normalizarNome(nome: string): string {
  return (nome || '').toString().trim()
}

export default function ErrosFormPage() {
  const hoje = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    data: hoje,
    supervisor: '', // supervisoes.nome
    agente: '', // agentes.nome (limpo)
    nicho: '',
    tipo: '',
    relato: '',
  })

  const [salvando, setSalvando] = useState(false)

  // Lista de agentes (tabela: agentes)
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [carregandoAgentes, setCarregandoAgentes] = useState(true)

  // Lista de supervisores (tabela: supervisoes)
  const [supervisores, setSupervisores] = useState<string[]>([])
  const [carregandoSupervisores, setCarregandoSupervisores] = useState(true)

  // Carregar agentes
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

  // Carregar supervisores (supervisoes.nome) e deduplicar
  useEffect(() => {
    async function carregarSupervisores() {
      try {
        setCarregandoSupervisores(true)

        const { data, error } = await supabase
          .from('supervisoes')
          .select('nome')
          .not('nome', 'is', null)
          .order('nome', { ascending: true })

        if (error) throw error

        // Dedup + trim (evita nomes repetidos por espaços)
        const mapa = new Map<string, string>()
        for (const row of data || []) {
          const raw = normalizarNome((row as any)?.nome)
          if (!raw) continue
          const key = raw.toLowerCase()
          if (!mapa.has(key)) mapa.set(key, raw)
        }

        setSupervisores(Array.from(mapa.values()).sort((a, b) => a.localeCompare(b)))
      } catch (err) {
        console.error('Erro ao carregar supervisores', err)
        alert('Não foi possível carregar a lista de supervisores.')
      } finally {
        setCarregandoSupervisores(false)
      }
    }

    carregarSupervisores()
  }, [])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()

    if (
      !form.data.trim() ||
      !form.supervisor.trim() ||
      !form.agente.trim() ||
      !form.nicho.trim() ||
      !form.tipo.trim() ||
      !form.relato.trim()
    ) {
      alert(
        'Preencha Data, Supervisão responsável, Pessoa responsável pela ligação, Nicho, Tipo e Relato.'
      )
      return
    }

    try {
      setSalvando(true)

      const { error } = await supabase.from('erros_agentes').insert([
        {
          data: form.data,
          supervisor: form.supervisor.trim(),
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
      alert('Erro ao salvar: ' + (err?.message ?? 'Erro desconhecido'))
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

  // (Opcional) mostrar ativos primeiro
  const agentesOrdenados = useMemo(() => {
    const ativos = agentes.filter((a) => (a.status || '').toLowerCase() === 'ativo')
    const outros = agentes.filter((a) => (a.status || '').toLowerCase() !== 'ativo')
    return [...ativos, ...outros]
  }, [agentes])

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow space-y-4">
          <form onSubmit={salvar} className="space-y-4">
            {/* Data */}
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
              {/* Supervisão responsável (select) */}
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Supervisão responsável
                </label>
                <select
                  className="w-full rounded-lg border p-2 text-[#535151] bg-white"
                  value={form.supervisor}
                  onChange={(e) =>
                    setForm({ ...form, supervisor: e.target.value })
                  }
                  disabled={carregandoSupervisores}
                >
                  <option value="">
                    {carregandoSupervisores
                      ? 'Carregando supervisores...'
                      : 'Selecione a supervisão'}
                  </option>

                  {supervisores.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pessoa responsável pela ligação (select de agentes) */}
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Pessoa responsável pela ligação
                </label>
                <select
                  className="w-full rounded-lg border p-2 text-[#535151] bg-white"
                  value={form.agente}
                  onChange={(e) => setForm({ ...form, agente: e.target.value })}
                  disabled={carregandoAgentes}
                >
                  <option value="">
                    {carregandoAgentes
                      ? 'Carregando agentes...'
                      : 'Selecione o agente'}
                  </option>

                  {agentesOrdenados.map((a) => (
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
                onChange={(e) => setForm({ ...form, relato: e.target.value })}
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
