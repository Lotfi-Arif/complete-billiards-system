import Database from "better-sqlite3";
import { BaseService } from "./BaseService";
import { Reservation } from "../../shared/types/entities";
import { ReservationRecord } from "../../shared/types/database";
import { DatabaseError, ValidationError } from "../../shared/types/errors";
import { PrayerService } from "../prayer/PrayerService";

export class ReservationService extends BaseService {
  private prayerService?: PrayerService;
  private readonly MIN_ADVANCE_TIME = 30; // minutes
  private readonly MAX_ADVANCE_DAYS = 7; // days
  private readonly RESERVATION_DURATION = 120; // minutes

  constructor(db: Database.Database, prayerService?: PrayerService) {
    super(db);
    this.prayerService = prayerService;
  }

  async createReservation(
    tableId: number,
    customerId: number,
    staffId: number,
    reservationTime: Date
  ): Promise<number> {
    try {
      return this.db.transaction(() => {
        // Validate reservation time
        this.validateReservationTime(reservationTime);

        // Check if table exists and is available for reservation
        const tableStatus = this.prepareStatement<[number], { status: string }>(
          "SELECT status FROM pool_tables WHERE id = ?"
        ).get(tableId);

        if (!tableStatus) {
          throw new ValidationError("Table not found");
        }

        // Check for conflicting reservations
        const hasConflict = this.checkTimeConflict(tableId, reservationTime);
        if (hasConflict) {
          throw new ValidationError(
            "Table already reserved for this time slot"
          );
        }

        // Create reservation
        const result = this.prepareStatement<
          [number, number, number, string],
          ReservationRecord
        >(
          `INSERT INTO reservations (
            table_id, customer_id, staff_id, reservation_time, status
          ) VALUES (?, ?, ?, ?, 'pending')`
        ).run(tableId, customerId, staffId, reservationTime.toISOString());

        const reservationId = Number(result.lastInsertRowid);

        this.logActivity("reservation", reservationId, "created", staffId, {
          tableId,
          customerId,
          reservationTime: reservationTime.toISOString(),
        });

        return reservationId;
      })();
    } catch (error) {
      throw new DatabaseError("Failed to create reservation", { error });
    }
  }

  async confirmReservation(
    reservationId: number,
    staffId: number
  ): Promise<void> {
    try {
      const result = this.prepareStatement<[number], void>(
        "UPDATE reservations SET status = 'confirmed' WHERE id = ?"
      ).run(reservationId);

      if (result.changes === 0) {
        throw new ValidationError("Reservation not found");
      }

      this.logActivity("reservation", reservationId, "confirmed", staffId);
    } catch (error) {
      throw new DatabaseError("Failed to confirm reservation", { error });
    }
  }

  async cancelReservation(
    reservationId: number,
    staffId: number,
    reason?: string
  ): Promise<void> {
    try {
      const result = this.prepareStatement<[number], void>(
        "UPDATE reservations SET status = 'cancelled' WHERE id = ?"
      ).run(reservationId);

      if (result.changes === 0) {
        throw new ValidationError("Reservation not found");
      }

      this.logActivity("reservation", reservationId, "cancelled", staffId, {
        reason,
      });
    } catch (error) {
      throw new DatabaseError("Failed to cancel reservation", { error });
    }
  }

  async getReservation(reservationId: number): Promise<Reservation | null> {
    try {
      const record = this.prepareStatement<[number], ReservationRecord>(
        `SELECT 
          r.*,
          c.username as customer_name,
          s.username as staff_name
        FROM reservations r
        JOIN users c ON r.customer_id = c.id
        JOIN users s ON r.staff_id = s.id
        WHERE r.id = ?`
      ).get(reservationId);

      return record ? this.mapReservationRecord(record) : null;
    } catch (error) {
      throw new DatabaseError("Failed to get reservation", { error });
    }
  }

  async getTableReservations(
    tableId: number,
    startDate: Date,
    endDate: Date
  ): Promise<Reservation[]> {
    try {
      const records = this.prepareStatement<
        [number, string, string],
        ReservationRecord
      >(
        `SELECT 
          r.*,
          c.username as customer_name,
          s.username as staff_name
        FROM reservations r
        JOIN users c ON r.customer_id = c.id
        JOIN users s ON r.staff_id = s.id
        WHERE r.table_id = ?
        AND r.reservation_time BETWEEN ? AND ?
        AND r.status IN ('pending', 'confirmed')
        ORDER BY r.reservation_time ASC`
      ).all(tableId, startDate.toISOString(), endDate.toISOString());

      return records.map(this.mapReservationRecord);
    } catch (error) {
      throw new DatabaseError("Failed to get table reservations", { error });
    }
  }

  async getCustomerReservations(customerId: number): Promise<Reservation[]> {
    try {
      const records = this.prepareStatement<[number], ReservationRecord>(
        `SELECT 
          r.*,
          c.username as customer_name,
          s.username as staff_name
        FROM reservations r
        JOIN users c ON r.customer_id = c.id
        JOIN users s ON r.staff_id = s.id
        WHERE r.customer_id = ?
        AND r.status IN ('pending', 'confirmed')
        ORDER BY r.reservation_time ASC`
      ).all(customerId);

      return records.map(this.mapReservationRecord);
    } catch (error) {
      throw new DatabaseError("Failed to get customer reservations", { error });
    }
  }

  private validateReservationTime(reservationTime: Date): void {
    const now = new Date();
    const minutesUntilReservation =
      (reservationTime.getTime() - now.getTime()) / (1000 * 60);
    const daysUntilReservation = minutesUntilReservation / (24 * 60);

    // Check minimum advance time
    if (minutesUntilReservation < this.MIN_ADVANCE_TIME) {
      throw new ValidationError(
        `Reservations must be made at least ${this.MIN_ADVANCE_TIME} minutes in advance`
      );
    }

    // Check maximum advance time
    if (daysUntilReservation > this.MAX_ADVANCE_DAYS) {
      throw new ValidationError(
        `Reservations cannot be made more than ${this.MAX_ADVANCE_DAYS} days in advance`
      );
    }

    // Check prayer time conflicts
    if (this.prayerService?.isInPrayerTime(reservationTime)) {
      throw new ValidationError("Cannot make reservations during prayer times");
    }
  }

  private checkTimeConflict(tableId: number, reservationTime: Date): boolean {
    const reservationEnd = new Date(
      reservationTime.getTime() + this.RESERVATION_DURATION * 60 * 1000
    );

    const conflictingReservation = this.prepareStatement<
      [number, string, string, string],
      { id: number }
    >(
      `SELECT id 
       FROM reservations 
       WHERE table_id = ? 
       AND reservation_time < ? 
       AND datetime(reservation_time, '+' || ? || ' minutes') > ?
       AND status IN ('pending', 'confirmed')`
    ).get(
      tableId,
      reservationEnd.toISOString(),
      this.RESERVATION_DURATION.toString(),
      reservationTime.toISOString()
    );

    return !!conflictingReservation;
  }

  private mapReservationRecord(record: ReservationRecord): Reservation {
    return {
      id: record.id,
      tableId: record.table_id,
      customerId: record.customer_id,
      staffId: record.staff_id,
      reservationTime: new Date(record.reservation_time),
      status: record.status,
      customerName: record.customer_name,
      staffName: record.staff_name,
    };
  }
}
