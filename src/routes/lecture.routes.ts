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

router.get("/:id/discussions", VerifyUser, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.userId;
    const lectureId = parseInt(req.params.id as string);

    if (isNaN(lectureId)) {
        return res.status(400).json({
            error: "Invalid lecture ID"
        });
    }

    const lecture = await prisma.lecture.findUnique({
        where: {
            id: lectureId
        },
        include: {
            section: {
                include: {
                    course: true
                }
            }
        }
    });

    if (!lecture) {
        return res.status(404).json({
            error: "Lecture not found"
        });
    }

    const courseId = lecture.section.course.id;

    const purchase = await prisma.purchase.findUnique({
        where: {
            userId_courseId: {
                userId,
                courseId
            }
        }
    });

    if (
        !purchase &&
        lecture.section.course.authorId !== userId
    ) {
        return res.status(403).json({
            error: "You are not authorized to access discussions for this lecture"
        });
    }

    const page = Math.max(
        1,
        Number(req.query.page) || 1
    );

    const limit = Math.min(
        100,
        Math.max(
            1,
            Number(req.query.limit) || 20
        )
    );

    const totalDiscussions =
        await prisma.discussion.count({
            where: {
                lectureId,
                parentId: null
            }
        });

    const discussions =
        await prisma.discussion.findMany({
            where: {
                lectureId,
                parentId: null
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                replies: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    },
                    orderBy: {
                        createdAt: "asc"
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            },
            skip: (page - 1) * limit,
            take: limit
        });

    return res.json({
        page,
        limit,
        totalDiscussions,
        totalPages: Math.ceil(
            totalDiscussions / limit
        ),
        discussions
    });
});

router.post("/:id/discussions", VerifyUser, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.userId;
    const lectureId = parseInt(req.params.id as string);
    const { content } = req.body;

    if (isNaN(lectureId)) {
        return res.status(400).json({
            error: "Invalid lecture ID"
        });
    }

    if (
        typeof content !== "string" ||
        content.trim().length === 0
    ) {
        return res.status(400).json({
            error: "Content is required"
        });
    }

    const lecture = await prisma.lecture.findUnique({
        where: {
            id: lectureId
        },
        include: {
            section: {
                include: {
                    course: true
                }
            }
        }
    });

    if (!lecture) {
        return res.status(404).json({
            error: "Lecture not found"
        });
    }

    const courseId = lecture.section.course.id;

    const purchase = await prisma.purchase.findUnique({
        where: {
            userId_courseId: {
                userId,
                courseId
            }
        }
    });

    if (
        !purchase &&
        lecture.section.course.authorId !== userId
    ) {
        return res.status(403).json({
            error: "You are not authorized to post discussions for this lecture"
        });
    }

    const discussion = await prisma.discussion.create({
        data: {
            content: content.trim(),
            userId,
            lectureId,
            parentId: null
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    });

    return res.status(201).json(discussion);
});

router.post("/discussions/:id/replies", VerifyUser, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.userId;
    const discussionId = parseInt(req.params.id as string);
    const { content } = req.body;

    if (isNaN(discussionId)) {
        return res.status(400).json({
            error: "Invalid discussion ID"
        });
    }

    if (
        typeof content !== "string" ||
        content.trim().length === 0
    ) {
        return res.status(400).json({
            error: "Content is required"
        });
    }

    const parentDiscussion = await prisma.discussion.findUnique({
        where: {
            id: discussionId
        },
        include: {
            lecture: {
                include: {
                    section: {
                        include: {
                            course: true
                        }
                    }
                }
            }
        }
    });

    if (!parentDiscussion) {
        return res.status(404).json({
            error: "Discussion not found"
        });
    }

    const courseId =
        parentDiscussion.lecture.section.course.id;

    const purchase = await prisma.purchase.findUnique({
        where: {
            userId_courseId: {
                userId,
                courseId
            }
        }
    });

    if (
        !purchase &&
        parentDiscussion.lecture.section.course.authorId !== userId
    ) {
        return res.status(403).json({
            error: "You are not authorized to reply in this discussion"
        });
    }

    const reply = await prisma.discussion.create({
        data: {
            content: content.trim(),
            userId,
            lectureId: parentDiscussion.lectureId,
            parentId: discussionId
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    });

    return res.status(201).json(reply);
});

router.put("/discussions/:id", VerifyUser, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.userId;
    const discussionId = parseInt(req.params.id as string);
    const { content } = req.body;

    if (isNaN(discussionId)) {
        return res.status(400).json({
            error: "Invalid discussion ID"
        });
    }

    if (
        typeof content !== "string" ||
        content.trim().length === 0
    ) {
        return res.status(400).json({
            error: "Content is required"
        });
    }

    const discussion = await prisma.discussion.findUnique({
        where: {
            id: discussionId
        }
    });

    if (!discussion) {
        return res.status(404).json({
            error: "Discussion not found"
        });
    }

    if (discussion.userId !== userId) {
        return res.status(403).json({
            error: "You can only edit your own discussions"
        });
    }

    const updatedDiscussion = await prisma.discussion.update({
        where: {
            id: discussionId
        },
        data: {
            content: content.trim()
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    });

    return res.json(updatedDiscussion);
});

router.delete("/discussions/:id", VerifyUser, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.userId;
    const discussionId = parseInt(req.params.id as string);

    if (isNaN(discussionId)) {
        return res.status(400).json({
            error: "Invalid discussion ID"
        });
    }

    const discussion = await prisma.discussion.findUnique({
        where: {
            id: discussionId
        }
    });

    if (!discussion) {
        return res.status(404).json({
            error: "Discussion not found"
        });
    }

    if (discussion.userId !== userId) {
        return res.status(403).json({
            error: "You can only delete your own discussions"
        });
    }

    await prisma.discussion.delete({
        where: {
            id: discussionId
        }
    });

    return res.json({
        message: "Discussion deleted successfully"
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
