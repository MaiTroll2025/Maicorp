export type Role = 'CEO' | 'HR_MANAGER' | 'EMPLOYEE' | 'CUSTOMER' | 'PUBLIC'

export type EmploymentStatus = 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED' | 'INACTIVE'
export type AccountStatus = 'ACTIVE' | 'DISABLED' | 'PENDING' | 'TERMINATED'

export interface UserRecord {
  id: string
  email: string
  full_name: string
  role: Role
  employment_status: EmploymentStatus
  account_status: AccountStatus
  access_version: number
  employee_id?: string | null
}

export interface SessionUser {
  id: string
  email: string
  role: Role
  employment_status: EmploymentStatus
  account_status: AccountStatus
  access_version: number
  employee_id?: string | null
}

export const ACCESS_VERSION = (() => {
  // Bumped whenever a CEO action must force all sessions of a user to revalidate.
  return 1
})()