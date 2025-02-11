import { ArduinoControlService } from "../ArduinoControlService";
import { SerialPort } from "serialport";
import Logger from "@/shared/logger";
import { BusinessError } from "@/shared/types/errors";

// Mock SerialPort
jest.mock("serialport", () => {
  const mockOn = jest.fn();
  const mockWrite = jest.fn();

  return {
    SerialPort: jest.fn().mockImplementation((options, _) => ({
      on: mockOn,
      write: mockWrite,
      path: options.path,
      baudRate: options.baudRate,
    })),
  };
});

describe("ArduinoControlService", () => {
  let service: ArduinoControlService;
  let mockPort: jest.Mocked<SerialPort>;
  const defaultPortPath = "/dev/ttyUSB0";
  const defaultBaudRate = 9600;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ArduinoControlService(defaultPortPath);
    mockPort = (SerialPort as unknown as jest.Mock).mock.results[0].value;
  });

  describe("constructor", () => {
    it("should initialize with default baud rate", () => {
      expect(SerialPort).toHaveBeenCalledWith(
        { baudRate: defaultBaudRate, path: defaultPortPath },
        expect.any(Function)
      );
    });

    it("should initialize with custom baud rate", () => {
      const customBaudRate = 115200;
      service = new ArduinoControlService(defaultPortPath, customBaudRate);
      expect(SerialPort).toHaveBeenCalledWith(
        { baudRate: customBaudRate, path: defaultPortPath },
        expect.any(Function)
      );
    });

    it("should set up error and open event handlers", () => {
      expect(mockPort.on).toHaveBeenCalledWith("open", expect.any(Function));
      expect(mockPort.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("should log error on initialization failure", () => {
      const error = new Error("Port access denied");
      const initCallback = (SerialPort as unknown as jest.Mock).mock
        .calls[0][1];

      initCallback(error);
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Error initializing Arduino serial port")
      );
    });

    it("should log success on port open", () => {
      const openCall = mockPort.on.mock.calls.find(
        (call) => call[0] === "open"
      );
      if (!openCall) throw new Error("Open handler not found");
      const openHandler = openCall[1];
      openHandler();
      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Arduino serial port ${defaultPortPath} opened`)
      );
    });

    it("should log error on port error", () => {
      const error = new Error("Communication error");
      const errorHandlerCall = mockPort.on.mock.calls.find(
        (call) => call[0] === "error"
      );
      if (!errorHandlerCall) throw new Error("Error handler not found");
      const errorHandler = errorHandlerCall[1];
      errorHandler(error);
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Arduino serial port error")
      );
    });
  });

  describe("sendCommand", () => {
    it("should send command with newline character", async () => {
      mockPort.write.mockImplementation((_, callback) => {
        if (callback) callback(null);
        return true;
      });

      await service.sendCommand("TEST_COMMAND");
      expect(mockPort.write).toHaveBeenCalledWith(
        "TEST_COMMAND\n",
        expect.any(Function)
      );
      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Command sent to Arduino: TEST_COMMAND")
      );
    });

    it("should handle write errors", async () => {
      const error = new Error("Write failed");
      mockPort.write.mockImplementation((_, callback) => {
        if (callback) callback(error);
        return true;
      });

      await expect(service.sendCommand("TEST_COMMAND")).rejects.toThrow(
        BusinessError
      );
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Error sending command")
      );
    });
  });

  describe("table control commands", () => {
    beforeEach(() => {
      mockPort.write.mockImplementation((_, callback) => {
        if (callback) callback(null);
        return true;
      });
    });

    it("should send correct command for turnLightsOn", async () => {
      await service.turnLightsOn();
      expect(mockPort.write).toHaveBeenCalledWith(
        "LIGHTS_ON\n",
        expect.any(Function)
      );
    });

    it("should send correct command for turnLightsOff", async () => {
      await service.turnLightsOff();
      expect(mockPort.write).toHaveBeenCalledWith(
        "LIGHTS_OFF\n",
        expect.any(Function)
      );
    });

    it("should send correct command for signalTableReady", async () => {
      await service.signalTableReady();
      expect(mockPort.write).toHaveBeenCalledWith(
        "TABLE_READY\n",
        expect.any(Function)
      );
    });

    it("should send correct command for signalTableOff", async () => {
      await service.signalTableOff();
      expect(mockPort.write).toHaveBeenCalledWith(
        "TABLE_OFF\n",
        expect.any(Function)
      );
    });

    it("should handle errors for all table control commands", async () => {
      const error = new Error("Write failed");
      mockPort.write.mockImplementation((_, callback) => {
        if (callback) callback(error);
        return true;
      });

      await expect(service.turnLightsOn()).rejects.toThrow(BusinessError);
      await expect(service.turnLightsOff()).rejects.toThrow(BusinessError);
      await expect(service.signalTableReady()).rejects.toThrow(BusinessError);
      await expect(service.signalTableOff()).rejects.toThrow(BusinessError);
    });
  });

  describe("error handling", () => {
    it("should return detailed error messages", async () => {
      const error = new Error("Port locked");
      mockPort.write.mockImplementation((_, callback) => {
        if (callback) callback(error);
        return true;
      });

      try {
        await service.sendCommand("TEST_COMMAND");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessError);
        expect(e.message).toContain("Port locked");
      }
    });

    it("should log all errors with appropriate context", async () => {
      const error = new Error("Connection lost");
      mockPort.write.mockImplementation((_, callback) => {
        if (callback) callback(error);
        return true;
      });

      try {
        await service.sendCommand("TEST_COMMAND");
      } catch (e) {
        expect(Logger.error).toHaveBeenCalledWith(
          expect.stringContaining("TEST_COMMAND")
        );
        expect(Logger.error).toHaveBeenCalledWith(
          expect.stringContaining("Connection lost")
        );
      }
    });
  });

  describe("edge cases", () => {
    it("should handle empty commands", async () => {
      mockPort.write.mockImplementation((_, callback) => {
        if (callback) callback(null);
        return true;
      });

      await service.sendCommand("");
      expect(mockPort.write).toHaveBeenCalledWith("\n", expect.any(Function));
    });

    it("should handle commands with special characters", async () => {
      mockPort.write.mockImplementation((_, callback) => {
        if (callback) callback(null);
        return true;
      });

      const specialCommand = "TEST@#$%^&*";
      await service.sendCommand(specialCommand);
      expect(mockPort.write).toHaveBeenCalledWith(
        `${specialCommand}\n`,
        expect.any(Function)
      );
    });
  });
});
