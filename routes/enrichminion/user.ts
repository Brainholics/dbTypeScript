import express, { Request, Response } from 'express';
import { addCredits, createUser, getUser } from "../../db/enrichminion/user";
import userMiddleware from "../../middleware/enrichminion/supabaseAuth";

const app = express.Router();

app.post("/register", userMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userID = (req as any).user.id;
        const email = (req as any).user.email;
        const { fullName, companyName, phoneNumber, location } = req.body;
        const user = await createUser(fullName, companyName, phoneNumber, location, userID, email);

        if (!user) {
            res.status(400).json({ message: "User already exists" });
            return;
        }

        res.status(200).json({ message: "User created successfully", user });

    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

app.get("/getUser", userMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userID = (req as any).user.id;
        const user = await getUser(userID);

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        res.status(200).json({ user });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

app.post("/addCredits", userMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const { credits } = req.body;
        const userID = (req as any).user.id;
        const state = await addCredits(credits, userID);

        if (!state) {
            res.status(400).json({ message: "Failed to add credits" });
            return;
        }

        res.status(200).json({ message: `Credits added successfully balance: ${state.credits}` });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

app.get("/getCredits", userMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userID = (req as any).user.id;
        const user = await getUser(userID);

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        res.status(200).json({ credits: user.credits });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

app.get("/getCost", async (req: Request, res: Response): Promise<void> => {
    try {
        const enrichminiondbPrice = parseInt(process.env.enrichminiondb_price as string);
        res.status(200).json({ enrichminiondbPrice });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
})

app.get("/getCostWithAuth", userMiddleware,async (req: Request, res: Response): Promise<void> => {
    try {
        const enrichminiondbPrice = parseInt(process.env.enrichminiondb_price as string);
        res.status(200).json({ enrichminiondbPrice });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
})




export default app;