import { z } from "zod";

export const SignupSchema = z.object({
    email: z.email(),
    password: z.string().min(6),
    role: z.enum(["STUDENT", "INSTRUCTOR"])
});

export const LoginSchema=z.object({
    email:z.email(),
    password:z.string().min(6)
})