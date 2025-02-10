import Database from "better-sqlite3";
import { DatabaseService } from "../DatabaseService";
import { UserService } from "../UserService";
import { TableService } from "../TableService";
import { SessionService } from "../SessionService";
import { ReservationService } from "../ReservationService";
import { ArduinoService } from "../../arduino/ArduinoService";
import { PrayerService } from "../../prayer/PrayerService";
import { DatabaseError } from "../../../shared/types/errors";
import { UserRole } from "@/shared/types/entities";

// Mock dependencies
jest.mock("better-sqlite3");
jest.mock("../UserService");
jest.mock("../TableService");
jest.mock("../SessionService");
jest.mock("../ReservationService");
jest.mock("../../arduino/ArduinoService");
jest.mock("../../prayer/PrayerService");

describe("DatabaseService", () => {
  let dbService: DatabaseService;
  let mockDb: jest.Mocked<Database.Database>;
  let mockArduino: jest.Mocked<ArduinoService>;
  let mockPrayer: jest.Mocked<PrayerService>;

  const dbConfig = {
    filename: ":memory:",
    readonly: false,
    fileMustExist: false,
  };

  const MockDatabase = Database as jest.MockedClass<typeof Database>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup database mock
    mockDb = {
      pragma: jest.fn(),
      exec: jest.fn(),
      close: jest.fn(),
      prepare: jest.fn(),
    } as unknown as jest.Mocked<Database.Database>;

    MockDatabase.mockImplementation(() => mockDb);

    // Setup Arduino and Prayer service mocks with required constructor parameters
    mockArduino = new ArduinoService({
      autoConnect: false,
      baudRate: 9600,
      port: "/dev/ttyUSB0",
    }) as jest.Mocked<ArduinoService>;
    mockPrayer = new PrayerService({
      latitude: 0,
      longitude: 0,
      timeZone: "UTC",
    }) as jest.Mocked<PrayerService>;

    // Initialize database service
    dbService = new DatabaseService(dbConfig, mockArduino, mockPrayer);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("constructor", () => {
    it("should initialize database and services successfully", () => {
      expect(MockDatabase).toHaveBeenCalledWith(
        dbConfig.filename,
        expect.any(Object)
      );
      expect(mockDb.pragma).toHaveBeenCalledWith("foreign_keys = ON");
      expect(mockDb.exec).toHaveBeenCalled();
      expect(dbService.userService).toBeInstanceOf(UserService);
      expect(dbService.tableService).toBeInstanceOf(TableService);
      expect(dbService.sessionService).toBeInstanceOf(SessionService);
      expect(dbService.reservationService).toBeInstanceOf(ReservationService);
    });

    it("should throw DatabaseError on initialization failure", () => {
      MockDatabase.mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      expect(() => new DatabaseService(dbConfig)).toThrow(DatabaseError);
    });
  });

  describe("user management methods", () => {
    it("should create user successfully", async () => {
      const userId = 1;
      jest.spyOn(dbService.userService, "createUser").mockResolvedValue(userId);

      const result = await dbService.createUser(
        "testuser",
        "password",
        "staff"
      );

      expect(result).toBe(userId);
      expect(dbService.userService.createUser).toHaveBeenCalledWith(
        "testuser",
        "password",
        "staff"
      );
    });

    it("should verify user successfully", async () => {
      const mockUser = {
        id: 1,
        username: "testuser",
        role: "staff" as UserRole,
        createdAt: new Date(),
      };
      jest
        .spyOn(dbService.userService, "verifyUser")
        .mockResolvedValue(mockUser);

      const result = await dbService.verifyUser("testuser", "password");

      expect(result).toEqual(mockUser);
      expect(dbService.userService.verifyUser).toHaveBeenCalledWith(
        "testuser",
        "password"
      );
    });

    it("should check manager role correctly", async () => {
      jest
        .spyOn(dbService.userService, "isUserManager")
        .mockResolvedValue(true);

      const result = await dbService.isUserManager(1);

      expect(result).toBe(true);
      expect(dbService.userService.isUserManager).toHaveBeenCalledWith(1);
    });
  });

  describe("table management methods", () => {
    it("should create table successfully", async () => {
      const tableId = 1;
      jest
        .spyOn(dbService.tableService, "createTable")
        .mockResolvedValue(tableId);

      const result = await dbService.createTable();

      expect(result).toBe(tableId);
      expect(dbService.tableService.createTable).toHaveBeenCalled();
    });

    it("should update table status successfully", async () => {
      jest
        .spyOn(dbService.tableService, "updateTableStatus")
        .mockResolvedValue();

      await dbService.updateTableStatus(1, "maintenance", 2);

      expect(dbService.tableService.updateTableStatus).toHaveBeenCalledWith(
        1,
        "maintenance",
        2
      );
    });
  });

  describe("session management methods", () => {
    it("should start session successfully", async () => {
      const sessionId = 1;
      jest
        .spyOn(dbService.sessionService, "startSession")
        .mockResolvedValue(sessionId);

      const result = await dbService.startSession(1, 2, 3);

      expect(result).toBe(sessionId);
      expect(dbService.sessionService.startSession).toHaveBeenCalledWith(
        1,
        2,
        3
      );
    });

    it("should end session successfully", async () => {
      jest.spyOn(dbService.sessionService, "endSession").mockResolvedValue();

      await dbService.endSession(1, 2);

      expect(dbService.sessionService.endSession).toHaveBeenCalledWith(1, 2);
    });
  });

  describe("reservation management methods", () => {
    it("should create reservation successfully", async () => {
      const reservationId = 1;
      const reservationTime = new Date();
      jest
        .spyOn(dbService.reservationService, "createReservation")
        .mockResolvedValue(reservationId);

      const result = await dbService.createReservation(
        1,
        2,
        3,
        reservationTime
      );

      expect(result).toBe(reservationId);
      expect(
        dbService.reservationService.createReservation
      ).toHaveBeenCalledWith(1, 2, 3, reservationTime);
    });
  });

  describe("cleanup", () => {
    it("should close database connection", () => {
      dbService.cleanup();
      expect(mockDb.close).toHaveBeenCalled();
    });
  });
});
