'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type UserRole = 'supervisao' | 'lider' | 'marketing'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        await supabase.auth.signOut()
      } catch {}
    })()
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setLoading(false)
      setErrorMsg(error.message)
      return
    }

    const user = data?.user

    if (!user) {
      setLoading(false)
      setErrorMsg('Usuário não encontrado.')
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    setLoading(false)

    if (profileError || !profile?.role) {
      setErrorMsg('Perfil não encontrado no sistema.')
      return
    }

    const role = profile.role as UserRole

    if (role === 'marketing') {
      router.replace('/informacoes-agentes')
      return
    }

    if (role === 'supervisao' || role === 'lider') {
      router.replace('/chamada')
      return
    }

    router.replace('/')
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-white relative">
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-[#1677ff]" />
      <div className="absolute -top-12 -left-12 h-44 w-44 rounded-full bg-[#1677ff]" />
      <div className="absolute bottom-16 left-10 h-56 w-56 rounded-[40px] bg-[#1677ff] rotate-12" />

      <div className="relative z-10 h-full w-full flex items-center justify-center px-8">
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 items-center gap-10">
          <div className="flex justify-center md:justify-start">
            <form
              onSubmit={onSubmit}
              className="w-full max-w-sm rounded-2xl bg-white shadow-[0_12px_30px_rgba(0,0,0,0.15)] p-8 space-y-5"
            >
              <div className="text-center space-y-2">
                <h1 className="text-lg font-semibold text-[#3b3b3b]">
                  Bem vindo ao <span className="font-extrabold text-[#1677ff]">LOGIN</span>
                </h1>
                <p className="text-xs text-gray-500">Preencha os dados do login para acessar</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600">Usuário</label>
                <input
                  type="email"
                  className="w-full border-b border-gray-300 focus:border-[#1677ff] outline-none py-2 text-sm text-black"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="Digite seu e-mail"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600">Senha</label>
                <input
                  type="password"
                  className="w-full border-b border-gray-300 focus:border-[#1677ff] outline-none py-2 text-sm text-black"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                />
              </div>

              {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-[#1677ff] py-2.5 text-sm font-bold text-white hover:brightness-95 disabled:opacity-50"
              >
                {loading ? 'ENTRANDO…' : 'ENTRAR'}
              </button>
            </form>
          </div>

          <div className="hidden md:flex justify-center">
            <div className="relative w-[440px] h-[320px] drop-shadow-[0_18px_25px_rgba(0,0,0,0.18)]">
              <div
                className="absolute inset-0 bg-[#1677ff]"
                style={{
                  clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                  borderRadius: '28px',
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-center px-10">
                <p className="text-white font-extrabold text-xl leading-snug">
                  Faça o Login em nossa
                  <br />
                  <span className="text-2xl">Plataforma</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}