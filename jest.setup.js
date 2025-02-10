// Mock better-sqlite3
jest.mock("better-sqlite3", () => {
  return jest.fn().mockImplementation(() => ({
    pragma: jest.fn(),
    exec: jest.fn(),
    prepare: jest.fn(),
    close: jest.fn(),
    transaction: jest.fn(),
  }));
});

// Mock services
jest.mock("../UserService", () => ({
  UserService: jest.fn().mockImplementation(() => ({
    createUser: jest.fn(),
    verifyUser: jest.fn(),
    isUserManager: jest.fn(),
  })),
}));

jest.mock("../TableService", () => ({
  TableService: jest.fn().mockImplementation(() => ({
    createTable: jest.fn(),
    updateTableStatus: jest.fn(),
  })),
}));

jest.mock("../SessionService", () => ({
  SessionService: jest.fn().mockImplementation(() => ({
    startSession: jest.fn(),
    endSession: jest.fn(),
  })),
}));

jest.mock("../ReservationService", () => ({
  ReservationService: jest.fn().mockImplementation(() => ({
    createReservation: jest.fn(),
  })),
}));

jest.mock("../../arduino/ArduinoService", () => ({
  ArduinoService: jest.fn(),
}));

jest.mock("../../prayer/PrayerService", () => ({
  PrayerService: jest.fn(),
}));
