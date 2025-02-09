import bcrypt from "bcryptjs";
import { BaseService } from "./BaseService";
import { User } from "../../shared/types/entities";
import { UserSchema } from "../../shared/types/validation/schemas";
import { UserRecord } from "../../shared/types/database";
import { DatabaseError, ValidationError } from "../../shared/types/errors";
import { z } from "zod";

export class UserService extends BaseService {
  async createUser(
    username: string,
    password: string,
    role: User["role"]
  ): Promise<number> {
    try {
      UserSchema.parse({ username, password, role });
      const hashedPassword = await bcrypt.hash(password, 10);

      return this.db.transaction(() => {
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

      return {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: new Date(user.created_at),
      };
    } catch (error) {
      throw new DatabaseError("Failed to verify user", { error });
    }
  }

  async updateUserRole(userId: number, newRole: User["role"]): Promise<void> {
    try {
      const result = this.prepareStatement<[string, number], void>(
        "UPDATE users SET role = ? WHERE id = ?"
      ).run(newRole, userId);

      if (result.changes === 0) {
        throw new ValidationError("User not found");
      }

      this.logActivity("user", userId, "role_updated", userId, { newRole });
    } catch (error) {
      throw new DatabaseError("Failed to update user role", { error });
    }
  }

  async isUserManager(userId: number): Promise<boolean> {
    const user = this.prepareStatement<[number], UserRecord>(
      "SELECT role FROM users WHERE id = ?"
    ).get(userId);
    return user?.role === "manager";
  }

  async getUserById(userId: number): Promise<User | null> {
    try {
      const user = this.prepareStatement<[number], UserRecord>(
        "SELECT * FROM users WHERE id = ?"
      ).get(userId);

      if (!user) return null;

      return {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: new Date(user.created_at),
      };
    } catch (error) {
      throw new DatabaseError("Failed to get user", { error });
    }
  }
}
