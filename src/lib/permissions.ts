export type UserRole = 'supervisao' | 'lider' | 'marketing'

export const ROLE_HOME: Record<UserRole, string> = {
  supervisao: '/',
  lider: '/',
  marketing: '/informacoes-agentes',
}

export const PERMISSIONS: Record<UserRole, string[]> = {
  supervisao: ['*'],

  lider: [
    '/',
    '/dashboard',
    '/chamada',
    '/erros',
    '/advertencias',
    '/ligacoes',
    '/atestados',
    '/ausencias',
    '/campanhas',
    '/ura',
    '/informacoes-agentes',
  ],

  marketing: ['/informacoes-agentes'],
}

export function hasPermission(role: UserRole, pathname: string) {
  const allowed = PERMISSIONS[role]

  if (allowed.includes('*')) return true

  return allowed.some((route) => {
    if (route === '/') return pathname === '/'
    return pathname === route || pathname.startsWith(route + '/')
  })
}