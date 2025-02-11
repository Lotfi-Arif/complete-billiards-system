const mockStatement = {
  run: jest.fn(),
  get: jest.fn(),
  all: jest.fn(),
  iterate: jest.fn(),
  bind: jest.fn(),
  columns: jest.fn(),
  raw: jest.fn(),
  expanded: jest.fn(),
  pluck: jest.fn(),
  finalize: jest.fn(),
  reader: false,
  readonly: false,
  source: "",
};

// Mock better-sqlite3
jest.mock("better-sqlite3", () => {
  return jest.fn().mockImplementation(() => ({
    pragma: jest.fn(),
    exec: jest.fn(),
    prepare: jest.fn().mockReturnValue(mockStatement),
    close: jest.fn(),
    transaction: jest.fn((fn) => fn), // Return the function directly
    backup: jest.fn(),
    serialize: jest.fn(),
    function: jest.fn(),
    aggregate: jest.fn(),
    table: jest.fn(),
    loadExtension: jest.fn(),
    defaultSafeIntegers: jest.fn(),
    name: "test.db",
    open: true,
    inTransaction: false,
    readonly: false,
    memory: false,
  }));
});

// Mock UserService
jest.mock("@/backend/database/UserService", () => ({
  UserService: jest.fn().mockImplementation(() => ({
    createUser: jest.fn(),
    verifyUser: jest.fn(),
    isUserManager: jest.fn(),
  })),
}));

// mock TableService
jest.mock("@/backend/database/TableService", () => ({
  TableService: jest.fn().mockImplementation(() => ({
    createTable: jest.fn(),
    updateTableStatus: jest.fn(),
    deleteTable: jest.fn(),
    isTableAvailable: jest.fn(),
  })),
}));

// Mock SessionService
jest.mock("@/backend/database/SessionService", () => ({
  SessionService: jest.fn().mockImplementation(() => ({
    startSession: jest.fn(),
    endSession: jest.fn(),
    calculateSessionCost: jest.fn(),
  })),
}));

// Mock ReservationService
jest.mock("@/backend/database/ReservationService", () => ({
  ReservationService: jest.fn().mockImplementation(() => ({
    createReservation: jest.fn(),
    confirmReservation: jest.fn(),
  })),
}));

// Mock ArduinoService
jest.mock("@/backend/arduino/ArduinoService", () => ({
  ArduinoService: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    toggleTable: jest.fn(),
    sendCommand: jest.fn(),
    isConnected: jest.fn(),
    reset: jest.fn(),
  })),
}));

// Create a mock logger instance with static methods
const mockLogger = {
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};

// Mock logger
jest.mock("@/shared/logger", () => mockLogger);

// Mock PrayerService
jest.mock("@/backend/database/PrayerService", () => ({
  PrayerService: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();

  // Reset logger mock methods
  mockLogger.error.mockClear();
  mockLogger.info.mockClear();
  mockLogger.warn.mockClear();
});
