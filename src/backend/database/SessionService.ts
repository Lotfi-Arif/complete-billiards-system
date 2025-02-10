import Database from "better-sqlite3";
import { BaseService } from "./BaseService";
import { Session } from "../../shared/types/entities";
import { SessionRecord } from "../../shared/types/database";
import { DatabaseError, ValidationError } from "../../shared/types/errors";
import { PrayerService } from "../prayer/PrayerService";

export class SessionService extends BaseService {
  private readonly HOURLY_RATE = 30; // $30 per hour
  private readonly MIN_SESSION_DURATION = 30; // 30 minutes
  private prayerService?: PrayerService;

  constructor(db: Database.Database, prayerService?: PrayerService) {
    super(db);
    this.prayerService = prayerService;
  }

  async startSession(
    tableId: number,
    staffId: number,
    customerId?: number
  ): Promise<number> {
    try {
      return this.db.transaction(() => {
        // Check if table exists and is available
        const tableStatus = this.prepareStatement<[number], { status: string }>(
          "SELECT status FROM pool_tables WHERE id = ?"
        ).get(tableId);

        if (!tableStatus) {
          throw new ValidationError("Table not found");
        }

        if (tableStatus.status !== "available") {
          throw new ValidationError("Table is not available");
        }

        // Check prayer time restrictions
        if (this.prayerService?.isInPrayerTime()) {
          throw new ValidationError("Cannot start session during prayer time");
        }

        // Start new session
        const result = this.prepareStatement<
          [number, number, number | null],
          SessionRecord
        >(
          `INSERT INTO sessions (
            table_id, 
            staff_id, 
            customer_id, 
            start_time,
            status
          ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'active')`
        ).run(tableId, staffId, customerId || null);

        const sessionId = Number(result.lastInsertRowid);

        // Update table status and link session
        this.prepareStatement<[number, number], void>(
          `UPDATE pool_tables 
           SET status = 'occupied', current_session_id = ? 
           WHERE id = ?`
        ).run(sessionId, tableId);

        this.logActivity("session", sessionId, "started", staffId, {
          tableId,
          customerId,
        });

        return sessionId;
      })();
    } catch (error) {
      throw new DatabaseError("Failed to start session", { error });
    }
  }

  async endSession(sessionId: number, staffId: number): Promise<void> {
    try {
      await this.db.transaction(() => {
        // Get session details
        const session = this.prepareStatement<[number], SessionRecord>(
          `SELECT s.*, t.id as table_id 
           FROM sessions s
           JOIN pool_tables t ON s.table_id = t.id
           WHERE s.id = ?`
        ).get(sessionId);

        if (!session) {
          throw new ValidationError("Session not found");
        }

        if (session.status !== "active") {
          throw new ValidationError("Session is not active");
        }

        // Calculate duration and amount
        const startTime = new Date(session.start_time);
        const endTime = new Date();
        const durationMinutes = Math.ceil(
          (endTime.getTime() - startTime.getTime()) / (1000 * 60)
        );

        if (durationMinutes < this.MIN_SESSION_DURATION) {
          throw new ValidationError(
            `Session must be at least ${this.MIN_SESSION_DURATION} minutes`
          );
        }

        const amount = this.calculateSessionAmount(durationMinutes);

        // Update session
        this.prepareStatement<[string, number, number, number], void>(
          `UPDATE sessions 
           SET status = ?, end_time = CURRENT_TIMESTAMP, duration = ?, amount = ?
           WHERE id = ?`
        ).run("completed", durationMinutes, amount, sessionId);

        // Update table status
        this.prepareStatement<[number], void>(
          `UPDATE pool_tables 
           SET status = 'available', current_session_id = NULL 
           WHERE id = ?`
        ).run(session.table_id);

        this.logActivity("session", sessionId, "completed", staffId, {
          duration: durationMinutes,
          amount,
        });
      })();
    } catch (error) {
      throw new DatabaseError("Failed to end session", { error });
    }
  }

  async getActiveSession(tableId: number): Promise<Session | null> {
    try {
      const record = this.prepareStatement<
        [number],
        SessionRecord & { staff_name?: string; customer_name?: string }
      >(
        `SELECT 
          s.*,
          u.username as staff_name,
          c.username as customer_name
         FROM sessions s
         JOIN users u ON s.staff_id = u.id
         LEFT JOIN users c ON s.customer_id = c.id
         WHERE s.table_id = ? AND s.status = 'active'`
      ).get(tableId);

      if (!record) return null;

      return this.mapSessionRecord(record);
    } catch (error) {
      throw new DatabaseError("Failed to get active session", { error });
    }
  }

  async getSessionById(sessionId: number): Promise<Session | null> {
    try {
      const record = this.prepareStatement<
        [number],
        SessionRecord & { staff_name?: string; customer_name?: string }
      >(
        `SELECT 
          s.*,
          u.username as staff_name,
          c.username as customer_name
         FROM sessions s
         JOIN users u ON s.staff_id = u.id
         LEFT JOIN users c ON s.customer_id = c.id
         WHERE s.id = ?`
      ).get(sessionId);

      if (!record) return null;

      return this.mapSessionRecord(record);
    } catch (error) {
      throw new DatabaseError("Failed to get session", { error });
    }
  }

  async getSessionsByCustomer(
    customerId: number,
    limit: number = 10
  ): Promise<Session[]> {
    try {
      const records = this.prepareStatement<
        [number, number],
        SessionRecord & { staff_name?: string; customer_name?: string }
      >(
        `SELECT 
          s.*,
          u.username as staff_name,
          c.username as customer_name
         FROM sessions s
         JOIN users u ON s.staff_id = u.id
         LEFT JOIN users c ON s.customer_id = c.id
         WHERE s.customer_id = ?
         ORDER BY s.start_time DESC
         LIMIT ?`
      ).all(customerId, limit);

      return records.map(this.mapSessionRecord);
    } catch (error) {
      throw new DatabaseError("Failed to get customer sessions", { error });
    }
  }

  async cancelSession(
    sessionId: number,
    staffId: number,
    reason?: string
  ): Promise<void> {
    try {
      await this.db.transaction(() => {
        const session = this.prepareStatement<[number], SessionRecord>(
          "SELECT * FROM sessions WHERE id = ?"
        ).get(sessionId);

        if (!session) {
          throw new ValidationError("Session not found");
        }

        if (session.status !== "active") {
          throw new ValidationError("Session is not active");
        }

        // Update session status
        this.prepareStatement<[number], void>(
          "UPDATE sessions SET status = 'cancelled', end_time = CURRENT_TIMESTAMP WHERE id = ?"
        ).run(sessionId);

        // Update table status
        this.prepareStatement<[number], void>(
          "UPDATE pool_tables SET status = 'available', current_session_id = NULL WHERE id = ?"
        ).run(session.table_id);

        this.logActivity("session", sessionId, "cancelled", staffId, {
          reason,
        });
      })();
    } catch (error) {
      throw new DatabaseError("Failed to cancel session", { error });
    }
  }

  private calculateSessionAmount(durationMinutes: number): number {
    // Round up to nearest 30 minutes
    const billableHours = Math.ceil(durationMinutes / 30) * 0.5;
    return billableHours * this.HOURLY_RATE;
  }

  private mapSessionRecord(
    record: SessionRecord & { staff_name?: string; customer_name?: string }
  ): Session {
    return {
      id: record.id,
      tableId: record.table_id,
      staffId: record.staff_id,
      customerId: record.customer_id || undefined,
      startTime: new Date(record.start_time),
      endTime: record.end_time ? new Date(record.end_time) : undefined,
      duration: record.duration || undefined,
      amount: record.amount || undefined,
      status: record.status,
      staffName: record.staff_name,
      customerName: record.customer_name,
    };
  }
}
