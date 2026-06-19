import { z } from "zod";

export const ReviewSchema = z.object({
    rating: z.number()
        .min(1, "Rating must be at least 1")
        .max(5, "Rating cannot exceed 5")
        .refine(
            (rating) => Number.isInteger(rating * 2),
            {
                message:
                    "Rating must be in increments of 0.5"
            }
        ),

    comment: z.string()
        .min(10, "Comment too short")
        .max(500, "Comment too long")
        .optional()
});