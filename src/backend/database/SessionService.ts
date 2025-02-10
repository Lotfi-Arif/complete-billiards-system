// src/backend/database/SessionService.ts
import { Database } from "better-sqlite3";
import { BaseService } from "./BaseService";
import {
  Session,
  SessionStatus,
  CreateSessionDTO,
  EndSessionDTO,
} from "@/shared/types/Session";
import {
  DatabaseError,
  NotFoundError,
  BusinessError,
} from "@/shared/types/errors";
import { TableService } from "./TableService";
import { TableStatus } from "@/shared/types/Table";

export class SessionService extends BaseService {
  private tableService: TableService;

  constructor(db: Database) {
    super(db);
    this.tableService = new TableService(db);
    this.initializeTable();
  }

  private initializeTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tableId INTEGER NOT NULL,
        customerId INTEGER,
        startTime DATETIME NOT NULL,
        endTime DATETIME,
        duration INTEGER,
        cost DECIMAL(10,2),
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tableId) REFERENCES tables(id)
      )
    `);
  }

  async startSession(data: CreateSessionDTO): Promise<Session> {
    try {
      // First check if table exists
      const table = await this.tableService.getTableById(data.tableId);

      // if table exists, check if it's available
      if (!table) {
        throw new BusinessError(
          `Table ${data.tableId} does not exist or is not available`
        );
      }
      // Only check availability if starting a session right now
      const startTime = data.startTime || new Date();
      if (!data.startTime) {
        // If no specific start time provided, check availability
        if (!(await this.tableService.isTableAvailable(data.tableId))) {
          throw new BusinessError(`Table ${data.tableId} is not available`);
        }
      }

      return this.transaction(() => {
        // Update table status first (only if starting now)
        if (!data.startTime) {
          this.tableService.updateTableStatus(data.tableId, {
            status: TableStatus.IN_USE,
          });
        }

        // Then create session
        const stmt = this.db.prepare(`
          INSERT INTO sessions (
            tableId, 
            customerId, 
            startTime, 
            status
          ) VALUES (?, ?, ?, ?)
        `);

        const result = stmt.run(
          data.tableId,
          data.customerId || null,
          startTime.toISOString(),
          SessionStatus.ACTIVE
        );

        if (!result.lastInsertRowid) {
          throw new DatabaseError("Failed to create session");
        }

        return this.getSessionById(Number(result.lastInsertRowid));
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BusinessError) {
        throw error;
      }
      throw new DatabaseError("Failed to start session", { error });
    }
  }

  async endSession(id: number, data: EndSessionDTO = {}): Promise<Session> {
    try {
      const session = await this.getSessionById(id);

      if (session.status !== SessionStatus.ACTIVE) {
        throw new BusinessError(`Session ${id} is not active`);
      }

      const endTime = data.endTime || new Date();
      const duration = Math.ceil(
        (endTime.getTime() - session.startTime.getTime()) / (1000 * 60)
      );

      // Get table to calculate cost
      const table = await this.tableService.getTableById(session.tableId);
      const cost = (duration / 60) * table.hourlyRate;

      return this.transaction(() => {
        // Update table status first
        this.tableService.updateTableStatus(session.tableId, {
          status: TableStatus.AVAILABLE,
        });

        // Then update session
        const stmt = this.db.prepare(`
          UPDATE sessions 
          SET endTime = ?,
              duration = ?,
              cost = ?,
              status = ?,
              updatedAt = CURRENT_TIMESTAMP
          WHERE id = ? AND status = ?
        `);

        const result = stmt.run(
          endTime.toISOString(),
          duration,
          cost,
          data.status || SessionStatus.COMPLETED,
          id,
          SessionStatus.ACTIVE
        );

        if (result.changes === 0) {
          throw new NotFoundError(
            `Session with id ${id} not found or not active`
          );
        }

        return this.getSessionById(id);
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BusinessError) {
        throw error;
      }
      throw new DatabaseError("Failed to end session", { error });
    }
  }

  async getSessionById(id: number): Promise<Session> {
    const stmt = this.db.prepare("SELECT * FROM sessions WHERE id = ?");
    const session = stmt.get(id) as Session | undefined;

    if (!session) {
      throw new NotFoundError(`Session with id ${id} not found`);
    }

    return {
      ...session,
      startTime: new Date(session.startTime),
      endTime: session.endTime ? new Date(session.endTime) : null,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
    };
  }

  async getActiveSessions(): Promise<Session[]> {
    const stmt = this.db.prepare("SELECT * FROM sessions WHERE status = ?");
    const sessions = stmt.all(SessionStatus.ACTIVE) as Session[];

    return sessions.map((session) => ({
      ...session,
      startTime: new Date(session.startTime),
      endTime: session.endTime ? new Date(session.endTime) : null,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
    }));
  }

  async getTableSessions(tableId: number): Promise<Session[]> {
    try {
      // Verify table exists first
      await this.tableService.getTableById(tableId);

      const stmt = this.db.prepare("SELECT * FROM sessions WHERE tableId = ?");
      const sessions = stmt.all(tableId) as Session[];

      return sessions.map((session) => ({
        ...session,
        startTime: new Date(session.startTime),
        endTime: session.endTime ? new Date(session.endTime) : null,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      }));
    } catch (error) {
      if (error instanceof NotFoundError) {
        return [];
      }
      throw error;
    }
  }

  async getCustomerSessions(customerId: number): Promise<Session[]> {
    const stmt = this.db.prepare("SELECT * FROM sessions WHERE customerId = ?");
    const sessions = stmt.all(customerId) as Session[];

    return sessions.map((session) => ({
      ...session,
      startTime: new Date(session.startTime),
      endTime: session.endTime ? new Date(session.endTime) : null,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
    }));
  }

  async cancelSession(id: number): Promise<Session> {
    return this.endSession(id, { status: SessionStatus.CANCELLED });
  }

  async calculateSessionCost(session: Session): Promise<number> {
    if (!session.endTime) {
      throw new BusinessError("Cannot calculate cost for active session");
    }

    const table = await this.tableService.getTableById(session.tableId);
    const duration =
      session.duration ||
      Math.ceil(
        (session.endTime.getTime() - session.startTime.getTime()) / (1000 * 60)
      );

    return (duration / 60) * table.hourlyRate;
  }
}
