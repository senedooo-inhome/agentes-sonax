'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Empresa = {
  id: string
  nome: string
}

type LinhaEmpresa = {
  empresa_id: string
  nome: string
  atende: boolean // true = SIM, false = NÃO
  quemAdicionou: string
  responsavelUra: string
  observacao: string
}

type Holiday = {
  nome: string
  data: Date
}

/** =========================
 *  Helpers de data / feriados
 *  ========================= */

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toYYYYMMDD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function addDays(d: Date, days: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  x.setHours(0, 0, 0, 0)
  return x
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function formatBR(d: Date) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

function weekdayPT(d: Date) {
  const dias = [
    'Domingo',
    'Segunda-Feira',
    'Terça-Feira',
    'Quarta-Feira',
    'Quinta-Feira',
    'Sexta-Feira',
    'Sábado',
  ]
  return dias[d.getDay()]
}

/**
 * Computa Páscoa (Meeus/Jones/Butcher)
 */
function easterDate(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function buildHolidays(year: number): Holiday[] {
  const pascoa = easterDate(year)
  const carnaval = addDays(pascoa, -47)
  const paixao = addDays(pascoa, -2)
  const corpus = addDays(pascoa, 60)

  const fixed = (m: number, d: number) => new Date(year, m - 1, d)

  const list: Holiday[] = [
    { nome: 'Confraternização Universal', data: fixed(1, 1) },
    { nome: 'Carnaval', data: carnaval },
    { nome: 'Paixão de Cristo', data: paixao },
    { nome: 'Tiradentes', data: fixed(4, 21) },
    { nome: 'Dia do Trabalho', data: fixed(5, 1) },
    { nome: 'Corpus Christi', data: corpus },
    { nome: 'Aniversário de Caratinga', data: fixed(6, 24) },
    { nome: 'Independência do Brasil', data: fixed(9, 7) },
    { nome: 'Nossa Sra. Aparecida', data: fixed(10, 12) },
    { nome: 'Finados', data: fixed(11, 2) },
    { nome: 'Proclamação da República', data: fixed(11, 15) },
    { nome: 'Consciência Negra', data: fixed(11, 20) },
    { nome: 'Natal', data: fixed(12, 25) },
  ]

  return list
    .map((h) => ({ ...h, data: startOfDay(h.data) }))
    .sort((a, b) => a.data.getTime() - b.data.getTime())
}

/**
 * Mostra o feriado atual e só troca para o próximo 2 dias depois.
 */
function getHolidayByRule(today: Date): Holiday {
  const t = startOfDay(today)
  const y = t.getFullYear()

  const holidays = [...buildHolidays(y), ...buildHolidays(y + 1)].sort(
    (a, b) => a.data.getTime() - b.data.getTime(),
  )

  for (const h of holidays) {
    const cutoff = addDays(h.data, 2)
    if (t.getTime() <= cutoff.getTime()) return h
  }

  return holidays[0]
}

/** =========================
 *  Toggle SIM / NÃO
 *  ========================= */
function ToggleSimNao({
  value,
  onChange,
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  const isSim = value

  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={[
        'relative inline-flex h-8 w-[104px] items-center rounded-full border transition',
        isSim ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50',
      ].join(' ')}
      aria-label="Alternar SIM/NÃO"
      title={isSim ? 'SIM' : 'NÃO'}
    >
      <span
        className={[
          'absolute left-3 text-[12px] font-extrabold tracking-wide',
          isSim ? 'text-green-700' : 'text-red-700 opacity-0',
        ].join(' ')}
      >
        SIM
      </span>
      <span
        className={[
          'absolute right-3 text-[12px] font-extrabold tracking-wide',
          !isSim ? 'text-red-700' : 'text-green-700 opacity-0',
        ].join(' ')}
      >
        NÃO
      </span>

      <span
        className={[
          'inline-block h-6 w-6 transform rounded-full bg-white shadow transition',
          isSim ? 'translate-x-[72px]' : 'translate-x-[8px]',
          isSim ? 'ring-2 ring-green-400' : 'ring-2 ring-red-400',
        ].join(' ')}
      />
    </button>
  )
}

/** =========================
 *  Página
 *  ========================= */
export default function OperacaoEmpresaPage() {
  const [holiday, setHoliday] = useState<Holiday>(() => getHolidayByRule(new Date()))
  const [linhas, setLinhas] = useState<LinhaEmpresa[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const totalEmpresas = useMemo(() => linhas.length, [linhas])

  // Atualiza feriado automaticamente
  useEffect(() => {
    const tick = () => setHoliday(getHolidayByRule(new Date()))
    tick()
    const id = setInterval(tick, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  function updateLinha(empresa_id: string, patch: Partial<LinhaEmpresa>) {
    setLinhas((prev) => prev.map((l) => (l.empresa_id === empresa_id ? { ...l, ...patch } : l)))
  }

  // 1) Carrega lista de empresas e cria linhas padrão
  useEffect(() => {
    async function carregarEmpresas() {
      try {
        setCarregando(true)

        const { data: empData, error: empErr } = await supabase
          .from('empresas')
          .select('id, nome')
          .order('nome', { ascending: true })

        if (empErr) throw empErr

        const emps: Empresa[] = (empData || []).map((e: any) => ({
          id: e.id,
          nome: e.nome,
        }))

        setEmpresas(emps)

        const base: LinhaEmpresa[] = emps.map((emp) => ({
          empresa_id: emp.id,
          nome: emp.nome,
          atende: true,
          quemAdicionou: '',
          responsavelUra: '',
          observacao: '',
        }))

        setLinhas(base)
      } catch (err) {
        console.error('Erro ao carregar empresas', err)
        alert('Não foi possível carregar empresas.')
      } finally {
        setCarregando(false)
      }
    }

    carregarEmpresas()
  }, [])

  // 2) Sempre que mudar feriado/data OU quando empresas carregarem,
  //    busca registros já salvos e preenche na tela (mantém persistência)
  useEffect(() => {
    if (!empresas.length) return

    async function carregarRegistrosSalvos() {
      try {
        setCarregando(true)

        const dataISO = toYYYYMMDD(holiday.data)

        const { data: regs, error } = await supabase
          .from('operacao_empresas')
          .select('empresa_id, status_operacao, quem_adicionou, responsavel_ura, observacao, feriado, data')
          .eq('data', dataISO) // se "data" for DATE no banco, isso funciona
          .order('empresa_id', { ascending: true })

        if (error) throw error

        const map = new Map<string, any>()
        ;(regs || []).forEach((r: any) => map.set(r.empresa_id, r))

        setLinhas((prev) =>
          prev.map((l) => {
            const r = map.get(l.empresa_id)
            if (!r) return l

            return {
              ...l,
              atende: String(r.status_operacao || '').toLowerCase() === 'sim',
              quemAdicionou: r.quem_adicionou ?? '',
              responsavelUra: r.responsavel_ura ?? '',
              observacao: r.observacao ?? '',
            }
          }),
        )
      } catch (err) {
        console.error('Erro ao carregar registros salvos', err)
        // sem alert aqui pra não ficar chato
      } finally {
        setCarregando(false)
      }
    }

    carregarRegistrosSalvos()
  }, [holiday.data, empresas.length]) // (se quiser, pode colocar holiday.nome também)

  async function salvarTudo(e: React.FormEvent) {
    e.preventDefault()

    if (!linhas.length) {
      alert('Nenhuma empresa carregada.')
      return
    }

    try {
      setSalvando(true)

      const dataISO = toYYYYMMDD(holiday.data)
      const feriadoNome = holiday.nome

      const payload = linhas.map((l) => ({
        data: dataISO,
        feriado: feriadoNome,
        empresa_id: l.empresa_id,
        status_operacao: l.atende ? 'Sim' : 'Não',
        quem_adicionou: l.quemAdicionou?.trim() || null,
        responsavel_ura: l.responsavelUra?.trim() || null,
        observacao: l.observacao?.trim() || null,
      }))

      // ✅ UPSERT para atualizar se já existir (precisa UNIQUE em data+empresa_id)
      const { error } = await supabase
        .from('operacao_empresas')
        .upsert(payload, { onConflict: 'data,empresa_id' })

      if (error) throw error

      alert('Registros salvos! ✅')

      // ✅ NÃO RESETAR OS CAMPOS
      // Se quiser, pode só recarregar do banco pra garantir:
      // (mas não é obrigatório)
      // await carregarRegistrosSalvos()  <-- (aqui teria que virar função fora do useEffect)
    } catch (err: any) {
      console.error(err)
      alert('Erro ao salvar: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setSalvando(false)
    }
  }

  async function resetTela() {
    // “Cancelar” = voltar o feriado padrão atual e recarregar do banco
    setHoliday(getHolidayByRule(new Date()))
    // não limpa linhas aqui; o useEffect vai repuxar os dados do feriado atual
  }

  const tableMaxH = 'max-h-[calc(100vh-260px)]'

  return (
    <main className="min-h-screen w-full bg-[#f3f6f9]">
      <div className="w-full px-4 py-4 md:px-6 md:py-6">
        <div className="w-full rounded-2xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.10)] ring-1 ring-black/5">
          {/* header topo */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b bg-[#f7fafc] px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7fb9d7] text-white shadow">
                🗓️
              </div>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight text-[#1f2a37]">
                  Cadastro de Novo Feriado
                </h1>
                <p className="mt-1 text-[12px] text-gray-600">
                  Preencha por empresa. O sistema troca automaticamente para o próximo feriado{' '}
                  <b>(2 dias após o atual)</b>.
                </p>
              </div>
            </div>

            {/* DATA + dia da semana */}
            <div className="min-w-[260px]">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-extrabold text-[#1f2a37]">DATA DO FERIADO</label>
                <span className="text-[12px] font-semibold text-gray-700">{weekdayPT(holiday.data)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 rounded-xl border bg-white px-3 py-2 shadow-sm">
                <div className="text-sm font-extrabold text-[#1f2a37]">{formatBR(holiday.data)}</div>
                <div className="ml-auto text-[12px] text-gray-500">{toYYYYMMDD(holiday.data)}</div>
              </div>
            </div>
          </div>

          {/* faixa: feriado */}
          <div className="px-6 py-4">
            <label className="text-[12px] font-extrabold text-[#1f2a37]">FERIADO</label>
            <div className="mt-1 flex items-center gap-3 rounded-xl border bg-white px-3 py-3 shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#183a63] text-white">
                🎯
              </div>
              <div className="text-sm font-extrabold tracking-wide text-[#183a63]">{holiday.nome}</div>
            </div>
          </div>

          {/* tabela */}
          <form onSubmit={salvarTudo} className="px-6 pb-6">
            <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
              <div className="grid grid-cols-[2.1fr_1.1fr_1.1fr_1.1fr_1.6fr] gap-0 bg-[#f3f4f6]">
                <div className="px-4 py-3 text-[12px] font-extrabold text-[#1f2a37]">
                  NOME DA EMPRESA
                </div>
                <div className="px-4 py-3 text-[12px] font-extrabold text-[#1f2a37]">
                  CALL CENTER VAI ATENDER?
                </div>
                <div className="px-4 py-3 text-[12px] font-extrabold text-[#1f2a37]">
                  QUEM ADICIONOU
                </div>
                <div className="px-4 py-3 text-[12px] font-extrabold text-[#1f2a37]">
                  RESPONSÁVEL PELA URA
                </div>
                <div className="px-4 py-3 text-[12px] font-extrabold text-[#1f2a37]">
                  OBSERVAÇÃO
                </div>
              </div>

              <div className={[tableMaxH, 'overflow-auto'].join(' ')}>
                {carregando ? (
                  <div className="p-6 text-[12px] text-gray-600">Carregando…</div>
                ) : (
                  linhas.map((l, idx) => (
                    <div
                      key={l.empresa_id}
                      className={[
                        'grid grid-cols-[2.1fr_1.1fr_1.1fr_1.1fr_1.6fr] items-center',
                        idx % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]',
                        'border-t',
                      ].join(' ')}
                    >
                      <div className="px-4 py-3 text-[12px] font-bold text-[#1f2a37]">{l.nome}</div>

                      <div className="px-4 py-3">
                        <ToggleSimNao
                          value={l.atende}
                          onChange={(v) => updateLinha(l.empresa_id, { atende: v })}
                        />
                      </div>

                      <div className="px-4 py-3">
                        <input
                          className="w-full rounded-lg border bg-white px-3 py-2 text-[12px] text-[#1f2a37] outline-none focus:ring-2 focus:ring-[#7fb9d7]"
                          value={l.quemAdicionou}
                          onChange={(e) => updateLinha(l.empresa_id, { quemAdicionou: e.target.value })}
                          placeholder="Digite quem adicionou"
                        />
                      </div>

                      <div className="px-4 py-3">
                        <input
                          className="w-full rounded-lg border bg-white px-3 py-2 text-[12px] text-[#1f2a37] outline-none focus:ring-2 focus:ring-[#7fb9d7]"
                          value={l.responsavelUra}
                          onChange={(e) => updateLinha(l.empresa_id, { responsavelUra: e.target.value })}
                          placeholder="Digite o responsável"
                        />
                      </div>

                      <div className="px-4 py-3">
                        <textarea
                          rows={2}
                          className="w-full resize-none rounded-lg border bg-white px-3 py-2 text-[12px] text-[#1f2a37] outline-none focus:ring-2 focus:ring-[#7fb9d7]"
                          value={l.observacao}
                          onChange={(e) => updateLinha(l.empresa_id, { observacao: e.target.value })}
                          placeholder='Ex.: "Atendimento reduzido / URA ajustada..."'
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* rodapé */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-[12px] text-gray-600">
                {totalEmpresas > 0 ? `${totalEmpresas} empresa(s)` : ''}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={resetTela}
                  className="rounded-xl border bg-white px-6 py-3 text-[12px] font-extrabold text-[#1f2a37] shadow-sm hover:bg-gray-50"
                >
                  CANCELAR
                </button>

                <button
                  type="submit"
                  disabled={salvando || carregando || linhas.length === 0}
                  className="rounded-xl bg-[#5ea7cf] px-8 py-3 text-[12px] font-extrabold text-white shadow-sm hover:bg-[#4f9ac4] disabled:opacity-50"
                >
                  {salvando ? 'SALVANDO…' : 'SALVAR'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
