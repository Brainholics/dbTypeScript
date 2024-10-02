import express, { Request, Response } from 'express';
import multer from 'multer';
import userMiddleware from "../../middleware/enrichminion/supabaseAuth";

const app = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });


app.post('/scanDB',userMiddleware, upload.single('csv'), async (req: Request, res: Response) => {
    const startingTime = new Date().getTime();
    try {
        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }
        const file = req.file;
        const { wantedFields , responseType, discordUsername, responseFormat, email, firstName, lastName,phoneNumber} = req.body;

        const blob = new Blob([file.buffer], { type: file.mimetype });
        const formData = new FormData()
        formData.append('csv', blob, 'data.csv');
        formData.append('wantedFields', wantedFields)
        formData.append('responseType', responseType)
        formData.append('discordUsername', discordUsername)
        formData.append('responseFormat', responseFormat)
        formData.append('email', email)
        formData.append('firstName', firstName)
        formData.append('lastName', lastName)
        formData.append('phoneNumber', phoneNumber)

        const response = await fetch('https://enrichbackend.dealsinfo.store/api/GetResponse', {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${process.env.token}`
            },
            body: formData
        });

        const data = await response.json();
        if (data.error) {
            res.status(500).json({ error: data.error });
            return;
        }
        res.status(200).json(data);
    } catch (err: any) {
        const totalTime = (new Date().getTime() - startingTime) / 1000;
        res.status(500).json({ error: err.message, "total time": `${totalTime} seconds` });
    }
});


export default app;
