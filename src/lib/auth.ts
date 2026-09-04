import { create } from 'zustand'
import { supabase } from './supabase'
import type { SessionUser, Role, EmploymentStatus, AccountStatus } from './types'

interface AuthState {
  user: SessionUser | null
  loading: boolean
  initialized: boolean
  init: () => Promise<void>
  refresh: () => Promise<void>
  signOut: () => Promise<void>
  setUser: (u: SessionUser | null) => void
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  initialized: false,
  async init() {
    if (get().initialized) return
    set({ loading: true })
    const { data: sess } = await supabase.auth.getSession()
    if (sess.session) {
      await loadUserFromSession(sess.session.user.id).then((u) => set({ user: u }))
    } else {
      set({ user: null })
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        set({ user: null })
        return
      }
      const u = await loadUserFromSession(session.user.id)
      set({ user: u })
    })

    // realtime channel for account revocation
    subscribeAccessRevocation((payload) => {
      if (!payload?.user_id) return
      if (get().user?.id === payload.user_id) {
        set({ user: null })
        supabase.auth.signOut().catch(() => {})
        // Hard navigation ensures caches drop
        window.location.assign('/login?msg=revoked')
      }
    })

    set({ loading: false, initialized: true })
  },
  async refresh() {
    if (!get().user) return
    const u = await loadUserFromSession(get().user!.id)
    set({ user: u })
  },
  async signOut() {
    await supabase.auth.signOut()
    set({ user: null })
  },
  setUser(u) {
    set({ user: u })
  },
}))

async function loadUserFromSession(userId: string): Promise<SessionUser | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id,email,full_name,role,employment_status,account_status,access_version,employee_id')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.warn('[auth] loadUserFromSession error', error.message)
      return null
    }
    if (!data) return null
    return {
      id: data.id,
      email: data.email,
      role: data.role as Role,
      employment_status: data.employment_status as EmploymentStatus,
      account_status: data.account_status as AccountStatus,
      access_version: data.access_version ?? 1,
      employee_id: data.employee_id ?? null,
    }
  } catch (e) {
    console.warn('[auth] loadUserFromSession exception', e)
    return null
  }
}

function subscribeAccessRevocation(handler: (payload: any) => void) {
  try {
    const ch = supabase.channel('user-access-revocation')
    ch.on('broadcast', { event: 'revoked' }, (payload) => handler(payload))
    ch.subscribe()
  } catch {
    // ignore
  }
}

export async function redirectForRole(user: SessionUser | null) {
  if (!user) return '/login'
  switch (user.role) {
    case 'CEO':
      return '/ceo'
    case 'HR_MANAGER':
      return '/hr'
    case 'EMPLOYEE':
      return '/employee'
    case 'CUSTOMER':
      return '/account'
    default:
      return '/'
  }
}