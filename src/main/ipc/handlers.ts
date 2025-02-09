import { ipcMain } from "electron";
import { DatabaseService } from "../../backend/database/DatabaseService";
import { ArduinoService } from "../../backend/arduino/ArduinoService";
import { PrayerService } from "../../backend/prayer/PrayerService";
import { IpcChannels } from "../../shared/types/ipc";
import { UserRole } from "@/shared/types/entities";

export function registerIpcHandlers(
  db: DatabaseService,
  arduino: ArduinoService,
  prayer: PrayerService
) {
  // User Management
  ipcMain.handle(
    IpcChannels.USER_LOGIN,
    async (_event, username: string, password: string) => {
      return await db.verifyUser(username, password);
    }
  );

  ipcMain.handle(
    IpcChannels.USER_CREATE,
    async (
      _event,
      userData: {
        username: string;
        password: string;
        role: UserRole;
      }
    ) => {
      return await db.createUser(
        userData.username,
        userData.password,
        userData.role
      );
    }
  );

  // Table Management
  ipcMain.handle(
    IpcChannels.TABLE_START,
    async (
      _event,
      {
        tableId,
        staffId,
        customerId,
      }: {
        tableId: number;
        staffId: number;
        customerId?: number;
      }
    ) => {
      if (prayer.isInPrayerTime() && !(await db.isUserManager(staffId))) {
        throw new Error("Cannot start table during prayer time");
      }

      const sessionId = await db.startSession(tableId, staffId, customerId);
      await arduino.toggleTable(tableId, true);
      return sessionId;
    }
  );

  ipcMain.handle(
    IpcChannels.TABLE_END,
    async (
      _event,
      {
        sessionId,
        tableId,
        staffId,
      }: {
        sessionId: number;
        tableId: number;
        staffId: number;
      }
    ) => {
      await db.endSession(sessionId, staffId);
      await arduino.toggleTable(tableId, false);
    }
  );

  // Prayer Time Management
  ipcMain.handle(IpcChannels.PRAYER_NEXT, () => {
    return prayer.getNextPrayer();
  });

  ipcMain.handle(IpcChannels.PRAYER_STATUS, () => {
    return prayer.isInPrayerTime();
  });

  // Reservations
  ipcMain.handle(
    IpcChannels.RESERVATION_CREATE,
    async (
      _event,
      {
        tableId,
        customerId,
        staffId,
        time,
      }: {
        tableId: number;
        customerId: number;
        staffId: number;
        time: Date;
      }
    ) => {
      return await db.createReservation(tableId, customerId, staffId, time);
    }
  );
}
