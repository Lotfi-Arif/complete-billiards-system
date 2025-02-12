// src/main/preload.ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  createReservation: (data: any) =>
    ipcRenderer.invoke("create-reservation", data),
  cancelReservation: (id: number) =>
    ipcRenderer.invoke("cancel-reservation", id),
  startSession: (data: any) => ipcRenderer.invoke("start-session", data),
  endSession: (id: number, data: any) =>
    ipcRenderer.invoke("end-session", id, data),
  authenticateUser: (username: string, password: string) =>
    ipcRenderer.invoke("authenticate-user", username, password),
  createUser: (userData: any) => ipcRenderer.invoke("create-user", userData),
  getPrayerTimes: (dateStr: string) =>
    ipcRenderer.invoke("get-prayer-times", dateStr),
  getNextPrayer: (dateStr: string) =>
    ipcRenderer.invoke("get-next-prayer", dateStr),
  updateTableStatus: (tableId: number, status: string, performedBy: number) =>
    ipcRenderer.invoke("update-table-status", tableId, status, performedBy),
  openTable: (tableId: number) => ipcRenderer.invoke("open-table", tableId),
  closeTable: (tableId: number) => ipcRenderer.invoke("close-table", tableId),
  setTableCooldown: (tableId: number, cooldownMinutes: number) =>
    ipcRenderer.invoke("set-table-cooldown", tableId, cooldownMinutes),
  createPayment: (data: any) => ipcRenderer.invoke("create-payment", data),
  createNotification: (data: any) =>
    ipcRenderer.invoke("create-notification", data),
  markNotificationAsRead: (id: number) =>
    ipcRenderer.invoke("mark-notification-as-read", id),
  // Expose additional endpoints as needed.
});
