import { Request, Router } from "express";
const router=Router();
import prisma from "../lib/prisma";
import {VerifyUser} from "../middleware/auth";
import crypto from "crypto";
type AuthenticatedRequest = Request & {
    user?: {
        userId: number;
        role: string;
    };
};

// router.post ("/:id/complete", VerifyUser, StudentOnly, async(req: AuthenticatedRequest, res) => {
//     const userId = req.user!.userId;
//     const paymentId = parseInt(req.params.id as string);
//     if (isNaN(paymentId)) {
//         return res.status(400).json({
//             error: "Invalid payment ID"
//         });
//     }
//     const payment = await prisma.payment.findUnique({
//         where: {
//             id: paymentId
//         }
//     });
//     if (!payment) {
//         return res.status(404).json({
//             error: "Payment not found"
//         });
//     }
//     if (payment.userId !== userId) {
//         return res.status(403).json({
//             error: "You are not authorized to complete this payment"
//         });
//     }
//     if (payment.status !== "PENDING") {
//         return res.status(409).json({
//             error:
//                 "Only pending payments can be completed"
//         });
//     }
//     try{
//         await prisma.$transaction(
//             async tx => {
//                 const existingPurchase =
//                 await tx.purchase.findUnique({
//                     where: {
//                         userId_courseId: {
//                             userId: payment.userId,
//                             courseId: payment.courseId
//                         }
//                     }
//                 });
//                 if (existingPurchase) {
//                     throw new Error(
//                         "Purchase already exists for this user and course"
//                     );
//                 }
//                 await tx.payment.update({
//                     where: {
//                         id: paymentId
//                     },
//                     data: {
//                         status: "COMPLETED",
//                         completedAt: new Date()
//                     }
//                 });
                
//                 await tx.purchase.create({
//                     data: {
//                         userId: payment.userId,
//                         courseId: payment.courseId
//                     }
//                 });
//             }
//         )
        
//         return res.json({
//             message:
//                 "Payment completed successfully",
//             paymentId,
//             courseId: payment.courseId
//         });
// }    catch (error) {
//         console.error(error);
//         return res.status(500).json({
//             error:
//                 "An error occurred while completing the payment"
//         });
//     }
// });

router.post("/verify", VerifyUser, async (req: AuthenticatedRequest, res) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
    } = req.body;
    const payment =
    await prisma.payment.findFirst({
        where: {
            razorpayOrderId:
                razorpay_order_id
        }
    });
    if (!payment) {

        return res.status(404).json({

            error: "Payment not found"

        });

    }
    if (payment.status === "COMPLETED") {
        return res.json({
            message: "Payment already verified"
        });
    }
    const generatedSignature = crypto
        .createHmac(
            "sha256",
            process.env.RAZORPAY_KEY_SECRET!
        )
        .update(
            `${razorpay_order_id}|${razorpay_payment_id}`
        )
        .digest("hex");
    
    if (
        generatedSignature !==
        razorpay_signature
    ) {
        return res.status(400).json({
            error: "Invalid payment signature"
        });
    }
    try {
        await prisma.$transaction(
            async tx => {

                const existingPurchase =
                    await tx.purchase.findUnique({
                        where: {
                            userId_courseId: {
                                userId:
                                    payment.userId,
                                courseId:
                                    payment.courseId
                            }
                        }
                    });

                if (existingPurchase) {
                    throw new Error(
                        "Purchase already exists"
                    );
                }

                await tx.payment.update({
                    where: {
                        id: payment.id
                    },
                    data: {
                        status: "COMPLETED",
                        razorpayPaymentId:
                            razorpay_payment_id,
                        completedAt:
                            new Date()
                    }
                });

                await tx.purchase.create({
                    data: {
                        userId:
                            payment.userId,
                        courseId:
                            payment.courseId
                    }
                });
            }
        );
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error:
                "An error occurred while completing the payment"
        });
    }
    return res.json({
        success: true,
        message:
            "Payment verified successfully",
        paymentId: payment.id,
        courseId: payment.courseId
    });
});
// router.get("/test-order", async (_, res) => {

//     try {

//         const order = await razorpay.orders.create({

//             amount: 100,

//             currency: "INR",

//             receipt: "test_receipt"

//         });

//         return res.json(order);

//     } catch (error) {

//         console.error(error);

//         return res.status(500).json({

//             error: "Failed to create Razorpay order"

//         });

//     }

// });
export default router;