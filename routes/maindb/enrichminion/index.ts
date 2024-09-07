import express, { Request, Response } from 'express';
import userMiddleware from "../../../middleware/enrichminion/supabaseAuth";
import multer from 'multer';
import {getBothEmails, getByLIID, getMultipleByLIID, getPersonalEmail, getPersonalEmailByLIID, getProfessionalEmail, getProfessionalEmailsByLIID, scanDB, Test} from "../../../logic/maindb/maindbLogic"

const app = express.Router();
const upload = multer({ dest: './data/' });

app.post('/scandb', userMiddleware, upload.single('csv'), async (req: Request, res: Response) => {
    const response = await scanDB(req, res);
    if (!response) {
        res.status(500).json({error: "failed to scan db"});
    }
    res.status(200).json({"response" : response});
});

app.post('/getPersonalEmail', userMiddleware, upload.single('csv'), async (req: Request, res: Response) => {
    try {
        await getPersonalEmail(req, res);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/getProfessionalEmail', userMiddleware, upload.single('csv'), async (req: Request, res: Response) => {
    try {
        await getProfessionalEmail(req, res);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/getBothEmails', userMiddleware, upload.single('csv'), async (req: Request, res: Response) => {
    try {
        await getBothEmails(req, res);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/getByLiid', userMiddleware, async (req: Request, res: Response) => {
    try {
        await getByLIID(req, res);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/getAllByLiid', userMiddleware, async (req: Request, res: Response) => {
    try {
        await getMultipleByLIID(req, res);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/getPersonalEmailByLiid', userMiddleware, async (req: Request, res: Response) => {
    try {
        await getPersonalEmailByLIID(req, res);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/getProfessionalEmailsByLiid', userMiddleware, async (req: Request, res: Response) => {
    try {
        await getProfessionalEmailsByLIID(req, res);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/test', userMiddleware, upload.single('csv'), async (req: Request, res: Response) => {
    const startingTime = new Date().getTime();
    try {
        const {success} = await Test(req, res);
        const totalTime = (new Date().getTime() - startingTime) / 1000;
        if (success) {
            res.status(200).json({ message: "successful", "total time": `${totalTime} seconds` });
        } else {
            res.status(500).json({ message: "failed", "total time": `${totalTime} seconds` });
        }
    } catch (err: any) {
        const totalTime = (new Date().getTime() - startingTime) / 1000;
        res.status(500).json({ error: err.message, "total time": `${totalTime} seconds` });
    }
});




export default app;