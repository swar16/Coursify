import {z} from "zod";

export const CourseSchema=z.object({
    title: z.string().min(3,"Title must be 3 characters!"),
    description:z.string().min(10,"Description too short!"),
    price:z.number().positive("Price must be positive!")
});



