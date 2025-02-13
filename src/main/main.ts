// src/main/main.ts
import "module-alias/register";
import { app, BrowserWindow } from "electron";
import path from "path";
import fs from "fs-extra";
import * as moduleAlias from "module-alias";
import Database from "better-sqlite3";

// Setup module aliases
moduleAlias.addAliases({
  "@": path.join(__dirname, ".."),
});

import Logger from "@/shared/logger";
import { PlatformUtils } from "@/utils/platform";
import { initializeDatabase } from "@/backend/database/initDatabase";

let mainWindow: BrowserWindow | null = null;
let database: Database.Database | null = null;

async function ensureAppDirectories() {
  try {
    const appDataPath = PlatformUtils.getAppDataPath();
    await fs.ensureDir(appDataPath);
    Logger.info("App directories created at:", appDataPath);
  } catch (error) {
    Logger.error("Error creating app directories:", error);
    throw error;
  }
}

async function initializeAppDatabase() {
  try {
    const dbPath = PlatformUtils.getDatabasePath();
    Logger.info("Initializing database at:", dbPath);

    // Initialize database first
    // const db = initializeDatabase(dbPath);

    // // Then initialize IPC handlers with the database instance
    // const { initializeHandlers } = await import("./ipc/handlers");
    // initializeHandlers(db);

    // database = db;
    Logger.info("Database and handlers initialized successfully");
  } catch (error) {
    Logger.error("Error initializing database:", error);
    throw error;
  }
}

const createWindow = () => {
  try {
    const windowConfig: Electron.BrowserWindowConstructorOptions = {
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
      },
    };

    if (PlatformUtils.isMac()) {
      windowConfig.titleBarStyle = "hidden";
      windowConfig.trafficLightPosition = { x: 20, y: 20 };
    }

    mainWindow = new BrowserWindow(windowConfig);

    const isDev = process.env.NODE_ENV === "development";
    Logger.info(`Running in ${isDev ? "development" : "production"} mode`);

    if (isDev) {
      const devServerUrl = "http://localhost:3000";
      Logger.info(`Loading development server from: ${devServerUrl}`);
      mainWindow.loadURL(devServerUrl);
      mainWindow.webContents.openDevTools();

      mainWindow.webContents.on(
        "did-fail-load",
        (event, errorCode, errorDescription) => {
          Logger.error(
            `Failed to load dev server: ${errorDescription} (${errorCode})`
          );
        }
      );
    } else {
      const indexPath = PlatformUtils.getUIPath();
      Logger.info(`Loading production build from: ${indexPath}`);
      mainWindow.loadFile(indexPath);
    }

    // Setup window event handlers
    mainWindow.webContents.on("did-finish-load", () => {
      Logger.info("Window loaded successfully");
    });

    if (PlatformUtils.isMac()) {
      mainWindow.on("enter-full-screen", () => {
        mainWindow?.webContents.send("fullscreen-change", true);
      });
      mainWindow.on("leave-full-screen", () => {
        mainWindow?.webContents.send("fullscreen-change", false);
      });
    }

    mainWindow.on("closed", () => {
      mainWindow = null;
    });

    Logger.info("Main window created successfully");
  } catch (error) {
    Logger.error("Error creating main window:", error);
    throw error;
  }
};

async function initializeApp() {
  try {
    await ensureAppDirectories();
    await initializeAppDatabase();
    createWindow();
    Logger.info("Application initialized successfully");
  } catch (error) {
    Logger.error("Error initializing application:", error);
    app.quit();
  }
}

app
  .whenReady()
  .then(initializeApp)
  .catch((error) => {
    Logger.error("Error during app initialization:", error);
    app.quit();
  });

// Cleanup function
function cleanup() {
  try {
    if (database) {
      database.close();
      database = null;
    }
    Logger.info("Database connection closed");
  } catch (error) {
    Logger.error("Error during cleanup:", error);
  }
}

app.on("window-all-closed", () => {
  cleanup();
  if (!PlatformUtils.isMac()) {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Global error handlers
process.on("uncaughtException", (error) => {
  Logger.error("Uncaught exception:", error);
  cleanup();
  app.quit();
});

process.on("unhandledRejection", (error) => {
  Logger.error("Unhandled rejection:", error);
});

app.on("quit", () => {
  cleanup();
  Logger.info("Application quit");
});
