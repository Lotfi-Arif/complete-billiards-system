// src/main/services/TableService.ts

import { Database } from "better-sqlite3";
import {
  Table,
  TableStatus,
  CreateTableDTO,
  UpdateTableDTO,
} from "@/shared/types/Table";
import { DatabaseError, NotFoundError } from "@/shared/types/errors";
import { BaseService } from "./BaseService";
import Logger from "@/shared/logger"; // Adjust the import path as needed

/**
 * TableService handles all operations related to pool tables including creation,
 * retrieval, updates, and deletion (deactivation). It extends BaseService to leverage
 * common database utilities such as transactions and logging.
 */
export class TableService extends BaseService {
  constructor(db: Database) {
    super(db);
    Logger.info("Initializing TableService");
    this.initializeTable();
  }

  /**
   * Creates the tables schema if it does not exist.
   * This method is called once during service initialization.
   */
  private initializeTable(): void {
    try {
      Logger.info("Initializing table schema if not exists");
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
      Logger.info("Table schema initialized successfully");
    } catch (error) {
      Logger.error("Failed to initialize table schema: " + error);
      throw new DatabaseError("Failed to initialize table schema", { error });
    }
  }

  /**
   * Creates a new pool table record.
   *
   * @param data - The details required to create a table.
   * @returns The newly created Table record.
   * @throws DatabaseError if the table creation fails.
   */
  async createTable(data: CreateTableDTO): Promise<Table> {
    try {
      Logger.info(`Creating table with tableNumber: ${data.tableNumber}`);
      const stmt = this.db.prepare(`
        INSERT INTO tables (tableNumber, hourlyRate, condition)
        VALUES (?, ?, ?)
      `);

      // Wrap the insert operation in a transaction.
      const result = this.transaction(() => {
        return stmt.run(
          data.tableNumber,
          data.hourlyRate,
          data.condition || "Good"
        );
      });

      if (!result.lastInsertRowid) {
        Logger.error("No lastInsertRowid returned after table insertion");
        throw new DatabaseError("Failed to create table");
      }

      Logger.info(
        `Table created successfully with id ${result.lastInsertRowid}`
      );
      return this.getTableById(Number(result.lastInsertRowid));
    } catch (error) {
      Logger.error(`Error in createTable: ${error}`);
      throw new DatabaseError("Failed to create table", { error });
    }
  }

  /**
   * Retrieves a table record by its ID.
   *
   * @param id - The unique identifier of the table.
   * @returns The Table record.
   * @throws NotFoundError if the table does not exist.
   * @throws DatabaseError if the operation fails.
   */
  async getTableById(id: number): Promise<Table> {
    try {
      Logger.info(`Fetching table with id ${id}`);
      const stmt = this.db.prepare("SELECT * FROM tables WHERE id = ?");
      const table = stmt.get(id) as Table | undefined;

      if (!table) {
        Logger.warn(`Table with id ${id} not found`);
        throw new NotFoundError(`Table with id ${id} not found`);
      }

      Logger.info(`Table with id ${id} retrieved successfully`);
      return {
        ...table,
        lastMaintenance: table.lastMaintenance
          ? new Date(table.lastMaintenance)
          : null,
        createdAt: new Date(table.createdAt),
        updatedAt: new Date(table.updatedAt),
      };
    } catch (error) {
      Logger.error(`Error in getTableById: ${error}`);
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError("Failed to get table by id", { error });
    }
  }

  /**
   * Retrieves all active tables.
   *
   * @returns An array of Table records.
   * @throws DatabaseError if the operation fails.
   */
  async getAllTables(): Promise<Table[]> {
    try {
      Logger.info("Fetching all active tables");
      const stmt = this.db.prepare("SELECT * FROM tables WHERE isActive = 1");
      const tables = stmt.all() as Table[];

      Logger.info(`Retrieved ${tables.length} active table(s)`);
      return tables.map((table) => ({
        ...table,
        lastMaintenance: table.lastMaintenance
          ? new Date(table.lastMaintenance)
          : null,
        createdAt: new Date(table.createdAt),
        updatedAt: new Date(table.updatedAt),
      }));
    } catch (error) {
      Logger.error(`Error in getAllTables: ${error}`);
      throw new DatabaseError("Failed to get all tables", { error });
    }
  }

  /**
   * Updates a table's details.
   *
   * @param id - The unique identifier of the table to update.
   * @param data - The updated table details.
   * @returns The updated Table record.
   * @throws NotFoundError if the table does not exist.
   * @throws DatabaseError if the update operation fails.
   */
  async updateTableStatus(
    id: number,
    data: UpdateTableDTO,
    performedBy?: number // optional parameter for the user ID performing the update
  ): Promise<Table> {
    try {
      Logger.info(`Updating table with id ${id}`);
      // Verify the table exists before attempting an update.
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
        values.push(data.isActive ? 1 : 0);
      }

      // Always update the updatedAt field to reflect the modification time.
      updates.push("updatedAt = CURRENT_TIMESTAMP");

      const sql = `
        UPDATE tables 
        SET ${updates.join(", ")}
        WHERE id = ?
      `;
      Logger.info(
        `Executing update for table id ${id} with SQL: ${sql} and values: ${JSON.stringify(
          values
        )}`
      );

      const stmt = this.db.prepare(sql);

      const result = this.transaction(() => {
        return stmt.run(...values, id);
      });

      if (result.changes === 0) {
        Logger.warn(`No changes made for table with id ${id}`);
        throw new NotFoundError(`Table with id ${id} not found`);
      }

      // If a performedBy value is provided, log the activity.
      if (performedBy !== undefined) {
        this.logActivity("PoolTable", id, "UPDATE_STATUS", performedBy, {
          ...data,
        });
      }

      Logger.info(`Table with id ${id} updated successfully`);
      return await this.getTableById(id);
    } catch (error) {
      Logger.error(`Error in updateTableStatus for table id ${id}: ${error}`);
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError("Failed to update table", { error });
    }
  }

  /**
   * Deletes (deactivates) a table.
   *
   * @param id - The unique identifier of the table to delete.
   * @throws NotFoundError if the table is not found or already deleted.
   * @throws DatabaseError if the deletion operation fails.
   */
  async deleteTable(id: number): Promise<void> {
    try {
      Logger.info(`Deleting (deactivating) table with id ${id}`);
      // Verify that the table exists and is currently active.
      const table = await this.getTableById(id);

      if (!table.isActive) {
        Logger.warn(`Table with id ${id} is already inactive`);
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
        Logger.warn(`No changes made during deletion for table with id ${id}`);
        throw new NotFoundError(
          `Table with id ${id} not found or already deleted`
        );
      }

      Logger.info(`Table with id ${id} deactivated successfully`);
    } catch (error) {
      Logger.error(`Error in deleteTable for table id ${id}: ${error}`);
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError("Failed to delete table", { error });
    }
  }

  /**
   * Checks whether a table is available (i.e., its status is AVAILABLE).
   *
   * @param id - The unique identifier of the table.
   * @returns True if the table is available; otherwise, false.
   * @throws DatabaseError if the operation fails.
   */
  async isTableAvailable(id: number): Promise<boolean> {
    try {
      Logger.info(`Checking availability for table with id ${id}`);
      const table = await this.getTableById(id);
      const available = table.status === TableStatus.AVAILABLE;
      Logger.info(
        `Table with id ${id} is ${available ? "available" : "not available"}`
      );
      return available;
    } catch (error) {
      Logger.error(`Error in isTableAvailable for table id ${id}: ${error}`);
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError("Failed to check table availability", { error });
    }
  }
}
