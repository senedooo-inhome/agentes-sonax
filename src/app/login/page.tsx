'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('sonaxinhome@gmail.com')
  const [password, setPassword] = useState('Sonax@0102')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/') // já logado → vai pro cadastro
    })
  }, [router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email, password,
    })
    setLoading(false)
    if (error) {
      setErrorMsg(error.message)
      return
    }
    router.replace('/') // pós-login: vai pro cadastro (home)
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7] flex items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow space-y-4"
      >
        <h1 className="text-xl font-bold text-[#2687e2]">Entrar</h1>
        <div className="space-y-2">
          <label className="text-sm font-medium">E-mail</label>
          <input
            type="email"
            className="w-full rounded-lg border p-2 text-black"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Senha</label>
          <input
            type="password"
            className="w-full rounded-lg border p-2 text-black"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#2687e2] px-4 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
