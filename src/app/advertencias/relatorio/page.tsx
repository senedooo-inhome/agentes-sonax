'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type LinhaAdv = {
  id: string
  data: string
  supervisor: string
  agente: string
  motivo: string
  descricao: string
  tipo_advertencia: string
  acao: string
  status: string
  observacoes: string | null
  link_evidencia: string | null
  created_at: string
}

const MOTIVOS = [
  'Conduta',
  'Ausência',
  'Desempenho',
  'Descumprimento de escala',
  'Outros',
]

const TIPOS = ['Verbal', 'Escrita', 'Suspensão', 'Outros']

const STATUS_OPCOES = ['Resolvido', 'Em acompanhamento', 'Reincidente']

export default function RelatorioAdvertenciasPage() {
  const router = useRouter()

  // ==== PROTEÇÃO: só supervisão pode ver relatório ====
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
  // =====================================================

  const hoje = new Date().toISOString().slice(0, 10)

  // filtros
  const [dataIni, setDataIni] = useState(hoje)
  const [dataFim, setDataFim] = useState(hoje)
  const [qSupervisor, setQSupervisor] = useState('')
  const [qAgente, setQAgente] = useState('')
  const [fMotivo, setFMotivo] = useState('Todos')
  const [fStatus, setFStatus] = useState('Todos')
  const [fTipoAdv, setFTipoAdv] = useState('Todos')

  const [linhas, setLinhas] = useState<LinhaAdv[]>([])
  const [loading, setLoading] = useState(false)

  // ✅ NOVO: estado do modal de edição e exclusão
  const [editando, setEditando] = useState<LinhaAdv | null>(null)
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

  async function buscar() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('advertencias')
        .select(
          'id, created_at, data, supervisor, agente, motivo, descricao, tipo_advertencia, acao, status, observacoes, link_evidencia'
        )
        .gte('data', dataIni)
        .lte('data', dataFim)

      if (error) throw error

      let all = (data ?? []) as LinhaAdv[]

      // filtros texto
      const qSup = qSupervisor.trim().toLowerCase()
      const qAgt = qAgente.trim().toLowerCase()
      if (qSup) {
        all = all.filter((l) =>
          (l.supervisor ?? '').toLowerCase().includes(qSup)
        )
      }
      if (qAgt) {
        all = all.filter((l) => (l.agente ?? '').toLowerCase().includes(qAgt))
      }

      // filtros select
      if (fMotivo !== 'Todos') {
        all = all.filter((l) => l.motivo === fMotivo)
      }
      if (fStatus !== 'Todos') {
        all = all.filter((l) => l.status === fStatus)
      }
      if (fTipoAdv !== 'Todos') {
        all = all.filter((l) => l.tipo_advertencia === fTipoAdv)
      }

      // ordena: mais recente primeiro
      all.sort((a, b) =>
        a.data === b.data
          ? a.agente.localeCompare(b.agente)
          : a.data < b.data
          ? 1
          : -1
      )

      setLinhas(all)
    } catch (err: any) {
      alert('Erro ao buscar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    buscar()
  }, []) // primeira carga

  // CSV
  function csvEscape(v: any) {
    return `"${String(v ?? '').replace(/"/g, '""')}"`
  }

  function exportarCSV() {
    if (!linhas.length) {
      alert('Sem dados.')
      return
    }

    const headers = [
      'Data',
      'Supervisor',
      'Agente',
      'Motivo',
      'Descrição',
      'Tipo de Advertência',
      'Ação Tomada',
      'Status',
      'Observações',
      'Link',
      'Criado em',
    ]

    const rows = linhas.map((l) =>
      [
        l.data,
        l.supervisor,
        l.agente,
        l.motivo,
        l.descricao,
        l.tipo_advertencia,
        l.acao,
        l.status,
        l.observacoes ?? '',
        l.link_evidencia ?? '',
        new Date(l.created_at).toLocaleString('pt-BR'),
      ]
        .map(csvEscape)
        .join(';')
    )

    const conteudo = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n')
    const blob = new Blob([conteudo], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `advertencias_${dataIni}_a_${dataFim}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // ✅ NOVO: abrir modal de edição com uma cópia da linha
  function abrirEdicao(linha: LinhaAdv) {
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
        .from('advertencias')
        .update({
          data: editando.data,
          supervisor: editando.supervisor,
          agente: editando.agente,
          motivo: editando.motivo,
          descricao: editando.descricao,
          tipo_advertencia: editando.tipo_advertencia,
          acao: editando.acao,
          status: editando.status,
          observacoes: editando.observacoes,
          link_evidencia: editando.link_evidencia,
        })
        .eq('id', editando.id)

      if (error) throw error

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
    const ok = window.confirm(
      'Tem certeza que deseja excluir este registro? Essa ação não pode ser desfeita.'
    )
    if (!ok) return

    setExcluindoId(id)
    try {
      const { error } = await supabase.from('advertencias').delete().eq('id', id)
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
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Data ini */}
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">
                Data inicial
              </label>
              <input
                type="date"
                value={dataIni}
                onChange={(e) => setDataIni(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151] placeholder-[#535151]/60"
              />
            </div>

            {/* Data fim */}
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">
                Data final
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151] placeholder-[#535151]/60"
              />
            </div>

            {/* Supervisor */}
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">
                Supervisor
              </label>
              <input
                type="text"
                value={qSupervisor}
                onChange={(e) => setQSupervisor(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
                placeholder="Filtrar por supervisor"
              />
            </div>

            {/* Agente */}
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">
                Agente
              </label>
              <input
                type="text"
                value={qAgente}
                onChange={(e) => setQAgente(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
                placeholder="Filtrar por agente"
              />
            </div>

            {/* Motivo */}
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">
                Motivo
              </label>
              <select
                value={fMotivo}
                onChange={(e) => setFMotivo(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
              >
                <option value="Todos">Todos</option>
                {MOTIVOS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">
                Status
              </label>
              <select
                value={fStatus}
                onChange={(e) => setFStatus(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
              >
                <option value="Todos">Todos</option>
                {STATUS_OPCOES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Linha 2 de filtros */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Tipo de advertência */}
            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">
                Tipo Advertência
              </label>
              <select
                value={fTipoAdv}
                onChange={(e) => setFTipoAdv(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
              >
                <option value="Todos">Todos</option>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Atalhos e botões */}
            <div className="md:col-span-5 flex flex-wrap items-end gap-3">
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
                    <th className="border-b p-2">Motivo</th>
                    <th className="border-b p-2">Tipo</th>
                    <th className="border-b p-2">Ação</th>
                    <th className="border-b p-2">Status</th>
                    <th className="border-b p-2">Descrição</th>
                    <th className="border-b p-2">Obs.</th>
                    <th className="border-b p-2">Link</th>
                    <th className="border-b p-2">Criado em</th>
                    <th className="border-b p-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.id} className="text-sm align-top">
                      <td className="border-b p-2 text-[#535151]">{l.data}</td>
                      <td className="border-b p-2 text-[#535151]">{l.supervisor}</td>
                      <td className="border-b p-2 text-[#535151]">{l.agente}</td>
                      <td className="border-b p-2 text-[#535151]">{l.motivo}</td>
                      <td className="border-b p-2 text-[#535151]">{l.tipo_advertencia}</td>
                      <td className="border-b p-2 text-[#535151]">{l.acao}</td>
                      <td className="border-b p-2 text-[#535151]">{l.status}</td>
                      <td className="border-b p-2 text-[#535151] whitespace-pre-line">{l.descricao}</td>
                      <td className="border-b p-2 text-[#535151] whitespace-pre-line">{l.observacoes ?? '-'}</td>
                      <td className="border-b p-2 text-[#535151] break-all">
                        {l.link_evidencia ? (
                          <a
                            className="text-[#2687e2] underline break-all"
                            href={l.link_evidencia}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            abrir
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
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
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-lg space-y-4">
            <h2 className="text-lg font-semibold text-[#535151]">Editar advertência</h2>

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
                <label className="block text-sm font-medium mb-1 text-[#ff751f]">Motivo</label>
                <select
                  value={editando.motivo}
                  onChange={(e) => setEditando({ ...editando, motivo: e.target.value })}
                  className="w-full rounded-lg border p-2 text-[#535151] bg-white"
                >
                  {MOTIVOS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-[#ff751f]">Tipo de advertência</label>
                <select
                  value={editando.tipo_advertencia}
                  onChange={(e) => setEditando({ ...editando, tipo_advertencia: e.target.value })}
                  className="w-full rounded-lg border p-2 text-[#535151] bg-white"
                >
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-[#ff751f]">Status</label>
                <select
                  value={editando.status}
                  onChange={(e) => setEditando({ ...editando, status: e.target.value })}
                  className="w-full rounded-lg border p-2 text-[#535151] bg-white"
                >
                  {STATUS_OPCOES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1 text-[#ff751f]">Ação tomada</label>
                <input
                  type="text"
                  value={editando.acao}
                  onChange={(e) => setEditando({ ...editando, acao: e.target.value })}
                  className="w-full rounded-lg border p-2 text-[#535151]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1 text-[#ff751f]">Link de evidência</label>
                <input
                  type="text"
                  value={editando.link_evidencia ?? ''}
                  onChange={(e) => setEditando({ ...editando, link_evidencia: e.target.value })}
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Descrição</label>
              <textarea
                value={editando.descricao}
                onChange={(e) => setEditando({ ...editando, descricao: e.target.value })}
                rows={4}
                className="w-full rounded-lg border p-2 text-[#535151]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Observações</label>
              <textarea
                value={editando.observacoes ?? ''}
                onChange={(e) => setEditando({ ...editando, observacoes: e.target.value })}
                rows={3}
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
