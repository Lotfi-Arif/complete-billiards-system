import { SerialPort } from "serialport";
import Logger from "@/shared/logger";
import { BusinessError } from "@/shared/types/errors";

/**
 * ArduinoControlService handles communication with an Arduino device via serial port.
 * It is used to control hardware signals such as pool table lights.
 */
export class ArduinoControlService {
  private port: SerialPort;

  /**
   * Initializes a connection to the Arduino.
   * @param portPath - The serial port path (e.g., "/dev/ttyUSB0" or "COM3").
   * @param baudRate - The baud rate for the connection (defaults to 9600).
   */
  constructor(portPath: string, baudRate: number = 9600) {
    this.port = new SerialPort({ baudRate, path: portPath }, (err) => {
      if (err) {
        Logger.error(`Error initializing Arduino serial port: ${err.message}`);
      }
    });

    // Log when the port opens successfully.
    this.port.on("open", () => {
      Logger.info(`Arduino serial port ${portPath} opened at ${baudRate} baud`);
    });

    // Log any errors that occur on the port.
    this.port.on("error", (err) => {
      Logger.error(`Arduino serial port error: ${err.message}`);
    });
  }

  /**
   * Sends a command string to the Arduino.
   * @param command - The command to send (e.g., "LIGHTS_ON").
   * @returns A promise that resolves when the command is sent.
   * @throws BusinessError if the command fails to send.
   */
  async sendCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Append a newline character if needed by your Arduino's firmware.
      const commandWithNewline = command + "\n";
      this.port.write(commandWithNewline, (err) => {
        if (err) {
          Logger.error(`Error sending command "${command}": ${err.message}`);
          return reject(
            new BusinessError(
              `Failed to send command to Arduino: ${err.message}`
            )
          );
        }
        Logger.info(`Command sent to Arduino: ${command}`);
        resolve();
      });
    });
  }

  /**
   * Turns the pool table lights on.
   * @returns A promise that resolves when the command is sent.
   */
  async turnLightsOn(): Promise<void> {
    return this.sendCommand("LIGHTS_ON");
  }

  /**
   * Turns the pool table lights off.
   * @returns A promise that resolves when the command is sent.
   */
  async turnLightsOff(): Promise<void> {
    return this.sendCommand("LIGHTS_OFF");
  }

  /**
   * Sends a command to indicate that the pool table is in a "ready" state.
   * You can customize this command based on your hardware requirements.
   * @returns A promise that resolves when the command is sent.
   */
  async signalTableReady(): Promise<void> {
    return this.sendCommand("TABLE_READY");
  }

  /**
   * Sends a command to signal that a pool table should be turned off,
   * for example during prayer time cooldown.
   * @returns A promise that resolves when the command is sent.
   */
  async signalTableOff(): Promise<void> {
    return this.sendCommand("TABLE_OFF");
  }
}
