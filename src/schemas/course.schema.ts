import {z} from "zod";

export const CourseSchema=z.object({
    title: z.string().min(3,"Title must be 3 characters!"),
    description:z.string().min(10,"Description too short!"),
    price:z.number().positive("Price must be positive!"),
    categoryIds: z.array(z.number().int().positive()).min(1).max(3)
    .refine(
        (ids) => new Set(ids).size === ids.length,
        {
            message: "Duplicate categories are not allowed"
        }
    )
});



