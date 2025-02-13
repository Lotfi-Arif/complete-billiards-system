import { contextBridge, ipcRenderer } from "electron";
import { ElectronAPI } from "@/shared/types/electronAPI";

const api: ElectronAPI = {
  // Reservation operations
  createReservation: (data) => ipcRenderer.invoke("create-reservation", data),
  cancelReservation: (id) => ipcRenderer.invoke("cancel-reservation", id),
  startSession: (data) => ipcRenderer.invoke("start-session", data),
  endSession: (id, data) => ipcRenderer.invoke("end-session", id, data),
  authenticateUser: (username, password) =>
    ipcRenderer.invoke("authenticate-user", username, password),
  createUser: (userData) => ipcRenderer.invoke("create-user", userData),
  getPrayerTimes: (dateStr) => ipcRenderer.invoke("get-prayer-times", dateStr),
  getNextPrayer: (dateStr) => ipcRenderer.invoke("get-next-prayer", dateStr),
  updateTableStatus: (tableId, status, performedBy) =>
    ipcRenderer.invoke("update-table-status", tableId, status, performedBy),
  openTable: (tableId) => ipcRenderer.invoke("open-table", tableId),
  closeTable: (tableId) => ipcRenderer.invoke("close-table", tableId),
  setTableCooldown: (tableId, cooldownMinutes) =>
    ipcRenderer.invoke("set-table-cooldown", tableId, cooldownMinutes),
  createPayment: (data) => ipcRenderer.invoke("create-payment", data),
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("electron", api);
