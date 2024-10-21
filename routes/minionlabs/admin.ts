import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { adminLogin, generateAPIkey, getAllApikeys, getAllUsers, getApiKey, getUserById, revokeAPIkey, updateCredits } from "../../db/enrichminion/admin";
import { deleteLog, getAllLogs, getAllLogsByUserID, getOneLog } from "../../db/enrichminion/log";
import adminVerification from "../../middleware/enrichminion/adminAuth";

import { getLogsByUserID as verifyEmailUserLogs, updateLogIDAtAdmin as verifyUpdateLogAtAdmin } from "../../db/verifyEmail/admin";

import { removeCredits } from "../../db/enrichminion/user";
import { getAllInvoices, getInvoiceByBillingID } from "../../db/verifyEmail/billing";
import { addJSONStringToLog, changeProgressStatus, getBreakPoint, getEmailsFromBreakPoint, getAllLogs as verifyEmailAllLogs, getOneLog as verifyEmailLog, updateLog as verifyUpdateLog } from "../../db/verifyEmail/log";
import { BreakPoint, Email, EmailSingleDB, SECONDAPIResponse, SMTPResponse, SMTPStatus } from "../../types/interfaces";
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

//change webhook
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

app.get("/getUserCredits", adminVerification, async (req: Request, res: Response) => {  //TESTED
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


// Logs

// enrich logs
app.post("/getOneEnrichLog", adminVerification, async (req: Request, res: Response): Promise<void> => {
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

app.get("/getAllEnrichLogs", adminVerification, async (req: Request, res: Response): Promise<void> => {
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

app.get("/getEnrichLogsByID", adminVerification, async (req: Request, res: Response): Promise<void> => {
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
app.delete("/deleteEnrichLog", adminVerification, async (req: Request, res: Response): Promise<void> => {
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


// verify email logs

app.post("/getOneVerifyEmailLog", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        const { logID } = req.body;
        const data = await verifyEmailLog(logID);
        if (!data) {
            throw new Error("failed to find log");
        }
        res.status(200).json({ data });
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

//change prices

app.post("/changeVerifyEmailPrice", adminVerification, async (req: ChangeEnrichPriceRequest, res: Response) => {  //TESTED
    try {
        const { newPrice } = req.body;
        if (isNaN(newPrice) || !newPrice) {
            throw new Error("Invalid price");
        }

        process.env.VerifyCost = newPrice.toString();

        const envFilePath = path.resolve(__dirname, '../../.env');
        if (!fs.existsSync(envFilePath)) {
            throw new Error(".env file not found");
        }

        let envFileContent = fs.readFileSync(envFilePath, 'utf8');
        const newEnvFileContent = envFileContent.replace(/(^|\n)VerifyCost=.*/, `$1VerifyCost=${newPrice}`);
        fs.writeFileSync(envFilePath, newEnvFileContent);

        res.status(200).json({ "resp": "updated price" });
    } catch (error: any) {
        res.status(400).json({ "error": error.message });
    }
});

app.post("/changeEnrichPrice", adminVerification, async (req: ChangeEnrichPriceRequest, res: Response) => {  //TESTED
    try {
        const { newPrice } = req.body;
        if (isNaN(newPrice) || !newPrice) {
            throw new Error("Invalid price");
        }

        process.env.EnrichCost = newPrice.toString();

        const envFilePath = path.resolve(__dirname, '../../.env');
        if (!fs.existsSync(envFilePath)) {
            throw new Error(".env file not found");
        }

        let envFileContent = fs.readFileSync(envFilePath, 'utf8');
        const newEnvFileContent = envFileContent.replace(/(^|\n)EnrichCost=.*/, `$1EnrichCost=${newPrice}`);
        fs.writeFileSync(envFilePath, newEnvFileContent);

        res.status(200).json({ "resp": "updated price" });
    } catch (error: any) {
        res.status(400).json({ "error": error.message });
    }
});

app.post("/changeCreditPrice", adminVerification, async (req: ChangeEnrichPriceRequest, res: Response) => {  //TESTED
    try {
        const { newPrice } = req.body;
        if (isNaN(newPrice) || !newPrice) {
            throw new Error("Invalid price");
        }

        process.env.CreditPrice = newPrice.toString();

        const envFilePath = path.resolve(__dirname, '../../.env');
        if (!fs.existsSync(envFilePath)) {
            throw new Error(".env file not found");
        }

        let envFileContent = fs.readFileSync(envFilePath, 'utf8');
        const newEnvFileContent = envFileContent.replace(/(^|\n)CreditPrice=.*/, `$1CreditPrice=${newPrice}`);
        fs.writeFileSync(envFilePath, newEnvFileContent);

        res.status(200).json({ "resp": "updated price" });
    } catch (error: any) {
        res.status(400).json({ "error": error.message });
    }
});

app.post("/changeRegistrationCredits", adminVerification, async (req: ChangeEnrichPriceRequest, res: Response) => {  //TESTED
    try {
        const { newPrice } = req.body;
        if (isNaN(newPrice) || !newPrice) {
            throw new Error("Invalid price");
        }

        process.env.RegistrationCredits = newPrice.toString();

        const envFilePath = path.resolve(__dirname, '../../.env');
        if (!fs.existsSync(envFilePath)) {
            throw new Error(".env file not found");
        }

        let envFileContent = fs.readFileSync(envFilePath, 'utf8');
        const newEnvFileContent = envFileContent.replace(/(^|\n)RegistrationCredits=.*/, `$1RegistrationCredits=${newPrice}`);
        fs.writeFileSync(envFilePath, newEnvFileContent);

        res.status(200).json({ "resp": "updated registration credits" });
    } catch (error: any) {
        res.status(400).json({ "error": error.message });
    }
});

//get prices

app.get("/getEnrichPrice", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        if (!process.env.EnrichCost) {
            throw new Error("no price set");
        }
        res.status(200).json({ "resp": process.env.EnrichCost });
    } catch (error: any) {
        res.status(404).json({ "error": error.message });
    }
});

app.get("/getCreditCost", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        if (!process.env.CreditPrice) {
            throw new Error("no price set");
        }
        res.status(200).json({ "resp": process.env.CreditPrice });
    } catch (error: any) {
        res.status(404).json({ "error": error.message });
    }
});

app.get("/getVerifyEmailCost", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        if (!process.env.VerifyCost) {
            throw new Error("no price set");
        }
        res.status(200).json({ "resp": process.env.VerifyCost });
    } catch (error: any) {
        res.status(404).json({ "error": error.message });
    }
});

app.get("/getRegistrationCredits", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        if (!process.env.RegistrationCredits) {
            throw new Error("no price set");
        }
        res.status(200).json({ "resp": process.env.RegistrationCredits });
    } catch (error: any) {
        res.status(404).json({ "error": error.message });
    }
});

app.get("/getAllBills", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        const data = await getAllInvoices();
        if (!data) {
            throw new Error("no bills found");
        }
        res.status(200).json({ data });
    } catch (error: any) {
        res.status(404).json({ "error": error.message });
    }
})

app.post("/getBillsByUser", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        const { userID } = req.body;
        const data = await getAllLogsByUserID(userID);
        if (!data) {
            throw new Error("no bills found");
        }
        res.status(200).json({ data });
    } catch (error: any) {
        res.status(404).json({ "error": error.message });
    }
})

app.post("/getBill", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        const { billingID } = req.body;
        const data = await getInvoiceByBillingID(billingID);
        if (!data) {
            throw new Error("no bill found");
        }
        res.status(200).json({ data });
    } catch (error: any) {
        res.status(404).json({ "error": error.message });
    }
})

app.post("/runFrom1BreakPoint", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        const { logID } = req.body;
        const log = await verifyEmailLog(logID);
        if (!log) {
            throw new Error("log not found");
        }

        if (log.status !== "1") {
            throw new Error("log is not at breakpoint 1");
        }

        const breakPoint = await getBreakPoint(logID);
        if (!breakPoint) {
            throw new Error("breakpoint not found");
        }

        const emailsData = await getEmailsFromBreakPoint(breakPoint.BreakPointID);
        const emails = emailsData.map((email) => email.email);

        // send request to SMTP ENDPOINT
        const response = await fetch(process.env.SMTPENDPOINT as string, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                emails: emails,
            }),
            redirect: "follow",
        })

        if (!response.ok) {
            res.status(400).json({ message: "Failed to send emails to SMTP server" });

            const updatedLog = await verifyUpdateLog(log.LogID, "1", ({
                apicode: 1,
                emails: emails,
                statuses: emailsData.map((email) => email.status),
                providers: emailsData.map((email) => email.Provider),
                mxProviders: emailsData.map((email) => email.mxProvider),
                mxRecords: emailsData.map((email) => email.mxRecord),
            } as BreakPoint));
            if (!updatedLog) {
                res.status(400).json({ message: "Failed to update log at First server failure" });
                return;
            }
            return;
        }

        const data = await response.json() as SMTPResponse;

        const updatedLog = await verifyUpdateLogAtAdmin(data.id);
        if (!updatedLog) {
            res.status(400).json({ message: "Failed to update log at admin" });
            return;
        }

        res.status(200).json({ message: "File uploaded successfully", updatedLog });
    } catch (error: any) {
        res.status(404).json({ "error": error.message });
    }
});

app.post("/checkStatusFrom1", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {

        const { logID } = req.body;
        if (!logID) {
            res.status(400).json({ message: "Log ID not found" });
            return;
        }

        const log = await verifyEmailLog(logID);
        if (!log) {
            res.status(400).json({ message: "Log not found" });
            return;
        }
        if (log.status === "completed") {
            res.status(200).json({ message: "Completed", "log": log });
            return;
        }

        if (log.InProgress) {
            res.status(200).json({ message: "In progress", log });
            return;
        }

        const googleWorkspaceEmails: Email[] = [];
        const restEmails: Email[] = [];
        const validEmails: Email[] = [];
        const catchAllValidEmails: Email[] = [];
        const UnknownEmails: Email[] = [];
        const invalidEmails: Email[] = [];

        // Function to poll SMTP response status
        const checkSMTPStatus = async (): Promise<SMTPStatus | null> => {
            const maxRetries = 60; // Retry for up to 5 minutes (5 seconds * 60 retries)
            let retries = 0;
            let statusData: SMTPStatus | null = null;

            while (retries < maxRetries) {
                const SMTPResponseStatus = await fetch(process.env.SMTPRESPONSE as string, {
                    method: "POST",
                    headers: {
                        "x-mails-api-key": process.env.SMTPAPIKEY as string,
                        "ID": logID
                    }
                });

                if (SMTPResponseStatus.ok) {
                    statusData = await SMTPResponseStatus.json() as SMTPStatus;

                    if (statusData.status === 'completed') {
                        return statusData;
                    }

                    // If status is not complete, wait 5 seconds before retrying
                    retries++;
                    await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000)); // Wait 5 seconds
                } else {
                    res.status(400).json({ message: "Failed to check status from SMTP server" });
                    return null;
                }
            }

            res.status(408).json({ message: "Timeout: Status not completed within 5 hours" });
            return null;
        };

        // Call the polling function
        const statusData = await checkSMTPStatus();
        if (!statusData) return;

        const updateProgressLog = await changeProgressStatus(logID, true);
        if (!updateProgressLog) {
            res.status(400).json({ message: "Failed to update log" });
            return;
        }

        if (!statusData.emails) {
            res.status(500).json({ message: "No emails found in first SMTP server" });
            return;
        }

        for (const email of statusData.emails) {
            if (email.result === "unknown" || email.result === "catch_all" || email.result === "risky") {
                if (email.provider === "googleworkspace") {
                    googleWorkspaceEmails.push(email);
                } else {
                    restEmails.push(email);
                }
            } else if (email.result === "deliverable") {
                validEmails.push(email);
            } else {
                // console.log({"Invalid Email": email.result});
                invalidEmails.push(email);
            }
        }

        for (const email of restEmails) {

            const response = await fetch(process.env.OutlookEndpoint as string, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: email.email
                })
            })

            if (!response.ok) {
                //adding {email:"GoogleWorkSpaceStart"} to the emails array to send emails to google workspace server Because lazy do not want to change DB schema 
                const pendingEmails = [...restEmails, ...googleWorkspaceEmails];
                const updatedLog = await verifyUpdateLog(logID, "2", ({
                    apicode: 2,
                    emails: pendingEmails.map((email) => email.email),
                    statuses: pendingEmails.map((email) => email.result),
                    providers: pendingEmails.map((email) => email.provider),
                    mxProviders: statusData.emails.map((email) => email.provider),
                    mxRecords: statusData.emails.map((email) => email.mx_record),
                } as BreakPoint))
                if (!updatedLog) {
                    res.status(400).json({ message: "Failed to update log in case of outlook server failure" });
                    return;
                }
                res.status(400).json({ message: "Failed to send emails to outlook server" });
                return;
            }

            const data = await response.json() as SECONDAPIResponse;

            if (data['EMAIL-status'] === "valid") {
                if (email.result === "catch_all" || email.result === "risky") {
                    catchAllValidEmails.push(email);
                }
                else {
                    validEmails.push(email);
                }
            }
            else {
                googleWorkspaceEmails.push(email);
            }
        }

        for (const email of googleWorkspaceEmails) {
            const response = await fetch(process.env.GsuiteEndpoint as string, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: email.email
                })
            });

            if (!response.ok) {
                const updatedLog = await verifyUpdateLog(logID, "3", ({
                    apicode: 3,
                    emails: googleWorkspaceEmails.map((email) => email.email),
                    providers: googleWorkspaceEmails.map((email) => email.provider),
                    statuses: googleWorkspaceEmails.map((email) => email.result),
                    mxProviders: statusData.emails.map((email) => email.provider),
                    mxRecords: statusData.emails.map((email) => email.mx_record),
                } as BreakPoint))
                if (!updatedLog) {
                    res.status(400).json({ message: "Failed to update log in case of Gsuite server failure" });
                    return;
                }
                res.status(400).json({ message: "Failed to send emails to Gsuite server" });
                return;
            }

            const data = await response.json() as SECONDAPIResponse;

            if (data['EMAIL-status'] === "valid") {
                if (email.result === "catch_all" || email.result === "risky") {
                    catchAllValidEmails.push(email);
                }
                else {
                    validEmails.push(email);
                }
            }
            else {
                UnknownEmails.push(email);
            }
        }

        const Location = updateProgressLog.url;

        const uploadedJson = await fetch(Location as string);
        if (!uploadedJson.ok) {
            res.status(400).json({ message: "Failed to fetch uploaded JSON" });
            return;
        }

        const uploadedJsonData = await uploadedJson.json();

        const data = {
            ...uploadedJsonData,
            ValidEmails: validEmails.map((email) => email.email),
            CatchAllValidEmails: catchAllValidEmails.map((email) => email.email),
            InvalidEmails: invalidEmails.map((email) => email.email),
            UnknownEmails: UnknownEmails.map((email) => email.email),
            MxProviders: statusData.emails.map((email) => email.provider),
            MxRecords: statusData.emails.map((email) => email.mx_record),
        };

        console.log({ data: data });


        const JSONData = JSON.stringify(data, null, 2);

        const updatedLog = await verifyUpdateLog(logID, "completed", ({
            apicode: 4,
            emails: [],
            providers: [],
            statuses: [],
            mxProviders: [],
            mxRecords: [],
        } as BreakPoint))
        if (!updatedLog) {
            res.status(400).json({ message: "Failed to update log at Done" });
            return;
        }

        const addJSONstring = await addJSONStringToLog(logID, JSONData, validEmails.length, invalidEmails.length, UnknownEmails.length, catchAllValidEmails.length);;
        if (!addJSONstring) {
            res.status(400).json({ message: "Failed to add JSON data to log" });
            return;
        }

        res.status(200).json({
            message: "File uploaded successfully",
            validEmails: validEmails.length,
            catchAllValidEmails: catchAllValidEmails.length,
            invalidEmails: invalidEmails.length,
            UnknownEmails: UnknownEmails.length,
            mxProvier: statusData.emails.length,
            mxRecords: statusData.emails.length
        });

        return;
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
})

app.post("/runFrom2BreakPoint", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        const { logID } = req.body;

        const log = await verifyEmailLog(logID);
        if (!log) {
            throw new Error("log not found");
        }

        if (log.status !== "2") {
            throw new Error("log is not at breakpoint 2");
        }

        const breakPoint = await getBreakPoint(logID);
        if (!breakPoint) {
            throw new Error("breakpoint not found");
        }

        const emailsData = await getEmailsFromBreakPoint(breakPoint.BreakPointID);

        let googleWorkspaceEmails: EmailSingleDB[] = [];
        let restEmails: EmailSingleDB[] = [];
        const validEmails: EmailSingleDB[] = [];
        const catchAllValidEmails: EmailSingleDB[] = [];
        const UnknownEmails: EmailSingleDB[] = [];
        const invalidEmails: EmailSingleDB[] = [];


        for (const email of emailsData) {
            if (email.status === "unknown" || email.status === "catch_all" || email.status === "risky") {
                if (email.Provider === "googleworkspace") {
                    googleWorkspaceEmails.push(email);
                } else {
                    restEmails.push(email)
                }
            } else if (email.Provider === "deliverable") {
                validEmails.push(email);
            } else {
                // console.log({"Invalid Email": email.result});
                invalidEmails.push(email);
            }


            // alas buri bala change in v2

            for (const email of restEmails) {
                const response = await fetch(process.env.OutlookEndpoint as string, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email: email
                    })
                })

                if (!response.ok) {
                    //adding {email:"GoogleWorkSpaceStart"} to the emails array to send emails to google workspace server Because lazy do not want to change DB schema 
                    const pendingEmails = [...restEmails, ...googleWorkspaceEmails];
                    const updatedLog = await verifyUpdateLog(logID, "2", ({
                        apicode: 2,
                        emails: pendingEmails.map((email) => email.email),
                        statuses: pendingEmails.map((email) => email.status),
                        providers: pendingEmails.map((email) => email.Provider),
                        mxProviders: emailsData.map((email) => email.mxProvider),
                        mxRecords: emailsData.map((email) => email.mxRecord)
                    } as BreakPoint))
                    if (!updatedLog) {
                        res.status(400).json({ message: "Failed to update log in case of outlook server failure" });
                        return;
                    }
                    res.status(400).json({ message: "Failed to send emails to outlook server" });
                    return;
                }

                const data = await response.json() as SECONDAPIResponse;

                if (data['EMAIL-status'] === "valid") {
                    if (email.Provider === "catch_all" || email.Provider === "``risky") {
                        catchAllValidEmails.push(email);
                    }
                    else {
                        validEmails.push(email);
                    }
                }
                else {
                    googleWorkspaceEmails.push(email);
                }
            }

            for (const email of googleWorkspaceEmails) {
                const response = await fetch(process.env.GsuiteEndpoint as string, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email: email.email
                    })
                });

                if (!response.ok) {
                    const updatedLog = await verifyUpdateLog(logID, "3", ({
                        apicode: 3,
                        emails: googleWorkspaceEmails.map((email) => email.email),
                        statuses: googleWorkspaceEmails.map((email) => email.status),
                        providers: googleWorkspaceEmails.map((email) => email.Provider),
                        mxProviders: emailsData.map((email) => email.mxProvider),
                        mxRecords: emailsData.map((email) => email.mxRecord)
                    } as BreakPoint))
                    if (!updatedLog) {
                        res.status(400).json({ message: "Failed to update log in case of Gsuite server failure" });
                        return;
                    }
                    res.status(400).json({ message: "Failed to send emails to Gsuite server" });
                    return;
                }

                const data = await response.json() as SECONDAPIResponse;

                if (data['EMAIL-status'] === "valid") {
                    if (email.Provider === "catch_all" || email.Provider === "risky") {
                        catchAllValidEmails.push(email);
                    }
                    else {
                        validEmails.push(email);
                    }
                }
                else {
                    UnknownEmails.push(email);
                }
            }

            const Location = log.url;

            const uploadedJson = await fetch(Location as string);
            if (!uploadedJson.ok) {
                res.status(400).json({ message: "Failed to fetch uploaded JSON" });
                return;
            }

            const uploadedJsonData = await uploadedJson.json();


            // Create JSON object
            const data = {
                ...uploadedJsonData,
                ValidEmails: validEmails.map((email) => email.email),
                CatchAllValidEmails: catchAllValidEmails.map((email) => email.email),
                InvalidEmails: invalidEmails.map((email) => email.email),
                UnknownEmails: UnknownEmails.map((email) => email.email),
                MxProviders: emailsData.map((email) => email.mxProvider),
                MxRecords: emailsData.map((email) => email.mxRecord),
            };

            const JSONData = JSON.stringify(data, null, 2);

            const updatedLog = await verifyUpdateLog(logID, "completed", ({
                apicode: 4,
                emails: [],
                statuses: [],
                providers: [],
                mxProviders: [],
                mxRecords: []
            } as BreakPoint))
            if (!updatedLog) {
                res.status(400).json({ message: "Failed to update log at Done" });
                return;
            }

            const addJSONstring = await addJSONStringToLog(logID, JSONData, validEmails.length, invalidEmails.length, UnknownEmails.length, catchAllValidEmails.length);;
            if (!addJSONstring) {
                res.status(400).json({ message: "Failed to add JSON data to log" });
                return;
            }

            res.status(200).json({
                message: "File uploaded successfully",
                validEmails: validEmails.length,
                catchAllValidEmails: catchAllValidEmails.length,
                invalidEmails: invalidEmails.length,
                UnknownEmails: UnknownEmails.length
            });

            return;

        }
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
})

app.post("/runFrom3BreakPoint", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        const { logID } = req.body;

        const log = await verifyEmailLog(logID);
        if (!log) {
            throw new Error("log not found");
        }

        if (log.status !== "3") {
            throw new Error("log is not at breakpoint 3");
        }

        const breakPoint = await getBreakPoint(logID);
        if (!breakPoint) {
            throw new Error("breakpoint not found");
        }

        const emailsData = await getEmailsFromBreakPoint(breakPoint.BreakPointID);
        let emails: EmailSingleDB[] = [];
        const validEmails: EmailSingleDB[] = [];
        const catchAllValidEmails: EmailSingleDB[] = [];
        const UnknownEmails: EmailSingleDB[] = [];
        const invalidEmails: EmailSingleDB[] = [];



        for (const emailData of emails) {
            const response = await fetch(process.env.GsuiteEndpoint as string, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: emailData.email
                })
            });

            if (!response.ok) {
                const updatedLog = await verifyUpdateLog(logID, "3", ({
                    apicode: 3,
                    emails: emailsData.map((email) => email.email),
                    statuses: emailsData.map((email) => email.status),
                    providers: emailsData.map((email) => email.Provider),
                    mxProviders: emailsData.map((email) => email.mxProvider),
                    mxRecords: emailsData.map((email) => email.mxRecord)
                } as BreakPoint))
                if (!updatedLog) {
                    res.status(400).json({ message: "Failed to update log in case of Gsuite server failure" });
                    return;
                }
                res.status(400).json({ message: "Failed to send emails to Gsuite server" });
                return;
            }

            const data = await response.json() as SECONDAPIResponse;

            if (data['EMAIL-status'] === "valid") {
                if (emailData.Provider === "catch_all" || emailData.Provider === "risky") {
                    catchAllValidEmails.push(emailData);
                }
                else {
                    validEmails.push(emailData);
                }
            }
            else {
                UnknownEmails.push(emailData);
            }
        }

        const Location = log.url;

        const uploadedJson = await fetch(Location as string);
        if (!uploadedJson.ok) {
            res.status(400).json({ message: "Failed to fetch uploaded JSON" });
            return;
        }

        const uploadedJsonData = await uploadedJson.json();

        // Create JSON object
        const data = {
            ...uploadedJsonData,
            ValidEmails: validEmails.map((email) => email.email),
            CatchAllValidEmails: catchAllValidEmails.map((email) => email.email),
            InvalidEmails: invalidEmails.map((email) => email.email),
            UnknownEmails: UnknownEmails.map((email) => email.email),
            MxProviders: emailsData.map((email) => email.mxProvider),
            MxRecords: emailsData.map((email) => email.mxRecord),
        };

        const JSONData = JSON.stringify(data, null, 2);

        const updatedLog = await verifyUpdateLog(logID, "completed", ({
            apicode: 4,
            emails: [],
            statuses: [],
            providers: [],
            mxProviders: [],
            mxRecords: []
        } as BreakPoint))
        if (!updatedLog) {
            res.status(400).json({ message: "Failed to update log at Done" });
            return;
        }

        const addJSONstring = await addJSONStringToLog(logID, JSONData, validEmails.length, invalidEmails.length, UnknownEmails.length, catchAllValidEmails.length);;
        if (!addJSONstring) {
            res.status(400).json({ message: "Failed to add JSON data to log" });
            return;
        }

        res.status(200).json({
            message: "File uploaded successfully",
            validEmails: validEmails.length,
            catchAllValidEmails: catchAllValidEmails.length,
            invalidEmails: invalidEmails.length,
            UnknownEmails: UnknownEmails.length
        });

        return;
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
})

app.get("/setVerifyStatusToDev", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {

        process.env.VerifyStatus = "development";

        const envFilePath = path.resolve(__dirname, '../../.env');
        if (!fs.existsSync(envFilePath)) {
            throw new Error(".env file not found");
        }

        let envFileContent = fs.readFileSync(envFilePath, 'utf8');
        const newEnvFileContent = envFileContent.replace(/(^|\n)VerifyStatus=.*/, `$1VerifyStatus=development`);
        fs.writeFileSync(envFilePath, newEnvFileContent);

        res.status(200).json({ "resp": "updated price" });
    } catch (e: any) {
        res.status(400).json({ message: e.message })
    }
})

app.get("/setVerifyStatusToProd", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {

        process.env.VerifyStatus = "production";

        const envFilePath = path.resolve(__dirname, '../../.env');
        if (!fs.existsSync(envFilePath)) {
            throw new Error(".env file not found");
        }

        let envFileContent = fs.readFileSync(envFilePath, 'utf8');
        const newEnvFileContent = envFileContent.replace(/(^|\n)VerifyStatus=.*/, `$1VerifyStatus=production`);
        fs.writeFileSync(envFilePath, newEnvFileContent);

        res.status(200).json({ "resp": "updated price" });
    } catch (e: any) {
        res.status(400).json({ message: e.message })
    }
})

app.get("/getVerifyStatus", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        if (!process.env.VerifyStatus) {
            throw new Error("no status set");
        }
        res.status(200).json({ "resp": process.env.VerifyStatus });
    } catch (error: any) {
        res.status(404).json({ "error": error.message });
    }
});

app.get("/setEnrichStatusToDev", adminVerification, async (req: Request, res: Response) => {  //TESTED  

    try {

        process.env.EnrichStatus = "development";

        const envFilePath = path.resolve(__dirname, '../../.env');
        if (!fs.existsSync(envFilePath)) {
            throw new Error(".env file not found");
        }

        let envFileContent = fs.readFileSync(envFilePath, 'utf8');
        const newEnvFileContent = envFileContent.replace(/(^|\n)EnrichStatus=.*/, `$1EnrichStatus=development`);
        fs.writeFileSync(envFilePath, newEnvFileContent);

        res.status(200).json({ "resp": "updated price" });
    } catch (e: any) {
        res.status(400).json({ message: e.message })
    }
})

app.get("/setEnrichStatusToProd", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {

        process.env.EnrichStatus = "production";

        const envFilePath = path.resolve(__dirname, '../../.env');
        if (!fs.existsSync(envFilePath)) {
            throw new Error(".env file not found");
        }

        let envFileContent = fs.readFileSync(envFilePath, 'utf8');
        const newEnvFileContent = envFileContent.replace(/(^|\n)EnrichStatus=.*/, `$1EnrichStatus=production`);
        fs.writeFileSync(envFilePath, newEnvFileContent);

        res.status(200).json({ "resp": "updated price" });
    } catch (e: any) {
        res.status(400).json({ message: e.message })
    }
});

app.get("/getEnrichStatus", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        if (!process.env.EnrichStatus) {
            throw new Error("no status set");
        }
        res.status(200).json({ "resp": process.env.EnrichStatus });
    } catch (error: any) {
        res.status(404).json({ "error": error.message });
    }
});


export default app;