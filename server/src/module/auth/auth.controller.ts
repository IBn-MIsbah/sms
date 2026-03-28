import { Request, Response, NextFunction } from "express";
import { loginInputSchema } from "./auth.schema";
import { prisma } from "../../shared/prisma";
import bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";

// export const authController = {
//   login: async (req: Request, res: Response) => {
//     try {
//       const { email, password } = loginInputSchema.parse(req.body);

//       const user = await prisma.user.findUnique({
//         where: { email: email },
//       });

//       if (!user) {
//         res.status(404).json({
//           success: false,
//           code: "USER_NOT_FOUND",
//           message: "Invalid Credentials",
//         });
//       }

//       const isPasswordValid = await bcrypt.compare(
//         password,
//         user?.password as string,
//       );

//       if (!isPasswordValid) {
//         res.status(400).json({
//           success: false,
//           code: "INVALID_PASSWORD",
//           message: "Invalid Credentials",
//         });
//       }

//       return res.status(200).json({
//         success: true,
//         code: "LOGIN_SUCCESS",
//         data: {
//           id: user?.id,
//           fname: user?.firstName,
//           lname: user?.lastName,
//           role: user?.role,
//           schoolId: user?.schoolId,
//         },
//       });
//     } catch (error) {
//       console.log("Login error:", error);
//       return res.status(500).json({
//         success: false,
//         code: "ERROR_LOGIN",
//         message: error,
//       });
//     }
//   },
// };

export class AuthController {
  constructor(private authService: AuthService) {}

  async login(req: Request, res: Response, next: NextFunction) {
    req.logger.info("Proccessing login request");
    try {
      const validatedData = loginInputSchema.parse(req.body);
      const result = await this.authService.login(validatedData);

      req.logger.info("Login successful", { userId: result.user.id });

      return res.json({
        success: true,
        data: result,
        message: "Login Successfully",
      });
    } catch (error: any) {
      req.logger.error("Login failed", { error: error.message });
      next(error);
    }
  }
}
