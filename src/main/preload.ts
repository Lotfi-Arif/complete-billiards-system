import { contextBridge, ipcRenderer } from "electron";
import { TableStatus } from "@/shared/types/Table";

// Define the API types
interface ElectronAPI {
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

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("electron", {
  // Reservation operations
  createReservation: (data) => ipcRenderer.invoke("create-reservation", data),
  cancelReservation: (id) => ipcRenderer.invoke("cancel-reservation", id),

  // Session operations
  startSession: (data) => ipcRenderer.invoke("start-session", data),
  endSession: (id, data) => ipcRenderer.invoke("end-session", id, data),

  // User operations
  authenticateUser: (username, password) =>
    ipcRenderer.invoke("authenticate-user", username, password),
  createUser: (userData) => ipcRenderer.invoke("create-user", userData),

  // Prayer operations
  getPrayerTimes: (dateStr) => ipcRenderer.invoke("get-prayer-times", dateStr),
  getNextPrayer: (dateStr) => ipcRenderer.invoke("get-next-prayer", dateStr),

  // Table operations
  updateTableStatus: (tableId, status, performedBy) =>
    ipcRenderer.invoke("update-table-status", tableId, status, performedBy),
  openTable: (tableId) => ipcRenderer.invoke("open-table", tableId),
  closeTable: (tableId) => ipcRenderer.invoke("close-table", tableId),
  setTableCooldown: (tableId, cooldownMinutes) =>
    ipcRenderer.invoke("set-table-cooldown", tableId, cooldownMinutes),

  // Payment operations
  createPayment: (data) => ipcRenderer.invoke("create-payment", data),
} as ElectronAPI);
