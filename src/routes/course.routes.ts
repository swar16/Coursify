import { Request, Router } from "express";
const router=Router();
import prisma from "../lib/prisma";
import {VerifyUser, InstructorOnly } from "../middleware/auth";

type AuthenticatedRequest = Request & {
    user?: {
        userId: number;
        role: string;
    };
};

router.post("/", VerifyUser, InstructorOnly, async(req: AuthenticatedRequest, res) => {
    
    const { title, description,price } = req.body;
    if(!title || !description || price===undefined){
        return res.status(400).json({ error: "Title, description, and price are required" });
    }
    const course = await prisma.course.create({
        data: {
            title,
            description,
            authorId: req.user!.userId,
            price
        }
    })
    return res.status(201).json(course);
});

router.post("/my-courses", VerifyUser,InstructorOnly, async(req: AuthenticatedRequest, res) => {
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
    const { title, description, price } = req.body;
    if(!title || !description || price===undefined){
        return res.status(400).json({ error: "Title, description, and price are required" });
    }
    const updatedCourse = await prisma.course.update({
        where: {
            id: courseId
        },
        data: {
            title,
            description,
            price
        }
    })
    return res.json(updatedCourse);
});

router.get("/", async(req, res) => {
    
    const courses = await prisma.course.findMany({
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
    return res.json(courses);

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

    if(course?.authorId!==req.user?.userId){
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

    if (!id) {
        return res.status(400).json({
            error: "Course ID missing"
        });
    }

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