export interface User {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  STAFF = "STAFF",
  CUSTOMER = "CUSTOMER",
}

export interface CreateUserDTO {
  username: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface UpdateUserDTO {
  email?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface UserCredentials {
  username: string;
  password: string;
}
