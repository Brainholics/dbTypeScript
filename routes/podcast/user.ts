import express, { Request, Response } from 'express';
import { addCredits, createUser, getUser } from "../../db/podcast/user";
import userMiddleware from "../../middleware/podcast/supabaseAuth";
import {checkSavedProfile, getUserProfile, saveProfile} from "../../db/podcast/saveProfile";

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

app.get("/getCost", userMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const podcastPrice = parseInt(process.env.podcast_price as string);
        res.status(200).json({ podcastPrice });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
})

app.post("/saveProfile", userMiddleware, async (req: Request, res: Response): Promise<void> => {
    try{
        const userID = (req as any).user.id;
        const {id,email,title,sentiment,authorName,rank,audience,adCost,host,category,language,episodes,lastedPublished,publishingFrequency} = req.body;

        const user = await saveProfile(id,userID,email,title,sentiment,authorName,rank,audience,adCost,host,category,language,episodes,lastedPublished,publishingFrequency);

        if(!user){
            res.status(400).json({message: "Failed to save profile"});
            return;
        }

        res.status(200).json({message: "Profile saved successfully", user});

    }catch(error: any){
        res.status(500).json({ message: error.message });
    }
})

app.post("/getUserSavedProfiles", userMiddleware, async(req: Request, res: Response): Promise<void> => {
    try{
        const userID = (req as any).user.id;
        const profiles = await getUserProfile(userID);
        if(!profiles){
            res.status(404).json({message: "Profiles not found"});
            return;
        }

        res.status(200).json({profiles});
    }catch(error: any){
        res.status(500).json({ message: error.message });
    }    
})

app.post("/checkSavedProfile", userMiddleware, async(req: Request, res: Response): Promise<void> => {
    try{
        const userID = (req as any).user.id;
        const {id} = req.body;
        const profiles = await checkSavedProfile(id,userID);
        if(!profiles){
            res.status(404).json({message: "Profiles not found"});
            return;
        }

        res.status(200).json({profiles});
    }catch(error: any){
        res.status(500).json({ message: error.message });
    }

})

export default app;