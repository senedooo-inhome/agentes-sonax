'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Item = { id: string | number; nome: string }

const TIPOS_ERRO = [
  'Factorial',
  'Pontualidade',
  'Erro atendimento Tel',
  'Problemas tec.',
  'Erro atendimento chat',
  'Mat. Trab. inadequado',
  'Tabulação incorreta',
  'Falta de atenção Bitrix',
  'Outros',
] as const

type TipoErro = (typeof TIPOS_ERRO)[number]
type Nicho = '' | 'Clínica' | 'SAC'

function hojeYYYYMMDD() {
  return new Date().toISOString().slice(0, 10)
}

// ✅ valor padrão para erros que não têm empresa
const EMPRESA_NAO_SE_APLICA = 'Não se aplica'

export default function CadastrarErrosPage() {
  const router = useRouter()

  // ✅ proteção
  const [checkingAuth, setCheckingAuth] = useState(true)
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const email = (data.session?.user?.email || '').toLowerCase()

      if (!email) {
        router.replace('/login?next=' + window.location.pathname)
        return
      }

      // ✅ libera 2 acessos
      const allowedEmails = ['supervisao@sonax.net.br', 'sonaxinhome@gmail.com']
      const permitido = allowedEmails.includes(email)

      if (!permitido) {
        alert('Acesso restrito.')
        router.replace('/')
        return
      }

      setCheckingAuth(false)
    })()
  }, [router])

  // ===== LISTAS (supabase) =====
  const [agentes, setAgentes] = useState<Item[]>([])
  const [supervisoes, setSupervisoes] = useState<Item[]>([])
  const [empresas, setEmpresas] = useState<Item[]>([])
  const [carregandoListas, setCarregandoListas] = useState(false)

  // buscas
  const [qAgente, setQAgente] = useState('')
  const [qSupervisor, setQSupervisor] = useState('')
  const [qEmpresa, setQEmpresa] = useState('')

  const agentesFiltrados = useMemo(() => {
    const q = qAgente.trim().toLowerCase()
    if (!q) return agentes
    return agentes.filter((a) => a.nome.toLowerCase().includes(q))
  }, [agentes, qAgente])

  const supervisoesFiltradas = useMemo(() => {
    const q = qSupervisor.trim().toLowerCase()
    if (!q) return supervisoes
    return supervisoes.filter((s) => s.nome.toLowerCase().includes(q))
  }, [supervisoes, qSupervisor])

  const empresasFiltradas = useMemo(() => {
    const q = qEmpresa.trim().toLowerCase()
    if (!q) return empresas
    return empresas.filter((e) => e.nome.toLowerCase().includes(q))
  }, [empresas, qEmpresa])

  async function carregarListas() {
    try {
      setCarregandoListas(true)

      const [agRes, supRes, empRes] = await Promise.all([
        supabase.from('agentes').select('id, nome').order('nome', { ascending: true }),
        supabase.from('supervisoes').select('id, nome').order('nome', { ascending: true }),
        supabase.from('empresas').select('id, nome').order('nome', { ascending: true }),
      ])

      if (agRes.error) throw agRes.error
      if (supRes.error) throw supRes.error
      if (empRes.error) throw empRes.error

      setAgentes((agRes.data as any) || [])
      setSupervisoes((supRes.data as any) || [])
      setEmpresas((empRes.data as any) || [])
    } catch (err: any) {
      console.error(err)
      alert('Erro ao carregar listas: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCarregandoListas(false)
    }
  }

  useEffect(() => {
    if (!checkingAuth) carregarListas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingAuth])

  // ===== FORM =====
  const [form, setForm] = useState({
    data: hojeYYYYMMDD(),
    nicho: '' as Nicho,
    empresa: '', // pode ser EMPRESA_NAO_SE_APLICA
    supervisor: '',
    agente: '',
    tipo: '' as '' | TipoErro,
    relato: '',
  })

  const [salvando, setSalvando] = useState(false)

  function resetForm() {
    setForm({
      data: hojeYYYYMMDD(),
      nicho: '',
      empresa: '',
      supervisor: '',
      agente: '',
      tipo: '',
      relato: '',
    })
    setQAgente('')
    setQSupervisor('')
    setQEmpresa('')
  }

  async function salvar() {
    if (!form.data) return alert('Preencha a data.')
    if (!form.nicho) return alert('Selecione o nicho.')

    // ✅ agora empresa pode ser "Não se aplica"
    const empresaValida =
      form.empresa === EMPRESA_NAO_SE_APLICA || (form.empresa && form.empresa.trim().length > 0)
    if (!empresaValida) return alert('Selecione a empresa ou "Não se aplica".')

    if (!form.supervisor) return alert('Selecione o supervisor.')
    if (!form.agente) return alert('Selecione o agente.')
    if (!form.tipo) return alert('Selecione o tipo do erro.')
    if (!form.relato.trim()) return alert('Descreva o relato.')

    try {
      setSalvando(true)

      const payload = {
        data: form.data,
        nicho: form.nicho,
        empresa: form.empresa, // ✅ pode ser "Não se aplica"
        supervisor: form.supervisor,
        agente: form.agente,
        tipo: form.tipo,
        relato: form.relato.trim(),
      }

      const { error } = await supabase.from('erros_agentes').insert([payload])
      if (error) throw error

      alert('Erro registrado com sucesso!')
      resetForm()
    } catch (err: any) {
      console.error(err)
      alert('Erro ao salvar: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setSalvando(false)
    }
  }

  if (checkingAuth) {
    return (
      <main className="min-h-[calc(100vh-0px)] bg-[#f5f6f7] p-6">
        <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow text-[#0f172a]">
          Carregando…
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[calc(100vh-0px)] bg-[#f5f6f7] p-6">
      <div className="w-full max-w-[1600px] mx-auto space-y-6">
        <div className="sticky top-0 z-20 bg-[#f5f6f7] pt-2">
          <div className="rounded-2xl bg-white p-6 shadow flex flex-wrap items-center justify-between gap-4 border border-[#e2e8f0]">
            <div>
              <h1 className="text-2xl font-extrabold text-[#2687e2]">Cadastrar Erros</h1>
              <p className="text-sm text-[#334155]">
                Supervisor (supervisoes), agente (agentes) e empresa (empresas)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={carregarListas}
                className="rounded-lg border border-[#334155] bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#111827] disabled:opacity-50"
                disabled={carregandoListas}
              >
                {carregandoListas ? 'Recarregando…' : 'Recarregar listas'}
              </button>

              <button
                type="button"
                onClick={salvar}
                disabled={salvando}
                className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow border border-[#e2e8f0]">
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Data</label>
              <input
                type="date"
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Nicho</label>
              <select
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white"
                value={form.nicho}
                onChange={(e) => setForm({ ...form, nicho: e.target.value as Nicho })}
              >
                <option value="">Selecione</option>
                <option value="Clínica">Clínica</option>
                <option value="SAC">SAC</option>
              </select>
            </div>

            {/* Empresa */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Empresa</label>
              <input
                type="text"
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white mb-2"
                value={qEmpresa}
                onChange={(e) => setQEmpresa(e.target.value)}
                placeholder="Buscar empresa..."
              />
              <select
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white disabled:opacity-60"
                value={form.empresa}
                onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                disabled={carregandoListas}
              >
                <option value="">
                  {carregandoListas ? 'Carregando...' : 'Selecione a empresa'}
                </option>

                {/* ✅ NOVO: não se aplica */}
                <option value={EMPRESA_NAO_SE_APLICA}>{EMPRESA_NAO_SE_APLICA}</option>

                {empresasFiltradas.map((em) => (
                  <option key={String(em.id)} value={em.nome}>
                    {em.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Supervisor</label>
              <input
                type="text"
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white mb-2"
                value={qSupervisor}
                onChange={(e) => setQSupervisor(e.target.value)}
                placeholder="Buscar supervisor..."
              />
              <select
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white disabled:opacity-60"
                value={form.supervisor}
                onChange={(e) => setForm({ ...form, supervisor: e.target.value })}
                disabled={carregandoListas}
              >
                <option value="">
                  {carregandoListas ? 'Carregando...' : 'Selecione o supervisor'}
                </option>
                {supervisoesFiltradas.map((s) => (
                  <option key={String(s.id)} value={s.nome}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-3">
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Agente</label>
              <input
                type="text"
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white mb-2"
                value={qAgente}
                onChange={(e) => setQAgente(e.target.value)}
                placeholder="Buscar agente..."
              />
              <select
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white disabled:opacity-60"
                value={form.agente}
                onChange={(e) => setForm({ ...form, agente: e.target.value })}
                disabled={carregandoListas}
              >
                <option value="">
                  {carregandoListas ? 'Carregando...' : 'Selecione o agente'}
                </option>
                {agentesFiltrados.map((a) => (
                  <option key={String(a.id)} value={a.nome}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-3">
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Tipo do erro</label>
              <select
                className="w-full rounded-lg border border-[#cbd5e1] p-2 text-[#0f172a] bg-white"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as any })}
              >
                <option value="">Selecione</option>
                {TIPOS_ERRO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-6">
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Relato</label>
              <textarea
                rows={5}
                className="w-full rounded-lg border border-[#cbd5e1] p-3 text-[#0f172a] bg-white"
                value={form.relato}
                onChange={(e) => setForm({ ...form, relato: e.target.value })}
                placeholder="Descreva o erro com contexto..."
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#64748b]">
              * Obrigatórios: Data, Nicho, Empresa (ou Não se aplica), Supervisor, Agente, Tipo, Relato
            </p>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-[#334155] bg-white px-4 py-2 text-sm font-semibold text-[#0f172a] hover:bg-[#e2e8f0]"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
