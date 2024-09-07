import { PrismaClient } from "@prisma/client";
import { NextFunction, Request, Response } from "express";

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
    user?: any; // You can replace `any` with a more specific type if you have a User interface
  }

const apiAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authHeader = req.headers["authorization"];
        if (!authHeader) {
            throw new Error("Authorization header missing");
        }

        const APIKEY = authHeader.split("Bearer ")[1];
        if (!APIKEY) {
            throw new Error("Token missing");
        }

        const user = await prisma.user.findUnique({
            where: {
                apikey: APIKEY
            }
        })

        if (user?.apikey) {
            req.user = user;
            next();
        } else {
            throw new Error("Unauthorized");
        }

    } catch (error: any) {
        res.status(401).json({ message: error.message });
    }
};

export default apiAuth;