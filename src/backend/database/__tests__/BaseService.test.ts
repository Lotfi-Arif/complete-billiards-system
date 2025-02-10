import Database from "better-sqlite3";
import { BaseService } from "../BaseService";

// Mock the Database type
jest.mock("better-sqlite3");

// Create a concrete implementation for testing
class TestService extends BaseService {
  public exposedLogActivity(
    entityType: string,
    entityId: number,
    action: string,
    performedBy: number,
    details?: Record<string, unknown>
  ): void {
    this.logActivity(entityType, entityId, action, performedBy, details);
  }

  public exposedPrepareStatement<TParams extends unknown[], TResult>(
    sql: string
  ): Database.Statement<TParams, TResult> {
    return this.prepareStatement(sql);
  }
}

describe("BaseService", () => {
  let db: jest.Mocked<Database.Database>;
  let testService: TestService;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create a new database instance
    db = new Database(":memory:") as jest.Mocked<Database.Database>;
    testService = new TestService(db);
  });

  describe("logActivity", () => {
    it("should successfully log activity without details", () => {
      const mockRun = jest.fn();
      (db.prepare as jest.Mock).mockReturnValue({ run: mockRun });

      testService.exposedLogActivity("table", 1, "reserve", 123);

      expect(db.prepare).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO activity_logs")
      );
      expect(mockRun).toHaveBeenCalledWith("table", 1, "reserve", 123, null);
    });

    it("should successfully log activity with details", () => {
      const mockRun = jest.fn();
      (db.prepare as jest.Mock).mockReturnValue({ run: mockRun });

      const details = { duration: 60, price: 50 };
      testService.exposedLogActivity("table", 1, "reserve", 123, details);

      expect(db.prepare).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO activity_logs")
      );
      expect(mockRun).toHaveBeenCalledWith(
        "table",
        1,
        "reserve",
        123,
        JSON.stringify(details)
      );
    });

    it("should handle database errors gracefully", () => {
      const mockRun = jest.fn().mockImplementation(() => {
        throw new Error("Database error");
      });
      (db.prepare as jest.Mock).mockReturnValue({ run: mockRun });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      testService.exposedLogActivity("table", 1, "reserve", 123);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("prepareStatement", () => {
    it("should successfully prepare a valid SQL statement", () => {
      const mockStatement = {
        run: jest.fn(),
        get: jest.fn(),
        all: jest.fn(),
      };
      (db.prepare as jest.Mock).mockReturnValue(mockStatement);

      const stmt = testService.exposedPrepareStatement("SELECT * FROM test");
      expect(db.prepare).toHaveBeenCalledWith("SELECT * FROM test");
      expect(stmt).toBe(mockStatement);
    });

    it("should throw on invalid SQL", () => {
      (db.prepare as jest.Mock).mockImplementation(() => {
        throw new Error("Invalid SQL");
      });

      expect(() => {
        testService.exposedPrepareStatement("INVALID SQL");
      }).toThrow("Invalid SQL");
    });
  });
});
