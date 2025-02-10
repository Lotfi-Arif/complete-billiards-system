export enum TableStatus {
  AVAILABLE = "AVAILABLE",
  IN_USE = "IN_USE",
  MAINTENANCE = "MAINTENANCE",
  RESERVED = "RESERVED",
}

export interface Table {
  id: number;
  tableNumber: number;
  status: TableStatus;
  lastMaintenance: Date | null;
  condition: string;
  hourlyRate: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTableDTO {
  tableNumber: number;
  hourlyRate: number;
  condition?: string;
}

export interface UpdateTableDTO {
  status?: TableStatus;
  condition?: string;
  hourlyRate?: number;
  lastMaintenance?: Date;
  isActive?: boolean;
}
