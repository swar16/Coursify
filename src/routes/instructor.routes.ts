import { Request, Router } from "express";
const router=Router();
import prisma from "../lib/prisma";
import {VerifyUser, InstructorOnly , StudentOnly} from "../middleware/auth";
type AuthenticatedRequest = Request & {
    user?: {
        userId: number;
        role: string;
    };
};

router.get("/analytics", VerifyUser, InstructorOnly, async(req: AuthenticatedRequest, res) => {
    const userId = req.user!.userId;
    const courses = await prisma.course.findMany({
        where: {
            authorId: userId
        },
        include: {
            _count: {
                select: {
                    purchases: true,
                    reviews: true
                }
            }
        }
    });
    const totalCourses = courses.length;
    const publishedCourses = courses.filter(course => course.status === "PUBLISHED").length;
    const draftCourses = courses.filter(course => course.status === "DRAFT").length;
    const archivedCourses = courses.filter(course => course.status === "ARCHIVED").length;
    const totalRevenue= courses.reduce((acc, course) => acc + course._count.purchases * course.price, 0);
    const totalPurchases=courses.reduce((acc,course) => acc + course._count.purchases, 0);
    const totalReviews= courses.reduce((acc,course)=> acc+ course._count.reviews, 0);
    const averageRating =totalReviews > 0 ? Number(
              (
                  courses.reduce(
                      (acc, course) =>
                          acc +
                          course.averageRating *
                              course._count.reviews,
                      0
                  ) / totalReviews
              ).toFixed(2)
          )
        : 0;
    
    const topCoursesbyRevenue = [...courses]
        .sort(
            (a, b) =>
                b._count.purchases * b.price -
                a._count.purchases * a.price
        )
        .slice(0, 5)
        .map(course => ({
            id: course.id,
            title: course.title,
            revenue:
                course._count.purchases * course.price
        }));

    const topCoursesbyPurchases = [...courses]
        .sort(
            (a, b) =>
                b._count.purchases -
                a._count.purchases
        )
        .slice(0, 5)
        .map(course => ({
            id: course.id,
            title: course.title,
            purchases: course._count.purchases
        }));

    const topCoursesbyRating = [...courses]
        .filter(
            course => course._count.reviews >= 5
        )
        .sort(
            (a, b) =>
                b.averageRating -
                a.averageRating
        )
        .slice(0, 5)
        .map(course => ({
            id: course.id,
            title: course.title,
            averageRating: course.averageRating,
            reviewCount: course._count.reviews
        }));   
    res.json({
        overview: {
            totalCourses,
            publishedCourses,
            draftCourses,
            archivedCourses,
            totalRevenue,
            totalPurchases,
            averageRating,
            totalReviews
        },
        topCourses: {
            byRevenue: topCoursesbyRevenue,
            byPurchases: topCoursesbyPurchases,
            byRating: topCoursesbyRating
        }
    })
});

export default router;  