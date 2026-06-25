import {Router} from 'express';
import prisma from "../lib/prisma";
const router = Router();

router.get("/", async(req, res) => {
    const categories = await prisma.category.findMany({
        include: {
            courses: true
        }
    });
    const response = categories.map(category => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        courseCount: category.courses.length
    }));
    res.json(response);
});


export default router;
