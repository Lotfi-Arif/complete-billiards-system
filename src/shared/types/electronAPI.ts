import { TableStatus } from "./Table";

// Define the API types
export interface ElectronAPI {
  // Reservation operations
  createReservation: (
    data: any
  ) => Promise<{ success: boolean; data?: any; error?: string }>;
  cancelReservation: (
    id: number
  ) => Promise<{ success: boolean; data?: any; error?: string }>;

  // Session operations
  startSession: (
    data: any
  ) => Promise<{ success: boolean; data?: any; error?: string }>;
  endSession: (
    id: number,
    data: any
  ) => Promise<{ success: boolean; data?: any; error?: string }>;

  // User operations
  authenticateUser: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; data?: string; error?: string }>;
  createUser: (
    userData: any
  ) => Promise<{ success: boolean; data?: any; error?: string }>;

  // Prayer operations
  getPrayerTimes: (
    dateStr: string
  ) => Promise<{ success: boolean; data?: any; error?: string }>;
  getNextPrayer: (
    dateStr: string
  ) => Promise<{ success: boolean; data?: any; error?: string }>;

  // Table operations
  updateTableStatus: (
    tableId: number,
    status: TableStatus | undefined,
    performedBy: number
  ) => Promise<{ success: boolean; data?: any; error?: string }>;
  openTable: (tableId: number) => Promise<{ success: boolean; error?: string }>;
  closeTable: (
    tableId: number
  ) => Promise<{ success: boolean; error?: string }>;
  setTableCooldown: (
    tableId: number,
    cooldownMinutes: number
  ) => Promise<{ success: boolean; error?: string }>;

  // Payment operations
  createPayment: (
    data: any
  ) => Promise<{ success: boolean; data?: any; error?: string }>;
}
