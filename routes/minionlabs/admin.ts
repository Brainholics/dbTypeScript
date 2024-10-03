import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { deleteLog, getAllLogs, getAllLogsByUserID, getOneLog } from "../../db/enrichminion/log";
import { adminLogin, generateAPIkey, getAllApikeys, getAllUsers, getApiKey, getUserById, revokeAPIkey, updateCredits } from "../../db/enrichminion/admin";
import adminVerification from "../../middleware/enrichminion/adminAuth";

import {updateCredits as verifyEmailUpdateCreds, getLogsByUserID as verifyEmailUserLogs} from "../../db/verifyEmail/admin";

import { getAllLogs as verifyEmailAllLogs } from "../../db/verifyEmail/log";
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

interface ChangeEnrichPriceRequest extends Request {
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

        await deleteLog(userID);
        res.status(200).json({ "resp": "user deleted" });
    } catch (error: any) {
        res.status(404).json({ "message": error.message });
    }
});

// CHANGE PRICINGS ROUTE
app.post("/changeEnrichMinionPrice", adminVerification, async (req: ChangeEnrichPriceRequest, res: Response) => {  //TESTED
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
        const newEnvFileContent = envFileContent.replace(/(^|\n)enrichminiondb_price=.*/, `$1enrichminiondb_price=${newPrice}`);
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

app.post("/changeEnrichMinionCostperAccess", adminVerification, async (req: ChangeEnrichPriceRequest, res: Response) => {  //TESTED
    try {
        const { newPrice } = req.body;
        if (isNaN(newPrice) || !newPrice) {
            throw new Error("Invalid price");
        }

        process.env.enrichminiondb_per_row_cost = newPrice.toString();

        const envFilePath = path.resolve(__dirname, '../../.env');
        if (!fs.existsSync(envFilePath)) {
            throw new Error(".env file not found");
        }

        let envFileContent = fs.readFileSync(envFilePath, 'utf8');
        const newEnvFileContent = envFileContent.replace(/(^|\n)enrichminiondb_per_row_cost=.*/, `$1enrichminiondb_per_row_cost=${newPrice}`);
        fs.writeFileSync(envFilePath, newEnvFileContent);

        res.status(200).json({ "resp": "updated price" });
    } catch (error: any) {
        res.status(400).json({ "error": error.message });
    }
});



// APIKEY ROUTES

app.post("/generateApiKey", adminVerification, async (req: Request, res: Response) => {  //TESTED   
    try {
        const { userID } = req.body;
        const resp = await getApiKey(userID);
        if (resp) {
            throw new Error("this account already have APIKEY access");
        }
        const apiKey = await generateAPIkey(userID);
        res.status(200).json({ apiKey });
    } catch (error: any) {
        res.status(404).json({ "message": error.message });
    }
})

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

app.get("/getEnrichMinionAccessCost", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        if (!process.env.enrichminiondb_per_row_cost) {
            throw new Error("no price set");
        }
        res.status(200).json({ "resp": process.env.enrichminiondb_per_row_cost});
    } catch (error: any) {
        res.status(404).json({ "error": error.message });
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

app.get("/getEnrichMinionCredits", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        const { userID } = req.body;
        const user = await getUserById(userID);
        if (!user) {
            throw new Error("User not found");
        }
        res.status(200).json({ credits: user.credits });
    } catch (error: any) {
        res.status(400).json({ "message": error.message });
    }
});

app.get("/getEnrichMinionPrice", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        if (!process.env.enrichminiondb_price) {
            throw new Error("no price set");
        }
        res.status(200).json({ "resp": process.env.enrichminiondb_price });
    } catch (error: any) {
        res.status(404).json({ "error": error.message });
    }
});

// Update credits
app.post("/updateEnrichMinionCredits", adminVerification, async (req: UpdateCreditsRequest, res: Response) => {  //TESTED
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


// Logs

// get logs

app.post("/getOneEnrichMinionLog", adminVerification, async (req: Request, res: Response): Promise<void> => {
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

// get all logs

app.get("/getAllEnrichMinionLogs", adminVerification, async (req: Request, res: Response): Promise<void> => {
    try {
        const logs = await getAllLogs();

        if (!logs) {
            res.status(404).json({ message: "Logs not found" });
            return;
        }

        res.status(200).json({ logs });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});


// get user logs


app.get("/getEnrichMinionUserLogs", adminVerification, async (req: Request, res: Response): Promise<void> => {
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


//delete logs


app.delete("/deleteEnrichMinionLog", adminVerification, async (req: Request, res: Response): Promise<void> => {
    try {
        const { logID } = req.body;
        const log = await getOneLog(logID);

        if (!log) {
            res.status(404).json({ message: "Log not found" });
            return;
        }

        await deleteLog(logID);

        res.status(200).json({ message: "Log deleted" });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
})

app.post("/updateVerifyEmailCredits", adminVerification, async (req: UpdateCreditsRequest, res: Response) => {  //TESTED
    try {
        const { userID, credits } = req.body;
        const resp = await verifyEmailUpdateCreds(userID, credits);
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

app.get("/getAllVerifyEmailLogsById", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        const { userID } = req.body;

        const data = await verifyEmailUserLogs(userID);
        if (!data) {
            throw new Error("failed to find logs");
        }
        res.status(200).json({ data });
    } catch (error: any) {
        res.status(400).json({ "message": error.message });
    }
});

app.get("/getAllVerifyEmailLogs", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        const data = await verifyEmailAllLogs() 
        if (!data) {    
            throw new Error("failed to find logs");
        }
        res.status(200).json({ data });
    } catch (error: any) {
        res.status(400).json({ "message": error.message });
    }
});

app.post("changeVerifyEmailPrice", adminVerification, async (req: ChangeEnrichPriceRequest, res: Response) => {  //TESTED
    try {
        const { newPrice } = req.body;
        if (isNaN(newPrice) || !newPrice) {
            throw new Error("Invalid price");
        }

        process.env.COSTPEREMAIIL = newPrice.toString();

        const envFilePath = path.resolve(__dirname, '../../.env');
        if (!fs.existsSync(envFilePath)) {
            throw new Error(".env file not found");
        }

        let envFileContent = fs.readFileSync(envFilePath, 'utf8');
        const newEnvFileContent = envFileContent.replace(/(^|\n)COSTPEREMAIIL=.*/, `$1COSTPEREMAIIL=${newPrice}`);
        fs.writeFileSync(envFilePath, newEnvFileContent);

        res.status(200).json({ "resp": "updated price" });
    } catch (error: any) {
        res.status(400).json({ "error": error.message });
    }
});


export default app;