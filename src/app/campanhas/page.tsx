'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Nicho = 'SAC' | 'Clínica'

export default function CampanhasPage() {
  const [aba, setAba] = useState<'elogio'|'reciclagem'|'vale'>('elogio')

  const hoje = new Date().toISOString().slice(0,10)

  // --- Elogio Premiado ---
  const [elogioForm, setElogioForm] = useState({
    data: hoje,
    nicho: 'SAC' as Nicho,
    tipo_elogio: '',           // 👈 novo campo
    nome: '',
    empresa: '',
    telefone_protocolo: '',
    elogio: ''
  })
  const [enviandoElogio, setEnviandoElogio] = useState(false)

  async function enviarElogio(e: React.FormEvent) {
    e.preventDefault()
    if (!elogioForm.tipo_elogio) { alert('Selecione o tipo de elogio (Ligação ou Chat).'); return }
    if (!elogioForm.nome.trim()) { alert('Informe o nome.'); return }
    if (!elogioForm.elogio.trim()) { alert('Descreva o elogio.'); return }
    try {
      setEnviandoElogio(true)
      const { error } = await supabase.from('campanha_elogio').insert([{
        data: elogioForm.data,
        nicho: elogioForm.nicho,
        tipo_elogio: elogioForm.tipo_elogio, // 👈 salvando
        nome: elogioForm.nome.trim(),
        empresa: elogioForm.empresa.trim() || null,
        telefone_protocolo: elogioForm.telefone_protocolo.trim() || null,
        elogio: elogioForm.elogio.trim()
      }])
      if (error) throw error
      alert('Elogio enviado com sucesso!')
      setElogioForm({
        data: hoje,
        nicho: 'SAC',
        tipo_elogio: '',
        nome: '',
        empresa: '',
        telefone_protocolo: '',
        elogio: ''
      })
    } catch (err:any) {
      alert('Erro ao enviar: ' + err.message)
    } finally {
      setEnviandoElogio(false)
    }
  }

  // --- Reciclagem ---
  const [recForm, setRecForm] = useState({
    data: hoje,
    nicho: 'Clínica' as Nicho,
    nome: '',
    empresas_prioridade: '',
    empresas_dificuldade: '',
    preparado: 'Sim' as 'Sim'|'Não',
    preferencia_horario: 'Semana após 18:00' as 'Semana após 18:00'|'Final de semana',
    duas_no_mesmo_dia: 'Não' as 'Sim'|'Não'
  })
  const [enviandoRec, setEnviandoRec] = useState(false)

  async function enviarReciclagem(e: React.FormEvent) {
    e.preventDefault()
    if (!recForm.nome.trim()) { alert('Informe seu nome.'); return }
    try {
      setEnviandoRec(true)
      const { error } = await supabase.from('campanha_reciclagem').insert([{
        data: recForm.data,
        nicho: recForm.nicho,
        nome: recForm.nome.trim(),
        empresas_prioridade: recForm.empresas_prioridade.trim() || null,
        empresas_dificuldade: recForm.empresas_dificuldade.trim() || null,
        preparado: recForm.preparado === 'Sim',
        preferencia_horario: recForm.preferencia_horario,
        duas_no_mesmo_dia: recForm.duas_no_mesmo_dia === 'Sim'
      }])
      if (error) throw error
      alert('Resposta enviada! Obrigado 🙂')
      setRecForm({
        data: hoje,
        nicho: 'Clínica',
        nome: '',
        empresas_prioridade: '',
        empresas_dificuldade: '',
        preparado: 'Sim',
        preferencia_horario: 'Semana após 18:00',
        duas_no_mesmo_dia: 'Não'
      })
    } catch (err:any) {
      alert('Erro ao enviar: ' + err.message)
    } finally {
      setEnviandoRec(false)
    }
  }

  // --- Vale (adiantamento) ---
  const [valeForm, setValeForm] = useState({
    data: hoje,
    nome: '',
    valor: '',
    ciente: false
  })
  const [enviandoVale, setEnviandoVale] = useState(false)

  async function enviarVale(e: React.FormEvent) {
    e.preventDefault()
    if (!valeForm.nome.trim()) { alert('Informe o nome completo.'); return }
    const valorNum = Number(String(valeForm.valor).replace(',', '.'))
    if (!isFinite(valorNum) || valorNum <= 0) { alert('Informe um valor válido.'); return }
    if (!valeForm.ciente) { alert('Confirme que leu e está ciente das regras.'); return }

    try {
      setEnviandoVale(true)
      const { error } = await supabase.from('campanha_vale').insert([{
        data: valeForm.data,
        nome: valeForm.nome.trim(),
        valor: valorNum,
        ciente: valeForm.ciente
      }])
      if (error) throw error
      alert('Solicitação de vale enviada!')
      setValeForm({ data: hoje, nome: '', valor: '', ciente: false })
    } catch (err:any) {
      alert('Erro ao enviar: ' + err.message)
    } finally {
      setEnviandoVale(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#2687e2]">Campanhas</h1>
        </header>

        {/* Abas */}
        <div className="rounded-xl bg-white p-2 shadow flex gap-2">
          <button
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${aba==='elogio'?'bg-[#2687e2] text-white':'bg-gray-100 text-gray-700'}`}
            onClick={()=>setAba('elogio')}
          >
            Elogio Premiado
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${aba==='reciclagem'?'bg-[#2687e2] text-white':'bg-gray-100 text-gray-700'}`}
            onClick={()=>setAba('reciclagem')}
          >
            Reciclagem 2025
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${aba==='vale'?'bg-[#2687e2] text-white':'bg-gray-100 text-gray-700'}`}
            onClick={()=>setAba('vale')}
          >
            Vale (adiantamento)
          </button>
        </div>

        {/* Conteúdo das abas */}
        {aba==='elogio' ? (
          <div className="rounded-xl bg-white p-6 shadow space-y-4">
            <p className="text-gray-800">
              <b>Campanha: Elogio Premiado</b><br/>
              Parabéns por receber um elogio no seu atendimento! Isso mostra que seu esforço e dedicação estão sendo reconhecidos.
              Continue assim, e que venham mais elogios e conquistas no seu caminho. Boa sorte e sucesso!
            </p>

            <form onSubmit={enviarElogio} className="space-y-4">
              {/* Data */}
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Data</label>
                <input
                  type="date"
                  value={elogioForm.data}
                  onChange={e=>setElogioForm({...elogioForm, data:e.target.value})}
                  className="w-full rounded-lg border p-2 text-[#535151]"
                />
              </div>

              {/* Tipo de elogio + Nome */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Tipo de elogio</label>
                  <select
                    value={elogioForm.tipo_elogio}
                    onChange={e=>setElogioForm({...elogioForm, tipo_elogio: e.target.value})}
                    className="w-full rounded-lg border p-2 text-[#535151]"
                  >
                    <option value="">Selecione</option>
                    <option value="Ligação">Ligação</option>
                    <option value="Chat">Chat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Nome</label>
                  <input
                    type="text"
                    value={elogioForm.nome}
                    onChange={e=>setElogioForm({...elogioForm, nome:e.target.value})}
                    className="w-full rounded-lg border p-2 text-[#535151]"
                    placeholder="Seu nome"
                  />
                </div>
              </div>

              {/* Nicho + Empresa / Protocolo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Nicho</label>
                  <select
                    value={elogioForm.nicho}
                    onChange={e=>setElogioForm({...elogioForm, nicho: e.target.value as Nicho})}
                    className="w-full rounded-lg border p-2 text-[#535151]"
                  >
                    {['SAC','Clínica'].map(n=>(
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Empresa</label>
                  <input
                    type="text"
                    value={elogioForm.empresa}
                    onChange={e=>setElogioForm({...elogioForm, empresa:e.target.value})}
                    className="w-full rounded-lg border p-2 text-[#535151]"
                    placeholder="Opcional"
                  />
                </div>
              </div>

              {/* Telefone / protocolo */}
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Telefone ou Protocolo</label>
                <input
                  type="text"
                  value={elogioForm.telefone_protocolo}
                  onChange={e=>setElogioForm({...elogioForm, telefone_protocolo:e.target.value})}
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  placeholder="Opcional"
                />
              </div>

              {/* Descrição do elogio */}
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Qual foi o elogio?</label>
                <textarea
                  rows={4}
                  value={elogioForm.elogio}
                  onChange={e=>setElogioForm({...elogioForm, elogio:e.target.value})}
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  placeholder="Descreva o elogio recebido"
                />
              </div>

              <button
                type="submit"
                disabled={enviandoElogio}
                className="rounded-lg bg-[#2687e2] px-4 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {enviandoElogio ? 'Enviando…' : 'Enviar'}
              </button>
            </form>
          </div>
        ) : aba==='reciclagem' ? (
          <div className="rounded-xl bg-white p-6 shadow space-y-4">
            <p className="text-gray-800">
              <b>Campanha: RECICLAGEM</b><br/>
              Abaixo você encontrará uma série de perguntas para melhor entendermos e agendarmos as reciclagens de 2025.
              Marque conforme disponibilidade e maior interesse. <br/>
              <i>Lembrando que as reciclagens serão agendadas de acordo com as demandas e fora do horário de expediente.</i>
            </p>

            <form onSubmit={enviarReciclagem} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Data</label>
                <input
                  type="date"
                  value={recForm.data}
                  onChange={e=>setRecForm({...recForm, data:e.target.value})}
                  className="w-full rounded-lg border p-2 text-[#535151]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Nicho</label>
                  <select
                    value={recForm.nicho}
                    onChange={e=>setRecForm({...recForm, nicho: e.target.value as Nicho})}
                    className="w-full rounded-lg border p-2 text-[#535151]"
                  >
                    {['Clínica','SAC'].map(n=>(
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Seu nome</label>
                  <input
                    type="text"
                    value={recForm.nome}
                    onChange={e=>setRecForm({...recForm, nome:e.target.value})}
                    className="w-full rounded-lg border p-2 text-[#535151]"
                    placeholder="Seu nome"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Empresa(s) com prioridade (pode informar mais de uma)
                </label>
                <input
                  type="text"
                  value={recForm.empresas_prioridade}
                  onChange={e=>setRecForm({...recForm, empresas_prioridade:e.target.value})}
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  placeholder="Separe por vírgulas"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">
                  Dentro do nicho escolhido, em quais empresas tem mais dificuldade?
                </label>
                <input
                  type="text"
                  value={recForm.empresas_dificuldade}
                  onChange={e=>setRecForm({...recForm, empresas_dificuldade:e.target.value})}
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  placeholder="Separe por vírgulas"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Preparado para mais demandas?</label>
                  <div className="flex gap-3">
                    {(['Sim','Não'] as const).map(v=>(
                      <label key={v} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="preparado"
                          checked={recForm.preparado===v}
                          onChange={()=>setRecForm({...recForm, preparado:v})}
                        />
                        <span className="text-[#535151]">{v}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Preferência para agendamento</label>
                  <select
                    value={recForm.preferencia_horario}
                    onChange={e=>setRecForm({...recForm, preferencia_horario:e.target.value as any})}
                    className="w-full rounded-lg border p-2 text-[#535151]"
                  >
                    {['Semana após 18:00','Final de semana'].map(v=>(
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Duas reciclagens no mesmo dia (mesmo nicho)?</label>
                  <div className="flex gap-3">
                    {(['Sim','Não'] as const).map(v=>(
                      <label key={v} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="duas"
                          checked={recForm.duas_no_mesmo_dia===v}
                          onChange={()=>setRecForm({...recForm, duas_no_mesmo_dia:v})}
                        />
                        <span className="text-[#535151]">{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={enviandoRec}
                className="rounded-lg bg-[#2687e2] px-4 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {enviandoRec ? 'Enviando…' : 'Enviar'}
              </button>
            </form>
          </div>
        ) : (
          // --- Aba VALE ---
          <div className="rounded-xl bg-white p-6 shadow space-y-4">
            <div className="text-gray-800 space-y-2">
              <b>VALE ADIANTAMENTO DE SALÁRIO!</b>
              <div className="text-sm">
                <p>⚠ <b>Atenção!</b> Leia atentamente as REGRAS antes de solicitar:</p>
                <ul className="list-disc pl-5 mt-1">
                  <li>✅ Valor máximo de <b>30% do salário</b>.</li>
                  <li>✅ Pedido até o <b>dia 14</b> de cada mês (verificar se não cai no fim de semana).</li>
                  <li>✅ O desconto será feito em <b>parcela única (1x)</b>.</li>
                </ul>
                <p className="mt-2">❌ <b>Requisitos:</b></p>
                <ul className="list-disc pl-5">
                  
                  <li>🔴 Não estar cumprindo <b>aviso prévio</b>.</li>
                  <li>🔴 Ficar atento ao pedir vale em período de <b>FÉRIAS</b>.</li>
                </ul>
              </div>
            </div>

            <form onSubmit={enviarVale} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Data</label>
                <input
                  type="date"
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  value={valeForm.data}
                  onChange={e=>setValeForm({...valeForm, data: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Nome completo</label>
                <input
                  type="text"
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  value={valeForm.nome}
                  onChange={e=>setValeForm({...valeForm, nome: e.target.value})}
                  placeholder="Seu nome completo"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Valor de adiantamento</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full rounded-lg border p-2 text-[#535151]"
                  value={valeForm.valor}
                  onChange={e=>setValeForm({...valeForm, valor: e.target.value})}
                  placeholder="Ex.: 350,00"
                />
                <p className="text-xs text-gray-500 mt-1">* Máximo de 30% do salário (informativo).</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="ciente"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={valeForm.ciente}
                  onChange={e=>setValeForm({...valeForm, ciente: e.target.checked})}
                />
                <label htmlFor="ciente" className="text-sm font-semibold text-[#ff751f]">
                  Ciente de todas as regras
                </label>
              </div>

              <button
                type="submit"
                disabled={enviandoVale}
                className="rounded-lg bg-[#2687e2] px-4 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {enviandoVale ? 'Enviando…' : 'Solicitar Vale'}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  )
}
