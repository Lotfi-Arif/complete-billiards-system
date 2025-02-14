import { contextBridge, ipcRenderer } from "electron";
import { ElectronAPI } from "@/shared/types/electronAPI";
import { ApiResponse } from "@/shared/types/api";
import { Table } from "@/shared/types/Table";

const api: ElectronAPI = {
  // Table operations
  getTables: () =>
    ipcRenderer.invoke("get-tables") as Promise<ApiResponse<Table[]>>,

  getTable: (id) =>
    ipcRenderer.invoke("get-table", id) as Promise<ApiResponse<Table>>,

  updateTableStatus: (id, data, performedBy) =>
    ipcRenderer.invoke("update-table-status", id, data, performedBy) as Promise<
      ApiResponse<Table>
    >,

  openTable: (id, performedBy) =>
    ipcRenderer.invoke("open-table", id, performedBy) as Promise<
      ApiResponse<Table>
    >,

  closeTable: (id, performedBy) =>
    ipcRenderer.invoke("close-table", id, performedBy) as Promise<
      ApiResponse<Table>
    >,

  setTableMaintenance: (id, performedBy) =>
    ipcRenderer.invoke("set-table-maintenance", id, performedBy) as Promise<
      ApiResponse<Table>
    >,

  setTableCooldown: (id, performedBy) =>
    ipcRenderer.invoke("set-table-cooldown", id, performedBy) as Promise<
      ApiResponse<Table>
    >,

  isTableAvailable: (id) =>
    ipcRenderer.invoke("is-table-available", id) as Promise<
      ApiResponse<boolean>
    >,
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("electron", api);
