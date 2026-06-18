import {z} from "zod";

export const CourseStatusSchema = z.object({
    status: z.enum([
        "PUBLISHED",
        "DRAFT",
        "ARCHIVED"
    ])
});