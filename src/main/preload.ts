import { contextBridge, ipcRenderer } from "electron";
import type { IpcChannels } from "../shared/types/ipc";

const api = {
  invoke: <T>(channel: IpcChannels, ...args: unknown[]): Promise<T> => {
    return ipcRenderer.invoke(channel, ...args);
  },

  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));

    return () => {
      ipcRenderer.removeAllListeners(channel);
    };
  },
};

contextBridge.exposeInMainWorld("electronAPI", api);

// Expose types for renderer process
export type ElectronAPI = typeof api;
