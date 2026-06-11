import prisma from "./lib/prisma";

console.log("created");

void prisma.$disconnect();