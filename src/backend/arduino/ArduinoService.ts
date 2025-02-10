import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import EventEmitter from "events";

interface ArduinoConfig {
  baudRate?: number;
  port?: string;
  autoConnect?: boolean;
}

export class ArduinoService extends EventEmitter {
  private port: SerialPort | null = null;
  private parser: ReadlineParser | null = null;
  private connected = false;
  private readonly MAX_TABLES = 8; // UNO limitation using pins 2-9

  constructor(config: ArduinoConfig = {}) {
    super();
    const defaultPort = process.platform === "win32" ? "COM3" : "/dev/ttyUSB0";

    this.port = new SerialPort({
      path: config.port || defaultPort,
      baudRate: config.baudRate || 9600,
    });

    this.parser = this.port.pipe(new ReadlineParser({ delimiter: "\n" }));
    this.setupEventListeners();

    if (config.autoConnect !== false) {
      this.connect();
    }
  }

  async connect(): Promise<void> {
    try {
      if (this.connected) return;

      await new Promise<void>((resolve, reject) => {
        if (!this.port) {
          reject(new Error("Serial port not initialized"));
          return;
        }

        this.port.open((err) => {
          if (err) {
            reject(err);
          } else {
            this.connected = true;
            resolve();
            this.emit("connected");
          }
        });
      });
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }

  async toggleTable(tableId: number, state: boolean): Promise<void> {
    if (!this.isConnected()) {
      throw new Error("Arduino not connected");
    }

    if (tableId < 1 || tableId > this.MAX_TABLES) {
      throw new Error(
        `Invalid table ID. Must be between 1 and ${this.MAX_TABLES}`
      );
    }

    const command = `T${tableId}:${state ? "1" : "0"}\n`;

    return new Promise((resolve, reject) => {
      this.port?.write(command, (error) => {
        if (error) {
          reject(error);
          return;
        }

        // Wait for acknowledgment
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error("Command timeout"));
        }, 1000);

        const handleResponse = (response: string) => {
          if (response.trim() === "ACK") {
            cleanup();
            resolve();
          } else if (response.startsWith("ERR")) {
            cleanup();
            reject(new Error(`Command failed: ${response}`));
          }
        };

        const cleanup = () => {
          clearTimeout(timeout);
          this.parser?.removeListener("data", handleResponse);
        };

        this.parser?.once("data", handleResponse);
      });
    });
  }

  isConnected(): boolean {
    return this.connected && this.port?.isOpen === true;
  }

  async reset(): Promise<void> {
    if (!this.isConnected()) {
      throw new Error("Arduino not connected");
    }

    return new Promise((resolve, reject) => {
      this.port?.write("RESET\n", (error) => {
        if (error) {
          reject(error);
          return;
        }

        this.parser?.once("data", (response) => {
          if (response.trim() === "ACK") {
            resolve();
          } else {
            reject(new Error("Reset failed"));
          }
        });
      });
    });
  }

  private setupEventListeners(): void {
    this.port?.on("error", (error) => {
      this.connected = false;
      this.emit("error", error);
    });

    this.port?.on("close", () => {
      this.connected = false;
      this.emit("disconnected");
    });

    this.parser?.on("data", (data) => {
      this.emit("data", data);
    });
  }

  cleanup(): void {
    if (this.port?.isOpen) {
      this.port.close();
    }
    this.connected = false;
  }
}
