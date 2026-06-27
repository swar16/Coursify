import { Request, Response, Router } from "express";
const router=Router();
import prisma from "../lib/prisma";
import {VerifyUser, InstructorOnly, StudentOnly, OptionalAuth } from "../middleware/auth";
import { CourseSchema } from "../schemas/course.schema";
import { CourseStatusSchema } from "../schemas/course-status.schema";
import { ReviewSchema } from "../schemas/review.schema";
import PDFDocument from "pdfkit";
import { getCertificateData } from "../utils/certificate";
type AuthenticatedRequest = Request & {
    user?: {
        userId: number;
        role: string;
    };
};

router.post("/", VerifyUser, InstructorOnly, async(req: AuthenticatedRequest, res) => {
    
    const result =CourseSchema.safeParse(req.body)
    if (!result.success) {
        return res.status(400).json({
            errors: result.error.issues
        });
    }
    const data = result.data;
    const existingCategories = await prisma.category.findMany({
        where: {
            id: {
                in: data.categoryIds
            }
        }
    });
    if (existingCategories.length !== data.categoryIds.length) {
        return res.status(400).json({
            error: "One or more categories do not exist"
        });
    }
    const course = await prisma.course.create({
    data: {
        title: data.title,
        description: data.description,
        price: data.price,
        authorId: req.user!.userId,
        categories: {
            connect: data.categoryIds.map(id => ({
                id
            }))
        }
    }
    });
    return res.status(201).json({
        course
    });
});

router.get("/my-courses", VerifyUser,InstructorOnly, async(req: AuthenticatedRequest, res) => {
    const courses = await prisma.course.findMany({
        where: {
            authorId: req.user!.userId
        }
    });
    return res.json(courses);
});

router.put("/:id", VerifyUser, InstructorOnly, async(req: AuthenticatedRequest, res) => {
    
    const courseId = parseInt(req.params.id as string);
    if(isNaN(courseId)){
        return res.status(400).json({ error: "Invalid course ID" });
    }
    const course = await prisma.course.findUnique({
        where: {
            id: courseId
        }
    })
    if(!course){
        return res.status(404).json({ error: "Course not found" });
    }
    if(course.authorId !== req.user!.userId){
        return res.status(403).json({ error: "You are not the author of this course" });
    }
    const result=CourseSchema.safeParse(req.body);
    if(!result.success){
        return res.status(400).json({
            errors: result.error.issues
        });
    }
    const existingCategories = await prisma.category.findMany({
        where: {
            id: {
                in: result.data.categoryIds 
            }
        }
    });
    if (existingCategories.length !== (result.data.categoryIds).length) {
        return res.status(400).json({
            error: "One or more categories do not exist"
        });
    }
    
    const data=result.data;
    const updatedCourse = await prisma.course.update({
        where: {
            id: courseId
        },
        data: {
            title: data.title,
            description: data.description,
            price: data.price,
            categories: {
                set: data.categoryIds.map(id => ({
                    id
                }))
            }
        }
        
    })
    return res.json(updatedCourse);
});


router.put("/:id/review", VerifyUser, StudentOnly, async(req: AuthenticatedRequest, res) => {
    const courseId = parseInt(req.params.id as string);
    const userId = req.user!.userId;
    if(isNaN(courseId)){
        return res.status(400).json({ error: "Invalid course ID" });
    }
    const data=ReviewSchema.safeParse(req.body);
    if(!data.success){
        return res.status(400).json({
            errors: data.error.issues
        });
    }
    const {rating, comment}=data.data;
    const course = await prisma.course.findUnique({
        where: {
            id: courseId
        }
    })
    if(!course){
        return res.status(404).json({ error: "Course not found" });
    }
    const purchase = await prisma.purchase.findUnique({
        where: {
            userId_courseId: {
                userId: req.user!.userId,
                courseId
            }
        }
    })
    if(!purchase){
        return res.status(403).json({ error: "You have not purchased this course" });
    }
    if(course.status !== "PUBLISHED" && course.status !== "ARCHIVED"){
        return res.status(403).json({ error: "You can only review published or archived courses" });
    }
    
    const review = await prisma.$transaction(
        async (tx) => {
            const review = await tx.review.upsert({
                where: {
                    userId_courseId: {
                        userId,
                        courseId
                    }
                },
                update: {
                    rating,
                    comment: comment ?? null
                },
                create: {
                    userId,
                    courseId,
                    rating,
                    comment: comment ?? null
                }
            });
            const stats = await tx.review.aggregate({
                where: {
                    courseId
                },
                _avg: {
                    rating: true
                },
                _count: {
                    rating: true
                }
            });
            await tx.course.update({
                where: {
                    id: courseId
                },
                data: {
                    averageRating: Number(
                        (stats._avg.rating ?? 0).toFixed(2)
                    ),
                    reviewCount: stats._count.rating
                }
            });
            return review;
        }
    );
    return res.json({
        message: "Review saved successfully",
        review
    });
});
router.get("/", async(req, res) => {
    const whereClause: any ={status:"PUBLISHED"};
    const sort= req.query.sort as string;
    let orderBy={};
    switch(sort){
        case "price_asc":
            orderBy={
                price:"asc"
            };
            break;
        case "price_desc":
            orderBy={
                price:"desc"
            };
            break;
        case "latest":
            orderBy={
                createdAt:"desc"
            };
            break;
        default:
            orderBy={
                createdAt:"desc"
            };
    }
    const minPrice = Number(req.query.minPrice);
    const maxPrice = Number(req.query.maxPrice);
    const categoryId = Number(req.query.categoryId);
    if (!isNaN(categoryId)) {
        whereClause.categories = {
            some: {
                id: categoryId
            }
        };
    }
    if (!isNaN(minPrice) || !isNaN(maxPrice)) {
        whereClause.price = {};
    }
    if(!isNaN(minPrice)){
        whereClause.price.gte=minPrice;
    }
    if(!isNaN(maxPrice)){
        whereClause.price.lte=maxPrice;
    }


    const search=req.query.search as string;
    if (search) {

        whereClause.title = {

            contains: search,

            mode: "insensitive"

        }
    }
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(
        100,
        Math.max(1, Number(req.query.limit) || 10)
    );
    const totalCourses = await prisma.course.count({
        where:whereClause
    });
    const totalPages = Math.ceil(totalCourses / limit);

    const courses = await prisma.course.findMany({
        where: whereClause,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
            author: {
                select: {
                    id: true,
                    role: true,
                    name: true
                }
            },
            categories: {
                select: {
                    id: true,
                    name: true,
                    slug: true
                }
            }
        }
    });
    return res.json({
        page,
        limit,
        totalCourses,
        totalPages,
        courses
    });

});

router.get("/purchased", VerifyUser, async(req: AuthenticatedRequest, res) => {
    const purchases=await prisma.purchase.findMany({
        where: {
            userId: req.user!.userId
        },
        include: {
            course: true
        }
    })
    return res.json(purchases);
});

router.delete("/:id",VerifyUser, InstructorOnly, async(req: AuthenticatedRequest, res)=>{
    const courseId=parseInt(req.params.id as string);
    if(isNaN(courseId)){
        return res.status(400).json({
            error: "The course id is not valid!"
        })
    }
    const course=await prisma.course.findUnique({
        where:{
            id:courseId
        }
    })
    if(!course){
        return res.status(404).json({
            error:"Course could not be fetched!"
        })
    }

    if(course.authorId!==req.user?.userId){
        return res.status(403).json({
            error:"You are not authorized to access this course!"
        })
    }
    await prisma.course.delete({
        where:{
            id:courseId
        }
    })
    return res.json({
        message: "Course deleted successfully!"
    })

})


router.get(
    "/:id/analytics",
    VerifyUser,
    InstructorOnly,
    async (req: AuthenticatedRequest, res) => {
        const courseId = parseInt(req.params.id as string);
        const userId = req.user!.userId;

        if (isNaN(courseId)) {
            return res.status(400).json({
                error: "Invalid course ID"
            });
        }

        const course = await prisma.course.findUnique({
            where: {
                id: courseId
            }
        });

        if (!course) {
            return res.status(404).json({
                error: "Course not found"
            });
        }

        if (course.authorId !== userId) {
            return res.status(403).json({
                error: "You are not the author of this course"
            });
        }

        const totalPurchases = await prisma.purchase.count({
            where: {
                courseId
            }
        });

        const totalRevenue =
            Number((totalPurchases * course.price).toFixed(2));

        const totalLectures = await prisma.lecture.count({
            where: {
                section: {
                    courseId
                }
            }
        });

        const ratingDistributionRows =
            await prisma.review.groupBy({
                by: ["rating"],
                where: {
                    courseId
                },
                _count: {
                    rating: true
                },
                orderBy: {
                    rating: "desc"
                }
            });

        const ratingDistribution =
            ratingDistributionRows.map(row => ({
                rating: row.rating,
                count: row._count.rating
            }));

        const progress =
        await prisma.lectureProgress.groupBy({
            by: ["userId"],
            where: {
                lecture: {
                    section: {
                        courseId
                    }
                },
                completed: true
            },
            _count: {
                lectureId: true
            }
        });
        const completedStudents =
        totalLectures > 0
            ? progress.filter(
                p =>
                    p._count.lectureId === totalLectures
            ).length
            : 0;
            const completionRate =
        totalPurchases > 0
            ? Number(
                (
                    completedStudents /
                    totalPurchases *
                    100
                ).toFixed(2)
            )
            : 0;

        return res.json({
            courseId: course.id,
            courseTitle: course.title,

            totalPurchases,

            totalRevenue,

            averageRating: course.averageRating,

            totalReviews: course.reviewCount,

            totalLectures,

            ratingDistribution,completedStudents,

            completionRate
        });
    }
);
router.get(
    "/:id/certificate/pdf",
    VerifyUser,
    async (
        req: AuthenticatedRequest,
        res
    ) => {
        const courseId = parseInt(
            req.params.id as string
        );

        const userId =
            req.user!.userId;

        if (isNaN(courseId)) {
            return res.status(400).json({
                error: "Invalid course ID"
            });
        }

        try {
            const certificateData =
                await getCertificateData(
                    userId,
                    courseId
                );

            if (
                !certificateData.eligible
            ) {
                return res.status(403).json({
                    error:
                        "Course not completed"
                });
            }

            const doc =
                new PDFDocument({
                    size: "A4",
                    margin: 50
                });

            res.setHeader(
                "Content-Type",
                "application/pdf"
            );

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="certificate-${courseId}.pdf"`
            );

            doc.pipe(res);

            doc.fontSize(28);
            doc.text(
                "CERTIFICATE OF COMPLETION",
                {
                    align: "center"
                }
            );

            doc.moveDown(2);

            doc.fontSize(16);
            doc.text(
                "This certifies that",
                {
                    align: "center"
                }
            );

            doc.moveDown();

            doc.fontSize(24);
            doc.text(
                certificateData.user.name,
                {
                    align: "center"
                }
            );

            doc.moveDown();

            doc.fontSize(16);
            doc.text(
                "has successfully completed",
                {
                    align: "center"
                }
            );

            doc.moveDown();

            doc.fontSize(22);
            doc.text(
                certificateData.course
                    .title,
                {
                    align: "center"
                }
            );

            doc.moveDown(2);

            doc.fontSize(14);

            doc.text(
                `Completion Date: ${
                    certificateData.completedAt
                        ?.toDateString() ??
                    "N/A"
                }`,
                {
                    align: "center"
                }
            );

            doc.moveDown(4);

            doc.fontSize(12);

            doc.text(
                `Certificate ID: LMS-${courseId}-${userId}`,
                {
                    align: "center"
                }
            );

            doc.end();
        } catch (error) {
            if (
                error instanceof Error &&
                error.message ===
                    "COURSE_NOT_FOUND"
            ) {
                return res
                    .status(404)
                    .json({
                        error:
                            "Course not found"
                    });
            }

            if (
                error instanceof Error &&
                error.message ===
                    "NOT_PURCHASED"
            ) {
                return res
                    .status(403)
                    .json({
                        error:
                            "You have not purchased this course"
                    });
            }

            if (
                error instanceof Error &&
                error.message ===
                    "USER_NOT_FOUND"
            ) {
                return res
                    .status(404)
                    .json({
                        error:
                            "User not found"
                    });
            }

            throw error;
        }
    }
);

router.post("/:id/create-order", VerifyUser, async (req: AuthenticatedRequest, res) => {
    const courseId = parseInt(req.params.id as string);
    const userId = req.user!.userId;

    if (isNaN(courseId)) {
        return res.status(400).json({
            error: "Invalid course ID"
        });
    }

    const course = await prisma.course.findUnique({
        where: { id: courseId }
    });

    if (!course) {
        return res.status(404).json({
            error: "Course not found"
        });
    }

    if (course.status !== "PUBLISHED") {
        return res.status(409).json({
            error: "Course is not published"
        });
    }

    const existingPurchase = await prisma.purchase.findUnique({
        where: {
            userId_courseId: {
                userId,
                courseId
            }
        }
    });

    if (existingPurchase) {
        return res.status(400).json({
            error: "You have already purchased this course"
        });
    }
    const payment = await prisma.payment.create({
        data: {
            userId,
            courseId,
            amount: course.price,
            status: "PENDING"
        }
    });
    return res.status(201).json({
        paymentId: payment.id,
        amount: payment.amount,
        status: payment.status
    });
});

router.get("/:id/reviews",OptionalAuth,async (req: AuthenticatedRequest, res: Response) => {
        const courseId = parseInt(req.params.id as string);
        const userId = req.user?.userId;

        if (isNaN(courseId)) {
            return res.status(400).json({
                error: "Invalid course ID"
            });
        }

        const course = await prisma.course.findUnique({
            where: {
                id: courseId
            }
        });

        if (!course) {
            return res.status(404).json({
                error: "Course not found"
            });
        }

        let hasPurchased = false;

        if (userId && course.status === "ARCHIVED") {
            const purchase =
                await prisma.purchase.findUnique({
                    where: {
                        userId_courseId: {
                            userId,
                            courseId
                        }
                    }
                });

            hasPurchased = !!purchase;
        }

        switch (course.status) {
            case "DRAFT":
                if (userId !== course.authorId) {
                    return res.status(403).json({
                        error:
                            "You're not authorized to access this course"
                    });
                }
                break;

            case "ARCHIVED":
                if (
                    userId !== course.authorId &&
                    !hasPurchased
                ) {
                    return res.status(403).json({
                        error:
                            "You're not authorized to access this course"
                    });
                }
                break;

            case "PUBLISHED":
                break;
        }

        const page = Math.max(
            1,
            Number(req.query.page) || 1
        );

        const limit = Math.min(
            100,
            Math.max(
                1,
                Number(req.query.limit) || 10
            )
        );

        const totalReviews =
            await prisma.review.count({
                where: {
                    courseId
                }
            });

        const reviews =
            await prisma.review.findMany({
                where: {
                    courseId
                },
                orderBy: {
                    createdAt: "desc"
                },
                skip: (page - 1) * limit,
                take: limit,
                select: {
                    id: true,
                    rating: true,
                    comment: true,
                    createdAt: true,
                    updatedAt: true,
                    user: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

        return res.json({
            page,
            limit,
            totalReviews,
            totalPages: Math.ceil(
                totalReviews / limit
            ),
            reviews
        });
    }
);

router.post("/:id/purchase", VerifyUser, async(req: AuthenticatedRequest, res) => {
    
    const id = req.params.id;
    const courseId = parseInt(id as string);
    if (isNaN(courseId)) {
        return res.status(400).json({
            error: "Invalid course ID"
        });
    }
    const course=await prisma.course.findUnique({
        where: {
            id: courseId
        }
    })
    if(!course){
        return res.status(404).json({ error: "Course not found" });
    }
    if(course.status !== "PUBLISHED"){
        return res.status(409).json({ error: "Course is not published" });
    }
    const alreadyPurchased = await prisma.purchase.findUnique({
        where: {
            userId_courseId: {
                userId: req.user!.userId,
                courseId
            }
        }
    })
    if(alreadyPurchased){
        return res.status(400).json({ error: "You have already purchased this course" });
    }
    await prisma.purchase.create({
        data: {
            userId: req.user!.userId,
            courseId
        }
    })
    return res.json({ message: "Course purchased successfully" });
});

router.delete("/:id/review", VerifyUser, StudentOnly, async(req: AuthenticatedRequest, res) => {
    const courseId = parseInt(req.params.id as string);
    const userId = req.user!.userId;
    if(isNaN(courseId)){
        return res.status(400).json({ error: "Invalid course ID" });
    }
    const course = await prisma.course.findUnique({
        where: {
            id: courseId
        }
    })
    if(!course){
        return res.status(404).json({ error: "Course not found" });
    }
    // const purchase = await prisma.purchase.findUnique({
    //     where: {
    //         userId_courseId: {
    //             userId,
    //             courseId
    //         }
    //     }
    // })
    // if(!purchase){
    //     return res.status(403).json({ error: "You have not purchased this course" });
    // }

    const review = await prisma.review.findUnique({
        where: {
            userId_courseId: {
                userId,
                courseId
            }
        }
    })
    if(!review){
        return res.status(404).json({ error: "Review not found" });
    }
    await prisma.$transaction(
        async (tx) => {
            await tx.review.delete({
            where: {
                userId_courseId: {
                    userId,
                    courseId
                }
            }
            })
            const stats = await tx.review.aggregate({
                where: {
                    courseId
                },
                _avg: {
                    rating: true
                },
                _count: {
                    rating: true
                }
            });
            await tx.course.update({
                where: {
                    id: courseId
                },
                data: {
                    averageRating: Number(
                        (stats._avg.rating ?? 0).toFixed(2)
                    ),
                    reviewCount: stats._count.rating
                }
            });
        }
    );
    return res.json({ message: "Review deleted successfully" });
});

router.patch("/:id/status",VerifyUser,InstructorOnly,async (req: AuthenticatedRequest, res) => {
        const courseId = parseInt(req.params.id as string);
        const userId = req.user!.userId;

        if (isNaN(courseId)) {
            return res.status(400).json({
                error: "Invalid course ID"
            });
        }

        const parsed = CourseStatusSchema.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({
                error: parsed.error.issues[0]?.message
            });
        }

        const { status } = parsed.data;

        const course = await prisma.course.findUnique({
            where: {
                id: courseId
            }
        });

        if (!course) {
            return res.status(404).json({
                error: "Course not found"
            });
        }

        if (course.authorId !== userId) {
            return res.status(403).json({
                error: "You are not the author of this course"
            });
        }

        // idempotent
        if (course.status === status) {
            return res.json(course);
        }
        const validTransitions = {
            DRAFT: ["PUBLISHED"],
            PUBLISHED: ["ARCHIVED"],
            ARCHIVED: ["PUBLISHED"]
        } as const;

        const allowedStatuses =
            validTransitions[
                course.status as keyof typeof validTransitions
            ];

        if (!allowedStatuses.includes(status as never)) {
            return res.status(409).json({
                error: "Invalid status transition"
            });
        }
        if (status === "PUBLISHED") {
            const [
                sectionCount,
                lectureCount,
                emptySection
            ] = await Promise.all([
                prisma.section.count({
                    where: {
                        courseId
                    }
                }),

                prisma.lecture.count({
                    where: {
                        section: {
                            courseId
                        }
                    }
                }),

                prisma.section.findFirst({
                    where: {
                        courseId,
                        lectures: {
                            none: {}
                        }
                    }
                })
            ]);
            if (sectionCount === 0) {
                return res.status(409).json({
                    error: "Course must contain at least one section"
                });
            }

            if (lectureCount === 0) {
                return res.status(409).json({
                    error: "Course must contain at least one lecture"
                });
            }

            if (emptySection) {
                return res.status(409).json({
                    error:
                        "All sections must contain at least one lecture"
                });
            }
        }
        const updatedCourse =
        await prisma.course.update({
            where: {
                id: courseId
            },
            data: {
                status
            }
        });
        

        return res.json(updatedCourse);
        
    }
);
router.post("/:id/sections", VerifyUser, InstructorOnly, async(req: AuthenticatedRequest, res) => {
    const courseId = parseInt(req.params.id as string);
    if(isNaN(courseId)){
        return res.status(400).json({ error: "Invalid course ID" });
    }
    const course = await prisma.course.findUnique({
        where: {
            id: courseId
        }
    })
    if(!course){
        return res.status(404).json({ error: "Course not found" });
    }
    if(course.authorId !== req.user!.userId){
        return res.status(403).json({ error: "You are not the author of this course" });
    }
    const { title } = req.body;
    if(!title){
        return res.status(400).json({ error: "Title is required" });
    }
    const section = await prisma.section.create({
        data: {
            title,
            courseId
        }
    })
    return res.status(201).json(section);
});    


router.get("/:id/certificate", VerifyUser, async (req: AuthenticatedRequest, res) => {
    const courseId = parseInt(req.params.id as string);
    const userId = req.user!.userId;
    if (isNaN(courseId)) {
        return res.status(400).json({
            error: "Invalid course ID"
        });
    }
    try {
        const certificateData =
            await getCertificateData(
                userId,
                courseId
            );
        if (!certificateData.eligible) {
            return res.status(200).json({
                eligible: false,
                message: "Course not completed"
            });
        }
        return res.json({
            eligible: true,
            courseId:
                certificateData.course.id,
            courseTitle:
                certificateData.course.title,
            studentName:
                certificateData.user?.name,
            completedAt:
                certificateData.completedAt
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message ===
                "COURSE_NOT_FOUND"
        ) {
            return res.status(404).json({
                error: "Course not found"
            });
        }
        if (
            error instanceof Error &&
            error.message ===
                "NOT_PURCHASED"
        ) {
            return res.status(403).json({
                error:
                    "You have not purchased this course"
            });
        }
        throw error;
    }
});

router.get("/:id", OptionalAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.userId;
    const courseId = parseInt(req.params.id as string );

    if (isNaN(courseId)) {
        return res.status(400).json({
            error: "Invalid course ID"
        });
    }

    const course = await prisma.course.findUnique({
        where: {
            id: courseId
        },
        include: {
            author: {
                select: {
                    id: true,
                    role: true,
                    name: true
                }
            },
            sections: {
                include: {
                    lectures: {
                        select: {
                            id: true,
                            title: true
                        },
                        orderBy: {
                            createdAt: "asc"
                        }
                    }
                }
            }
            ,categories: {
                select: {
                    id: true,
                    name: true,
                    slug: true
                }
            }
        }
    });

    if (!course) {
        return res.status(404).json({
            error: "Course not found"
        });
    }

    const response = {
        course,
        hasPurchased: false,
        progress: null as null | {
            totalLectures: number;
            completedLectures: number;
            progressPercentage: number;
        },
        completedLectureIdList: [] as number[]
    };

    const isAuthor = userId === course.authorId;

    let purchase = null;

    if (userId) {
        purchase = await prisma.purchase.findUnique({
            where: {
                userId_courseId: {
                    userId,
                    courseId
                }
            }
        });
    }

    const hasPurchased = !!purchase;

    // Visibility Rules
    switch (course.status) {
        case "DRAFT":
            if (!isAuthor) {
                return res.status(403).json({
                    error: "You're not authorized to access this course"
                });
            }
            break;

        case "ARCHIVED":
            if (!isAuthor && !hasPurchased) {
                return res.status(403).json({
                    error: "You're not authorized to access this course"
                });
            }
            break;

        case "PUBLISHED":
            break;
    }

    if (!userId) {
        return res.json(response);
    }

    if (!hasPurchased && !isAuthor) {
        return res.json(response);
    }

    const totalLectures = course.sections.reduce(
        (acc, section) => acc + section.lectures.length,
        0
    );

    const [completedLectures, progressRows] = await Promise.all([
        prisma.lectureProgress.count({
            where: {
                userId,
                completed: true,
                lecture: {
                    section: {
                        courseId
                    }
                }
            }
        }),

        prisma.lectureProgress.findMany({
            where: {
                userId,
                completed: true,
                lecture: {
                    section: {
                        courseId
                    }
                }
            },
            select: {
                lectureId: true
            }
        })
    ]);

    response.hasPurchased = hasPurchased;

    response.progress = {
        totalLectures,
        completedLectures,
        progressPercentage:
            totalLectures > 0
                ? (completedLectures / totalLectures) * 100
                : 0
    };

    response.completedLectureIdList =
        progressRows.map(row => row.lectureId);

    return res.json(response);
});


export default router;
