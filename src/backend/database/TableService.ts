import Database from "better-sqlite3";
import { BaseService } from "./BaseService";
import { PoolTable } from "../../shared/types/entities";
import {
  TableRecord,
  MaintenanceRecord,
  TableMetrics,
} from "../../shared/types/database";
import { DatabaseError, ValidationError } from "../../shared/types/errors";
import { ArduinoService } from "../arduino/ArduinoService";
import { PrayerService } from "../prayer/PrayerService";

export class TableService extends BaseService {
  private arduino?: ArduinoService;
  private prayerService?: PrayerService;

  constructor(
    db: Database.Database,
    arduino?: ArduinoService,
    prayerService?: PrayerService
  ) {
    super(db);
    this.arduino = arduino;
    this.prayerService = prayerService;
  }

  async createTable(): Promise<number> {
    try {
      return this.db.transaction(() => {
        const result = this.prepareStatement<[string], TableRecord>(
          "INSERT INTO pool_tables (status, last_maintained) VALUES (?, CURRENT_TIMESTAMP)"
        ).run("available");

        const tableId = Number(result.lastInsertRowid);

        // Initialize hardware if available
        if (this.arduino) {
          this.arduino.toggleTable(tableId, false).catch(console.error);
        }

        this.logActivity("table", tableId, "created", 0);
        return tableId;
      })();
    } catch (error) {
      throw new DatabaseError("Failed to create table", { error });
    }
  }

  async updateTableStatus(
    tableId: number,
    status: PoolTable["status"],
    staffId: number
  ): Promise<void> {
    try {
      await this.db.transaction(async () => {
        // Check if we're trying to make the table available during prayer time
        if (status === "available" && this.prayerService?.isInPrayerTime()) {
          // Only managers can make tables available during prayer time
          const isManager = await this.isUserManager(staffId);
          if (!isManager) {
            throw new ValidationError(
              "Cannot change table status during prayer time"
            );
          }
        }

        const result = this.prepareStatement<[string, number], void>(
          "UPDATE pool_tables SET status = ? WHERE id = ?"
        ).run(status, tableId);

        if (result.changes === 0) {
          throw new ValidationError("Table not found");
        }

        // Sync with hardware
        if (this.arduino) {
          await this.arduino.toggleTable(tableId, status === "occupied");
        }

        this.logActivity("table", tableId, "status_updated", staffId, {
          status,
        });
      })();
    } catch (error) {
      throw new DatabaseError("Failed to update table status", { error });
    }
  }

  async getAllTables(): Promise<PoolTable[]> {
    try {
      const stmt = this.prepareStatement<[], TableRecord>(`
        SELECT 
          t.*,
          s.start_time as session_start_time,
          u.username as staff_name
        FROM pool_tables t
        LEFT JOIN sessions s ON t.current_session_id = s.id
        LEFT JOIN users u ON s.staff_id = u.id
        WHERE s.status = 'active' OR s.id IS NULL
      `);

      const records = stmt.all();
      return records.map((record) => ({
        id: record.id,
        status: record.status,
        currentSessionId: record.current_session_id || undefined,
        lastMaintained: record.last_maintained
          ? new Date(record.last_maintained)
          : new Date(),
        staffName: record.staff_name,
        sessionStartTime: record.session_start_time
          ? new Date(record.session_start_time)
          : undefined,
      }));
    } catch (error) {
      throw new DatabaseError("Failed to get tables", { error });
    }
  }

  async getTableById(tableId: number): Promise<PoolTable | null> {
    try {
      const stmt = this.prepareStatement<[number], TableRecord>(`
        SELECT 
          t.*,
          s.start_time as session_start_time,
          u.username as staff_name
        FROM pool_tables t
        LEFT JOIN sessions s ON t.current_session_id = s.id
        LEFT JOIN users u ON s.staff_id = u.id
        WHERE t.id = ?
      `);

      const record = stmt.get(tableId);
      if (!record) return null;

      return {
        id: record.id,
        status: record.status,
        currentSessionId: record.current_session_id || undefined,
        lastMaintained: record.last_maintained
          ? new Date(record.last_maintained)
          : new Date(),
        staffName: record.staff_name,
        sessionStartTime: record.session_start_time
          ? new Date(record.session_start_time)
          : undefined,
      };
    } catch (error) {
      throw new DatabaseError("Failed to get table", { error });
    }
  }

  async recordMaintenance(
    tableId: number,
    staffId: number,
    notes: string
  ): Promise<void> {
    try {
      await this.db.transaction(async () => {
        // Check if table exists
        const table = await this.getTableById(tableId);
        if (!table) {
          throw new ValidationError("Table not found");
        }

        // Update table status and maintenance timestamp
        this.prepareStatement<[string, number], void>(
          "UPDATE pool_tables SET last_maintained = CURRENT_TIMESTAMP, status = ? WHERE id = ?"
        ).run("maintenance", tableId);

        // Record maintenance log
        this.prepareStatement<[number, number, string], void>(
          "INSERT INTO maintenance_logs (table_id, staff_id, notes) VALUES (?, ?, ?)"
        ).run(tableId, staffId, notes);

        // Turn off table light during maintenance
        if (this.arduino) {
          await this.arduino.toggleTable(tableId, false);
        }

        this.logActivity("table", tableId, "maintenance", staffId, { notes });
      })();
    } catch (error) {
      throw new DatabaseError("Failed to record maintenance", { error });
    }
  }

  async getMaintenanceHistory(tableId: number): Promise<MaintenanceRecord[]> {
    try {
      return this.prepareStatement<[number], MaintenanceRecord>(
        `
        SELECT m.*, u.username as staff_name
        FROM maintenance_logs m
        JOIN users u ON m.staff_id = u.id
        WHERE m.table_id = ?
        ORDER BY m.timestamp DESC
      `
      ).all(tableId);
    } catch (error) {
      throw new DatabaseError("Failed to get maintenance history", { error });
    }
  }

  async getTableMetrics(
    tableId: number,
    startDate: Date,
    endDate: Date
  ): Promise<TableMetrics> {
    try {
      return this.db.transaction(() => {
        const usage = this.prepareStatement<
          [number, string, string],
          {
            total_hours: number;
            revenue: number;
            avg_duration: number;
          }
        >(
          `
          SELECT 
            SUM(duration) / 60.0 as total_hours,
            SUM(amount) as revenue,
            AVG(duration) as avg_duration
          FROM sessions 
          WHERE table_id = ? 
          AND start_time BETWEEN ? AND ?
          AND status = 'completed'
        `
        ).get(tableId, startDate.toISOString(), endDate.toISOString());

        const maintenance = this.prepareStatement<
          [number, string, string],
          { count: number }
        >(
          `
          SELECT COUNT(*) as count
          FROM maintenance_logs
          WHERE table_id = ?
          AND timestamp BETWEEN ? AND ?
        `
        ).get(tableId, startDate.toISOString(), endDate.toISOString());

        const timeSlots = this.prepareStatement<
          [number, string, string],
          { hour: number; count: number }
        >(
          `
          SELECT 
            strftime('%H', start_time) as hour,
            COUNT(*) as count
          FROM sessions
          WHERE table_id = ?
          AND start_time BETWEEN ? AND ?
          GROUP BY hour
          ORDER BY count DESC
          LIMIT 5
        `
        ).all(tableId, startDate.toISOString(), endDate.toISOString());

        return {
          totalHoursUsed: usage?.total_hours || 0,
          revenue: usage?.revenue || 0,
          maintenanceCount: maintenance?.count || 0,
          averageSessionDuration: usage?.avg_duration || 0,
          popularTimeSlots: timeSlots.map((slot) => ({
            hour: slot.hour,
            count: slot.count,
          })),
        };
      })();
    } catch (error) {
      throw new DatabaseError("Failed to get table metrics", { error });
    }
  }

  private async isUserManager(userId: number): Promise<boolean> {
    const result = this.prepareStatement<[number], { role: string }>(
      `
      SELECT role FROM users WHERE id = ?
    `
    ).get(userId);
    return result?.role === "manager";
  }

  async syncTableStatesWithArduino(): Promise<void> {
    if (!this.arduino) return;

    const tables = await this.getAllTables();
    await Promise.all(
      tables.map((table) =>
        this.arduino!.toggleTable(table.id, table.status === "occupied")
      )
    );
  }
}
