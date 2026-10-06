'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  Building2,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react'

type Empresa = {
  id: number
  nome: string
}

type StatusMessage = {
  type: 'success' | 'error'
  text: string
} | null

export default function CadastroEmpresasPage() {
  const router = useRouter()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [novaEmpresa, setNovaEmpresa] = useState('')
  const [busca, setBusca] = useState('')

  const [loading, setLoading] = useState(true)
  const [autorizado, setAutorizado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [excluindoId, setExcluindoId] = useState<number | null>(null)
  const [mensagem, setMensagem] = useState<StatusMessage>(null)

  useEffect(() => {
    verificarAcessoECarregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function verificarAcessoECarregar() {
    setLoading(true)
    setMensagem(null)

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) throw sessionError

      if (!session?.user) {
        router.replace('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profileError) throw profileError

      if (profile?.role !== 'supervisao') {
        setAutorizado(false)
        return
      }

      setAutorizado(true)
      await carregarEmpresas()
    } catch (error: any) {
      console.error('Erro ao verificar acesso:', error)

      setMensagem({
        type: 'error',
        text:
          'Não foi possível verificar seu acesso: ' +
          (error?.message ?? String(error)),
      })
    } finally {
      setLoading(false)
    }
  }

  async function carregarEmpresas() {
    const { data, error } = await supabase
      .from('empresas')
      .select('id, nome')
      .order('nome', { ascending: true })

    if (error) throw error

    setEmpresas((data ?? []) as Empresa[])
  }

  async function atualizarLista() {
    setMensagem(null)

    try {
      await carregarEmpresas()
    } catch (error: any) {
      console.error('Erro ao atualizar empresas:', error)

      setMensagem({
        type: 'error',
        text:
          'Erro ao atualizar empresas: ' +
          (error?.message ?? String(error)),
      })
    }
  }

  async function adicionarEmpresa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nome = novaEmpresa.trim()

    if (!nome) {
      setMensagem({
        type: 'error',
        text: 'Informe o nome da empresa.',
      })
      return
    }

    const jaExiste = empresas.some(
      (empresa) =>
        empresa.nome.trim().toLowerCase() === nome.toLowerCase()
    )

    if (jaExiste) {
      setMensagem({
        type: 'error',
        text: 'Essa empresa já está cadastrada.',
      })
      return
    }

    setSalvando(true)
    setMensagem(null)

    try {
      const { data, error } = await supabase
        .from('empresas')
        .insert({
          nome,
        })
        .select('id, nome')
        .single()

      if (error) throw error

      const empresaCriada = data as Empresa

      setEmpresas((listaAtual) =>
        [...listaAtual, empresaCriada].sort((a, b) =>
          a.nome.localeCompare(b.nome, 'pt-BR')
        )
      )

      setNovaEmpresa('')

      setMensagem({
        type: 'success',
        text: `Empresa "${empresaCriada.nome}" cadastrada com sucesso.`,
      })
    } catch (error: any) {
      console.error('Erro ao cadastrar empresa:', error)

      setMensagem({
        type: 'error',
        text:
          'Erro ao cadastrar empresa: ' +
          (error?.message ?? String(error)),
      })
    } finally {
      setSalvando(false)
    }
  }

  async function excluirEmpresa(empresa: Empresa) {
    const confirmou = window.confirm(
      `Tem certeza que deseja excluir a empresa "${empresa.nome}"?\n\nEssa ação não poderá ser desfeita.`
    )

    if (!confirmou) return

    setExcluindoId(empresa.id)
    setMensagem(null)

    try {
      const { error } = await supabase
        .from('empresas')
        .delete()
        .eq('id', empresa.id)

      if (error) throw error

      setEmpresas((listaAtual) =>
        listaAtual.filter((item) => item.id !== empresa.id)
      )

      setMensagem({
        type: 'success',
        text: `Empresa "${empresa.nome}" excluída com sucesso.`,
      })
    } catch (error: any) {
      console.error('Erro ao excluir empresa:', error)

      if (error?.code === '23503') {
        setMensagem({
          type: 'error',
          text:
            'Essa empresa possui registros vinculados e não pode ser excluída enquanto existir histórico relacionado.',
        })
      } else {
        setMensagem({
          type: 'error',
          text:
            'Erro ao excluir empresa: ' +
            (error?.message ?? String(error)),
        })
      }
    } finally {
      setExcluindoId(null)
    }
  }

  const empresasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    if (!termo) return empresas

    return empresas.filter((empresa) =>
      empresa.nome.toLowerCase().includes(termo)
    )
  }, [empresas, busca])

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 rounded-full border-b-2 border-[#2687e2] mx-auto mb-4" />

          <p className="text-gray-600">
            Carregando cadastro de empresas...
          </p>
        </div>
      </div>
    )
  }

  if (!autorizado) {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <div className="bg-white rounded-2xl shadow border border-red-200 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <ShieldAlert className="h-7 w-7 text-red-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Acesso restrito
          </h1>

          <p className="text-gray-600">
            O Cadastro de Empresas está disponível somente para a supervisão.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="bg-white rounded-2xl shadow border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 p-3">
              <Building2 className="h-6 w-6 text-[#2687e2]" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Cadastro de Empresas
              </h1>

              <p className="text-sm text-gray-600 mt-1">
                Cadastre, consulte e exclua empresas do sistema.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-200 px-5 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
              Total de empresas
            </p>

            <p className="text-2xl font-bold text-gray-900">
              {empresas.length}
            </p>
          </div>
        </div>
      </div>

      {/* MENSAGENS */}
      {mensagem && (
        <div
          className={[
            'rounded-xl border p-4 flex items-start gap-3',
            mensagem.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800',
          ].join(' ')}
        >
          {mensagem.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          )}

          <p className="text-sm font-medium">
            {mensagem.text}
          </p>
        </div>
      )}

      {/* CADASTRAR EMPRESA */}
      <div className="bg-white rounded-2xl shadow border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Adicionar nova empresa
        </h2>

        <form
          onSubmit={adicionarEmpresa}
          className="flex flex-col sm:flex-row gap-3"
        >
          <input
            type="text"
            value={novaEmpresa}
            onChange={(event) =>
              setNovaEmpresa(event.target.value)
            }
            placeholder="Digite o nome da empresa"
            maxLength={150}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#2687e2] focus:ring-2 focus:ring-[#2687e2]/20"
          />

          <button
            type="submit"
            disabled={salvando || !novaEmpresa.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2687e2] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f6bb6] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />

            {salvando
              ? 'Cadastrando...'
              : 'Cadastrar Empresa'}
          </button>
        </form>
      </div>

      {/* EMPRESAS CADASTRADAS */}
      <div className="bg-white rounded-2xl shadow border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Empresas cadastradas
              </h2>

              <p className="text-sm text-gray-600 mt-1">
                Empresas cadastradas na tabela{' '}
                <strong>empresas</strong> do Supabase.
              </p>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1 md:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                <input
                  type="text"
                  value={busca}
                  onChange={(event) =>
                    setBusca(event.target.value)
                  }
                  placeholder="Buscar empresa..."
                  className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#2687e2] focus:ring-2 focus:ring-[#2687e2]/20"
                />
              </div>

              <button
                type="button"
                onClick={atualizarLista}
                title="Atualizar lista"
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-3 text-gray-600 transition hover:bg-gray-50 hover:text-[#2687e2]"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {empresasFiltradas.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="h-14 w-14 text-gray-300 mx-auto mb-3" />

            <p className="font-semibold text-gray-700">
              {busca
                ? 'Nenhuma empresa encontrada.'
                : 'Nenhuma empresa cadastrada.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {empresasFiltradas.map((empresa) => (
              <div
                key={empresa.id}
                className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50">
                    <Building2 className="h-5 w-5 text-[#2687e2]" />
                  </div>

                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {empresa.nome}
                    </p>

                    <p className="text-xs text-gray-500">
                      ID: {empresa.id}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    excluirEmpresa(empresa)
                  }
                  disabled={
                    excluindoId === empresa.id
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />

                  <span className="hidden sm:inline">
                    {excluindoId === empresa.id
                      ? 'Excluindo...'
                      : 'Excluir'}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}