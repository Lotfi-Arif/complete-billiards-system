import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import isDev from "electron-is-dev";
import { registerIpcHandlers } from "./ipc/handlers";
import { DatabaseService } from "../backend/database/DatabaseService";
import { ArduinoService } from "../backend/arduino/ArduinoService";
import { PrayerService } from "../backend/database/PrayerService";

class MainProcess {
  private mainWindow: BrowserWindow | null = null;
  private db: DatabaseService;
  private arduino: ArduinoService;
  private prayer: PrayerService;

  constructor() {
    // Initialize core services
    this.db = new DatabaseService({
      filename: path.join(app.getPath("userData"), "pool-manager.db"),
    });

    this.arduino = new ArduinoService({
      baudRate: 9600,
      autoConnect: true,
    });

    this.prayer = new PrayerService({
      latitude: 21.4225, // Default coordinates (configurable)
      longitude: 39.8262,
      timeZone: "Asia/Riyadh",
      prayerWindowMinutes: 30,
    });
  }

  async initialize() {
    try {
      // Wait for app to be ready
      await app.whenReady();

      // Create main window
      this.createWindow();

      // Register IPC handlers
      registerIpcHandlers(this.db, this.arduino, this.prayer);

      // Set up app event handlers
      this.setupAppEvents();

      // Try to connect Arduino
      await this.arduino.connect().catch(console.error);
    } catch (error) {
      console.error("Failed to initialize application:", error);
      app.quit();
    }
  }

  private createWindow() {
    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
      },
    });

    // Load the app
    if (isDev) {
      // In development, load from React dev server
      this.mainWindow.loadURL("http://localhost:3000");
      // Open DevTools
      this.mainWindow.webContents.openDevTools();
    } else {
      // In production, load the built app
      this.mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
    }

    // Handle window close
    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
    });
  }

  private setupAppEvents() {
    // Handle macOS specific behavior
    app.on("activate", () => {
      if (!this.mainWindow) {
        this.createWindow();
      }
    });

    // Handle window-all-closed event
    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }
    });

    // Clean up before quit
    app.on("before-quit", async () => {
      await this.cleanup();
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      console.error("Uncaught exception:", error);
      this.mainWindow?.webContents.send("system:error", {
        type: "uncaught-exception",
        message: error.message,
      });
    });
  }

  private async cleanup() {
    try {
      // Clean up services
      this.db.cleanup();
      this.arduino.cleanup();

      // Additional cleanup
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.close();
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }
}

// Create and initialize the application
const mainProcess = new MainProcess();
mainProcess.initialize().catch((error) => {
  console.error("Failed to start application:", error);
  app.quit();
});
