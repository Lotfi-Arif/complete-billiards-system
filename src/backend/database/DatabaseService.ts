import Database from "better-sqlite3";
import { UserService } from "./UserService";
import { TableService } from "./TableService";
import { SessionService } from "./SessionService";
import { ReservationService } from "./ReservationService";
import { DatabaseConfig } from "../../shared/types/config";
import { DatabaseError } from "../../shared/types/errors";
import { ArduinoService } from "../arduino/ArduinoService";
import { PrayerService } from "../prayer/PrayerService";
import { PoolTable, User } from "@/shared/types/entities";

export class DatabaseService {
  private db: Database.Database;
  private userService: UserService;
  private tableService: TableService;
  private sessionService: SessionService;
  private reservationService: ReservationService;

  constructor(
    config: DatabaseConfig,
    arduino?: ArduinoService,
    prayer?: PrayerService
  ) {
    try {
      this.db = new Database(config.filename, {
        readonly: false,
        fileMustExist: false,
        ...config,
      });

      // Enable foreign keys
      this.db.pragma("foreign_keys = ON");

      // Initialize services
      this.userService = new UserService(this.db);
      this.tableService = new TableService(this.db, arduino, prayer);
      this.sessionService = new SessionService(this.db);
      this.reservationService = new ReservationService(this.db);

      // Initialize database schema
      this.initializeSchema();
    } catch (error) {
      throw new DatabaseError("Failed to initialize database", { error });
    }
  }

  private initializeSchema(): void {
    const schema = `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('manager', 'staff', 'customer')) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Pool tables
      CREATE TABLE IF NOT EXISTS pool_tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        status TEXT CHECK(status IN ('available', 'occupied', 'maintenance')) NOT NULL DEFAULT 'available',
        current_session_id INTEGER,
        last_maintained TIMESTAMP,
        FOREIGN KEY(current_session_id) REFERENCES sessions(id)
      );

      -- Sessions
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER NOT NULL,
        staff_id INTEGER NOT NULL,
        customer_id INTEGER,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP,
        duration INTEGER,
        amount DECIMAL(10,2),
        status TEXT CHECK(status IN ('active', 'completed', 'cancelled')) NOT NULL DEFAULT 'active',
        FOREIGN KEY(table_id) REFERENCES pool_tables(id),
        FOREIGN KEY(staff_id) REFERENCES users(id),
        FOREIGN KEY(customer_id) REFERENCES users(id)
      );

      -- Reservations
      CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER NOT NULL,
        customer_id INTEGER NOT NULL,
        staff_id INTEGER NOT NULL,
        reservation_time TIMESTAMP NOT NULL,
        status TEXT CHECK(status IN ('pending', 'confirmed', 'cancelled', 'completed')) NOT NULL DEFAULT 'pending',
        FOREIGN KEY(table_id) REFERENCES pool_tables(id),
        FOREIGN KEY(customer_id) REFERENCES users(id),
        FOREIGN KEY(staff_id) REFERENCES users(id)
      );

      -- Maintenance logs
      CREATE TABLE IF NOT EXISTS maintenance_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER NOT NULL,
        staff_id INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY(table_id) REFERENCES pool_tables(id),
        FOREIGN KEY(staff_id) REFERENCES users(id)
      );

      -- Activity logs
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        performed_by INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        details TEXT,
        FOREIGN KEY(performed_by) REFERENCES users(id)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_sessions_table_id ON sessions(table_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_reservations_table_id ON reservations(table_id);
      CREATE INDEX IF NOT EXISTS idx_maintenance_table_id ON maintenance_logs(table_id);
      CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity_type, entity_id);
    `;

    this.db.exec(schema);
  }

  // User management methods
  async createUser(
    username: string,
    password: string,
    role: User["role"]
  ): Promise<number> {
    return this.userService.createUser(username, password, role);
  }

  async verifyUser(username: string, password: string) {
    return this.userService.verifyUser(username, password);
  }

  // Table management methods
  async createTable(): Promise<number> {
    return this.tableService.createTable();
  }

  async updateTableStatus(
    tableId: number,
    status: PoolTable["status"],
    staffId: number
  ): Promise<void> {
    return this.tableService.updateTableStatus(tableId, status, staffId);
  }

  // Session management methods
  async startSession(
    tableId: number,
    staffId: number,
    customerId?: number
  ): Promise<number> {
    return this.sessionService.startSession(tableId, staffId, customerId);
  }

  async endSession(sessionId: number, staffId: number): Promise<void> {
    return this.sessionService.endSession(sessionId, staffId);
  }

  // Reservation management methods
  async createReservation(
    tableId: number,
    customerId: number,
    staffId: number,
    time: Date
  ): Promise<number> {
    return this.reservationService.createReservation(
      tableId,
      customerId,
      staffId,
      time
    );
  }

  // Utility methods
  async isUserManager(userId: number): Promise<boolean> {
    return this.userService.isUserManager(userId);
  }

  cleanup(): void {
    this.db.close();
  }
}
