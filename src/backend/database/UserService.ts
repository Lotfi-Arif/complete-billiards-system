import bcrypt from "bcryptjs";
import { BaseService } from "./BaseService";
import { User, UserRole } from "../../shared/types/entities";
import { UserRecord } from "../../shared/types/database";
import { DatabaseError, ValidationError } from "../../shared/types/errors";
import { z } from "zod";
import Database from "better-sqlite3";
import { UserSchema } from "@/shared/types/validation/schemas";

export class UserService extends BaseService {
  private readonly SALT_ROUNDS = 10;

  constructor(db: Database.Database) {
    super(db);
  }

  async createUser(
    username: string,
    password: string,
    role: UserRole
  ): Promise<number> {
    try {
      // Validate input data
      UserSchema.parse({ username, password, role });

      return this.db.transaction(async () => {
        // Check if username already exists
        const existingUser = this.prepareStatement<[string], { id: number }>(
          "SELECT id FROM users WHERE username = ?"
        ).get(username);

        if (existingUser) {
          throw new ValidationError("Username already exists");
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

        // Create user
        const result = this.prepareStatement<
          [string, string, string],
          UserRecord
        >("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run(
          username,
          hashedPassword,
          role
        );

        const userId = Number(result.lastInsertRowid);

        this.logActivity("user", userId, "created", userId);

        return userId;
      })();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError("Invalid user data", { error: error.errors });
      }
      throw new DatabaseError("Failed to create user", { error });
    }
  }

  async verifyUser(username: string, password: string): Promise<User | null> {
    try {
      const stmt = this.prepareStatement<[string], UserRecord>(
        "SELECT * FROM users WHERE username = ?"
      );

      const user = stmt.get(username);
      if (!user) return null;

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) return null;

      return this.mapUserRecord(user);
    } catch (error) {
      throw new DatabaseError("Failed to verify user", { error });
    }
  }

  async updateUserRole(userId: number, newRole: User["role"]): Promise<void> {
    try {
      // Validate role
      UserSchema.shape.role.parse(newRole);

      const result = this.prepareStatement<[string, number], void>(
        "UPDATE users SET role = ? WHERE id = ?"
      ).run(newRole, userId);

      if (result.changes === 0) {
        throw new ValidationError("User not found");
      }

      this.logActivity("user", userId, "role_updated", userId, { newRole });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError("Invalid role", { error: error.errors });
      }
      throw new DatabaseError("Failed to update user role", { error });
    }
  }

  async updatePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      // Validate new password
      UserSchema.shape.password.parse(newPassword);

      return this.db.transaction(async () => {
        // Get current user data
        const user = await this.getUserById(userId);
        if (!user) {
          throw new ValidationError("User not found");
        }

        // Verify current password
        const currentUser = await this.getUserWithPassword(userId);
        if (!currentUser) {
          throw new ValidationError("User not found");
        }

        const isValid = await bcrypt.compare(
          currentPassword,
          currentUser.password
        );
        if (!isValid) {
          throw new ValidationError("Current password is incorrect");
        }

        // Hash and update new password
        const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

        const result = this.prepareStatement<[string, number], void>(
          "UPDATE users SET password = ? WHERE id = ?"
        ).run(hashedPassword, userId);

        if (result.changes === 0) {
          throw new ValidationError("Failed to update password");
        }

        this.logActivity("user", userId, "password_updated", userId);
      })();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError("Invalid password format", {
          error: error.errors,
        });
      }
      throw new DatabaseError("Failed to update password", { error });
    }
  }

  async getUserById(userId: number): Promise<User | null> {
    try {
      const user = this.prepareStatement<[number], UserRecord>(
        "SELECT * FROM users WHERE id = ?"
      ).get(userId);

      if (!user) return null;

      return this.mapUserRecord(user);
    } catch (error) {
      throw new DatabaseError("Failed to get user", { error });
    }
  }

  async getUsers(role?: User["role"]): Promise<User[]> {
    try {
      let stmt: Database.Statement<any[], UserRecord>;

      if (role) {
        stmt = this.prepareStatement<[string], UserRecord>(
          "SELECT * FROM users WHERE role = ? ORDER BY username"
        );
        return stmt.all(role).map(this.mapUserRecord);
      } else {
        stmt = this.prepareStatement<[], UserRecord>(
          "SELECT * FROM users ORDER BY username"
        );
        return stmt.all().map(this.mapUserRecord);
      }
    } catch (error) {
      throw new DatabaseError("Failed to get users", { error });
    }
  }

  async isUserManager(userId: number): Promise<boolean> {
    try {
      const user = await this.getUserById(userId);
      return user?.role === "manager";
    } catch (error) {
      throw new DatabaseError("Failed to check user role", { error });
    }
  }

  private async getUserWithPassword(
    userId: number
  ): Promise<UserRecord | undefined> {
    return this.prepareStatement<[number], UserRecord>(
      "SELECT * FROM users WHERE id = ?"
    ).get(userId);
  }

  private mapUserRecord(record: UserRecord): User {
    return {
      id: record.id,
      username: record.username,
      role: record.role,
      createdAt: new Date(record.created_at),
    };
  }
}
