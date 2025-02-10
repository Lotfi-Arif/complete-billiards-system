import Database from "better-sqlite3";

export abstract class BaseService {
  protected db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

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
    } catch (error) {
      console.error("Failed to log activity:", error);
    }
  }

  protected transaction<T>(callback: () => T): T {
    const result = this.db.transaction(callback)();
    return result;
  }

  protected prepareStatement<TParams extends unknown[], TResult>(
    sql: string
  ): Database.Statement<TParams, TResult> {
    return this.db.prepare(sql);
  }
}
