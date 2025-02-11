import Logger from "@/shared/logger";
import Database from "better-sqlite3";

/**
 * BaseService provides common database operations that other services can inherit.
 * It includes helper methods for logging activities, handling transactions, and preparing statements.
 */
export abstract class BaseService {
  protected db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Logs an activity to the `activity_logs` table.
   *
   * @param entityType - The type of entity (e.g., 'PoolTable', 'Session').
   * @param entityId - The ID of the entity.
   * @param action - The action performed (e.g., 'CREATE', 'UPDATE', 'DELETE').
   * @param performedBy - The ID of the user who performed the action.
   * @param details - Additional details about the action (optional).
   */
  protected logActivity(
    entityType: string,
    entityId: number,
    action: string,
    performedBy: number,
    details?: Record<string, unknown>
  ): void {
    try {
      this.db
        .prepare<[string, number, string, number, string | null], void>(
          `INSERT INTO activity_logs (
            entity_type, entity_id, action, performed_by, details
          ) VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          entityType,
          entityId,
          action,
          performedBy,
          details ? JSON.stringify(details) : null
        );
      Logger.info(
        `Activity logged: [${entityType}] ID: ${entityId} Action: ${action} by User: ${performedBy}`
      );
    } catch (error) {
      // Log error using our centralized Logger
      Logger.error(
        `Failed to log activity for ${entityType} (ID: ${entityId}): ${error}`
      );
    }
  }

  /**
   * Executes a set of database operations within a transaction.
   * If any operation fails, the transaction is rolled back.
   *
   * @param callback - A callback function that contains database operations.
   * @returns The result of the transaction callback.
   * @throws Error if the transaction fails.
   */
  protected transaction<T>(callback: () => T): T {
    try {
      // better-sqlite3 provides a synchronous transaction mechanism.
      const tx = this.db.transaction(callback);
      return tx();
    } catch (error) {
      Logger.error(`Transaction failed: ${error}`);
      throw error;
    }
  }

  /**
   * Prepares an SQL statement for execution.
   *
   * @param sql - The SQL query string.
   * @returns A prepared statement that can be executed with parameters.
   * @throws Error if preparing the statement fails.
   */
  protected prepareStatement<TParams extends unknown[], TResult>(
    sql: string
  ): Database.Statement<TParams, TResult> {
    try {
      return this.db.prepare(sql);
    } catch (error) {
      Logger.error(`Failed to prepare statement: "${sql}" - ${error}`);
      throw error;
    }
  }
}
