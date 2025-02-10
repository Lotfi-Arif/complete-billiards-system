import { Database } from "better-sqlite3";
import {
  Table,
  TableStatus,
  CreateTableDTO,
  UpdateTableDTO,
} from "@/shared/types/Table";
import { DatabaseError, NotFoundError } from "@/shared/types/errors";
import { BaseService } from "./BaseService";

export class TableService extends BaseService {
  constructor(db: Database) {
    super(db);
    this.initializeTable();
  }

  private initializeTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tableNumber INTEGER UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'AVAILABLE',
        lastMaintenance DATETIME,
        condition TEXT,
        hourlyRate DECIMAL(10,2) NOT NULL,
        isActive BOOLEAN NOT NULL DEFAULT 1,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async createTable(data: CreateTableDTO): Promise<Table> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO tables (tableNumber, hourlyRate, condition)
        VALUES (?, ?, ?)
      `);

      const result = this.transaction(() => {
        return stmt.run(
          data.tableNumber,
          data.hourlyRate,
          data.condition || "Good"
        );
      });

      if (!result.lastInsertRowid) {
        throw new DatabaseError("Failed to create table");
      }

      return this.getTableById(Number(result.lastInsertRowid));
    } catch (error) {
      throw new DatabaseError("Failed to create table", { error });
    }
  }

  async getTableById(id: number): Promise<Table> {
    const stmt = this.db.prepare("SELECT * FROM tables WHERE id = ?");
    const table = stmt.get(id) as Table | undefined;

    if (!table) {
      throw new NotFoundError(`Table with id ${id} not found`);
    }

    return {
      ...table,
      lastMaintenance: table.lastMaintenance
        ? new Date(table.lastMaintenance)
        : null,
      createdAt: new Date(table.createdAt),
      updatedAt: new Date(table.updatedAt),
    };
  }

  async getAllTables(): Promise<Table[]> {
    const stmt = this.db.prepare("SELECT * FROM tables WHERE isActive = 1");
    const tables = stmt.all() as Table[];

    return tables.map((table) => ({
      ...table,
      lastMaintenance: table.lastMaintenance
        ? new Date(table.lastMaintenance)
        : null,
      createdAt: new Date(table.createdAt),
      updatedAt: new Date(table.updatedAt),
    }));
  }

  async updateTableStatus(id: number, data: UpdateTableDTO): Promise<Table> {
    try {
      // First verify the table exists
      await this.getTableById(id);

      const updates: string[] = [];
      const values: any[] = [];

      if (data.status) {
        updates.push("status = ?");
        values.push(data.status);
      }
      if (data.condition) {
        updates.push("condition = ?");
        values.push(data.condition);
      }
      if (data.hourlyRate) {
        updates.push("hourlyRate = ?");
        values.push(data.hourlyRate);
      }
      if (data.lastMaintenance) {
        updates.push("lastMaintenance = ?");
        values.push(data.lastMaintenance.toISOString());
      }
      if (typeof data.isActive === "boolean") {
        updates.push("isActive = ?");
        values.push(data.isActive ? 1 : 0); // Explicitly convert to SQLite boolean
      }

      updates.push("updatedAt = CURRENT_TIMESTAMP");

      const stmt = this.db.prepare(`
        UPDATE tables 
        SET ${updates.join(", ")}
        WHERE id = ?
      `);

      const result = this.transaction(() => {
        return stmt.run(...values, id);
      });

      if (result.changes === 0) {
        throw new NotFoundError(`Table with id ${id} not found`);
      }

      return this.getTableById(id);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError("Failed to update table", { error });
    }
  }

  async deleteTable(id: number): Promise<void> {
    try {
      // First check if table exists and is active
      const table = await this.getTableById(id);

      if (!table.isActive) {
        throw new NotFoundError(`Table with id ${id} has already been deleted`);
      }

      const stmt = this.db.prepare(`
        UPDATE tables 
        SET isActive = 0, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ? AND isActive = 1
      `);

      const result = this.transaction(() => {
        return stmt.run(id);
      });

      if (result.changes === 0) {
        throw new NotFoundError(
          `Table with id ${id} not found or already deleted`
        );
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError("Failed to delete table", { error });
    }
  }

  async isTableAvailable(id: number): Promise<boolean> {
    const table = await this.getTableById(id);
    return table.status === TableStatus.AVAILABLE;
  }
}
