import { ipcMain } from "electron";
import { DatabaseService } from "../../backend/database/DatabaseService";
import { ArduinoService } from "../../backend/arduino/ArduinoService";
import { PrayerService } from "../../backend/database/PrayerService";
import { IpcChannels } from "../../shared/types/ipc";
import { ValidationError } from "../../shared/types/errors";
import { PoolTable, UserRole } from "@/shared/types/entities";

export function registerIpcHandlers(
  db: DatabaseService,
  arduino: ArduinoService,
  prayer: PrayerService
) {
  // User Management
  ipcMain.handle(
    IpcChannels.USER_LOGIN,
    async (_event, username: string, password: string) => {
      return await db.userService.verifyUser(username, password);
    }
  );

  ipcMain.handle(
    IpcChannels.USER_CREATE,
    async (
      _event,
      data: { username: string; password: string; role: string }
    ) => {
      // Validate role
      if (!isValidUserRole(data.role)) {
        throw new ValidationError("Invalid user role");
      }
      return await db.userService.createUser(
        data.username,
        data.password,
        data.role
      );
    }
  );

  // Table Management
  ipcMain.handle(IpcChannels.TABLE_GET_ALL, async () => {
    return await db.tableService.getAllTables();
  });

  ipcMain.handle(
    IpcChannels.TABLE_UPDATE_STATUS,
    async (
      _event,
      {
        tableId,
        status,
        staffId,
      }: { tableId: number; status: string; staffId: number }
    ) => {
      // Validate status
      if (!isValidTableStatus(status)) {
        throw new ValidationError("Invalid table status");
      }
      return await db.tableService.updateTableStatus(tableId, status, staffId);
    }
  );

  ipcMain.handle(
    IpcChannels.TABLE_MAINTENANCE,
    async (
      _event,
      {
        tableId,
        staffId,
        notes,
      }: { tableId: number; staffId: number; notes: string }
    ) => {
      return await db.tableService.recordMaintenance(tableId, staffId, notes);
    }
  );

  // Session Management
  ipcMain.handle(
    IpcChannels.SESSION_START,
    async (
      _event,
      {
        tableId,
        staffId,
        customerId,
      }: { tableId: number; staffId: number; customerId?: number }
    ) => {
      if (
        prayer.isInPrayerTime() &&
        !(await db.userService.isUserManager(staffId))
      ) {
        throw new ValidationError("Cannot start session during prayer time");
      }
      const sessionId = await db.sessionService.startSession(
        tableId,
        staffId,
        customerId
      );
      await arduino.toggleTable(tableId, true);
      return sessionId;
    }
  );

  ipcMain.handle(
    IpcChannels.SESSION_END,
    async (
      _event,
      { sessionId, staffId }: { sessionId: number; staffId: number }
    ) => {
      const session = await db.sessionService.getSessionById(sessionId);
      if (!session) throw new ValidationError("Session not found");

      await db.sessionService.endSession(sessionId, staffId);
      await arduino.toggleTable(session.tableId, false);
      return session;
    }
  );

  // Reservation Management
  ipcMain.handle(
    IpcChannels.RESERVATION_CREATE,
    async (
      _event,
      data: {
        tableId: number;
        customerId: number;
        staffId: number;
        time: string;
      }
    ) => {
      return await db.reservationService.createReservation(
        data.tableId,
        data.customerId,
        data.staffId,
        new Date(data.time)
      );
    }
  );

  ipcMain.handle(
    IpcChannels.RESERVATION_CONFIRM,
    async (
      _event,
      { reservationId, staffId }: { reservationId: number; staffId: number }
    ) => {
      return await db.reservationService.confirmReservation(
        reservationId,
        staffId
      );
    }
  );

  // Prayer Time Management
  ipcMain.handle(IpcChannels.PRAYER_GET_NEXT, async () => {
    return prayer.getNextPrayer();
  });

  ipcMain.handle(IpcChannels.PRAYER_CHECK_TIME, async () => {
    return prayer.isInPrayerTime();
  });

  // System Status
  ipcMain.handle(IpcChannels.SYSTEM_STATUS, async () => {
    return {
      arduino: arduino.isConnected(),
      database: true, // Database connection is mandatory
      prayerService: true,
    };
  });

  function isValidUserRole(role: string): role is UserRole {
    return ["manager", "staff", "customer"].includes(role);
  }

  function isValidTableStatus(status: string): status is PoolTable["status"] {
    return ["available", "occupied", "maintenance"].includes(status);
  }
}
