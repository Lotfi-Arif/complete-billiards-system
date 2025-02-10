// src/backend/database/ReservationService.ts
import { Database } from "better-sqlite3";
import { BaseService } from "./BaseService";
import {
  Reservation,
  ReservationStatus,
  CreateReservationDTO,
  UpdateReservationDTO,
} from "@/shared/types/Reservation";
import {
  DatabaseError,
  NotFoundError,
  BusinessError,
} from "@/shared/types/errors";
import { TableService } from "./TableService";
import { PrayerService } from "../prayer/PrayerService";

export class ReservationService extends BaseService {
  private tableService: TableService;
  private prayerService: PrayerService;

  constructor(db: Database) {
    super(db);
    this.tableService = new TableService(db);
    this.prayerService = new PrayerService();
    this.initializeTable();
  }

  private initializeTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tableId INTEGER NOT NULL,
        customerId INTEGER NOT NULL,
        startTime DATETIME NOT NULL,
        endTime DATETIME NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        notes TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tableId) REFERENCES tables(id),
        FOREIGN KEY (customerId) REFERENCES users(id)
      )
    `);
  }

  private async validateReservationTime(
    data: CreateReservationDTO
  ): Promise<void> {
    const now = new Date();
    const minAdvanceTime = 30; // minutes
    const maxAdvanceDays = 7; // days

    // Check minimum advance time
    const minutesToStart =
      (data.startTime.getTime() - now.getTime()) / (1000 * 60);
    if (minutesToStart < minAdvanceTime) {
      throw new BusinessError(
        `Reservations must be made at least ${minAdvanceTime} minutes in advance`
      );
    }

    // Check maximum advance time
    const daysInAdvance =
      (data.startTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysInAdvance > maxAdvanceDays) {
      throw new BusinessError(
        `Reservations cannot be made more than ${maxAdvanceDays} days in advance`
      );
    }

    // Check prayer times
    if (
      (await this.prayerService.isInPrayerTime(data.startTime)) ||
      (await this.prayerService.isInPrayerTime(data.endTime))
    ) {
      throw new BusinessError("Cannot make reservations during prayer times");
    }

    // Check table exists
    await this.tableService.getTableById(data.tableId);
  }

  private async checkTimeConflict(
    data: CreateReservationDTO,
    excludeReservationId?: number
  ): Promise<void> {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM reservations 
      WHERE tableId = ? 
      AND status IN ('PENDING', 'CONFIRMED')
      AND id != COALESCE(?, -1)
      AND (
        (startTime <= ? AND endTime > ?) OR
        (startTime < ? AND endTime >= ?) OR
        (startTime >= ? AND endTime <= ?)
      )
    `);

    const result = stmt.get(
      data.tableId,
      excludeReservationId,
      data.endTime.toISOString(),
      data.startTime.toISOString(),
      data.endTime.toISOString(),
      data.startTime.toISOString(),
      data.startTime.toISOString(),
      data.endTime.toISOString()
    ) as { count: number };

    if (result.count > 0) {
      throw new BusinessError("Time slot conflicts with existing reservation");
    }
  }

  async createReservation(data: CreateReservationDTO): Promise<Reservation> {
    try {
      await this.validateReservationTime(data);
      await this.checkTimeConflict(data);

      const stmt = this.db.prepare(`
        INSERT INTO reservations (
          tableId,
          customerId,
          startTime,
          endTime,
          notes,
          status
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = this.transaction(() => {
        return stmt.run(
          data.tableId,
          data.customerId,
          data.startTime.toISOString(),
          data.endTime.toISOString(),
          data.notes || null,
          ReservationStatus.PENDING
        );
      });

      if (!result.lastInsertRowid) {
        throw new DatabaseError("Failed to create reservation");
      }

      return this.getReservationById(Number(result.lastInsertRowid));
    } catch (error) {
      if (error instanceof BusinessError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError("Failed to create reservation", { error });
    }
  }

  async confirmReservation(id: number): Promise<Reservation> {
    try {
      const reservation = await this.getReservationById(id);

      if (reservation.status !== ReservationStatus.PENDING) {
        throw new BusinessError(`Reservation ${id} is not in pending status`);
      }

      // Recheck conflicts before confirming
      await this.checkTimeConflict(
        {
          tableId: reservation.tableId,
          customerId: reservation.customerId,
          startTime: reservation.startTime,
          endTime: reservation.endTime,
        },
        id
      );

      const stmt = this.db.prepare(`
        UPDATE reservations
        SET status = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      const result = this.transaction(() => {
        return stmt.run(ReservationStatus.CONFIRMED, id);
      });

      if (result.changes === 0) {
        throw new NotFoundError(`Reservation with id ${id} not found`);
      }

      return this.getReservationById(id);
    } catch (error) {
      if (error instanceof BusinessError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError("Failed to confirm reservation", { error });
    }
  }

  async cancelReservation(id: number): Promise<Reservation> {
    try {
      const reservation = await this.getReservationById(id);

      if (
        ![ReservationStatus.PENDING, ReservationStatus.CONFIRMED].includes(
          reservation.status
        )
      ) {
        throw new BusinessError(`Reservation ${id} cannot be cancelled`);
      }

      const stmt = this.db.prepare(`
        UPDATE reservations
        SET status = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      const result = this.transaction(() => {
        return stmt.run(ReservationStatus.CANCELLED, id);
      });

      if (result.changes === 0) {
        throw new NotFoundError(`Reservation with id ${id} not found`);
      }

      return this.getReservationById(id);
    } catch (error) {
      if (error instanceof BusinessError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError("Failed to cancel reservation", { error });
    }
  }

  async getReservationById(id: number): Promise<Reservation> {
    const stmt = this.db.prepare("SELECT * FROM reservations WHERE id = ?");
    const reservation = stmt.get(id) as Reservation | undefined;

    if (!reservation) {
      throw new NotFoundError(`Reservation with id ${id} not found`);
    }

    return {
      ...reservation,
      startTime: new Date(reservation.startTime),
      endTime: new Date(reservation.endTime),
      createdAt: new Date(reservation.createdAt),
      updatedAt: new Date(reservation.updatedAt),
    };
  }

  async getTableReservations(tableId: number): Promise<Reservation[]> {
    const stmt = this.db.prepare(
      "SELECT * FROM reservations WHERE tableId = ?"
    );
    const reservations = stmt.all(tableId) as Reservation[];

    return reservations.map((reservation) => ({
      ...reservation,
      startTime: new Date(reservation.startTime),
      endTime: new Date(reservation.endTime),
      createdAt: new Date(reservation.createdAt),
      updatedAt: new Date(reservation.updatedAt),
    }));
  }

  async getCustomerReservations(customerId: number): Promise<Reservation[]> {
    const stmt = this.db.prepare(
      "SELECT * FROM reservations WHERE customerId = ?"
    );
    const reservations = stmt.all(customerId) as Reservation[];

    return reservations.map((reservation) => ({
      ...reservation,
      startTime: new Date(reservation.startTime),
      endTime: new Date(reservation.endTime),
      createdAt: new Date(reservation.createdAt),
      updatedAt: new Date(reservation.updatedAt),
    }));
  }

  async getActiveReservations(): Promise<Reservation[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM reservations 
      WHERE status IN (?, ?) 
      AND endTime > CURRENT_TIMESTAMP
      ORDER BY startTime ASC
    `);

    const reservations = stmt.all(
      ReservationStatus.PENDING,
      ReservationStatus.CONFIRMED
    ) as Reservation[];

    return reservations.map((reservation) => ({
      ...reservation,
      startTime: new Date(reservation.startTime),
      endTime: new Date(reservation.endTime),
      createdAt: new Date(reservation.createdAt),
      updatedAt: new Date(reservation.updatedAt),
    }));
  }
}
