import {PrismaClient as EnrichminionDB, EmailVerificationLogs as Logs}
 from "../../prisma/enrichminion/generated"
import {BreakPoint} from '../../types/interfaces';
import { v4 as uuid } from 'uuid';

const prisma = new EnrichminionDB();

// create
export async function createLog(
    logID: string,
    userID: string,
    fileName: string,
    creditsUsed: number,
    emails:number,
    stat: boolean,
    url: string
): Promise<Logs | null> {
    try {
        const log = await prisma.emailVerificationLogs.create({
            data:{
                LogID: logID,
                userID: userID,
                fileName: fileName,
                creditsUsed: creditsUsed,
                status: "pending",
                date: new Date(),
                emails: emails,
                InProgress: stat,
                url: url
            }
        })

        return log;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

// get all

export async function getAllLogsByUserID(userID :string): Promise<Logs[]> {
    try {
        const logs = await prisma.emailVerificationLogs.findMany({
            where: {
                userID: userID
            }
        });

        return logs;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function getAllLogs(): Promise<Logs[]> {
    try {
        const logs = await prisma.emailVerificationLogs.findMany();
        if (!logs) {
            return [];
        }
        return logs;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

//getone

export async function getOneLog(logID: string): Promise<Logs | null> {
    try {
        const log = await prisma.emailVerificationLogs.findUnique({
            where: {
                LogID: logID
            }
        });

        return log;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

//update

export async function updateLog(
    logID: string, 
    status: string,
    breakPoint: BreakPoint
    
): Promise<Logs | null> {
    try {
        const existingLog = await prisma.emailVerificationLogs.findUnique({
            where: {
                LogID: logID
            }
        });

        if (!existingLog) {
            return null;
        }

        const log = await prisma.emailVerificationLogs.update({
            where: {
                LogID: logID
            },
            data: {
                status: status,
                breakPoint: {
                    upsert: {
                        create: {
                            ApiCode: breakPoint.apicode,
                            Emails: breakPoint.emails
                        },
                        update: {
                            ApiCode: breakPoint.apicode,
                            Emails: breakPoint.emails
                        }
                    }
                }
            }
        });

        return log;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function addJSONStringToLog(
    logID: string,
    responseString: string,
    validLength: number,
    invalidLength: number,
    unknownLength: number,
    catchAllLength: number,
): Promise<Logs | null> {
    try {
        const existingLog = await prisma.emailVerificationLogs.findUnique({
            where: {
                LogID: logID
            }
        });

        if (!existingLog) {
            return null;
        }

        const log = await prisma.emailVerificationLogs.update({
            where: {
                LogID: logID
            },
            data: {
                responseString: responseString,
                InvalidEmails: invalidLength,
                ValidEmails: validLength,   
                UnknownEmails: unknownLength,
                catchAllEmails: catchAllLength
            }
        });

        return log;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function changeProgressStatus(logID: string , status: boolean): Promise<Logs | null> {
    try {
        const existingLog = await prisma.emailVerificationLogs.findUnique({
            where: {
                LogID: logID
            }
        });

        if (!existingLog) {
            return null;
        }

        const log = await prisma.emailVerificationLogs.update({
            where: {
                LogID: logID
            },
            data: {
                InProgress: status
            }
        });

        return log;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

//logs getall getone update  admin login change pricing gen api , 



// apikey

export async function generateAPIkey(userID: string) {
    const key = uuid() as string;

    const data = await prisma.user.update({
        where: {
            UserID: userID
        },
        data: {
            apikey: key
        }
    });

    return data;
}

export async function getApiKey(userID: string) {
    const data = await prisma.user.findUnique({
        where: {
            UserID: userID
        }
    });

    console.log(data);
    
    return data?.apikey;
}

export async function revokeAPIkey(userID: string) {
    const data = await prisma.user.update({
        where: {
            UserID: userID
        },
        data: {
            apikey: null
        }
    });

    return data;
}