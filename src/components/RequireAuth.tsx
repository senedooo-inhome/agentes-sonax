'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function RequireAuth() {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    async function check() {
      const { data } = await supabase.auth.getSession()
      if (!active) return
      if (!data.session) {
        // guarda para voltar depois do login, se quiser
        const next = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`
        router.replace(`/login${next}`)
      } else {
        setChecking(false)
      }
    }
    check()
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      if (!session) router.replace('/login')
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [router, pathname])

  if (checking) return null
  return null // apenas side-effect de redirecionamento
}
