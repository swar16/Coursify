import { Router } from "express";
import prisma from "../lib/prisma";
import bcrypt from "bcrypt";
import jwt from 'jsonwebtoken';
const router = Router();

router.post("/signup", async(req, res) => {

    const { email, password, role } = req.body;
    if(!email || !password || !role){
        return res.status(400).json({ error: "Email, password and role are required" });
    }
    const alreadyExists=await prisma.user.findUnique({
        where: { email }
    })
    if(alreadyExists){
        return res.status(400).json({ error: "User with this email already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            role
        }
    })
    return res.status(201).json({
        id: user.id,
        email: user.email,
        role: user.role
    });
    
});

router.post("/login", async(req, res) => {

    const { email, password } = req.body;
    if(!email || !password){
        return res.status(400).json({ error: "Email and password are required" });
    }
    const user=await prisma.user.findUnique({
        where:{
            email
        }
    })
    if(!user){
        return res.status(400).json({ error: "Invalid email or password" });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
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