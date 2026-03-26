import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./../../shared/prisma";
import { LoginInput } from "./auth.schema";

export class AuthService {
  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new Error("Invalid credentials");
    }

    const isValid = await bcrypt.compare(data.password, user.password);

    if (!isValid) {
      throw new Error("Invalid credentials");
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRETE!,
      { expiresIn: "30m" },
    );

    const { password: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      token,
    };
  }
}
