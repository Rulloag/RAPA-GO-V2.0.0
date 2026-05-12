import { UsersRepository } from "./users.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { User, CreateUserInput, UserStatus } from "./users.types.js";

/**
 * UsersService — business logic for user management.
 * Coordinates validation, uniqueness checks and repository calls.
 */
export class UsersService {
  private readonly repo: UsersRepository;

  constructor(repo?: UsersRepository) {
    this.repo = repo ?? new UsersRepository();
  }

  async getById(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw AppError.notFound(`User ${id} not found.`);
    return user;
  }

  async getByEmail(email: string): Promise<User | null> {
    return this.repo.findByEmail(email);
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const existing = await this.repo.findByEmail(input.email);
    if (existing) {
      throw new AppError({
        code: "AUTH_EMAIL_TAKEN",
        message: `Email ${input.email} is already registered.`,
        statusCode: 409,
      });
    }
    return this.repo.createUser(input);
  }

  async updateStatus(userId: string, status: UserStatus): Promise<User> {
    return this.repo.updateUserStatus(userId, status);
  }

  async verifyUser(userId: string): Promise<User> {
    return this.repo.markUserVerified(userId);
  }
}
