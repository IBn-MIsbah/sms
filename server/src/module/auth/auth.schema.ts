import { z } from "zod";

export const loginInputSchema = z.object({
  email: z.email(),
  password: z.string().min(1, { error: "Password is required" }),
});

export type LoginInput = z.infer<typeof loginInputSchema>;
