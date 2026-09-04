import { type ReactNode } from 'react'
import clsx from 'clsx'

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8', className)}>{children}</div>
}

export function Section({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={clsx('py-16 sm:py-20 lg:py-24', className)}>
      {children}
    </section>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('metal-card rounded-2xl p-6', className)}>{children}</div>
}

export function GlassCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('glass rounded-2xl p-6', className)}>{children}</div>
}

export function H1({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={clsx('text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]', className)}>{children}</h1>
}

export function H2({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={clsx('text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight', className)}>{children}</h2>
}

export function H3({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={clsx('text-xl sm:text-2xl font-semibold tracking-tight', className)}>{children}</h3>
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('text-[11px] tracking-[0.25em] uppercase text-muted font-medium', className)}>
      {children}
    </div>
  )
}

export function Divider({ className }: { className?: string }) {
  return <div className={clsx('divider my-10', className)} />
}

export function StatusDot({ tone = 'ok' }: { tone?: 'ok' | 'warn' | 'err' | 'crit' | 'unknown' | 'purp' | 'info' }) {
  const cls = {
    ok: 'bg-ok shadow-[0_0_12px_rgba(16,185,129,.6)]',
    warn: 'bg-warn shadow-[0_0_12px_rgba(245,158,11,.6)]',
    err: 'bg-err shadow-[0_0_12px_rgba(239,68,68,.6)]',
    crit: 'bg-crit shadow-[0_0_12px_rgba(220,38,38,.7)] animate-pulseSoft',
    info: 'bg-primary shadow-[0_0_12px_rgba(0,191,255,.6)]',
    purp: 'bg-secondary shadow-[0_0_12px_rgba(139,92,246,.6)]',
    unknown: 'bg-muted',
  }[tone]
  return <span className={clsx('inline-block w-2.5 h-2.5 rounded-full', cls)} aria-hidden />
}

export function Chip({ tone = 'default', children, className }: { tone?: 'default' | 'ok' | 'warn' | 'err' | 'crit' | 'info' | 'purp'; children: ReactNode; className?: string }) {
  const map = {
    default: '',
    ok: 'chip-ok',
    warn: 'chip-warn',
    err: 'chip-err',
    crit: 'chip-crit',
    info: 'chip-info',
    purp: 'chip-purp',
  }
  return <span className={clsx('chip', map[tone], className)}>{children}</span>
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-md bg-white/5', className)} />
}