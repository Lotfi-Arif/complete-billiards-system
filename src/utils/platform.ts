import { SerialPort } from "serialport";
import path from "path";
import { app } from "electron";
import Logger from "../shared/logger";

export class PlatformUtils {
  static getPlatform() {
    return process.platform;
  }

  static isWindows() {
    return process.platform === "win32";
  }

  static isMac() {
    return process.platform === "darwin";
  }

  static isLinux() {
    return process.platform === "linux";
  }

  static getAppDataPath() {
    switch (process.platform) {
      case "win32":
        return path.join(app.getPath("appData"), "PoolHallManager");
      case "darwin":
        return path.join(app.getPath("userData"), "PoolHallManager");
      case "linux":
        return path.join(app.getPath("userData"), "PoolHallManager");
      default:
        return path.join(app.getPath("userData"), "PoolHallManager");
    }
  }

  static getDatabasePath() {
    return path.join(this.getAppDataPath(), "pool-hall.db");
  }

  static async getSerialPorts() {
    try {
      const ports = await SerialPort.list();
      Logger.info("Available serial ports:", ports);
      return ports;
    } catch (error) {
      Logger.error("Error listing serial ports:", error);
      return [];
    }
  }

  static async findArduinoPort() {
    try {
      const ports = await this.getSerialPorts();

      const arduinoPatterns = {
        win32: /COM[0-9]+/,
        darwin: /\/dev\/cu\.usbmodem|\/dev\/cu\.usbserial/,
        linux: /\/dev\/ttyUSB|\/dev\/ttyACM/,
      };

      const pattern =
        arduinoPatterns[process.platform as keyof typeof arduinoPatterns];
      const arduinoPort = ports.find((port) => pattern.test(port.path));

      if (arduinoPort) {
        Logger.info("Found Arduino port:", arduinoPort.path);
        return arduinoPort.path;
      }

      Logger.warn("No Arduino port found");
      return null;
    } catch (error) {
      Logger.error("Error finding Arduino port:", error);
      return null;
    }
  }

  static getDefaultSerialConfig() {
    return {
      baudRate: 9600,
      dataBits: 8,
      parity: "none" as const,
      stopBits: 1,
      autoOpen: false,
    };
  }
}
