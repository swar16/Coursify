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

router.get("/:id", VerifyUser, async(req: AuthenticatedRequest, res) => {
    const userId = req.user!.userId;
    const lectureId = parseInt(req.params.id as string);
    if(isNaN(lectureId)){
        return res.status(400).json({ error: "Invalid lecture ID" });
    }
    const lecture = await prisma.lecture.findUnique({
        where: {
            id: lectureId
        },
        include: {
            section: {
                include: {
                    course:true
                }
            }
        }
    })
    if(!lecture){
        return res.status(404).json({ error: "Lecture not found" });
    }
    const courseId = lecture.section.course.id;
    const bought=await prisma.purchase.findUnique({
        where: {
            userId_courseId: {
                userId,
                courseId
            }
        }
    })
    if(!bought && lecture.section.course.authorId !== userId){
        return res.status(403).json({ error: "You have not purchased this course" });
    }
    return res.json({
        id: lecture.id,
        title: lecture.title,
        content: lecture.content
    });
});
        
router.put("/:id", VerifyUser, InstructorOnly, async(req: AuthenticatedRequest, res) => {
    const userId = req.user!.userId;
    const lectureId = parseInt(req.params.id as string);
    if(isNaN(lectureId)){   
        return res.status(400).json({ error: "Invalid lecture ID" });
    }
    const lecture = await prisma.lecture.findUnique({
        where: {
            id: lectureId
        },
        include: {
            section: {
                include: {
                    course:true
                }
            }
        }
    })
    if(!lecture){
        return res.status(404).json({ error: "Lecture not found" });
    }
    if(lecture.section.course.authorId !== userId){
        return res.status(403).json({ error: "You are not the author of this course" });
    }
    const { title, content } = req.body;
    if(!title || !content){
        return res.status(400).json({ error: "Title and content are required" });
    }
    const updatedLecture = await prisma.lecture.update({
        where: {
            id: lectureId
        },
        data: {
            title,
            content
        }
    })
    return res.json({
        id: updatedLecture.id,
        title: updatedLecture.title,
        content: updatedLecture.content
    });
});

router.delete("/:id", VerifyUser, InstructorOnly, async(req: AuthenticatedRequest, res) => {
    const userId = req.user!.userId;
    const lectureId = parseInt(req.params.id as string);
    if(isNaN(lectureId)){
        return res.status(400).json({ error: "Invalid lecture ID" });
    }
    const lecture = await prisma.lecture.findUnique({
        where: {
            id: lectureId
        },
        include: {
            section: {
                include: {
                    course:true
                }
            }
        }
    })
    if(!lecture){
        return res.status(404).json({ error: "Lecture not found" });
    }
    if(lecture.section.course.authorId !== userId){
        return res.status(403).json({ error: "You are not the author of this course" });
    }
    await prisma.lecture.delete({
        where: {
            id: lectureId
        }
    })
    return res.json({ message: "Lecture deleted successfully" });
});

router.patch("/:id/progress", VerifyUser, StudentOnly, async(req: AuthenticatedRequest, res) => {
    const userId = req.user!.userId;
    const completed=req.body.completed;
    if(typeof completed !== "boolean"){
        return res.status(400).json({ error: "Completed must be a boolean" });
    }
    const lectureId = parseInt(req.params.id as string);
    if(isNaN(lectureId)){
        return res.status(400).json({ error: "Invalid lecture ID" });
    }
    const lecture = await prisma.lecture.findUnique({
        where: {
            id: lectureId
        },
        include: {
            section: {
                include: {
                    course:true
                }
            }
        }
    })
    if(!lecture){
        return res.status(404).json({ error: "Lecture not found" });
    }
    const courseId = lecture.section.course.id;
    const bought=await prisma.purchase.findUnique({
        where: {
            userId_courseId: {
                userId,
                courseId
            }
        }
    })
    if(!bought){
        return res.status(403).json({ error: "You have not purchased this course" });
    }
    await prisma.lectureProgress.upsert({
        where: {
            userId_lectureId: {
                userId,
                lectureId
            }
        },
        update: {
            completed: completed,
            completedAt: completed ? new Date() : null
        },
        create: {
            userId,
            lectureId,
            completed,
            completedAt: completed ? new Date() : null
        }
    })
    return res.json({
        message: completed? "Lecture marked as completed": "Lecture marked as incomplete"
    });
});
export default router;
