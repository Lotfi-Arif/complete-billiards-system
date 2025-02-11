import { Database } from "better-sqlite3";
import bcrypt from "bcryptjs";
import { BaseService } from "./BaseService";
import {
  User,
  UserRole,
  CreateUserDTO,
  UpdateUserDTO,
  UserCredentials,
} from "@/shared/types/User";
import {
  DatabaseError,
  NotFoundError,
  AuthenticationError,
} from "@/shared/types/errors";

export class UserService extends BaseService {
  constructor(db: Database) {
    super(db);
    this.initializeTable();
  }

  private initializeTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'CUSTOMER',
        isActive BOOLEAN NOT NULL DEFAULT 1,
        lastLogin DATETIME,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  private async verifyPassword(
    password: string,
    hash: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async createUser(data: CreateUserDTO): Promise<User> {
    try {
      const passwordHash = await this.hashPassword(data.password);

      const stmt = this.db.prepare(`
        INSERT INTO users (
          username,
          email,
          passwordHash,
          role
        ) VALUES (?, ?, ?, ?)
      `);

      const result = this.transaction(() => {
        return stmt.run(
          data.username,
          data.email,
          passwordHash,
          data.role || UserRole.CUSTOMER
        );
      });

      if (!result.lastInsertRowid) {
        throw new DatabaseError("Failed to create user");
      }

      return this.getUserById(Number(result.lastInsertRowid));
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT") {
        throw new DatabaseError("Username or email already exists");
      }
      throw new DatabaseError("Failed to create user", { error });
    }
  }

  async authenticateUser(credentials: UserCredentials): Promise<User> {
    const stmt = this.db.prepare(`
      SELECT * FROM users 
      WHERE username = ? AND isActive = 1
    `);

    const user = stmt.get(credentials.username) as User | undefined;

    if (!user) {
      throw new AuthenticationError("Invalid credentials");
    }

    const isValid = await this.verifyPassword(
      credentials.password,
      user.passwordHash
    );
    if (!isValid) {
      throw new AuthenticationError("Invalid credentials");
    }

    // Update last login
    await this.updateLastLogin(user.id);

    return this.formatUser(user);
  }

  private async updateLastLogin(id: number): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE users 
      SET lastLogin = CURRENT_TIMESTAMP,
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    this.transaction(() => {
      return stmt.run(id);
    });
  }

  async getUserById(id: number): Promise<User> {
    const stmt = this.db.prepare("SELECT * FROM users WHERE id = ?");
    const user = stmt.get(id) as User | undefined;

    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }

    return this.formatUser(user);
  }

  async getUserByUsername(username: string): Promise<User> {
    const stmt = this.db.prepare("SELECT * FROM users WHERE username = ?");
    const user = stmt.get(username) as User | undefined;

    if (!user) {
      throw new NotFoundError(`User ${username} not found`);
    }

    return this.formatUser(user);
  }

  async updateUser(id: number, data: UpdateUserDTO): Promise<User> {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (data.email) {
        updates.push("email = ?");
        values.push(data.email);
      }
      if (data.password) {
        updates.push("passwordHash = ?");
        values.push(await this.hashPassword(data.password));
      }
      if (data.role) {
        updates.push("role = ?");
        values.push(data.role);
      }
      if (typeof data.isActive === "boolean") {
        updates.push("isActive = ?");
        values.push(data.isActive);
      }

      updates.push("updatedAt = CURRENT_TIMESTAMP");

      const stmt = this.db.prepare(`
        UPDATE users 
        SET ${updates.join(", ")}
        WHERE id = ?
      `);

      const result = this.transaction(() => {
        return stmt.run(...values, id);
      });

      if (result.changes === 0) {
        throw new NotFoundError(`User with id ${id} not found`);
      }

      return this.getUserById(id);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError("Failed to update user", { error });
    }
  }

  async deactivateUser(id: number): Promise<void> {
    await this.updateUser(id, { isActive: false });
  }

  async getActiveUsers(): Promise<User[]> {
    const stmt = this.db.prepare("SELECT * FROM users WHERE isActive = 1");
    const users = stmt.all() as User[];

    return users.map((user) => this.formatUser(user));
  }

  async isUserManager(id: number): Promise<boolean> {
    try {
      const user = await this.getUserById(id);
      return [UserRole.ADMIN, UserRole.MANAGER].includes(user.role);
    } catch (error) {
      return false;
    }
  }

  private formatUser(user: User): User {
    return {
      ...user,
      lastLogin: user.lastLogin ? new Date(user.lastLogin) : undefined,
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt),
    };
  }
}
