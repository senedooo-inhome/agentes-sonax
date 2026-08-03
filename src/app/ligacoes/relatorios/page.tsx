'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type LinhaLigacao = {
  id: string
  data: string
  nicho: string | null
  responsavel: string
  cliente_protocolo: string
  empresa: string | null
  status: string | null
  supervisao: string
  detalhe: string
  created_at: string
}

type FormEdicao = {
  data: string
  nicho: string
  responsavel: string
  cliente_protocolo: string
  empresa: string
  status: string
  supervisao: string
  detalhe: string
}

const NICHOS = ['Clínica', 'SAC'] as const
const STATUS = ['Resolvido', 'Pendente'] as const

const FORM_VAZIO: FormEdicao = {
  data: '',
  nicho: '',
  responsavel: '',
  cliente_protocolo: '',
  empresa: '',
  status: '',
  supervisao: '',
  detalhe: '',
}

export default function RelatoriosLigacoes() {
  const router = useRouter()

  // ====== PROTEÇÃO (mesmo esquema dos outros relatórios) ======
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const email = data.session?.user?.email

      if (!email) {
        router.replace('/login?next=' + window.location.pathname)
        return
      }

      // Lista de e-mails que podem acessar o relatório.
      const permitidos = ['supervisao@sonax.net.br', 'sonaxinhome@gmail.com']

      if (!permitidos.includes(email)) {
        alert('Acesso restrito.')
        router.replace('/')
      }
    })()
  }, [router])

  // ============================================================

  const hoje = new Date().toISOString().slice(0, 10)
  const [dataIni, setDataIni] = useState(hoje)
  const [dataFim, setDataFim] = useState(hoje)
  const [fNicho, setFNicho] = useState<'Todos' | (typeof NICHOS)[number]>('Todos')
  const [fStatus, setFStatus] = useState<'Todos' | (typeof STATUS)[number]>('Todos')
  const [qResp, setQResp] = useState('')
  const [qSup, setQSup] = useState('')
  const [qEmpresa, setQEmpresa] = useState('')

  const [linhas, setLinhas] = useState<LinhaLigacao[]>([])
  const [loading, setLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  const [registroEditando, setRegistroEditando] = useState<LinhaLigacao | null>(null)
  const [formEdicao, setFormEdicao] = useState<FormEdicao>(FORM_VAZIO)

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
        .from('ligacoes_ativas')
        .select(
          'id, created_at, data, nicho, responsavel, cliente_protocolo, empresa, status, supervisao, detalhe'
        )
        .gte('data', dataIni)
        .lte('data', dataFim)

      if (error) throw error

      let all = (data ?? []) as LinhaLigacao[]

      // Filtros de texto.
      const r = qResp.trim().toLowerCase()
      const s = qSup.trim().toLowerCase()
      const e = qEmpresa.trim().toLowerCase()

      if (fNicho !== 'Todos') {
        all = all.filter((l) => (l.nicho ?? '') === fNicho)
      }
      if (fStatus !== 'Todos') {
        all = all.filter((l) => (l.status ?? '') === fStatus)
      }
      if (r) {
        all = all.filter((l) => (l.responsavel ?? '').toLowerCase().includes(r))
      }
      if (s) {
        all = all.filter((l) => (l.supervisao ?? '').toLowerCase().includes(s))
      }
      if (e) {
        all = all.filter((l) => (l.empresa ?? '').toLowerCase().includes(e))
      }

      // Ordenar mais recente primeiro.
      all.sort((a, b) =>
        a.data === b.data
          ? a.responsavel.localeCompare(b.responsavel)
          : a.data < b.data
            ? 1
            : -1
      )

      setLinhas(all)
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido.'
      alert('Erro ao buscar: ' + mensagem)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void buscar()
    // A carga inicial deve acontecer apenas uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function abrirEdicao(linha: LinhaLigacao) {
    setRegistroEditando(linha)
    setFormEdicao({
      data: linha.data,
      nicho: linha.nicho ?? '',
      responsavel: linha.responsavel,
      cliente_protocolo: linha.cliente_protocolo,
      empresa: linha.empresa ?? '',
      status: linha.status ?? '',
      supervisao: linha.supervisao,
      detalhe: linha.detalhe,
    })
  }

  function fecharEdicao() {
    if (salvando) return
    setRegistroEditando(null)
    setFormEdicao(FORM_VAZIO)
  }

  function atualizarCampo(campo: keyof FormEdicao, valor: string) {
    setFormEdicao((anterior) => ({ ...anterior, [campo]: valor }))
  }

  async function salvarEdicao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    if (!registroEditando) return

    if (
      !formEdicao.data ||
      !formEdicao.responsavel.trim() ||
      !formEdicao.cliente_protocolo.trim() ||
      !formEdicao.supervisao.trim() ||
      !formEdicao.detalhe.trim()
    ) {
      alert('Preencha todos os campos obrigatórios.')
      return
    }

    setSalvando(true)

    try {
      const alteracoes = {
        data: formEdicao.data,
        nicho: formEdicao.nicho || null,
        responsavel: formEdicao.responsavel.trim(),
        cliente_protocolo: formEdicao.cliente_protocolo.trim(),
        empresa: formEdicao.empresa.trim() || null,
        status: formEdicao.status || null,
        supervisao: formEdicao.supervisao.trim(),
        detalhe: formEdicao.detalhe.trim(),
      }

      const { data, error } = await supabase
        .from('ligacoes_ativas')
        .update(alteracoes)
        .eq('id', registroEditando.id)
        .select(
          'id, created_at, data, nicho, responsavel, cliente_protocolo, empresa, status, supervisao, detalhe'
        )
        .single()

      if (error) throw error

      const registroAtualizado = data as LinhaLigacao

      setLinhas((anteriores) =>
        anteriores.map((linha) =>
          linha.id === registroAtualizado.id ? registroAtualizado : linha
        )
      )

      setRegistroEditando(null)
      setFormEdicao(FORM_VAZIO)
      alert('Registro atualizado com sucesso.')
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido.'
      alert('Erro ao editar: ' + mensagem)
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(linha: LinhaLigacao) {
    const descricao = linha.cliente_protocolo || linha.responsavel
    const confirmou = window.confirm(
      `Tem certeza que deseja excluir o registro “${descricao}”?\n\nEssa ação não poderá ser desfeita.`
    )

    if (!confirmou) return

    setExcluindoId(linha.id)

    try {
      const { error } = await supabase.from('ligacoes_ativas').delete().eq('id', linha.id)

      if (error) throw error

      setLinhas((anteriores) => anteriores.filter((item) => item.id !== linha.id))
      alert('Registro excluído com sucesso.')
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido.'
      alert('Erro ao excluir: ' + mensagem)
    } finally {
      setExcluindoId(null)
    }
  }

  // ===== CSV (Excel) =====
  function csvEscape(v: unknown) {
    return `"${String(v ?? '').replace(/"/g, '""')}"`
  }

  function exportarCSV() {
    if (!linhas.length) {
      alert('Sem dados.')
      return
    }

    const headers = [
      'Data',
      'Nicho',
      'Responsável',
      'Cliente/Protocolo',
      'Empresa',
      'Status',
      'Supervisão',
      'Detalhe',
      'Criado em',
    ]

    const rows = linhas.map((l) =>
      [
        l.data,
        l.nicho ?? '',
        l.responsavel,
        l.cliente_protocolo,
        l.empresa ?? '',
        l.status ?? '',
        l.supervisao,
        l.detalhe,
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
    a.download = `ligacoes_${dataIni}_a_${dataFim}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* filtros */}
        <div className="space-y-4 rounded-xl bg-white p-6 shadow">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#ff751f]">Data inicial</label>
              <input
                type="date"
                value={dataIni}
                onChange={(e) => setDataIni(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#ff751f]">Data final</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#ff751f]">Nicho</label>
              <select
                value={fNicho}
                onChange={(e) => setFNicho(e.target.value as typeof fNicho)}
                className="w-full rounded-lg border p-2 text-[#535151]"
              >
                <option value="Todos">Todos</option>
                {NICHOS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#ff751f]">Status</label>
              <select
                value={fStatus}
                onChange={(e) => setFStatus(e.target.value as typeof fStatus)}
                className="w-full rounded-lg border p-2 text-[#535151]"
              >
                <option value="Todos">Todos</option>
                {STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#ff751f]">Responsável</label>
              <input
                type="text"
                value={qResp}
                onChange={(e) => setQResp(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
                placeholder="Filtrar por quem ligou"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#ff751f]">Supervisão</label>
              <input
                type="text"
                value={qSup}
                onChange={(e) => setQSup(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
                placeholder="Filtrar por supervisão"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#ff751f]">Empresa</label>
              <input
                type="text"
                value={qEmpresa}
                onChange={(e) => setQEmpresa(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151]"
                placeholder="Filtrar por empresa"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2 md:col-span-3">
              <button
                type="button"
                onClick={atalhoHoje}
                className="rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={atalhoSemana}
                className="rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white"
              >
                Semana
              </button>
              <button
                type="button"
                onClick={atalhoMes}
                className="rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white"
              >
                Mês
              </button>

              <button
                type="button"
                onClick={() => void buscar()}
                disabled={loading}
                className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Buscando…' : 'Aplicar filtros'}
              </button>

              <button
                type="button"
                onClick={exportarCSV}
                disabled={!linhas.length}
                className="rounded-lg border border-[#2687e2] px-4 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white disabled:opacity-40"
              >
                Exportar CSV
              </button>
            </div>
          </div>
        </div>

        {/* tabela */}
        <div className="rounded-xl bg-white p-6 shadow">
          {!linhas.length ? (
            <p className="text-gray-500">Nenhum registro no período/critério.</p>
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full min-w-[1300px] border-collapse">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="text-left text-sm text-gray-600">
                    <th className="border-b p-2">Data</th>
                    <th className="border-b p-2">Nicho</th>
                    <th className="border-b p-2">Responsável</th>
                    <th className="border-b p-2">Cliente/Protocolo</th>
                    <th className="border-b p-2">Empresa</th>
                    <th className="border-b p-2">Status</th>
                    <th className="border-b p-2">Supervisão</th>
                    <th className="border-b p-2">Detalhe</th>
                    <th className="border-b p-2">Criado em</th>
                    <th className="border-b p-2 text-center">Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.id} className="text-sm hover:bg-gray-50">
                      <td className="border-b p-2 text-[#535151]">{l.data}</td>
                      <td className="border-b p-2 text-[#535151]">{l.nicho ?? '-'}</td>
                      <td className="border-b p-2 text-[#535151]">{l.responsavel}</td>
                      <td className="border-b p-2 text-[#535151]">{l.cliente_protocolo}</td>
                      <td className="border-b p-2 text-[#535151]">{l.empresa ?? '-'}</td>
                      <td className="border-b p-2 text-[#535151]">{l.status ?? '-'}</td>
                      <td className="border-b p-2 text-[#535151]">{l.supervisao}</td>
                      <td className="max-w-xs whitespace-pre-line border-b p-2 text-[#535151]">
                        {l.detalhe}
                      </td>
                      <td className="border-b p-2 text-[#535151]">
                        {new Date(l.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="border-b p-2">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => abrirEdicao(l)}
                            className="rounded-lg bg-[#f19a37] px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void excluir(l)}
                            disabled={excluindoId === l.id}
                            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
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

      {/* Modal de edição */}
      {registroEditando && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) fecharEdicao()
          }}
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-[#535151]">Editar informação</h2>
                <p className="text-sm text-gray-500">Altere os dados e clique em salvar.</p>
              </div>
              <button
                type="button"
                onClick={fecharEdicao}
                disabled={salvando}
                className="rounded-lg px-3 py-2 text-2xl leading-none text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                aria-label="Fechar edição"
              >
                ×
              </button>
            </div>

            <form onSubmit={salvarEdicao} className="space-y-5 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#ff751f]">Data *</label>
                  <input
                    type="date"
                    required
                    value={formEdicao.data}
                    onChange={(e) => atualizarCampo('data', e.target.value)}
                    className="w-full rounded-lg border p-3 text-[#535151]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#ff751f]">Nicho</label>
                  <select
                    value={formEdicao.nicho}
                    onChange={(e) => atualizarCampo('nicho', e.target.value)}
                    className="w-full rounded-lg border p-3 text-[#535151]"
                  >
                    <option value="">Não informado</option>
                    {NICHOS.map((nicho) => (
                      <option key={nicho} value={nicho}>
                        {nicho}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#ff751f]">
                    Responsável *
                  </label>
                  <input
                    type="text"
                    required
                    value={formEdicao.responsavel}
                    onChange={(e) => atualizarCampo('responsavel', e.target.value)}
                    className="w-full rounded-lg border p-3 text-[#535151]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#ff751f]">
                    Cliente/Protocolo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formEdicao.cliente_protocolo}
                    onChange={(e) => atualizarCampo('cliente_protocolo', e.target.value)}
                    className="w-full rounded-lg border p-3 text-[#535151]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#ff751f]">Empresa</label>
                  <input
                    type="text"
                    value={formEdicao.empresa}
                    onChange={(e) => atualizarCampo('empresa', e.target.value)}
                    className="w-full rounded-lg border p-3 text-[#535151]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#ff751f]">Status</label>
                  <select
                    value={formEdicao.status}
                    onChange={(e) => atualizarCampo('status', e.target.value)}
                    className="w-full rounded-lg border p-3 text-[#535151]"
                  >
                    <option value="">Não informado</option>
                    {STATUS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-[#ff751f]">
                    Supervisão *
                  </label>
                  <input
                    type="text"
                    required
                    value={formEdicao.supervisao}
                    onChange={(e) => atualizarCampo('supervisao', e.target.value)}
                    className="w-full rounded-lg border p-3 text-[#535151]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-[#ff751f]">Detalhe *</label>
                  <textarea
                    required
                    rows={6}
                    value={formEdicao.detalhe}
                    onChange={(e) => atualizarCampo('detalhe', e.target.value)}
                    className="w-full resize-y rounded-lg border p-3 text-[#535151]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
                <button
                  type="button"
                  onClick={fecharEdicao}
                  disabled={salvando}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="rounded-lg bg-[#2687e2] px-5 py-2.5 font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {salvando ? 'Salvando…' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}