import { ipcMain } from "electron";
import { TableService } from "../../backend/database/TableService";
import { TableStatus, UpdateTableDTO } from "../../shared/types/Table";
import Logger from "../../shared/logger";
import Database from "better-sqlite3";

export function initializeTableHandlers(database: Database.Database) {
  const tableService = new TableService(database);

  // Get all tables
  ipcMain.handle("get-tables", async () => {
    try {
      Logger.info("IPC: get-tables called");
      const tables = await tableService.getAllTables();
      return { success: true, data: tables };
    } catch (error) {
      Logger.error("IPC get-tables error:", error);
      return { success: false, error: error.message };
    }
  });

  // Get single table
  ipcMain.handle("get-table", async (event, id: number) => {
    try {
      Logger.info(`IPC: get-table called for id ${id}`);
      const table = await tableService.getTableById(id);
      return { success: true, data: table };
    } catch (error) {
      Logger.error(`IPC get-table error for id ${id}:`, error);
      return { success: false, error: error.message };
    }
  });

  // Update table status
  ipcMain.handle(
    "update-table-status",
    async (event, id: number, data: UpdateTableDTO, performedBy?: number) => {
      try {
        Logger.info(`IPC: update-table-status called for table ${id}`);
        const updatedTable = await tableService.updateTableStatus(
          id,
          data,
          performedBy
        );
        return { success: true, data: updatedTable };
      } catch (error) {
        Logger.error(`IPC update-table-status error for table ${id}:`, error);
        return { success: false, error: error.message };
      }
    }
  );

  // Open table (set to IN_USE)
  ipcMain.handle(
    "open-table",
    async (event, id: number, performedBy?: number) => {
      try {
        Logger.info(`IPC: open-table called for table ${id}`);
        const updatedTable = await tableService.updateTableStatus(
          id,
          { status: TableStatus.IN_USE },
          performedBy
        );
        return { success: true, data: updatedTable };
      } catch (error) {
        Logger.error(`IPC open-table error for table ${id}:`, error);
        return { success: false, error: error.message };
      }
    }
  );

  // Close table (set to AVAILABLE)
  ipcMain.handle(
    "close-table",
    async (event, id: number, performedBy?: number) => {
      try {
        Logger.info(`IPC: close-table called for table ${id}`);
        const updatedTable = await tableService.updateTableStatus(
          id,
          { status: TableStatus.AVAILABLE },
          performedBy
        );
        return { success: true, data: updatedTable };
      } catch (error) {
        Logger.error(`IPC close-table error for table ${id}:`, error);
        return { success: false, error: error.message };
      }
    }
  );

  // Set table to maintenance mode
  ipcMain.handle(
    "set-table-maintenance",
    async (event, id: number, performedBy?: number) => {
      try {
        Logger.info(`IPC: set-table-maintenance called for table ${id}`);
        const updatedTable = await tableService.updateTableStatus(
          id,
          {
            status: TableStatus.MAINTENANCE,
            lastMaintenance: new Date(),
          },
          performedBy
        );
        return { success: true, data: updatedTable };
      } catch (error) {
        Logger.error(`IPC set-table-maintenance error for table ${id}:`, error);
        return { success: false, error: error.message };
      }
    }
  );

  // Set table to cooldown mode
  ipcMain.handle(
    "set-table-cooldown",
    async (event, id: number, performedBy?: number) => {
      try {
        Logger.info(`IPC: set-table-cooldown called for table ${id}`);
        const updatedTable = await tableService.setTableCooldown(
          id,
          performedBy
        );
        return { success: true, data: updatedTable };
      } catch (error) {
        Logger.error(`IPC set-table-cooldown error for table ${id}:`, error);
        return { success: false, error: error.message };
      }
    }
  );

  // Check table availability
  ipcMain.handle("is-table-available", async (event, id: number) => {
    try {
      Logger.info(`IPC: is-table-available called for table ${id}`);
      const isAvailable = await tableService.isTableAvailable(id);
      return { success: true, data: isAvailable };
    } catch (error) {
      Logger.error(`IPC is-table-available error for table ${id}:`, error);
      return { success: false, error: error.message };
    }
  });
}
