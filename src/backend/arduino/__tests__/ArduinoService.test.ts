// src/backend/arduino/__tests__/ArduinoService.test.ts
import { SerialPort } from "serialport";
import { ArduinoService } from "../ArduinoService";
import { ArduinoError } from "../../../shared/types/errors";

// Mock SerialPort
jest.mock("serialport", () => {
  const mockSerialPort = jest.fn().mockImplementation((options) => {
    const eventHandlers: { [key: string]: ((...args: any[]) => void)[] } = {};

    return {
      path: options.path,
      baudRate: options.baudRate,
      write: jest.fn((data, callback) => callback()),
      on: jest.fn((event, handler) => {
        if (!eventHandlers[event]) {
          eventHandlers[event] = [];
        }
        eventHandlers[event].push(handler);
        // Immediately trigger 'open' event
        if (event === "open") {
          handler();
        }
      }),
      close: jest.fn((callback) => callback()),
      emit: (event: string, ...args: any[]) => {
        if (eventHandlers[event]) {
          eventHandlers[event].forEach((handler) => handler(...args));
        }
      },
    };
  });

  return {
    SerialPort: mockSerialPort,
    list: jest.fn().mockResolvedValue([
      {
        path: "/dev/ttyUSB0",
        manufacturer: "Arduino",
        vendorId: "2341",
        productId: "0043",
      },
    ]),
  };
});

describe("ArduinoService", () => {
  let arduino: ArduinoService;

  beforeEach(() => {
    jest.clearAllMocks();
    arduino = new ArduinoService({ autoConnect: false });
  });

  afterEach(async () => {
    await arduino.cleanup();
  });

  describe("Connection Management", () => {
    it("should connect to Arduino successfully", async () => {
      await arduino.connect();
      expect(arduino.isConnected()).toBe(true);
    });

    it("should handle connection failure when no Arduino is found", async () => {
      // Mock no Arduino found
      (SerialPort.list as jest.Mock).mockResolvedValueOnce([]);

      const connectPromise = arduino.connect();
      await expect(connectPromise).rejects.toThrow(ArduinoError);
      expect(arduino.isConnected()).toBe(false);
    });

    it("should retry connection on failure", async () => {
      const retryAttempts = 2;
      arduino = new ArduinoService({
        autoConnect: false,
        retryAttempts,
        retryDelay: 100,
      });

      // Mock first attempt failing, second succeeding
      (SerialPort.list as jest.Mock)
        .mockRejectedValueOnce(new Error("Connection failed"))
        .mockResolvedValueOnce([
          {
            path: "/dev/ttyUSB0",
            manufacturer: "Arduino",
          },
        ]);

      await arduino.connect();
      expect(SerialPort.list).toHaveBeenCalledTimes(2);
      expect(arduino.isConnected()).toBe(true);
    });
  });

  describe("Table Control", () => {
    beforeEach(async () => {
      await arduino.connect();
    });

    it("should toggle table state successfully", async () => {
      await arduino.toggleTable(1, true);
      expect(arduino.getTableState(1)).toBe(true);

      await arduino.toggleTable(1, false);
      expect(arduino.getTableState(1)).toBe(false);
    });

    it("should handle multiple tables independently", async () => {
      await arduino.toggleTable(1, true);
      await arduino.toggleTable(2, false);

      expect(arduino.getTableState(1)).toBe(true);
      expect(arduino.getTableState(2)).toBe(false);
    });

    it("should format commands correctly", async () => {
      await arduino.toggleTable(1, true);

      const mockSerialPort = (SerialPort as unknown as jest.Mock).mock
        .results[0].value;
      expect(mockSerialPort.write).toHaveBeenCalledWith(
        "TABLE_1:ON\n",
        expect.any(Function)
      );
    });

    it("should handle write errors", async () => {
      // Mock write error
      const mockSerialPort = (SerialPort as unknown as jest.Mock).mock
        .results[0].value;
      mockSerialPort.write.mockImplementationOnce(
        (data: string, callback: (error?: Error) => void) => {
          callback(new Error("Write failed"));
        }
      );

      await expect(arduino.toggleTable(1, true)).rejects.toThrow(ArduinoError);
      expect(arduino.getTableState(1)).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should handle port errors after connection", async () => {
      await arduino.connect();

      const mockSerialPort = (SerialPort as unknown as jest.Mock).mock
        .results[0].value;
      mockSerialPort.emit("error", new Error("Port error"));

      expect(arduino.isConnected()).toBe(false);
    });

    it("should attempt reconnection on error when autoConnect is enabled", async () => {
      arduino = new ArduinoService({
        autoConnect: true,
        retryDelay: 100,
      });

      await arduino.connect();
      const mockSerialPort = (SerialPort as unknown as jest.Mock).mock
        .results[0].value;
      mockSerialPort.emit("error", new Error("Port error"));

      // Wait for reconnection attempt
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(SerialPort.list).toHaveBeenCalledTimes(2);
    });
  });

  describe("Cleanup", () => {
    it("should close port on cleanup", async () => {
      await arduino.connect();
      await arduino.cleanup();

      const mockSerialPort = (SerialPort as unknown as jest.Mock).mock
        .results[0].value;
      expect(mockSerialPort.close).toHaveBeenCalled();
      expect(arduino.isConnected()).toBe(false);
    });

    it("should handle cleanup when not connected", async () => {
      await expect(arduino.cleanup()).resolves.not.toThrow();
    });
  });
});
