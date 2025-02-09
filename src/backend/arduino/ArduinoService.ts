import { SerialPort } from "serialport";
import { ArduinoError } from "../../shared/types/errors";

export interface ArduinoConfig {
  baudRate?: number;
  autoConnect?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}

export class ArduinoService {
  private port: SerialPort | null = null;
  private connectAttempts = 0;
  private readonly config: Required<ArduinoConfig>;
  private connectionPromise: Promise<void> | null = null;
  private tableStates: Map<number, boolean> = new Map();

  constructor(config: ArduinoConfig = {}) {
    this.config = {
      baudRate: config.baudRate ?? 9600,
      autoConnect: config.autoConnect ?? true,
      retryAttempts: config.retryAttempts ?? 3,
      retryDelay: config.retryDelay ?? 1000,
    };

    if (this.config.autoConnect) {
      this.connect().catch((error) => {
        console.error("Failed to auto-connect to Arduino:", error);
      });
    }
  }

  public async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.attemptConnection();
    return this.connectionPromise;
  }

  private async attemptConnection(): Promise<void> {
    while (this.connectAttempts < this.config.retryAttempts) {
      try {
        const ports = await SerialPort.list();
        const arduinoPort = ports.find(
          (port) =>
            port.manufacturer?.toLowerCase().includes("arduino") ||
            port.vendorId?.toLowerCase() === "2341"
        );

        if (!arduinoPort) {
          throw new ArduinoError("Arduino board not found", {
            availablePorts: ports.map((p) => ({
              path: p.path,
              manufacturer: p.manufacturer,
            })),
          });
        }

        this.port = new SerialPort({
          path: arduinoPort.path,
          baudRate: this.config.baudRate,
        });

        await new Promise<void>((resolve, reject) => {
          if (!this.port)
            return reject(new ArduinoError("Port not initialized"));

          this.port.on("open", () => {
            console.log("Arduino connection established");
            resolve();
          });

          this.port.on("error", (error) => {
            reject(new ArduinoError("Failed to open port", { error }));
          });
        });

        // Setup error handler for future errors
        this.port.on("error", (error) => {
          console.error("Arduino error:", error);
          this.handleConnectionError(error);
        });

        return;
      } catch (error) {
        this.connectAttempts++;
        if (this.connectAttempts >= this.config.retryAttempts) {
          this.connectionPromise = null;
          throw new ArduinoError("Failed to connect to Arduino after retries", {
            attempts: this.connectAttempts,
            error,
          });
        }
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.retryDelay)
        );
      }
    }
  }

  private handleConnectionError(error: Error): void {
    console.error("Arduino connection error:", error);
    this.port = null;
    this.connectionPromise = null;

    if (this.config.autoConnect) {
      this.connectAttempts = 0;
      this.connect().catch(console.error);
    }
  }

  public async toggleTable(tableId: number, state: boolean): Promise<void> {
    try {
      await this.ensureConnection();

      const command = `TABLE_${tableId}:${state ? "ON" : "OFF"}\n`;
      await this.sendCommand(command);

      this.tableStates.set(tableId, state);
    } catch (error) {
      throw new ArduinoError("Failed to toggle table", {
        tableId,
        state,
        error,
      });
    }
  }

  private async ensureConnection(): Promise<void> {
    if (!this.port) {
      await this.connect();
    }
  }

  private async sendCommand(command: string): Promise<void> {
    if (!this.port) {
      throw new ArduinoError("Not connected to Arduino");
    }

    return new Promise((resolve, reject) => {
      this.port!.write(command, (error) => {
        if (error) {
          reject(
            new ArduinoError("Failed to send command", { command, error })
          );
        } else {
          resolve();
        }
      });
    });
  }

  public getTableState(tableId: number): boolean {
    return this.tableStates.get(tableId) ?? false;
  }

  public async cleanup(): Promise<void> {
    if (this.port) {
      return new Promise((resolve) => {
        this.port!.close(() => {
          this.port = null;
          this.connectionPromise = null;
          resolve();
        });
      });
    }
  }

  // For testing purposes
  public isConnected(): boolean {
    return this.port !== null;
  }
}
