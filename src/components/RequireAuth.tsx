'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { hasPermission, ROLE_HOME, type UserRole } from '@/lib/permissions'

export default function RequireAuth() {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true

    async function check() {
      const { data } = await supabase.auth.getSession()

      if (!active) return

      const session = data.session

      if (!session) {
        const next = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`
        router.replace(`/login${next}`)
        return
      }

      const user = session.user

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!active) return

      if (error || !profile?.role) {
        alert('Perfil de acesso não encontrado.')
        await supabase.auth.signOut()
        router.replace('/login')
        return
      }

      const role = profile.role as UserRole

      if (!hasPermission(role, pathname)) {
        alert('Você não tem permissão para acessar esta tela.')
        router.replace(ROLE_HOME[role])
        return
      }

      setChecking(false)
    }

    check()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_ev, session) => {
      if (!session) {
        router.replace('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (!profile?.role) {
        router.replace('/login')
        return
      }

      const role = profile.role as UserRole

      if (!hasPermission(role, pathname)) {
        alert('Você não tem permissão para acessar esta tela.')
        router.replace(ROLE_HOME[role])
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [router, pathname])

  if (checking) return null
  return null
}