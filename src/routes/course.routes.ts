import { Request, Router } from "express";
const router=Router();
import prisma from "../lib/prisma";
import {VerifyUser, InstructorOnly } from "../middleware/auth";
import { CourseSchema } from "../schemas/course.schema";
import { PrismaClient } from "../generated/prisma/client";
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
            orderBy:{
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

router.get("/:id", async(req, res) => {
    
    const courseId = parseInt(req.params.id);
    if(isNaN(courseId)){
        return res.status(400).json({ error: "Invalid course ID" });
    }
    const course=await prisma.course.findUnique({
        where: {
            id: courseId
        },
        include: {
            author:{
                select: {
                    id: true,
                    email: true,
                    role: true
                }
            }
        }
    })
    if(!course){
        return res.status(404).json({ error: "Course not found" });
    }
    return res.json(course);
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

export default router;