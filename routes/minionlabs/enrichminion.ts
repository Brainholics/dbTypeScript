import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { createLog, deleteLog, getAllLogs, getAllLogsByUserID, getOneLog } from '../../db/enrichminion/log';
import userMiddleware from "../../middleware/enrichminion/supabaseAuth";
import { v4 } from 'uuid';
dotenv.config();

const app = express.Router();


// CREATE LOG

// app.post("/createLog", userMiddleware, async (req: Request, res: Response): Promise<void> => {
//     try {
//         const userID = (req as any).user.id;
//         const logID = v4();
//         const { creditUsed, fileName,url,type } = req.body;
//         const log = await createLog(logID, userID, creditUsed, fileName,type,url);
//         if (!log) {
//             res.status(404).json({ message: "Log not created" });
//             return;
//         }

//         res.status(201).json({ message: "Log created" });
//     } catch (error: any) {
//         res.status(500).json({ message: error.message });
//     }
// })

// Get LOGS
app.get("/getUserLogs", userMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userID = (req as any).user.id;
        const logs = await getAllLogsByUserID(userID);

        if (!logs) {
            res.status(404).json({ message: "Logs not found" });
            return;
        }

        res.status(200).json({ logs });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

app.post("/getOneLog", userMiddleware, async (req: Request, res: Response): Promise<void> => {
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


export default app;