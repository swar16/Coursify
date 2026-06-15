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
router.get("/student",VerifyUser,StudentOnly, async (req:AuthenticatedRequest,res)=>{
    const studentId=req.user!.userId;
    const [
        purchasedCourses,
        totalAmountSpent,
        recentPurchases
    ] = await Promise.all([
        prisma.purchase.count({
            where: {
                userId: studentId
            }
        }),
        prisma.purchase.findMany({
            where: {
                userId: studentId,
            },
            include: {
                course: {
                    select: {
                        price: true
                    }
                }
            }
        }),
        prisma.purchase.findMany({
            where: {
                userId: studentId
            },
            orderBy: {
                createdAt: "desc"
            },
            take: 3,
            include: {
                course: {
                    select: {
                        id: true,
                        title: true,
                        price: true
                    }
                }
            }
        })
    ]);
    const amountSpent = totalAmountSpent.reduce(
        (sum, purchase) => sum + purchase.course.price,
        0
    );
    return res.json({
        purchasedCourses,
        amountSpent,
        recentPurchases
    });
})
router.get("/instructor",VerifyUser,InstructorOnly, async (req:AuthenticatedRequest,res)=>{
    // first calculate the total courses of the instructor 
    const instructorId=req.user!.userId;

    const [
        totalCourses,
        coursePurchases,
        courses
    ] = await Promise.all([
        prisma.course.count({
            where: {
                authorId: instructorId
            }
        }),

        prisma.purchase.count({
            where: {
                course: {
                    authorId: instructorId
                }
            }
        }),

        prisma.course.findMany({
            where: {
                authorId: instructorId
            },
            select: {
                price: true,
                _count: {
                    select: {
                        purchases: true
                    }
                }
            }
        })
    ]);

    const totalRevenue = courses.reduce(
        (sum, course) =>
            sum + course.price * course._count.purchases,
        0
    );


    return res.json({
        totalCourses,
        coursePurchases,
        totalRevenue
    })

})



export default router;