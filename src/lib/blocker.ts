/**
 * Universal Blocker
 *
 * A centralized authorization + integrity layer that all sensitive
 * operations should pass through. The browser never makes trust
 * decisions; this layer is the *only* place where role + employment +
 * account state + request context are evaluated before a write hits
 * the database.
 *
 * The frontend calls `assert(...)` before invoking a privileged
 * action; the backend (Supabase RLS, server RPCs) enforces the same
 * invariants. Failures are recorded through Bug Catcher.
 */
import { supabase } from './supabase'
import { useAuth } from './auth'
import { recordBug } from './bugCatcher'
import type { Role } from './types'

export interface BlockContext {
  action: string
  target?: string
  requiredRoles?: Role[]
  reason?: string
}

export class BlockError extends Error {
  code: string
  reason: string
  action: string
  constructor(code: string, reason: string, action: string) {
    super(`[Block] ${code}: ${reason} (${action})`)
    this.code = code
    this.reason = reason
    this.action = action
  }
}

export function currentUser() {
  return useAuth.getState().user
}

export function assertAuthenticated(): void {
  const u = currentUser()
  if (!u) throw new BlockError('UNAUTHENTICATED', 'No authenticated session.', 'unknown')
}

export function assertRole(allowed: Role[]): void {
  const u = currentUser()
  if (!u) throw new BlockError('UNAUTHENTICATED', 'No authenticated session.', 'unknown')
  if (!allowed.includes(u.role)) {
    void recordBug({
      severity: 'HIGH',
      error_type: 'AUTHORIZATION_DENIED',
      error_message: `User ${u.email} (${u.role}) attempted ${allowed.join('/')} action`,
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
      metadata: { user_id: u.id, required: allowed },
    })
    throw new BlockError(
      'FORBIDDEN',
      `Role ${u.role} is not permitted to perform this action.`,
      'unknown',
    )
  }
}

export function assertActive(): void {
  const u = currentUser()
  if (!u) throw new BlockError('UNAUTHENTICATED', 'No authenticated session.', 'unknown')
  if (u.account_status !== 'ACTIVE' || u.employment_status !== 'ACTIVE') {
    throw new BlockError(
      'ACCESS_REVOKED',
      `Account or employment status is ${u.account_status}/${u.employment_status}.`,
      'unknown',
    )
  }
}

export async function recordBlock(evt: {
  action: string
  target?: string
  reason: string
  code?: string
}) {
  const u = currentUser()
  try {
    await supabase.from('universal_blocker_events').insert({
      action: evt.action,
      target: evt.target ?? null,
      reason: evt.reason,
      code: evt.code ?? 'BLOCKED',
      actor_id: u?.id ?? null,
      actor_email: u?.email ?? null,
      actor_role: u?.role ?? null,
      metadata: { ua: navigator.userAgent, path: location.pathname },
    })
  } catch (e) {
    console.warn('[blocker] failed to record event', e)
  }
}

export async function guarded<T>(
  ctx: BlockContext,
  fn: () => Promise<T>,
  opts?: { roles?: Role[]; requireActive?: boolean },
): Promise<T> {
  const u = currentUser()
  if (!u) {
    await recordBlock({ ...ctx, reason: 'unauthenticated' })
    throw new BlockError('UNAUTHENTICATED', 'No session.', ctx.action)
  }
  const roles = opts?.roles ?? ctx.requiredRoles
  if (roles && !roles.includes(u.role)) {
    await recordBlock({ ...ctx, reason: `role=${u.role} not in ${roles.join(',')}` })
    throw new BlockError('FORBIDDEN', 'Role not permitted.', ctx.action)
  }
  if (opts?.requireActive) {
    if (u.account_status !== 'ACTIVE' || u.employment_status !== 'ACTIVE') {
      await recordBlock({ ...ctx, reason: 'account inactive' })
      throw new BlockError('ACCESS_REVOKED', 'Account inactive.', ctx.action)
    }
  }
  try {
    return await fn()
  } catch (e: any) {
    await recordBlock({ ...ctx, reason: e?.message ?? 'unknown' })
    throw e
  }
}