import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ManagementPlan = 'NONE' | 'ESSENTIAL' | 'BUSINESS' | 'PREMIUM'
export type InfrastructureResponsibility = 'CUSTOMER_DIRECT' | 'MAI_CORP_COVERED'

export interface CartItem {
  productId: string
  slug: string
  name: string
  priceCents: number
  currency: string
  category: string
  managementPlan: ManagementPlan
  infrastructureResponsibility: InfrastructureResponsibility
  infrastructureMonthlyCostCents: number
  image?: string
  qty: number
}

interface CartState {
  items: CartItem[]
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void
  remove: (productId: string) => void
  setPlan: (productId: string, plan: ManagementPlan) => void
  setInfrastructureResponsibility: (productId: string, value: InfrastructureResponsibility, monthlyCostCents?: number) => void
  clear: () => void
  count: () => number
  subtotalCents: () => number
}

const MANAGEMENT_PRICE_CENTS: Record<ManagementPlan, number> = {
  NONE: 0,
  ESSENTIAL: 10000,
  BUSINESS: 20000,
  PREMIUM: 30000,
}

export const COVERAGE_MONTHLY_FEE_CENTS = 5000

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item, qty = 1) => {
        const existing = get().items.find((i) => i.productId === item.productId)
        if (existing) {
          set((s) => ({
            items: s.items.map((i) => (i.productId === item.productId ? { ...i, ...item, qty: i.qty + qty } : i)),
          }))
        } else {
          set((s) => ({ items: [...s.items, { ...item, qty }] }))
        }
      },
      remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      setPlan: (productId, plan) =>
        set((s) => ({ items: s.items.map((i) => (i.productId === productId ? { ...i, managementPlan: plan } : i)) })),
      setInfrastructureResponsibility: (productId, value, monthlyCostCents) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.productId === productId
              ? {
                  ...i,
                  infrastructureResponsibility: value,
                  infrastructureMonthlyCostCents: typeof monthlyCostCents === 'number' ? monthlyCostCents : i.infrastructureMonthlyCostCents,
                }
              : i,
          ),
        })),
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((s, i) => s + i.qty, 0),
      subtotalCents: () =>
        get().items.reduce((s, i) => {
          // Note: the $50 coverage fee is NOT added to the upfront product
          // subtotal — it is billed monthly via infrastructure_coverage.
          return s + (i.priceCents + MANAGEMENT_PRICE_CENTS[i.managementPlan]) * i.qty
        }, 0),
    }),
    { name: 'maicorp-cart' },
  ),
)

export function managementMonthlyCents(plan: ManagementPlan) {
  return MANAGEMENT_PRICE_CENTS[plan]
}