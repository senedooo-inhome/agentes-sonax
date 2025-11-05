import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  })

  const { message } = await req.json()
  const text = String(message || '').toLowerCase()

  // -------------- detectores --------------
  const wantsClinica = /(clinica|clínica|clin|hospital|unidade|posto|ambulat[oó]rio|saúde|ubs|upa|pronto[- ]?socorro)/i.test(text)
  const wantsSac = /(sac|atendimento|suporte|ajuda|fale[- ]?conosco|contato|reclama[cç][aã]o|ouvidoria|central|call[- ]?center|chat|mensagem)/i.test(text)
  const wantsCount = /(quantas|quantos|total|qtd|n[uú]mero|contagem|soma|c[oó]mputo|estat[íi]stica|dados|registro)/i.test(text)
  const isToday = /(hoje|agora|neste momento|atualmente|no dia de hoje|presente)/i.test(text)
  const isMonth = /(m[eê]s|esse m[eê]s|mês|mensal|no m[eê]s|referente ao m[eê]s|per[ií]odo mensal)/i.test(text)

  // datas
  const today = new Date().toISOString().slice(0, 10)
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const monthStart = `${year}-${month}-01`
  const lastDay = new Date(year, parseInt(month), 0).getDate()
  const monthEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`

  let intent: string = 'unknown'
  let rows: any[] = []

  try {
    if (text.includes('atestado')) {
      intent = 'atestados'
      const { data, error } = await supabase.from('atestados').select('*')
      if (error) throw error
      rows = data ?? []
    } else if (text.includes('presen') || text.includes('logou')) {
      intent = 'presencas'
      const query = supabase.from('presencas').select('*')
      if (isToday) query.eq('data', today)
      const { data, error } = await query.limit(100)
      if (error) throw error
      rows = data ?? []
    } else if (text.includes('adverten')) {
      intent = 'advertencias'
      const query = supabase.from('advertencias').select('*')
      if (isToday) query.eq('data', today)
      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      rows = data ?? []
    } else if (text.includes('elogio')) {
      intent = 'campanha_elogio'
      let query = supabase.from('campanha_elogio').select('*')
      if (isToday) query = query.eq('data', today)
      if (isMonth) query = query.gte('data', monthStart).lte('data', monthEnd)
      const { data, error } = await query.order('data', { ascending: false }).limit(200)
      if (error) throw error
      rows = data ?? []

      if (wantsClinica) {
        rows = rows.filter((r) =>
          String(r.nicho || '').toLowerCase().includes('clín') ||
          String(r.nicho || '').toLowerCase().includes('clin')
        )
      }
    } else if (text.includes('vale')) {
      intent = 'campanha_vale'
      let query = supabase.from('campanha_vale').select('*')
      if (isToday) query = query.eq('data', today)
      if (isMonth) query = query.gte('data', monthStart).lte('data', monthEnd)
      const { data, error } = await query.order('data', { ascending: false }).limit(200)
      if (error) throw error
      rows = data ?? []
    }

    if (wantsCount) {
      return NextResponse.json({
        ok: true,
        intent,
        count: rows.length,
        message: `Foram encontrados ${rows.length} registro(s) de ${intent || 'dados'}.`,
      })
    }

    if (!rows.length) {
      return NextResponse.json({
        ok: true,
        intent,
        count: 0,
        message: `Não encontrei registros para ${intent === 'unknown' ? 'essa pergunta' : intent}.`,
      })
    }

    const maxToShow = 5
    const lines = rows.slice(0, maxToShow).map((r) => {
      const nome = r.nome || r.agente || r.supervisor || r.empresa || '—'
      const data = r.data || r.data_inicio || r.created_at || ''
      return `• ${nome} — ${data}`
    })

    let textResp = `Encontrei ${rows.length} registro(s) de ${intent}: \n${lines.join(' \n')}`
    if (rows.length > maxToShow) {
      textResp += ` \n(+ ${rows.length - maxToShow} oculto(s))`
    }

    return NextResponse.json({
      ok: true,
      intent,
      count: rows.length,
      message: textResp,
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err.message || 'erro ao consultar',
      },
      { status: 500 },
    )
  }
}