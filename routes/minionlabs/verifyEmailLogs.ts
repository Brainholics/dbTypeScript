import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { getLogsByUserID } from '../../db/verifyEmail/admin';
import { createLog, getOneLog } from '../../db/verifyEmail/log';
import verifySessionToken from '../../middleware/enrichminion/supabaseAuth';
dotenv.config();

const app = express.Router();

app.get("/getUserLogs", verifySessionToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const userID = (req as any).user.id;
        const logs = await getLogsByUserID(userID);

        if (!logs) {
            res.status(404).json({ message: "Logs not found" });
            return;
        }

        res.status(200).json({ logs });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

app.post("/getOneLog", verifySessionToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { logID } = req.body;
        const log = await getOneLog(logID);

        if (!log) {
            res.status(404).json({ message: "Log not found" });
            return;
        }

        res.status(200).json({ log });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
})

app.post("/createLog",verifySessionToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { logID, userID, fileName, creditsUsed, emailsCount } = req.body;
        const log = await createLog(logID, userID, fileName, creditsUsed, emailsCount);

        if (!log) {
            res.status(400).json({ message: "Failed to create log" });
            return;
        }

        res.status(200).json({ message: "Log created successfully", log });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
})

export default app;