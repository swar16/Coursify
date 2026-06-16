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

router.put("/:id", VerifyUser, InstructorOnly, async(req: AuthenticatedRequest, res) => {
    const userId = req.user!.userId;
    const sectionId = parseInt(req.params.id as string);
    if(isNaN(sectionId)){
        return res.status(400).json({ error: "Invalid section ID" });
    }
    const section = await prisma.section.findUnique({
        where: {
            id: sectionId
        },
        include: {
            course: true
        }
    })
    if(!section){
        return res.status(404).json({ error: "Section not found" });
    }
    const course = section.course;
    if(course.authorId !== userId){
        return res.status(403).json({ error: "You are not the author of this course" });
    }
    const { title } = req.body;
    if(!title){
        return res.status(400).json({ error: "Title is required" });
    }
    const updatedSection= await prisma.section.update({
        where: {
            id: sectionId
        },
        data: {
            title
        }
    })
    return res.json(updatedSection);
});

router.delete("/:id", VerifyUser, InstructorOnly, async(req: AuthenticatedRequest, res) => {
    const userId = req.user!.userId;
    const sectionId = parseInt(req.params.id as string);
    if(isNaN(sectionId)){
        return res.status(400).json({ error: "Invalid section ID" });
    }
    const section = await prisma.section.findUnique({
        where: {
            id: sectionId
        },
        include: {
            course: true
        }
    })
    if(!section){
        return res.status(404).json({ error: "Section not found" });
    }
    const course = section.course;
    if(course.authorId !== userId){
        return res.status(403).json({ error: "You are not the author of this course" });
    }
    await prisma.section.delete({
        where: {
            id: sectionId
        }
    })
    return res.json({ message: "Section deleted successfully" });
});
router.post("/:id/lectures", VerifyUser, InstructorOnly, async(req: AuthenticatedRequest, res) => {
    const sectionId = parseInt(req.params.id as string);
    if(isNaN(sectionId)){
        return res.status(400).json({ error: "Invalid section ID" });
    }
    const section = await prisma.section.findUnique({
        where: {
            id: sectionId
        },
        include: {
            course: true
        }
    })
    if(!section){
        return res.status(404).json({ error: "Section not found" });
    }
    const course = section.course;
    if(course.authorId !== req.user!.userId){
        return res.status(403).json({ error: "You are not the author of this course" });
    }
    const { title,content } = req.body;
    if(!title){
        return res.status(400).json({ error: "Title is required" });
    }
    if(!content){
        return res.status(400).json({ error: "Content is required" });
    }
    const lecture= await prisma.lecture.create({
        data: {
            title,
            content,
            sectionId: sectionId
        }
    })
    return res.status(201).json(lecture);
});

router.get("/:id/lectures", VerifyUser, async(req: AuthenticatedRequest, res) => {
    const sectionId = parseInt(req.params.id as string);
    if(isNaN(sectionId)){
        return res.status(400).json({ error: "Invalid section ID" });
    }
    const section = await prisma.section.findUnique({
        where: {
            id: sectionId
        },
        include: {
            lectures: {
                orderBy: {
                    createdAt: 'asc'
                }
            }
            
        }
    })
    if(!section){
        return res.status(404).json({ error: "Section not found" });
    }
    
    return res.json(section.lectures);
}); 

export default router;