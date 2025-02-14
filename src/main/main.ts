import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import Database from "better-sqlite3";
import { TableService } from "../backend/database/TableService";
import Logger from "../shared/logger";
import { TableStatus } from "../shared/types/Table";

let mainWindow: BrowserWindow | null = null;
let database: Database.Database | null = null;
let tableService: TableService | null = null;

const isDevelopment = process.env.NODE_ENV === "development";

function initializeDatabase() {
  try {
    const userDataPath = app.getPath("userData");
    const dbPath = join(userDataPath, "poolhall.db");

    // Ensure the directory exists
    const fs = require("fs");
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    Logger.info(`Initializing database at: ${dbPath}`);

    // Open database with more explicit options
    database = new Database(dbPath, {
      // Adjust verbose to match the expected signature
      verbose: (message?: unknown, ...additionalArgs: unknown[]) => {
        Logger.info(String(message), ...additionalArgs);
      },
      fileMustExist: false,
      timeout: 5000,
    });

    // Test database connection
    database.pragma("journal_mode = WAL");
    database.pragma("foreign_keys = ON");

    // Initialize service only after successful database connection
    tableService = new TableService(database);

    Logger.info("Database initialized successfully");
    return true;
  } catch (error) {
    Logger.error("Failed to initialize database:", error);
    if (database) {
      try {
        database.close();
      } catch (closeError) {
        Logger.error("Error closing database:", closeError);
      }
      database = null;
    }
    return false;
  }
}

function createWindow() {
  try {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, "preload.js"),
      },
    });

    if (isDevelopment) {
      mainWindow.loadURL("http://localhost:3000");
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
    }

    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  } catch (error) {
    Logger.error("Error creating window:", error);
    throw error;
  }
}

function initializeIpcHandlers() {
  if (!tableService) {
    throw new Error("TableService not initialized");
  }

  ipcMain.handle("get-tables", async () => {
    try {
      Logger.info("IPC: get-tables called");
      if (!tableService) throw new Error("TableService not available");
      const tables = await tableService.getAllTables();
      return { success: true, data: tables };
    } catch (error) {
      Logger.error("IPC get-tables error:", error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle(
    "open-table",
    async (event, id: number, performedBy?: number) => {
      try {
        Logger.info(`IPC: open-table called for table ${id}`);
        const table = await tableService!.updateTableStatus(
          id,
          { status: TableStatus.IN_USE },
          performedBy
        );
        return { success: true, data: table };
      } catch (error) {
        Logger.error(`IPC open-table error:`, error);
        return { success: false, error: String(error) };
      }
    }
  );

  ipcMain.handle(
    "close-table",
    async (event, id: number, performedBy?: number) => {
      try {
        Logger.info(`IPC: close-table called for table ${id}`);
        const table = await tableService!.updateTableStatus(
          id,
          { status: TableStatus.AVAILABLE },
          performedBy
        );
        return { success: true, data: table };
      } catch (error) {
        Logger.error(`IPC close-table error:`, error);
        return { success: false, error: String(error) };
      }
    }
  );

  ipcMain.handle(
    "update-table-status",
    async (event, id: number, data: any, performedBy?: number) => {
      try {
        Logger.info(`IPC: update-table-status called for table ${id}`);
        const table = await tableService!.updateTableStatus(
          id,
          data,
          performedBy
        );
        return { success: true, data: table };
      } catch (error) {
        Logger.error(`IPC update-table-status error:`, error);
        return { success: false, error: String(error) };
      }
    }
  );

  Logger.info("IPC handlers initialized successfully");
}

app.whenReady().then(() => {
  try {
    const dbInitialized = initializeDatabase();
    if (!dbInitialized) {
      throw new Error("Failed to initialize database");
    }

    initializeIpcHandlers();
    createWindow();

    app.on("activate", () => {
      if (mainWindow === null) {
        createWindow();
      }
    });
  } catch (error) {
    Logger.error("Failed to initialize application:", error);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("quit", () => {
  if (database) {
    try {
      database.close();
    } catch (error) {
      Logger.error("Error closing database on quit:", error);
    }
  }
});
