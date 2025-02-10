import Database from "better-sqlite3";
import { ReservationService } from "../ReservationService";
import { PrayerService } from "../../prayer/PrayerService";

describe("ReservationService", () => {
  let reservationService: ReservationService;
  let mockDb: jest.Mocked<Database.Database>;
  let mockPrayerService: jest.Mocked<PrayerService>;
  let mockStatement: jest.Mock;
  let mockRun: jest.Mock;
  let mockGet: jest.Mock;
  let mockAll: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup database mocks
    mockRun = jest.fn();
    mockGet = jest.fn();
    mockAll = jest.fn();
    mockStatement = jest.fn(() => ({
      run: mockRun,
      get: mockGet,
      all: mockAll,
    }));

    mockDb = {
      prepare: mockStatement,
      transaction: jest.fn((fn) => fn()),
    } as unknown as jest.Mocked<Database.Database>;

    // Setup PrayerService mock
    mockPrayerService = {
      isInPrayerTime: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<PrayerService>;

    reservationService = new ReservationService(mockDb, mockPrayerService);
  });

  describe("createReservation", () => {
    const validReservationData = {
      tableId: 1,
      customerId: 2,
      staffId: 3,
      reservationTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour in future
    };

    beforeEach(() => {
      // Default successful mocks
      mockGet.mockImplementation((query) => {
        if (query.includes("pool_tables")) {
          return { status: "available" };
        }
        return null; // No conflicting reservations
      });
      mockRun.mockReturnValue({ lastInsertRowid: 1 });
    });

    it("should create a valid reservation", async () => {
      const result = await reservationService.createReservation(
        validReservationData.tableId,
        validReservationData.customerId,
        validReservationData.staffId,
        validReservationData.reservationTime
      );

      expect(result).toBe(1);
    });

    it("should reject reservation during prayer time", async () => {
      mockPrayerService.isInPrayerTime.mockReturnValue(true);

      await expect(async () => {
        await reservationService.createReservation(
          validReservationData.tableId,
          validReservationData.customerId,
          validReservationData.staffId,
          validReservationData.reservationTime
        );
      }).rejects.toThrow("Cannot make reservations during prayer times");
    });

    it("should reject reservation with invalid advance time", async () => {
      const invalidTime = new Date(Date.now() + 15 * 60 * 1000); // Only 15 minutes in future

      await expect(async () => {
        await reservationService.createReservation(
          validReservationData.tableId,
          validReservationData.customerId,
          validReservationData.staffId,
          invalidTime
        );
      }).rejects.toThrow(/must be made at least \d+ minutes in advance/);
    });

    it("should reject reservation too far in advance", async () => {
      const tooFarTime = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000); // 8 days in future

      await expect(async () => {
        await reservationService.createReservation(
          validReservationData.tableId,
          validReservationData.customerId,
          validReservationData.staffId,
          tooFarTime
        );
      }).rejects.toThrow(/cannot be made more than \d+ days in advance/);
    });

    it("should reject reservation for non-existent table", async () => {
      mockGet.mockReset().mockReturnValue(null); // Table not found

      await expect(async () => {
        await reservationService.createReservation(
          validReservationData.tableId,
          validReservationData.customerId,
          validReservationData.staffId,
          validReservationData.reservationTime
        );
      }).rejects.toThrow("Table not found");
    });

    it("should reject reservation with time conflict", async () => {
      mockGet
        .mockReturnValueOnce({ status: "available" }) // Table status
        .mockReturnValueOnce({ id: 2 }); // Conflicting reservation

      await expect(async () => {
        await reservationService.createReservation(
          validReservationData.tableId,
          validReservationData.customerId,
          validReservationData.staffId,
          validReservationData.reservationTime
        );
      }).rejects.toThrow("Table already reserved for this time slot");
    });
  });

  describe("confirmReservation", () => {
    it("should confirm a valid reservation", async () => {
      mockRun.mockReturnValue({ changes: 1 });

      await reservationService.confirmReservation(1, 2);

      expect(mockDb.prepare).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalledWith(1);
    });

    it("should throw error for non-existent reservation", async () => {
      mockRun.mockReturnValue({ changes: 0 });

      await expect(async () => {
        await reservationService.confirmReservation(1, 2);
      }).rejects.toThrow("Reservation not found");
    });
  });

  describe("cancelReservation", () => {
    it("should cancel a valid reservation", async () => {
      mockRun.mockReturnValue({ changes: 1 });

      await reservationService.cancelReservation(1, 2, "Customer request");

      expect(mockDb.prepare).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalledWith(1);
    });

    it("should throw error for non-existent reservation", async () => {
      mockRun.mockReturnValue({ changes: 0 });

      await expect(async () => {
        await reservationService.cancelReservation(1, 2, "Customer request");
      }).rejects.toThrow("Reservation not found");
    });
  });

  describe("getReservation", () => {
    const mockReservationRecord = {
      id: 1,
      table_id: 2,
      customer_id: 3,
      staff_id: 4,
      reservation_time: new Date().toISOString(),
      status: "pending",
      customer_name: "John",
      staff_name: "Jane",
    };

    it("should return reservation by id", async () => {
      mockGet.mockReturnValue(mockReservationRecord);

      const result = await reservationService.getReservation(1);

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
      expect(result?.customerName).toBe("John");
    });

    it("should return null for non-existent reservation", async () => {
      mockGet.mockReturnValue(null);

      const result = await reservationService.getReservation(1);

      expect(result).toBeNull();
    });
  });

  describe("getTableReservations", () => {
    it("should return all reservations for a table", async () => {
      const mockReservations = [
        {
          id: 1,
          table_id: 1,
          customer_id: 2,
          staff_id: 3,
          reservation_time: new Date().toISOString(),
          status: "pending",
          customer_name: "John",
          staff_name: "Jane",
        },
      ];

      mockAll.mockReturnValue(mockReservations);

      const result = await reservationService.getTableReservations(
        1,
        new Date(),
        new Date()
      );

      expect(result).toHaveLength(1);
      expect(result[0].tableId).toBe(1);
    });
  });

  describe("getCustomerReservations", () => {
    it("should return all reservations for a customer", async () => {
      const mockReservations = [
        {
          id: 1,
          table_id: 1,
          customer_id: 2,
          staff_id: 3,
          reservation_time: new Date().toISOString(),
          status: "pending",
          customer_name: "John",
          staff_name: "Jane",
        },
      ];

      mockAll.mockReturnValue(mockReservations);

      const result = await reservationService.getCustomerReservations(2);

      expect(result).toHaveLength(1);
      expect(result[0].customerId).toBe(2);
    });
  });
});
