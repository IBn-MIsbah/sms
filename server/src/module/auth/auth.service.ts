import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./../../shared/prisma";
import { LoginInput } from "./auth.schema";
import { ContextLogger, LoggerFactory } from "../../shared/utils/logger";
import {
  NotFoundError,
  UnauthorizedError,
} from "../../shared/errors/custom-errors";

export class AuthService {
  private logger: ContextLogger;
  constructor() {
    this.logger = LoggerFactory.createModuleLogger("AuthService");
    this.logger.info("AuthService initialized");
  }
  async login(data: LoginInput) {
    this.logger.info("Login attempt", { email: data.email });
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      this.logger.warn("Login failed: User not found", { email: data.email });
      throw new NotFoundError("User");
    }

    const isValid = await bcrypt.compare(data.password, user.password);

    if (!isValid) {
      this.logger.warn("Login failed: invalid password", { email: data.email });
      throw new UnauthorizedError("Invalid credentials");
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRETE!,
      { expiresIn: "30m" },
    );

    const { password: _, ...userWithoutPassword } = user;
    this.logger.info("User logged in successfully");
    return {
      user: userWithoutPassword,
      token,
    };
  }
}
