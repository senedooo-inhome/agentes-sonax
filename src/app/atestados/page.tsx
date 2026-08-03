'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type LinhaAtestado = {
  id: string
  data: string
  nome: string
  dias: number
  enviado_rh: boolean
  link?: string | null
  created_at: string
}

type Agente = { id: string | number; nome: string }

export default function AtestadosPage() {
  const router = useRouter()
  const hoje = new Date().toISOString().slice(0, 10)

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

  // ✅ lista de agentes (para selects)
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [carregandoAgentes, setCarregandoAgentes] = useState(false)

  async function carregarAgentes() {
    try {
      setCarregandoAgentes(true)
      const { data, error } = await supabase
        .from('agentes')
        .select('id, nome')
        .order('nome', { ascending: true })

      if (error) throw error
      setAgentes(((data as any) || []) as Agente[])
    } catch (err: any) {
      console.error(err)
      alert('Erro ao carregar agentes: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setCarregandoAgentes(false)
    }
  }

  // ---------------- FORMULÁRIO ----------------
  const [form, setForm] = useState({
    data: hoje,
    nome: '', // agora vem do select
    dias: '',
    enviado_rh: 'Não' as 'Sim' | 'Não',
    link: '',
  })
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()

    if (!form.nome.trim()) {
      alert('Selecione o nome do agente.')
      return
    }

    const diasNum = Number(form.dias)
    if (!Number.isFinite(diasNum) || diasNum < 0) {
      alert('Informe um número válido de dias.')
      return
    }

    try {
      setSalvando(true)
      const { error } = await supabase.from('atestados').insert([
        {
          data: form.data,
          nome: form.nome.trim(), // salva o nome do agente
          dias: diasNum,
          enviado_rh: form.enviado_rh === 'Sim',
          link: form.link.trim() || null,
        },
      ])
      if (error) throw error

      alert('Atestado registrado!')
      setForm({ data: hoje, nome: '', dias: '', enviado_rh: 'Não', link: '' })
      await buscar()
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  // ---------------- RELATÓRIO ----------------
  const [dataIni, setDataIni] = useState(hoje)
  const [dataFim, setDataFim] = useState(hoje)

  // ✅ filtro por nome agora é select
  const [fNome, setFNome] = useState<string>('Todos')

  const [fEnviado, setFEnviado] = useState<'Todos' | 'Sim' | 'Não'>('Todos')

  const [linhas, setLinhas] = useState<LinhaAtestado[]>([])
  const [loading, setLoading] = useState(false)

  // ---------------- EDITAR / EXCLUIR ----------------
  const [editando, setEditando] = useState<LinhaAtestado | null>(null)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  const [formEdicao, setFormEdicao] = useState({
    data: hoje,
    nome: '',
    dias: '',
    enviado_rh: 'Não' as 'Sim' | 'Não',
    link: '',
  })

  function abrirEdicao(linha: LinhaAtestado) {
    setEditando(linha)
    setFormEdicao({
      data: linha.data,
      nome: linha.nome,
      dias: String(linha.dias),
      enviado_rh: linha.enviado_rh ? 'Sim' : 'Não',
      link: linha.link ?? '',
    })
  }

  function fecharEdicao() {
    if (salvandoEdicao) return
    setEditando(null)
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault()
    if (!editando) return

    if (!formEdicao.nome.trim()) {
      alert('Selecione o nome do agente.')
      return
    }

    const diasNum = Number(formEdicao.dias)
    if (!Number.isFinite(diasNum) || diasNum < 0) {
      alert('Informe um número válido de dias.')
      return
    }

    try {
      setSalvandoEdicao(true)

      const { error } = await supabase
        .from('atestados')
        .update({
          data: formEdicao.data,
          nome: formEdicao.nome.trim(),
          dias: diasNum,
          enviado_rh: formEdicao.enviado_rh === 'Sim',
          link: formEdicao.link.trim() || null,
        })
        .eq('id', editando.id)

      if (error) throw error

      alert('Atestado atualizado com sucesso!')
      setEditando(null)
      await buscar()
    } catch (err: any) {
      alert('Erro ao editar: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setSalvandoEdicao(false)
    }
  }

  async function excluir(linha: LinhaAtestado) {
    const confirmou = window.confirm(
      `Tem certeza que deseja excluir o atestado de ${linha.nome}?`
    )

    if (!confirmou) return

    try {
      setExcluindoId(linha.id)

      const { error } = await supabase
        .from('atestados')
        .delete()
        .eq('id', linha.id)

      if (error) throw error

      setLinhas((anteriores) => anteriores.filter((item) => item.id !== linha.id))
      alert('Atestado excluído com sucesso!')
    } catch (err: any) {
      alert('Erro ao excluir: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setExcluindoId(null)
    }
  }

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
        .from('atestados')
        .select('id, created_at, data, nome, dias, enviado_rh, link')
        .gte('data', dataIni)
        .lte('data', dataFim)

      if (error) throw error

      let all = (data ?? []) as LinhaAtestado[]

      // ✅ filtro por nome (select)
      if (fNome !== 'Todos') {
        all = all.filter((l) => (l.nome ?? '') === fNome)
      }

      if (fEnviado !== 'Todos') {
        const flag = fEnviado === 'Sim'
        all = all.filter((l) => l.enviado_rh === flag)
      }

      all.sort((a, b) =>
        a.data === b.data ? a.nome.localeCompare(b.nome) : a.data < b.data ? 1 : -1
      )
      setLinhas(all)
    } catch (err: any) {
      alert('Erro ao buscar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarAgentes()
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
    const headers = ['Data', 'Nome', 'Dias', 'Enviado RH', 'Link', 'Criado em']
    const rows = linhas.map((l) =>
      [
        l.data,
        l.nome,
        l.dias,
        l.enviado_rh ? 'Sim' : 'Não',
        l.link ?? '',
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
    a.download = `atestados_${dataIni}_a_${dataFim}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const agentesOrdenados = useMemo(() => {
    return [...agentes].sort((a, b) => a.nome.localeCompare(b.nome))
  }, [agentes])

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* HEADER */}
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#2687e2]">Atestados</h1>
          <div className="flex gap-2">
            <a
              href="/"
              className="rounded-lg bg-[#2687e2] px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600"
            >
              Início
            </a>
          </div>
        </header>

        {/* FORM */}
        <div className="rounded-xl bg-white p-6 shadow space-y-4">
          <form onSubmit={salvar} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Data</label>
                <input
                  type="date"
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Nome completo
                </label>

                <select
                  className="w-full rounded-lg border p-2 text-[#535151] bg-white disabled:opacity-60"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  disabled={carregandoAgentes}
                >
                  <option value="">
                    {carregandoAgentes ? 'Carregando agentes…' : 'Selecione o agente'}
                  </option>
                  {agentesOrdenados.map((a) => (
                    <option key={String(a.id)} value={a.nome}>
                      {a.nome}
                    </option>
                  ))}
                </select>

                <p className="mt-1 text-xs text-[#64748b]">
                  O nome é puxado automaticamente da tabela <strong>agentes</strong>.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Dias de atestado
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  value={form.dias}
                  onChange={(e) => setForm({ ...form, dias: e.target.value })}
                  placeholder="Ex.: 2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Enviado ao RH?
                </label>
                <select
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  value={form.enviado_rh}
                  onChange={(e) =>
                    setForm({ ...form, enviado_rh: e.target.value as 'Sim' | 'Não' })
                  }
                >
                  {['Não', 'Sim'].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Link do arquivo (Drive, etc.)
                </label>
                <input
                  type="url"
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  value={form.link}
                  onChange={(e) => setForm({ ...form, link: e.target.value })}
                  placeholder="https://..."
                />
              </div>
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

        {/* RELATÓRIO + FILTROS */}
        <div className="rounded-xl bg-white p-6 shadow space-y-4">
          <h2 className="text-lg font-semibold text-[#2687e2]">Relatório</h2>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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

            {/* ✅ filtro por nome agora é select */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">
                Filtrar por nome
              </label>
              <select
                value={fNome}
                onChange={(e) => setFNome(e.target.value)}
                className="w-full rounded-lg border p-2 text-[#535151] bg-white disabled:opacity-60"
                disabled={carregandoAgentes}
              >
                <option value="Todos">
                  {carregandoAgentes ? 'Carregando agentes…' : 'Todos'}
                </option>
                {agentesOrdenados.map((a) => (
                  <option key={String(a.id)} value={a.nome}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-[#ff751f]">Enviado ao RH</label>
              <select
                value={fEnviado}
                onChange={(e) => setFEnviado(e.target.value as any)}
                className="w-full rounded-lg border p-2 text-[#535151]"
              >
                {['Todos', 'Sim', 'Não'].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={atalhoHoje}
                type="button"
                className="w-full rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white"
              >
                Hoje
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex gap-2">
              <button
                onClick={atalhoSemana}
                type="button"
                className="rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white"
              >
                Semana
              </button>
              <button
                onClick={atalhoMes}
                type="button"
                className="rounded-lg border border-[#2687e2] px-3 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white"
              >
                Mês
              </button>
            </div>

            <div className="ml-auto flex gap-2">
              <button
                onClick={buscar}
                disabled={loading}
                type="button"
                className="rounded-lg bg-[#2687e2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Buscando…' : 'Aplicar filtros'}
              </button>

              <button
                onClick={exportarCSV}
                disabled={!linhas.length}
                type="button"
                className="rounded-lg border border-[#2687e2] px-4 py-2 text-sm font-semibold text-[#2687e2] hover:bg-[#2687e2] hover:text-white disabled:opacity-40"
              >
                Exportar CSV
              </button>
            </div>
          </div>

          {/* Tabela */}
          {!linhas.length ? (
            <p className="text-gray-500">Nenhum registro no período/critério.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-sm text-gray-600">
                    <th className="border-b p-2">Data</th>
                    <th className="border-b p-2">Nome</th>
                    <th className="border-b p-2">Dias</th>
                    <th className="border-b p-2">Enviado RH</th>
                    <th className="border-b p-2">Link</th>
                    <th className="border-b p-2">Criado em</th>
                    <th className="border-b p-2 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.id} className="text-sm">
                      <td className="border-b p-2 text-[#535151]">{l.data}</td>
                      <td className="border-b p-2 text-[#535151] font-medium">{l.nome}</td>
                      <td className="border-b p-2 text-[#535151]">{l.dias}</td>
                      <td className="border-b p-2 text-[#535151]">
                        {l.enviado_rh ? 'Sim' : 'Não'}
                      </td>
                      <td className="border-b p-2">
                        {l.link ? (
                          <a
                            href={l.link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#2687e2] underline break-all"
                          >
                            Abrir
                          </a>
                        ) : (
                          <span className="text-[#535151]">-</span>
                        )}
                      </td>
                      <td className="border-b p-2 text-[#535151]">
                        {new Date(l.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="border-b p-2">
                        <div className="flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => abrirEdicao(l)}
                            className="rounded-lg bg-[#2687e2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => excluir(l)}
                            disabled={excluindoId === l.id}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
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

      {editando && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) fecharEdicao()
          }}
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#2687e2]">Editar atestado</h2>
                <p className="text-sm text-[#64748b]">Altere os dados e clique em salvar.</p>
              </div>

              <button
                type="button"
                onClick={fecharEdicao}
                disabled={salvandoEdicao}
                className="rounded-lg border px-3 py-2 text-sm font-semibold text-[#535151] hover:bg-gray-100 disabled:opacity-50"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={salvarEdicao} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#ff751f]">Data</label>
                  <input
                    type="date"
                    required
                    value={formEdicao.data}
                    onChange={(e) => setFormEdicao({ ...formEdicao, data: e.target.value })}
                    className="w-full rounded-lg border p-2 text-[#535151]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#ff751f]">
                    Dias de atestado
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formEdicao.dias}
                    onChange={(e) => setFormEdicao({ ...formEdicao, dias: e.target.value })}
                    className="w-full rounded-lg border p-2 text-[#535151]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-[#ff751f]">
                  Nome completo
                </label>
                <select
                  required
                  value={formEdicao.nome}
                  onChange={(e) => setFormEdicao({ ...formEdicao, nome: e.target.value })}
                  disabled={carregandoAgentes}
                  className="w-full rounded-lg border bg-white p-2 text-[#535151] disabled:opacity-60"
                >
                  <option value="">Selecione o agente</option>
                  {agentesOrdenados.map((a) => (
                    <option key={String(a.id)} value={a.nome}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#ff751f]">
                    Enviado ao RH?
                  </label>
                  <select
                    value={formEdicao.enviado_rh}
                    onChange={(e) =>
                      setFormEdicao({
                        ...formEdicao,
                        enviado_rh: e.target.value as 'Sim' | 'Não',
                      })
                    }
                    className="w-full rounded-lg border p-2 text-[#535151]"
                  >
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#ff751f]">
                    Link do arquivo
                  </label>
                  <input
                    type="url"
                    value={formEdicao.link}
                    onChange={(e) => setFormEdicao({ ...formEdicao, link: e.target.value })}
                    placeholder="https://..."
                    className="w-full rounded-lg border p-2 text-[#535151]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={fecharEdicao}
                  disabled={salvandoEdicao}
                  className="rounded-lg border px-4 py-2 font-semibold text-[#535151] hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvandoEdicao}
                  className="rounded-lg bg-[#2687e2] px-4 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  {salvandoEdicao ? 'Salvando…' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}