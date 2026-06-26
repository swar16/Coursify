import prisma from "../lib/prisma";

export async function getCertificateData(
    userId: number,
    courseId: number
) {
    const course = await prisma.course.findUnique({
        where: { id: courseId }
    });

    if (!course) {
        throw new Error("COURSE_NOT_FOUND");
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
        throw new Error("NOT_PURCHASED");
    }

    const user = await prisma.user.findUnique({
        where: {
            id: userId
        },
        select: {
            name: true
        }
    });
    if (!user) {
        throw new Error(
            "USER_NOT_FOUND"
        );
    }
    const totalLectures = await prisma.lecture.count({
        where: {
            section: {
                courseId
            }
        }
    });

    const completedLectures =
        await prisma.lectureProgress.count({
            where: {
                userId,
                completed: true,
                lecture: {
                    section: {
                        courseId
                    }
                }
            }
        });

    const eligible =
        totalLectures > 0 &&
        completedLectures === totalLectures;

    const latestProgress =
        await prisma.lectureProgress.findFirst({
            where: {
                userId,
                completed: true,
                lecture: {
                    section: {
                        courseId
                    }
                }
            },
            orderBy: {
                completedAt: "desc"
            }
        });

    return {
        eligible,
        course,
        user,
        completedAt:
            latestProgress?.completedAt ?? null
    };
}