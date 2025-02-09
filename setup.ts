import "@testing-library/jest-dom";
import { jest } from "@jest/globals";
import { SerialPort } from "serialport";
import { BrowserWindow, IpcMain, IpcRenderer } from "electron";
import Database from "better-sqlite3";

// Mock electron
jest.mock("electron", () => {
  const mockIpcMain = {
    handle: jest.fn(),
    on: jest.fn(),
  } as unknown as IpcMain;

  const mockIpcRenderer = {
    invoke: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
  } as unknown as IpcRenderer;

  return {
    app: {
      getPath: jest.fn(),
      whenReady: jest.fn().mockResolvedValue(undefined as never),
      on: jest.fn(),
      quit: jest.fn(),
    },
    BrowserWindow: jest.fn().mockImplementation(() => ({
      loadURL: jest.fn(),
      loadFile: jest.fn(),
      on: jest.fn(),
      webContents: {
        openDevTools: jest.fn(),
      },
    })) as unknown as typeof BrowserWindow,
    ipcMain: mockIpcMain,
    ipcRenderer: mockIpcRenderer,
    contextBridge: {
      exposeInMainWorld: jest.fn(),
    },
  };
});

// Mock serialport for Arduino communication
jest.mock("serialport", () => ({
  SerialPort: jest.fn().mockImplementation(() => ({
    write: jest.fn(),
    on: jest.fn(),
  })) as unknown as typeof SerialPort,
  list: jest.fn(),
}));

// Mock better-sqlite3
jest.mock("better-sqlite3", () => {
  return jest.fn().mockImplementation(() => ({
    prepare: jest.fn().mockReturnValue({
      run: jest.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 }),
      get: jest.fn(),
      all: jest.fn(),
      finalize: jest.fn(),
    }),
    transaction: jest.fn((fn: Function) => () => fn()),
    exec: jest.fn(),
    close: jest.fn(),
  })) as unknown as typeof Database;
});

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Mock bcryptjs
jest.mock("bcryptjs", () => ({
  hash: jest
    .fn()
    .mockImplementation(async (): Promise<string> => "hashed_password"),
  compare: jest.fn().mockImplementation(async (): Promise<boolean> => true),
}));

// Mock adhan
jest.mock("adhan", () => {
  const mockDate = new Date("2024-02-09T12:00:00Z");

  return {
    PrayerTimes: jest.fn().mockImplementation(() => ({
      fajr: new Date(mockDate.setHours(5, 0)),
      sunrise: new Date(mockDate.setHours(6, 30)),
      dhuhr: new Date(mockDate.setHours(12, 30)),
      asr: new Date(mockDate.setHours(15, 45)),
      maghrib: new Date(mockDate.setHours(18, 0)),
      isha: new Date(mockDate.setHours(19, 30)),
    })),
    Coordinates: jest.fn(),
    CalculationMethod: {
      UmmAlQura: () => ({
        adjustments: {},
        methodParams: {},
      }),
    },
  };
});

// Global test setup
beforeAll(() => {
  jest.useFakeTimers();
  process.env.TZ = "Asia/Riyadh";

  // Set up window mock with proper typing
  (global as any).window = {
    ...(global as any).window,
    electronAPI: {
      invoke: jest.fn(),
      on: jest.fn(),
    },
  };
});

afterAll(() => {
  jest.useRealTimers();
  jest.resetModules();
  jest.clearAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.setSystemTime(new Date("2024-02-09T12:00:00Z"));
});

// Custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Error handler
process.on("unhandledRejection", (error) => {
  console.error("Unhandled Promise Rejection:", error);
  process.exit(1);
});

// Console mocking
const originalConsole = { ...console };
beforeAll(() => {
  if (process.env.DEBUG !== "true") {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
  }
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

// Database helper
export const resetDatabase = (): void => {
  const db = require("better-sqlite3")();
  db.exec("DELETE FROM users");
  db.exec("DELETE FROM pool_tables");
  db.exec("DELETE FROM sessions");
  db.exec("DELETE FROM reservations");
  db.close();
};

// Test data
interface User {
  username: string;
  password: string;
  role: "manager" | "staff" | "customer";
}

interface Table {
  id: number;
  status: "available" | "occupied";
}

interface TestData {
  users: {
    manager: User;
    staff: User;
    customer: User;
  };
  tables: {
    available: Table;
    occupied: Table;
  };
}

export const testData: TestData = {
  users: {
    manager: {
      username: "manager",
      password: "manager123",
      role: "manager",
    },
    staff: {
      username: "staff",
      password: "staff123",
      role: "staff",
    },
    customer: {
      username: "customer",
      password: "customer123",
      role: "customer",
    },
  },
  tables: {
    available: {
      id: 1,
      status: "available",
    },
    occupied: {
      id: 2,
      status: "occupied",
    },
  },
};
