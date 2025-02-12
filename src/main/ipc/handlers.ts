import { ipcMain } from "electron";
import Logger from "@/shared/logger";
import { ReservationService } from "@/backend/database/ReservationService";
import { TableService } from "@/backend/database/TableService";
import { SessionService } from "@/backend/database/SessionService";
import { UserService } from "@/backend/database/UserService";
import { PrayerService } from "@/backend/database/PrayerService";
import { PaymentService } from "@/backend/database/PaymentService";
import { PoolTableControlService } from "@/backend/database/PoolTableControlService";
import { ArduinoControlService } from "@/backend/database/ArduinoControlService";
import Database from "better-sqlite3";
import { TableStatus } from "@/shared/types/Table";

export function initializeHandlers(database: Database.Database) {
  // You can load configuration from environment variables or config files.
  const jwtSecret = process.env.JWT_SECRET || "YOUR_SECRET";

  // Instantiate service instances.
  const reservationService = new ReservationService(database);
  const tableService = new TableService(database);
  const sessionService = new SessionService(database);
  const userService = new UserService(database, jwtSecret);
  const prayerService = new PrayerService();
  const paymentService = new PaymentService(database);
  const arduinoControlService = new ArduinoControlService();
  const poolTableControlService = new PoolTableControlService(
    tableService,
    arduinoControlService
  );

  // ----- IPC Handlers -----

  // Reservation endpoints
  ipcMain.handle("create-reservation", async (event, data) => {
    try {
      Logger.info("IPC: create-reservation called");
      const reservation = await reservationService.createReservation(data);
      return { success: true, data: reservation };
    } catch (error) {
      Logger.error("IPC create-reservation error: " + error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("cancel-reservation", async (event, id: number) => {
    try {
      Logger.info(`IPC: cancel-reservation for id ${id}`);
      const reservation = await reservationService.cancelReservation(id);
      return { success: true, data: reservation };
    } catch (error) {
      Logger.error("IPC cancel-reservation error: " + error);
      return { success: false, error: error.message };
    }
  });

  // Session endpoints
  ipcMain.handle("start-session", async (event, data) => {
    try {
      Logger.info("IPC: start-session called");
      const session = await sessionService.startSession(data);
      return { success: true, data: session };
    } catch (error) {
      Logger.error("IPC start-session error: " + error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("end-session", async (event, id: number, data: any) => {
    try {
      Logger.info(`IPC: end-session for id ${id}`);
      const session = await sessionService.endSession(id, data);
      return { success: true, data: session };
    } catch (error) {
      Logger.error("IPC end-session error: " + error);
      return { success: false, error: error.message };
    }
  });

  // User endpoints
  ipcMain.handle(
    "authenticate-user",
    async (event, username: string, password: string) => {
      try {
        Logger.info(`IPC: authenticate-user for ${username}`);
        const token = await userService.authenticate(username, password);
        return { success: true, data: token };
      } catch (error) {
        Logger.error("IPC authenticate-user error: " + error);
        return { success: false, error: error.message };
      }
    }
  );

  ipcMain.handle("create-user", async (event, userData: any) => {
    try {
      Logger.info("IPC: create-user called");
      const user = await userService.createUser(userData);
      return { success: true, data: user };
    } catch (error) {
      Logger.error("IPC create-user error: " + error);
      return { success: false, error: error.message };
    }
  });

  // Prayer endpoints
  ipcMain.handle("get-prayer-times", async (event, dateStr: string) => {
    try {
      Logger.info("IPC: get-prayer-times called");
      const date = new Date(dateStr);
      const prayerTimes = prayerService.getPrayerTimes(date);
      return { success: true, data: prayerTimes };
    } catch (error) {
      Logger.error("IPC get-prayer-times error: " + error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("get-next-prayer", async (event, dateStr: string) => {
    try {
      Logger.info("IPC: get-next-prayer called");
      const date = new Date(dateStr);
      const nextPrayer = await prayerService.getNextPrayer(date);
      return { success: true, data: nextPrayer };
    } catch (error) {
      Logger.error("IPC get-next-prayer error: " + error);
      return { success: false, error: error.message };
    }
  });

  // Table and Pool Table Control endpoints
  ipcMain.handle(
    "update-table-status",
    async (
      event,
      tableId: number,
      status: TableStatus | undefined,
      performedBy: number
    ) => {
      try {
        Logger.info(
          `IPC: update-table-status for table ${tableId} to ${status}`
        );
        const updatedTable = await tableService.updateTableStatus(
          tableId,
          { status },
          performedBy
        );
        return { success: true, data: updatedTable };
      } catch (error) {
        Logger.error("IPC update-table-status error: " + error);
        return { success: false, error: error.message };
      }
    }
  );

  ipcMain.handle("open-table", async (event, tableId: number) => {
    try {
      Logger.info(`IPC: open-table for table ${tableId}`);
      await poolTableControlService.openTable(tableId);
      return { success: true };
    } catch (error) {
      Logger.error("IPC open-table error: " + error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("close-table", async (event, tableId: number) => {
    try {
      Logger.info(`IPC: close-table for table ${tableId}`);
      await poolTableControlService.closeTable(tableId);
      return { success: true };
    } catch (error) {
      Logger.error("IPC close-table error: " + error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(
    "set-table-cooldown",
    async (event, tableId: number, cooldownMinutes: number) => {
      try {
        Logger.info(
          `IPC: set-table-cooldown for table ${tableId} for ${cooldownMinutes} minutes`
        );
        await poolTableControlService.setTableCooldown(
          tableId,
          cooldownMinutes
        );
        return { success: true };
      } catch (error) {
        Logger.error("IPC set-table-cooldown error: " + error);
        return { success: false, error: error.message };
      }
    }
  );

  // Payment endpoints
  ipcMain.handle("create-payment", async (event, data: any) => {
    try {
      Logger.info("IPC: create-payment called");
      const payment = await paymentService.createPayment(data);
      return { success: true, data: payment };
    } catch (error) {
      Logger.error("IPC create-payment error: " + error);
      return { success: false, error: error.message };
    }
  });
}
