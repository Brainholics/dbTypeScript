import express, { Request, Response } from "express";
import fs from 'fs';
import path from 'path';
import adminVerification from "../../middleware/enrichminion/adminAuth";
import { adminLogin, generateAPIkey, getAllApikeys, getAllUsers, getApiKey, getLogsByUserID, getUserById, revokeAPIkey, updateCredits } from "../../db/verifyEmail/admin";
import { getAllLogs } from "../../db/verifyEmail/log";

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


// Login route
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

// // Get price
// app.get("/getPrice", adminVerification, async (req: Request, res: Response) => {  //TESTED
//     try {
//         if (!process.env.COSTPEREMAIL) {
//             throw new Error("no price set");
//         }
//         res.status(200).json({ "resp": process.env.COSTPEREMAIL });
//     } catch (error: any) {
//         res.status(404).json({ "error": error.message });
//     }
// });

// // Change price
// app.post("/changePrice", adminVerification, async (req: ChangePriceRequest, res: Response) => {  //TESTED
//     try {
//         const { newPrice } = req.body;
//         if (isNaN(newPrice) || !newPrice) {
//             throw new Error("Invalid price");
//         }

//         process.env.COSTPEREMAIL = newPrice.toString();

//         const envFilePath = path.resolve(__dirname, '../.env');
//         if (!fs.existsSync(envFilePath)) {
//             throw new Error(".env file not found");
//         }

//         let envFileContent = fs.readFileSync(envFilePath, 'utf8');
//         const newEnvFileContent = envFileContent.replace(/(^|\n)COSTPEREMAIL=.*/, `$1COSTPEREMAIL=${newPrice}`);
//         fs.writeFileSync(envFilePath, newEnvFileContent);

//         res.status(200).json({ "resp": "updated price" });
//     } catch (error: any) {
//         res.status(400).json({ "error": error.message });
//     }
// });

// Get all users
app.get("/getAllUsers", adminVerification, async (req: Request, res: Response) => { //TESTED
    try {
        const resp = await getAllUsers();
        res.status(200).json({ resp });
    } catch (error: any) {
        res.status(404).json({ "message": error.message });
    }
});

app.get("/getAllApikeys", adminVerification, async (req: Request, res: Response) => { //TESTED
    try {
        const resp = await getAllApikeys();
        res.status(200).json({ resp });
    } catch (error: any) {
        res.status(404).json({ "message": error.message });
    }
});

app.post("/generateAPIkey", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        const { userID } = req.body;
        const resp = await generateAPIkey(userID);
        if (!resp) {
            throw new Error("failed to generate key");
        }
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

app.get("/getAllLogsById", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        const { userID } = req.body;

        const data = await getLogsByUserID(userID);
        if (!data) {
            throw new Error("failed to find logs");
        }
        res.status(200).json({ data });
    } catch (error: any) {
        res.status(400).json({ "message": error.message });
    }
});

app.get("/getAllLogs", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        const data = await getAllLogs() 
        if (!data) {    
            throw new Error("failed to find logs");
        }
        res.status(200).json({ data });
    } catch (error: any) {
        res.status(400).json({ "message": error.message });
    }
});

export default app;
