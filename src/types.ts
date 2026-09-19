export type Role = 'admin' | 'staff'

export interface UserProfile {
  uid: string
  fullName: string
  role: Role
}

export type SessionStatus = 'open' | 'closed'

export interface StockSession {
  id: string
  name: string
  importedAt: number
  createdBy: string
  status: SessionStatus
}

export interface StockItem {
  id: string
  itemName: string
  unit: string
  assignedSection: string | null
}

export interface TallyQty {
  id: string
  tallyQty: number
}

export interface StockCount {
  id: string
  liveQty: number
  countedBy: string
  updatedAt: number
  assignedSection: string | null
}

export interface StockRow {
  id: string
  itemName: string
  unit: string
  tallyQty: number
  liveQty: number | null
  difference: number | null
  assignedSection: string | null
}
