'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type LinhaErro = {
  id: string
  data: string
  supervisor: string
  agente: string
  nicho: string | null
  empresa: string | null // ✅ empresa real
  tipo: string | null
  relato: string
  created_at: string
}

type EmpresaRow = { id: string | number; nome: string }

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
]

export default function RelatorioErros() {
  const router = useRouter()

  // --------- PROTEÇÃO: somente supervisão ----------
  useEffect(() => {
    async function verificarPermissao() {
      const { data } = await supabase.auth.getSession()
      const email = data.session?.user?.email
      if (!email) {
        router.replace('/login?next=' + window.location.pathname)
        return
      }
      if (email !== 'supervisao@sonax.net.br') {
        alert('Acesso restrito à supervisão.')
        router.replace('/')
      }
    }
    verificarPermissao()
  }, [router])
  // --------------------------------------------------

  const hoje = new Date().toISOString().slice(0, 10)
  const [dataIni, setDataIni] = useState(hoje)
  const [dataFim, setDataFim] = useState(hoje)

  const [qSupervisor, setQSupervisor] = useState('')
  const [qAgente, setQAgente] = useState('')

  const [fTipo, setFTipo] = useState<string>('Todos')
  const [fNicho, setFNicho] = useState<string>('Todos')

  // empresas do supabase + filtro select
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([])
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(false)
  const [fEmpresa, setFEmpresa] = useState<string>('Todas')

  const [linhas, setLinhas] = useState<LinhaErro[]>([])
  const [loading, setLoading] = useState(false)

  // ✅ NOVO: estado do modal de edição
  const [editando, setEditando] = useState<LinhaErro | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  function atalhoHoje() {
    const d = new Date().toISOString().slice(0, 10)
    setDataIni(d)
    setDataFim(d)
  }
  function atalhoSemana() {
    const d = new Date()
    const dow = d.getDay() || 7
    const ini = new Date(d)
    ini.setDate(d.getDate() - (dow - 1))
    const fim = new Date(ini)
    fim.setDate(ini.getDate() + 6)
    setDataIni(ini.toISOString().slice(0, 10))
    setDataFim(fim.toISOString().slice(0, 10))
  }
  function atalhoMes() {
    const d = new Date()
    const ini = new Date(d.getFullYear(), d.getMonth(), 1)
    const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    setDataIni(ini.toISOString().slice(0, 10))
    setDataFim(fim.toISOString().slice(0, 10))
  }

  async function carregarEmpresas() {
    try {
      setCarregandoEmpresas(true)
      const { data, error } = await supabase
        .from('empresas')
        .select('id, nome')
        .order('nome', { ascending: true })

      if (error) throw error
      setEmpresas(((data as any) || []) as EmpresaRow[])
    } catch (err: any) {
      console.error(err)
      alert('Erro ao carregar empresas: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCarregandoEmpresas(false)
    }
  }

  async function buscar() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('erros_agentes')
        .select('id, created_at, data, supervisor, agente, nicho, empresa, tipo, relato')
        .gte('data', dataIni)
        .lte('data', dataFim)

      if (error) throw error

      let all = (data ?? []) as LinhaErro[]

      const qSup = qSupervisor.trim().toLowerCase()
      const qAgt = qAgente.trim().toLowerCase()
      if (qSup) all = all.filter((l) => (l.supervisor ?? '').toLowerCase().includes(qSup))
      if (qAgt) all = all.filter((l) => (l.agente ?? '').toLowerCase().includes(qAgt))

      if (fTipo !== 'Todos') {
        all = all.filter((l) => (l.tipo ?? '') === fTipo)
      }

      if (fNicho !== 'Todos') {
        all = all.filter((l) => (l.nicho ?? '') === fNicho)
      }

      if (fEmpresa !== 'Todas') {
        all = all.filter((l) => (l.empresa ?? '') === fEmpresa)
      }

      all.sort((a, b) =>
        a.data === b.data ? a.agente.localeCompare(b.agente) : a.data < b.data ? 1 : -1
      )
      setLinhas(all)
    } catch (err: any) {
      alert('Erro ao buscar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarEmpresas()
    buscar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function csvEscape(v: any) {
    return `"${String(v ?? '').replace(/"/g, '""')}"`
  }

  function exportarCSV() {
    if (!linhas.length) {
      alert('Sem dados.')
      return
    }

    const headers = ['Data', 'Supervisor', 'Agente', 'Empresa', 'Nicho', 'Tipo', 'Relato', 'Criado em']

    const rows = linhas.map((l) =>
      [
        l.data,
        l.supervisor,
        l.agente,
        l.empresa ?? '',
        l.nicho ?? '',
        l.tipo ?? '',
        l.relato,
        new Date(l.created_at).toLocaleString('pt-BR'),
      ]
        .map(csvEscape)
        .join(';')
    )

    const conteudo = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n')
    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `erros_${dataIni}_a_${dataFim}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // ✅ NOVO: abrir modal de edição com uma cópia da linha
  function abrirEdicao(linha: LinhaErro) {
    setEditando({ ...linha })
  }

  function fecharEdicao() {
    setEditando(null)
  }

  // ✅ NOVO: salvar alterações no supabase
  async function salvarEdicao() {
    if (!editando) return
    setSalvando(true)
    try {
      const { error } = await supabase
        .from('erros_agentes')
        .update({
          data: editando.data,
          supervisor: editando.supervisor,
          agente: editando.agente,
          empresa: editando.empresa,
          nicho: editando.nicho,
          tipo: editando.tipo,
          relato: editando.relato,
        })
        .eq('id', editando.id)

      if (error) throw error

      // atualiza a linha na lista local sem precisar buscar tudo de novo
      setLinhas((prev) =>
        prev.map((l) => (l.id === editando.id ? { ...l, ...editando } : l))
      )
      setEditando(null)
    } catch (err: any) {
      alert('Erro ao salvar: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setSalvando(false)
    }
  }

  // ✅ NOVO: excluir registro
  async function excluirLinha(id: string) {
    const ok = window.confirm('Tem certeza que deseja excluir este registro? Essa ação não pode ser desfeita.')
    if (!ok) return

    setExcluindoId(id)
    try {
      const { error } = await supabase.from('erros_agentes').delete().eq('id', id)
      if (error) throw error
      setLinhas((prev) => prev.filter((l) => l.id !== id))
    } catch (err: any) {
      alert('Erro ao excluir: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setExcluindoId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Filtros */}
        <div className="rounded-xl bg-white p-6 shadow space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Data inicial</label>
              <input
                type="date"
                value={dataIni}
                onChange={(e) => setDataIni(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151] placeholder-[#535151]/60"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Data final</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151] placeholder-[#535151]/60"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Supervisor</label>
              <input
                type="text"
                value={qSupervisor}
                onChange={(e) => setQSupervisor(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
                placeholder="Filtrar por supervisor"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Agente</label>
              <input
                type="text"
                value={qAgente}
                onChange={(e) => setQAgente(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
                placeholder="Filtrar por agente"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Empresa</label>
              <select
                value={fEmpresa}
                onChange={(e) => setFEmpresa(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151] bg-white disabled:opacity-60"
                disabled={carregandoEmpresas}
              >
                <option value="Todas">
                  {carregandoEmpresas ? 'Carregando…' : 'Todas'}
                </option>
                {empresas.map((em) => (
                  <option key={String(em.id)} value={em.nome}>
                    {em.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Tipo do erro</label>
              <select
                value={fTipo}
                onChange={(e) => setFTipo(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
              >
                <option value="Todos">Todos</option>
                {TIPOS_ERRO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Nicho</label>
              <select
                value={fNicho}
                onChange={(e) => setFNicho(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
              >
                <option value="Todos">Todos</option>
                <option value="Clínica">Clínica</option>
                <option value="SAC">SAC</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-2">
              <button
                onClick={atalhoHoje}
                className="rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white"
              >
                Hoje
              </button>
              <button
                onClick={atalhoSemana}
                className="rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white"
              >
                Semana
              </button>
              <button
                onClick={atalhoMes}
                className="rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white"
              >
                Mês
              </button>
            </div>

            <div className="ml-auto flex gap-2">
              <button
                onClick={buscar}
                disabled={loading}
                className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Buscando…' : 'Aplicar filtros'}
              </button>
              <button
                onClick={exportarCSV}
                disabled={!linhas.length}
                className="rounded-lg border border-[#2687e2] px-4 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white disabled:opacity-40"
              >
                Exportar CSV
              </button>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="rounded-xl bg-white p-6 shadow">
          {!linhas.length ? (
            <p className="text-gray-500">Nenhum registro no período/critério.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-sm text-gray-600">
                    <th className="border-b p-2">Data</th>
                    <th className="border-b p-2">Supervisor</th>
                    <th className="border-b p-2">Agente</th>
                    <th className="border-b p-2">Empresa</th>
                    <th className="border-b p-2">Nicho</th>
                    <th className="border-b p-2">Tipo</th>
                    <th className="border-b p-2">Relato</th>
                    <th className="border-b p-2">Criado em</th>
                    <th className="border-b p-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.id} className="text-sm">
                      <td className="border-b p-2 text-[#535151]">{l.data}</td>
                      <td className="border-b p-2 text-[#535151]">{l.supervisor}</td>
                      <td className="border-b p-2 text-[#535151]">{l.agente}</td>
                      <td className="border-b p-2 text-[#535151]">{l.empresa ?? '-'}</td>
                      <td className="border-b p-2 text-[#535151]">{l.nicho ?? '-'}</td>
                      <td className="border-b p-2 text-[#535151]">{l.tipo ?? '-'}</td>
                      <td className="border-b p-2 text-[#535151] whitespace-pre-line">{l.relato}</td>
                      <td className="border-b p-2 text-[#535151]">
                        {new Date(l.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="border-b p-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => abrirEdicao(l)}
                            className="rounded-lg border border-[#2687e2] px-2 py-1 text-xs font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => excluirLinha(l.id)}
                            disabled={excluindoId === l.id}
                            className="rounded-lg border border-red-500 px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-500 hover:text-white disabled:opacity-50"
                          >
                            {excluindoId === l.id ? 'Excluindo…' : 'Excluir'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ✅ NOVO: Modal de edição */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg space-y-4">
            <h2 className="text-lg font-semibold text-[#535151]">Editar registro</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-[#ff751f]">Data</label>
                <input
                  type="date"
                  value={editando.data}
                  onChange={(e) => setEditando({ ...editando, data: e.target.value })}
                  className="w-full rounded-lg border p-2 text-[#535151]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-[#ff751f]">Supervisor</label>
                <input
                  type="text"
                  value={editando.supervisor}
                  onChange={(e) => setEditando({ ...editando, supervisor: e.target.value })}
                  className="w-full rounded-lg border p-2 text-[#535151]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-[#ff751f]">Agente</label>
                <input
                  type="text"
                  value={editando.agente}
                  onChange={(e) => setEditando({ ...editando, agente: e.target.value })}
                  className="w-full rounded-lg border p-2 text-[#535151]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-[#ff751f]">Empresa</label>
                <select
                  value={editando.empresa ?? ''}
                  onChange={(e) => setEditando({ ...editando, empresa: e.target.value })}
                  className="w-full rounded-lg border p-2 text-[#535151] bg-white"
                >
                  <option value="">-</option>
                  {empresas.map((em) => (
                    <option key={String(em.id)} value={em.nome}>
                      {em.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-[#ff751f]">Nicho</label>
                <select
                  value={editando.nicho ?? ''}
                  onChange={(e) => setEditando({ ...editando, nicho: e.target.value })}
                  className="w-full rounded-lg border p-2 text-[#535151]"
                >
                  <option value="">-</option>
                  <option value="Clínica">Clínica</option>
                  <option value="SAC">SAC</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-[#ff751f]">Tipo do erro</label>
                <select
                  value={editando.tipo ?? ''}
                  onChange={(e) => setEditando({ ...editando, tipo: e.target.value })}
                  className="w-full rounded-lg border p-2 text-[#535151]"
                >
                  <option value="">-</option>
                  {TIPOS_ERRO.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Relato</label>
              <textarea
                value={editando.relato}
                onChange={(e) => setEditando({ ...editando, relato: e.target.value })}
                rows={4}
                className="w-full rounded-lg border p-2 text-[#535151]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={fecharEdicao}
                disabled={salvando}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvarEdicao}
                disabled={salvando}
                className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {salvando ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
