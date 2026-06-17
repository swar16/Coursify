import { Request, Router } from "express";
const router=Router();
import prisma from "../lib/prisma";
import {VerifyUser, InstructorOnly, StudentOnly, OptionalAuth } from "../middleware/auth";
import { CourseSchema } from "../schemas/course.schema";
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
    const course = await prisma.course.create({
        data: {
            title:data.title,
            description:data.description,
            authorId: req.user!.userId,
            price:data.price
        }
    })
    return res.status(201).json(course);
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
    const data=result.data;
    const updatedCourse = await prisma.course.update({
        where: {
            id: courseId
        },
        data
    })
    return res.json(updatedCourse);
});

router.get("/", async(req, res) => {
    const whereClause: any ={};
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
                    email: true,
                    role: true
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

router.get("/:id", OptionalAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.userId;
    const courseId = parseInt(req.params.id as string);

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
                    role: true
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

    if (!userId) {
        return res.json(response);
    }

    const purchase = await prisma.purchase.findUnique({
        where: {
            userId_courseId: {
                userId,
                courseId
            }
        }
    });

    if (!purchase) {
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

    response.hasPurchased = true;

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



router.post("/:id/purchase", VerifyUser, async(req: AuthenticatedRequest, res) => {
    
    const id = req.params.id;
    const courseId = parseInt(id as string);
    const course=await prisma.course.findUnique({
        where: {
            id: courseId
        }
    })
    if(!course){
        return res.status(404).json({ error: "Course not found" });
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
export default router;
