import { z } from "zod";

export const SignupSchema = z.object({
    email: z.email(),
    password: z.string().min(6),
    role: z.enum(["STUDENT", "INSTRUCTOR"]),
    name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name cannot exceed 50 characters")
});

export const LoginSchema=z.object({
    email:z.email(),
    password:z.string().min(6)
})