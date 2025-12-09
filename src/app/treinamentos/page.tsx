'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function TreinamentosPage() {
  const router = useRouter()

  // Campos
  const [lider, setLider] = useState('')
  const [operador, setOperador] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [dataTreinamento, setDataTreinamento] = useState('')
  const [status, setStatus] = useState('Aberto')
  const [observacoes, setObservacoes] = useState('')

  const [salvando, setSalvando] = useState(false)
  const [treinamentos, setTreinamentos] = useState<any[]>([])

  // Carregar treinamentos
  async function load() {
    const { data } = await supabase
      .from('treinamentos')
      .select('*')
      .order('data_treinamento', { ascending: false })

    setTreinamentos(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  // Cadastrar
  async function salvarTreinamento(e: any) {
    e.preventDefault()

    if (!lider || !operador || !empresa || !dataTreinamento) {
      alert('Preencha todos os campos obrigatórios.')
      return
    }

    setSalvando(true)

    const { error } = await supabase.from('treinamentos').insert([
      {
        lider,
        operador,
        empresa,
        data_treinamento: dataTreinamento,
        status,
        observacoes: observacoes || null,
      },
    ])

    setSalvando(false)

    if (error) {
      alert('Erro: ' + error.message)
      return
    }

    // limpar form
    setLider('')
    setOperador('')
    setEmpresa('')
    setDataTreinamento('')
    setStatus('Aberto')
    setObservacoes('')

    load()
  }

  return (
    <div className="w-full min-h-screen bg-[#f6f7fb] p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-xl p-6 shadow">

        <h1 className="text-2xl font-normal text-[#ff9e61] mb-6">

          Cadastrar Novo Treinamento
        </h1>

        {/* FORM */}
        <form onSubmit={salvarTreinamento} className="grid gap-4">

          <div>
            <label className="text-[#ff9e61] font-normal">
Data</label>
            <input
              type="date"
              value={dataTreinamento}
              onChange={e => setDataTreinamento(e.target.value)}
              className="w-full border rounded-lg p-2 mt-1"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[#ff6b00] font-semibold">
                Líder / Supervisor
              </label>
              <input
                value={lider}
                onChange={e => setLider(e.target.value)}
                placeholder="Ex.: MARCO"
                className="w-full border rounded-lg p-2 mt-1"
              />
            </div>

            <div>
              <label className="text-[#ff6b00] font-semibold">
                Nome do Agente
              </label>
              <input
                value={operador}
                onChange={e => setOperador(e.target.value)}
                placeholder="Ex.: JOANA"
                className="w-full border rounded-lg p-2 mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-[#ff6b00] font-semibold">Empresa</label>
            <input
              value={empresa}
              onChange={e => setEmpresa(e.target.value)}
              placeholder="Ex.: Ezvolt"
              className="w-full border rounded-lg p-2 mt-1"
            />
          </div>

          <div>
            <label className="text-[#ff6b00] font-semibold">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full border rounded-lg p-2 mt-1"
            >
              <option value="Aberto">Aberto</option>
              <option value="Em andamento">Em andamento</option>
              <option value="Finalizado">Finalizado</option>
            </select>
          </div>

          <div>
            <label className="text-[#ff6b00] font-semibold">
              Observações
            </label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              className="w-full border rounded-lg p-2 mt-1 min-h-[80px]"
              placeholder="Informações adicionais..."
            />
          </div>

          <button
            type="submit"
            disabled={salvando}
            className="bg-[#007bff] text-white px-5 py-2 rounded-lg mt-2 hover:bg-[#0062cc]"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </form>

        {/* LISTA */}
        <h2 className="text-xl font-bold mt-10 mb-4 text-[#ff6b00]">
          Treinamentos Cadastrados
        </h2>

        <div className="grid gap-4">
          {treinamentos.map(t => (
            <div
              key={t.id}
              className="bg-white border rounded-lg p-4 shadow-sm"
            >
              <p className="text-sm">
                <strong>Agente:</strong> {t.operador}
              </p>
              <p className="text-sm">
                <strong>Líder:</strong> {t.lider}
              </p>
              <p className="text-sm">
                <strong>Empresa:</strong> {t.empresa}
              </p>
              <p className="text-sm">
                <strong>Data:</strong>{' '}
                {new Date(t.data_treinamento).toLocaleDateString('pt-BR')}
              </p>
              <p className="text-sm">
                <strong>Status:</strong> {t.status}
              </p>

              {t.observacoes && (
                <p className="text-sm mt-2">
                  <strong>OBS:</strong> {t.observacoes}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
