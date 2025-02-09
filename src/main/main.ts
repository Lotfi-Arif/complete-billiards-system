import { app, BrowserWindow } from "electron";
import * as path from "path";
import isDev from "electron-is-dev";
import { registerIpcHandlers } from "./ipc/handlers";
import { DatabaseService } from "../backend/database/DatabaseService";
import { ArduinoService } from "../backend/arduino/ArduinoService";
import { PrayerService } from "../backend/prayer/PrayerService";

class MainProcess {
  private mainWindow: BrowserWindow | null = null;
  private db: DatabaseService;
  private arduino: ArduinoService;
  private prayer: PrayerService;

  constructor() {
    this.db = new DatabaseService({ filename: "pool-manager.db" });
    this.arduino = new ArduinoService();
    this.prayer = new PrayerService({
      latitude: 21.4225, // Default coordinates (should be configurable)
      longitude: 39.8262,
      timeZone: "Asia/Riyadh",
    });
  }

  async initialize() {
    await app.whenReady();
    this.createWindow();
    this.setupHandlers();
    this.setupAppEvents();
  }

  private createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
      },
    });

    if (isDev) {
      this.mainWindow.loadURL("http://localhost:3000");
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
    }
  }

  private setupHandlers() {
    registerIpcHandlers(this.db, this.arduino, this.prayer);
  }

  private setupAppEvents() {
    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }
    });

    app.on("activate", () => {
      if (!this.mainWindow) {
        this.createWindow();
      }
    });

    app.on("before-quit", () => {
      this.cleanup();
    });
  }

  private cleanup() {
    this.db.cleanup();
    this.arduino.cleanup();
  }
}

// Start the application
const mainProcess = new MainProcess();
mainProcess.initialize().catch(console.error);
