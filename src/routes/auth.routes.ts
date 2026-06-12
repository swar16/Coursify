import { Router } from "express";
import prisma from "../lib/prisma";
import bcrypt from "bcrypt";
import jwt from 'jsonwebtoken';
const router = Router();
import {SignupSchema} from "../schemas/auth.schema"
import { LoginSchema } from "../schemas/auth.schema";

router.post("/signup", async(req, res) => {
    const result=SignupSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({
            errors: result.error.issues
        });
    }
    const data = result.data;
    
    const alreadyExists=await prisma.user.findUnique({
        where: {
            email: data.email
        }
    })
    if(alreadyExists){
        return res.status(400).json({ error: "User with this email already exists" });
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
        data: {
            email: data.email,
            password: hashedPassword,
            role:data.role
        }
    })
    return res.status(201).json({
        id: user.id,
        email: user.email,
        role: user.role
    });
    
});

router.post("/login", async(req, res) => {

    const result=LoginSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({
            errors: result.error.issues
        });
    }
    const data = result.data;
    const user=await prisma.user.findUnique({
        where:{
            email:data.email
        }
    })
    if(!user){
        return res.status(400).json({ error: "Invalid email or password" });
    }
    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if(!isPasswordValid){
        return res.status(400).json({ error: "Invalid email or password" });
    }
    
    const token = jwt.sign(
    {
        userId: user.id,
        role: user.role
    },
    process.env.JWT_SECRET!,
    {
        expiresIn: "7d"
    }
    );

    return res.status(200).json({
        token,
        user: {
            id: user.id,
            email: user.email,
            role: user.role
        }
    });
});

export default router;