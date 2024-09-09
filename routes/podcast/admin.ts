import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { adminLogin, getAllApikeys, getAllUsers, getApiKey, getUserById, revokeAPIkey, updateCredits } from "../../db/podcast/admin";
import adminVerification from "../../middleware/podcast/adminAuth";

const app = express.Router();

interface LoginRequest extends Request {
    body: {
        email: string;
        password: string;
    };
}

interface UpdateCreditsRequest extends Request {
    body: {
        userID: string;
        credits: number;
    };
}

interface ChangeWebhookRequest extends Request {
    body: {
        webhook: string;
    };
}

interface ChanegPodcastPriceRequest extends Request {
    body: {
        newPrice: number;
    };
}



// LOGIN ROUTE
app.post("/login", async (req: LoginRequest, res: Response) => {  //TESTED
    try {
        const { email, password } = req.body;
        const resp = await adminLogin(email, password);
        if (!resp) {
            throw new Error("no admin account");
        }
        res.status(200).json({ "message": "authorised", "token": resp });
    } catch (error: any) {
        res.status(404).json({ "message": error.message });
    }
});





// USERS ROUTES



// get users

// Get user by ID
app.get("/getUser", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        const { userID } = req.body;
        const data = await getUserById(userID);
        if (!data) {
            throw new Error("user not found");
        }
        res.status(200).json({ data });
    } catch (error: any) {
        res.status(404).json({ "message": error.message });
    }
});


// Get all users
app.get("/getAllUsers", adminVerification, async (req: Request, res: Response) => { //TESTED
    try {
        const resp = await getAllUsers();
        res.status(200).json({ resp });
    } catch (error: any) {
        res.status(404).json({ "message": error.message });
    }
});

// delete user

app.delete("/deleteUser", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        const { userID } = req.body;
        const resp = await getUserById(userID);
        if (!resp) {
            throw new Error("user not found");
        }
        
        res.status(200).json({ "resp": "user deleted" });
    } catch (error: any) {
        res.status(404).json({ "message": error.message });
    }
});

// CHANGE PRICINGS ROUTE
app.post("/changePrice", adminVerification, async (req: ChanegPodcastPriceRequest, res: Response) => {  //TESTED
    try {
        const { newPrice } = req.body;
        if (isNaN(newPrice) || !newPrice) {
            throw new Error("Invalid price");
        }

        process.env.enrichminiondb_price = newPrice.toString();

        const envFilePath = path.resolve(__dirname, '../../.env');
        if (!fs.existsSync(envFilePath)) {
            throw new Error(".env file not found");
        }

        let envFileContent = fs.readFileSync(envFilePath, 'utf8');
        const newEnvFileContent = envFileContent.replace(/(^|\n)podcast_price=.*/, `$1podcast_price=${newPrice}`);
        fs.writeFileSync(envFilePath, newEnvFileContent);

        res.status(200).json({ "resp": "updated price" });
    } catch (error: any) {
        res.status(400).json({ "error": error.message });
    }
});

app.post("/changeWebhook", adminVerification, async (req: ChangeWebhookRequest, res: Response) => {  //TESTED
    try {
        const { webhook } = req.body;
        if (!webhook) {
            throw new Error("webhook cannot be empty");
        }
        process.env.WEBHOOK_URL = webhook;

        const envFilePath = path.resolve(__dirname, "../../.env");
        if (!fs.existsSync(envFilePath)) {
            throw new Error(".env file not found");
        }
        let envFileContent = fs.readFileSync(envFilePath, 'utf8');
        const newEnvFileContent = envFileContent.replace(/(^|\n)WEBHOOK_URL=.*/, `$1WEBHOOK_URL=${webhook}`);
        fs.writeFileSync(envFilePath, newEnvFileContent);

        res.status(200).json({ "message": "webhook changed" });
    } catch (error: any) {
        res.status(404).json({ "message": error.message });
    }
});



// APIKEY ROUTES

app.get("/getAllApikeys", adminVerification, async (req: Request, res: Response) => { //TESTED
    try {
        const resp = await getAllApikeys();
        res.status(200).json({ resp });
    } catch (error: any) {
        res.status(404).json({ "message": error.message });
    }
});

app.post("/getAPIkey", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        const { userID } = req.body;
        const resp = await getApiKey(userID);
        if (!resp) {
            throw new Error("this account do not have APIKEY access");
        }
        res.status(200).json({ resp });
    } catch (error: any) {
        res.status(404).json({ "message": error.message });
    }
});

app.post("/revokeAPIkey", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        const { userID } = req.body;
        const resp = await revokeAPIkey(userID);
        if (!resp) {
            throw new Error("failed to revoke key");
        }
        res.status(200).json({ resp });
    } catch (error: any) {
        res.status(404).json({ "message": error.message });
    }
});


// CREDITS ROUTES


app.get("/getPrice", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        if (!process.env.podcast_price) {
            throw new Error("no price set");
        }
        res.status(200).json({ "resp": process.env.podcast_price });
    } catch (error: any) {
        res.status(404).json({ "error": error.message });
    }
});

// Update credits
app.post("/updateCredits", adminVerification, async (req: UpdateCreditsRequest, res: Response) => {  //TESTED
    try {
        const { userID, credits } = req.body;
        const resp = await updateCredits(userID, credits);
        if (resp === "negative") {
            throw new Error("credits cannot be negative");
        }
        if (!resp) {
            throw new Error("failed to update credits");
        }
        res.status(200).json({ resp });
    } catch (error: any) {
        res.status(400).json({ "message": error.message });
    }
});





export default app;