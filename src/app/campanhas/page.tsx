'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Nicho = 'SAC' | 'Clínica'

export default function CampanhasPage() {
  const [aba, setAba] = useState<'elogio'|'reciclagem'|'vale'|'fone'>('elogio')

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


  // --- Solicitar novo fone ---
  const [foneForm, setFoneForm] = useState({
    data: hoje,
    nome: '',
    cep: '',
    rua: '',
    numero: '',
    bairro: '',
    cidade: '',
    estado: '',
    cpf: '',
    telefone: '',
    email: '',
    ciente: false
  })
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [enviandoFone, setEnviandoFone] = useState(false)

  function somenteNumeros(valor: string) {
    return valor.replace(/\D/g, '')
  }

  function formatarCep(valor: string) {
    const numeros = somenteNumeros(valor).slice(0, 8)
    return numeros.replace(/(\d{5})(\d)/, '$1-$2')
  }

  function formatarCpf(valor: string) {
    const numeros = somenteNumeros(valor).slice(0, 11)
    return numeros
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }

  function formatarTelefone(valor: string) {
    const numeros = somenteNumeros(valor).slice(0, 11)
    if (numeros.length <= 10) {
      return numeros
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2')
    }
    return numeros
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
  }

  async function buscarEnderecoPorCep(cepInformado: string) {
    const cep = somenteNumeros(cepInformado)
    if (cep.length !== 8) return

    try {
      setBuscandoCep(true)
      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      if (!resposta.ok) throw new Error('Não foi possível consultar o CEP.')

      const endereco = await resposta.json()
      if (endereco.erro) {
        alert('CEP não encontrado. Confira o número ou preencha o endereço manualmente.')
        return
      }

      setFoneForm(formAtual => ({
        ...formAtual,
        rua: endereco.logradouro || formAtual.rua,
        bairro: endereco.bairro || formAtual.bairro,
        cidade: endereco.localidade || formAtual.cidade,
        estado: endereco.uf || formAtual.estado
      }))
    } catch (err: any) {
      alert(err.message || 'Erro ao consultar o CEP. Você pode preencher o endereço manualmente.')
    } finally {
      setBuscandoCep(false)
    }
  }

  async function enviarSolicitacaoFone(e: React.FormEvent) {
    e.preventDefault()

    const camposObrigatorios = [
      foneForm.nome,
      foneForm.cep,
      foneForm.rua,
      foneForm.numero,
      foneForm.bairro,
      foneForm.cidade,
      foneForm.estado,
      foneForm.cpf,
      foneForm.telefone,
      foneForm.email
    ]

    if (camposObrigatorios.some(campo => !campo.trim())) {
      alert('Preencha todos os dados obrigatórios para solicitar o novo fone.')
      return
    }
    if (somenteNumeros(foneForm.cep).length !== 8) {
      alert('Informe um CEP válido com 8 números.')
      return
    }
    if (somenteNumeros(foneForm.cpf).length !== 11) {
      alert('Informe um CPF válido com 11 números.')
      return
    }
    if (!foneForm.email.includes('@')) {
      alert('Informe um e-mail válido.')
      return
    }
    if (!foneForm.ciente) {
      alert('Confirme que todos os dados estão corretos e atualizados.')
      return
    }

    try {
      setEnviandoFone(true)
      const { error } = await supabase.from('solicitacoes_fone').insert([{
        data: foneForm.data,
        nome: foneForm.nome.trim(),
        cep: somenteNumeros(foneForm.cep),
        rua: foneForm.rua.trim(),
        numero: foneForm.numero.trim(),
        bairro: foneForm.bairro.trim(),
        cidade: foneForm.cidade.trim(),
        estado: foneForm.estado.trim().toUpperCase(),
        cpf: somenteNumeros(foneForm.cpf),
        telefone: somenteNumeros(foneForm.telefone),
        email: foneForm.email.trim().toLowerCase(),
        ciente: foneForm.ciente
      }])

      if (error) throw error
      alert('Solicitação de novo fone enviada com sucesso!')
      setFoneForm({
        data: hoje,
        nome: '',
        cep: '',
        rua: '',
        numero: '',
        bairro: '',
        cidade: '',
        estado: '',
        cpf: '',
        telefone: '',
        email: '',
        ciente: false
      })
    } catch (err: any) {
      alert('Erro ao enviar: ' + err.message)
    } finally {
      setEnviandoFone(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#2687e2]">Campanhas</h1>
        </header>

        {/* Abas */}
        <div className="rounded-xl bg-white p-2 shadow flex flex-wrap gap-2">
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
          <button
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${aba==='fone'?'bg-[#2687e2] text-white':'bg-gray-100 text-gray-700'}`}
            onClick={()=>setAba('fone')}
          >
            Solicitar novo fone
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
        ) : aba==='vale' ? (
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
        ) : (
          // --- Aba SOLICITAR NOVO FONE ---
          <div className="rounded-xl bg-white p-6 shadow space-y-4">
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-gray-800">
              <p className="font-bold text-[#ff751f]">Solicitar novo fone</p>
              <p className="mt-2 text-sm">
                Sempre que for necessário realizar o envio de fone para algum colaborador,
                é obrigatório confirmar e preencher todos os dados abaixo.
              </p>
              <p className="mt-3 text-sm font-semibold">
                Antes de solicitar o envio, confiram todos os dados e garantam que estejam corretos e atualizados.
              </p>
              <p className="mt-2 text-sm">Conto com a atenção e o cuidado de todos.</p>
            </div>

            <form onSubmit={enviarSolicitacaoFone} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Data</label>
                <input type="date" value={foneForm.data} onChange={e=>setFoneForm({...foneForm, data:e.target.value})} className="w-full rounded-lg border p-2 text-[#535151]" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Nome completo</label>
                <input type="text" value={foneForm.nome} onChange={e=>setFoneForm({...foneForm, nome:e.target.value})} className="w-full rounded-lg border p-2 text-[#535151]" placeholder="Nome do colaborador" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">CEP</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={foneForm.cep}
                    onChange={e=>setFoneForm({...foneForm, cep:formatarCep(e.target.value)})}
                    onBlur={e=>buscarEnderecoPorCep(e.target.value)}
                    className="w-full rounded-lg border p-2 text-[#535151]"
                    placeholder="00000-000"
                    maxLength={9}
                  />
                  <button
                    type="button"
                    onClick={()=>buscarEnderecoPorCep(foneForm.cep)}
                    disabled={buscandoCep || somenteNumeros(foneForm.cep).length !== 8}
                    className="whitespace-nowrap rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                  >
                    {buscandoCep ? 'Buscando…' : 'Buscar CEP'}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">O endereço será preenchido automaticamente, mas todos os campos continuam editáveis.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Rua</label>
                  <input type="text" value={foneForm.rua} onChange={e=>setFoneForm({...foneForm, rua:e.target.value})} className="w-full rounded-lg border p-2 text-[#535151]" placeholder="Rua / Avenida" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Nº</label>
                  <input type="text" value={foneForm.numero} onChange={e=>setFoneForm({...foneForm, numero:e.target.value})} className="w-full rounded-lg border p-2 text-[#535151]" placeholder="Número" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Bairro</label>
                <input type="text" value={foneForm.bairro} onChange={e=>setFoneForm({...foneForm, bairro:e.target.value})} className="w-full rounded-lg border p-2 text-[#535151]" placeholder="Bairro" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Cidade</label>
                  <input type="text" value={foneForm.cidade} onChange={e=>setFoneForm({...foneForm, cidade:e.target.value})} className="w-full rounded-lg border p-2 text-[#535151]" placeholder="Cidade" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Estado</label>
                  <input type="text" value={foneForm.estado} onChange={e=>setFoneForm({...foneForm, estado:e.target.value.toUpperCase().slice(0,2)})} className="w-full rounded-lg border p-2 text-[#535151] uppercase" placeholder="UF" maxLength={2} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-[#ff751f]">CPF</label>
                  <input type="text" inputMode="numeric" value={foneForm.cpf} onChange={e=>setFoneForm({...foneForm, cpf:formatarCpf(e.target.value)})} className="w-full rounded-lg border p-2 text-[#535151]" placeholder="000.000.000-00" maxLength={14} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-[#ff751f]">Telefone</label>
                  <input type="tel" inputMode="tel" value={foneForm.telefone} onChange={e=>setFoneForm({...foneForm, telefone:formatarTelefone(e.target.value)})} className="w-full rounded-lg border p-2 text-[#535151]" placeholder="(00) 00000-0000" maxLength={15} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-[#ff751f]">E-mail</label>
                <input type="email" value={foneForm.email} onChange={e=>setFoneForm({...foneForm, email:e.target.value})} className="w-full rounded-lg border p-2 text-[#535151]" placeholder="email@exemplo.com" />
              </div>

              <div className="flex items-start gap-2 rounded-lg bg-gray-50 p-3">
                <input id="fone-ciente" type="checkbox" className="mt-1 h-4 w-4" checked={foneForm.ciente} onChange={e=>setFoneForm({...foneForm, ciente:e.target.checked})} />
                <label htmlFor="fone-ciente" className="text-sm font-semibold text-[#ff751f]">
                  Confirmo que conferi todos os dados e que estão corretos e atualizados.
                </label>
              </div>

              <button type="submit" disabled={enviandoFone || buscandoCep} className="rounded-lg bg-[#2687e2] px-4 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-50">
                {enviandoFone ? 'Enviando…' : 'Solicitar novo fone'}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  )
}