'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AdvertenciasPage() {
  const router = useRouter()
  const hoje = new Date().toISOString().slice(0, 10)

  //
  // 1. TODOS OS HOOKS PRIMEIRO 🔒
  //

  // controle de acesso
  const [carregandoPermissao, setCarregandoPermissao] = useState(true)
  const [autorizado, setAutorizado] = useState(false)

  // form
  const [form, setForm] = useState({
    data: hoje,
    supervisor: '',
    agente: '',
    motivo: '',
    descricao: '',
    tipo_advertencia: '',
    acao: '',
    status: '',
    observacoes: '',
    link_evidencia: '',
  })

  // loading do submit
  const [salvando, setSalvando] = useState(false)

  // efeito que valida permissão
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const email = data.session?.user?.email

      // não logado → manda pro login
      if (!email) {
        router.replace('/login?next=/advertencias')
        return
      }

      // só supervisão pode acessar
      if (email !== 'supervisao@sonax.net.br') {
        alert('Acesso restrito à supervisão.')
        router.replace('/')
        return
      }

      if (mounted) {
        setAutorizado(true)
        setCarregandoPermissao(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [router])

  //
  // 2. FUNÇÕES DO FORM
  //
  async function salvar(e: React.FormEvent) {
    e.preventDefault()

    if (
      !form.data.trim() ||
      !form.supervisor.trim() ||
      !form.agente.trim() ||
      !form.motivo.trim() ||
      !form.descricao.trim() ||
      !form.tipo_advertencia.trim() ||
      !form.acao.trim() ||
      !form.status.trim()
    ) {
      alert('Preencha todos os campos obrigatórios.')
      return
    }

    try {
      setSalvando(true)
      const { error } = await supabase.from('advertencias').insert([
        {
          data: form.data,
          supervisor: form.supervisor.trim(),
          agente: form.agente.trim(),
          motivo: form.motivo.trim(),
          descricao: form.descricao.trim(),
          tipo_advertencia: form.tipo_advertencia.trim(),
          acao: form.acao.trim(),
          status: form.status.trim(),
          observacoes: form.observacoes.trim() || null,
          link_evidencia: form.link_evidencia.trim() || null,
        },
      ])
      if (error) throw error

      alert('Advertência registrada com sucesso.')
      setForm({
        data: hoje,
        supervisor: '',
        agente: '',
        motivo: '',
        descricao: '',
        tipo_advertencia: '',
        acao: '',
        status: '',
        observacoes: '',
        link_evidencia: '',
      })
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  //
  // 3. LISTAS DOS SELECTS
  //
  const MOTIVOS = [
    'Conduta',
    'Ausência',
    'Desempenho',
    'Descumprimento de escala',
    'Outros',
  ]

  const TIPOS = [
    'Verbal',
    'Escrita',
    'Suspensão',
    'Outros',
  ]

  const ACOES = [
    'Conversa individual',
    'Registro formal',
    'Encaminhamento à coordenação',
    'Outros',
  ]

  const STATUS_OPCOES = [
    'Resolvido',
    'Em acompanhamento',
    'Reincidente',
  ]

  //
  // 4. AGORA SIM O RENDER
  //
  if (carregandoPermissao) {
    return (
      <main className="min-h-screen bg-[#f5f6f7] flex items-center justify-center p-6">
        <span className="text-gray-600 text-sm">Verificando acesso…</span>
      </main>
    )
  }

  if (!autorizado) {
    // já redirecionou lá em cima, mas retorno vazio pra não tentar montar nada
    return null
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold text-[#2687e2]">Advertências</h1>

          <div className="flex items-center gap-2 flex-wrap">
            <a
              href="/"
              className="rounded-lg bg-[#2687e2] px-2 py-1 text-sm font-semibold text-white hover:bg-blue-600"
            >
              Início
            </a>

            <a
              href="/advertencias/relatorios"
              className="rounded-lg border border-[#2687e2] px-2 py-1 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white"
            >
              Rel. advertências
            </a>

            <a
              href="/login?logout=1"
              className="rounded-lg bg-gray-500 px-2 py-1 text-sm font-semibold text-white hover:bg-gray-600"
            >
              Sair
            </a>
          </div>
        </header>

        {/* Texto explicativo */}
        <div className="rounded-xl bg-white p-4 shadow text-[#535151] text-sm leading-relaxed">
          <p className="whitespace-pre-line">
            {`Esta aba foi criada para registrar e acompanhar todas as advertências aplicadas aos colaboradores.

O objetivo é manter a transparência, garantir a evolução profissional e reforçar o compromisso com as normas da empresa.

Cada registro é tratado com seriedade, buscando sempre o diálogo, a correção de condutas e o fortalecimento da cultura organizacional.`}
          </p>
        </div>

        {/* Form */}
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

            {/* Supervisor / Agente */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Supervisor Responsável
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

              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Nome do Agente
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  value={form.agente}
                  onChange={(e) =>
                    setForm({ ...form, agente: e.target.value })
                  }
                  placeholder="Ex.: JOANA"
                />
              </div>
            </div>

            {/* Motivo da Advertência */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Motivo da Advertência
              </label>
              <select
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.motivo}
                onChange={(e) => setForm({ ...form, motivo: e.target.value })}
              >
                <option value="">Selecione o motivo</option>
                {MOTIVOS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Descrição Detalhada */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Descrição Detalhada
              </label>
              <textarea
                rows={4}
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.descricao}
                onChange={(e) =>
                  setForm({ ...form, descricao: e.target.value })
                }
                placeholder="Explique o ocorrido, contexto, impacto e evidências…"
              />
            </div>

            {/* Tipo de Advertência / Ação Tomada */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Tipo de Advertência
                </label>
                <select
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  value={form.tipo_advertencia}
                  onChange={(e) =>
                    setForm({ ...form, tipo_advertencia: e.target.value })
                  }
                >
                  <option value="">Selecione</option>
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Ação Tomada
                </label>
                <select
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  value={form.acao}
                  onChange={(e) =>
                    setForm({ ...form, acao: e.target.value })
                  }
                >
                  <option value="">Selecione</option>
                  {ACOES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Status
              </label>
              <select
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="">Selecione o status</option>
                {STATUS_OPCOES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Observações Adicionais */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Observações Adicionais
              </label>
              <textarea
                rows={3}
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.observacoes}
                onChange={(e) =>
                  setForm({ ...form, observacoes: e.target.value })
                }
                placeholder="(Opcional) Informações para acompanhamento futuro"
              />
            </div>

            {/* Link de evidência */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Link de evidência / documento
              </label>
              <input
                type="text"
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.link_evidencia}
                onChange={(e) =>
                  setForm({ ...form, link_evidencia: e.target.value })
                }
                placeholder="Cole aqui o link do Drive / print / etc"
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
