'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Empresa = {
  id: string
  nome: string
}

const RESPONSAVEIS = [
  'Samara Dias',
  'Ivania Brito',
  'Debora Venâncio',
  'Layssa Miranda',
  'Mayara Alves',
  'Leticia Guido',
  'Daniela Martins',
]

export default function OperacaoEmpresaPage() {
  const hoje = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    data: hoje,
    empresaId: '',
    statusOperacao: '', // "Sim" | "Não"  (Sim = atende / Não = não atende)
    responsavel: '',
    observacao: '',
    diasSemAtendimento: [] as number[], // 1..31
  })

  const [salvando, setSalvando] = useState(false)

  // Empresas
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(true)

  const diasDoMes = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), [])

  useEffect(() => {
    async function carregarEmpresas() {
      try {
        setCarregandoEmpresas(true)
        const { data, error } = await supabase
          .from('empresas')
          .select('id, nome')
          .order('nome', { ascending: true })

        if (error) throw error

        setEmpresas((data || []).map((e: any) => ({ id: e.id, nome: e.nome })))
      } catch (err) {
        console.error('Erro ao carregar empresas', err)
        alert('Não foi possível carregar a lista de empresas.')
      } finally {
        setCarregandoEmpresas(false)
      }
    }

    carregarEmpresas()
  }, [])

  // ✅ Se Call Center = "Sim", dias NÃO fazem sentido → desabilita e limpa seleção
  useEffect(() => {
    if (form.statusOperacao === 'Sim' && form.diasSemAtendimento.length > 0) {
      setForm((prev) => ({ ...prev, diasSemAtendimento: [] }))
    }
  }, [form.statusOperacao]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleDia(dia: number) {
    setForm((prev) => {
      const existe = prev.diasSemAtendimento.includes(dia)
      const novaLista = existe
        ? prev.diasSemAtendimento.filter((d) => d !== dia)
        : [...prev.diasSemAtendimento, dia].sort((a, b) => a - b)

      return { ...prev, diasSemAtendimento: novaLista }
    })
  }

  function formatDia(dia: number) {
    return String(dia).padStart(2, '0')
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()

    if (!form.data || !form.empresaId || !form.statusOperacao || !form.responsavel) {
      alert('Preencha Data, Empresa, Atendimento do Call Center? e Validação (Responsável).')
      return
    }

    // ✅ Se Call Center = "Não", é obrigatório selecionar pelo menos 1 dia
    if (form.statusOperacao === 'Não' && form.diasSemAtendimento.length === 0) {
      alert('Selecione ao menos 1 dia sem atendimento (pois o Call Center não atende).')
      return
    }

    try {
      setSalvando(true)

      const payload = {
        data: form.data,
        empresa_id: form.empresaId,
        status_operacao: form.statusOperacao, // Sim/Não
        responsavel: form.responsavel,
        observacao: form.observacao?.trim() || null,
        // ✅ se "Sim" -> []
        // ✅ se "Não" -> dias selecionados
        dias_sem_atendimento: form.statusOperacao === 'Sim' ? [] : form.diasSemAtendimento,
      }

      const { error } = await supabase.from('operacao_empresas').insert([payload])
      if (error) throw error

      alert('Registro salvo!')
      setForm({
        data: hoje,
        empresaId: '',
        statusOperacao: '',
        responsavel: '',
        observacao: '',
        diasSemAtendimento: [],
      })
    } catch (err: any) {
      console.error(err)
      alert('Erro ao salvar: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setSalvando(false)
    }
  }

  // ✅ Só habilita dias quando Call Center = "Não"
  const diasHabilitado = form.statusOperacao === 'Não'

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow space-y-6">
          <form onSubmit={salvar} className="space-y-6">
            {/* Data */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Data</label>
              <input
                type="date"
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </div>

            {/* Empresa */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Seleção de Empresa
              </label>
              <select
                className="w-full rounded-lg border p-2 text-[#535151] bg-white"
                value={form.empresaId}
                onChange={(e) => setForm({ ...form, empresaId: e.target.value })}
                disabled={carregandoEmpresas}
              >
                <option value="">
                  {carregandoEmpresas ? 'Carregando empresas...' : 'Selecione a empresa'}
                </option>
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Atendimento + Responsável */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Atendimento do Call Center?
                </label>
                <select
                  className="w-full rounded-lg border p-2 text-[#535151] bg-white"
                  value={form.statusOperacao}
                  onChange={(e) => setForm({ ...form, statusOperacao: e.target.value })}
                >
                  <option value="">Selecione</option>
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Validação (Responsável)
                </label>
                <select
                  className="w-full rounded-lg border p-2 text-[#535151] bg-white"
                  value={form.responsavel}
                  onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                >
                  <option value="">Selecione o responsável</option>
                  {RESPONSAVEIS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dias do mês */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-[#ff751f]">
                Dias que a empresa não vai ter atendimento
              </label>

              <div className={`flex flex-wrap gap-2 ${!diasHabilitado ? 'opacity-60' : ''}`}>
                {diasDoMes.map((dia) => {
                  const ativo = form.diasSemAtendimento.includes(dia)
                  return (
                    <button
                      type="button"
                      key={dia}
                      onClick={() => diasHabilitado && toggleDia(dia)}
                      disabled={!diasHabilitado}
                      className={[
                        'px-3 py-1 rounded-full border text-sm transition',
                        ativo
                          ? 'bg-[#2687e2] text-white border-[#2687e2]'
                          : 'bg-white text-[#535151] hover:bg-gray-50',
                        !diasHabilitado ? 'cursor-not-allowed' : '',
                      ].join(' ')}
                      title={`Dia ${formatDia(dia)}`}
                    >
                      {formatDia(dia)}
                    </button>
                  )
                })}
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Se o Atendimento do Call Center for “Sim”, não é necessário selecionar dias.
                <br />
                Se for “Não”, selecione os dias em que NÃO haverá atendimento.
              </p>
            </div>

            {/* Observação */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                Campo de Observação
              </label>
              <textarea
                rows={5}
                className="w-full rounded-lg border p-2 text-[#535151]"
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                placeholder='Ex.: "Empresa acionou a URA no feriado e pediu antecipação/pós-feriado..."'
              />
            </div>

            <button
              type="submit"
              disabled={salvando}
              className="rounded-lg bg-[#2687e2] px-6 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
