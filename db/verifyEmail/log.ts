import {PrismaClient as EnrichminionDB, EmailVerificationLogs as Logs}
 from "../../prisma/enrichminion/generated"
import {BreakPoint} from '../../types/interfaces';

const prisma = new EnrichminionDB();

// create
export async function createLog(
    logID: string,
    userID: string,
    fileName: string,
    creditsUsed: number,
    emails:number,
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
                    create: {
                        ApiCode: breakPoint.apicode,
                        Emails: breakPoint.emails
                    }
                }
            }
        });

        return log;
    } catch (error: any) {
        throw new Error(error.message);
    }
}


//logs getall getone update  admin login change pricing gen api , 