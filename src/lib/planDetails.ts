import type { ManagementPlan } from '@/lib/cart'

export interface PlanBenefit {
  label: string
  included: boolean
}

export interface PlanDetail {
  plan: ManagementPlan
  name: string
  monthlyCents: number
  tagline: string
  managementDays: number
  managementDaysLabel: string
  benefits: PlanBenefit[]
}

export const PLAN_DETAILS: Record<ManagementPlan, PlanDetail> = {
  NONE: {
    plan: 'NONE',
    name: 'No Management',
    monthlyCents: 0,
    tagline: 'You handle everything yourself.',
    managementDays: 0,
    managementDaysLabel: 'No MAI Corp management',
    benefits: [
      { label: 'MAI Corp project delivery and source handover', included: true },
      { label: 'You pay all third-party infrastructure costs directly', included: true },
      { label: 'MAI Corp management window (days MAI Corp maintains infrastructure)', included: false },
      { label: 'MAI Corp bug-fix coverage during the management window', included: false },
      { label: 'MAI Corp infrastructure bill management ($50/mo coverage)', included: false },
      { label: 'Priority response SLA', included: false },
    ],
  },
  ESSENTIAL: {
    plan: 'ESSENTIAL',
    name: 'Essential',
    monthlyCents: 10000,
    tagline: '30-day MAI Corp infrastructure management with Supabase Pro.',
    managementDays: 30,
    managementDaysLabel: '30 days of MAI Corp infrastructure management',
    benefits: [
      { label: 'Supabase Pro included as the managed infrastructure platform', included: true },
      { label: '30 days of MAI Corp infrastructure management after launch', included: true },
      { label: 'MAI Corp monitors uptime, backups, and security patches for 30 days', included: true },
      { label: 'Bug-fix coverage during the 30-day management window', included: true },
      { label: 'Customer remains responsible for the underlying Supabase Pro invoice during the management period', included: true },
      { label: 'Optional MAI Corp infrastructure coverage ($50/mo) — MAI Corp pays the provider on your behalf', included: false },
      { label: 'Extended management beyond 30 days', included: false },
      { label: 'Priority response SLA', included: false },
    ],
  },
  BUSINESS: {
    plan: 'BUSINESS',
    name: 'Business',
    monthlyCents: 20000,
    tagline: '3 months of MAI Corp infrastructure management with Supabase Pro.',
    managementDays: 90,
    managementDaysLabel: '3 months of MAI Corp infrastructure management',
    benefits: [
      { label: 'Supabase Pro included as the managed infrastructure platform', included: true },
      { label: '3 months of MAI Corp infrastructure management after launch', included: true },
      { label: 'MAI Corp monitors uptime, backups, and security patches for the full 3 months', included: true },
      { label: 'Bug-fix coverage during the 3-month management window', included: true },
      { label: 'Monthly infrastructure health report', included: true },
      { label: 'Optional MAI Corp infrastructure coverage ($50/mo) — MAI Corp pays the provider on your behalf', included: true },
      { label: 'Priority response SLA (next business day)', included: true },
      { label: '6-month management window', included: false },
      { label: 'Dedicated account manager', included: false },
    ],
  },
  PREMIUM: {
    plan: 'PREMIUM',
    name: 'Premium',
    monthlyCents: 30000,
    tagline: '6 months of MAI Corp infrastructure management with Supabase Pro.',
    managementDays: 180,
    managementDaysLabel: '6 months of MAI Corp infrastructure management',
    benefits: [
      { label: 'Supabase Pro included as the managed infrastructure platform', included: true },
      { label: '6 months of MAI Corp infrastructure management after launch', included: true },
      { label: 'MAI Corp monitors uptime, backups, and security patches for the full 6 months', included: true },
      { label: 'Bug-fix coverage during the 6-month management window', included: true },
      { label: 'Monthly infrastructure health report', included: true },
      { label: 'Optional MAI Corp infrastructure coverage ($50/mo) — MAI Corp pays the provider on your behalf', included: true },
      { label: 'Priority response SLA (same business day)', included: true },
      { label: 'Dedicated account manager', included: true },
      { label: 'Quarterly performance and cost optimisation review', included: true },
    ],
  },
}
