import { Logs, PrismaClient } from '@prisma/client';
import {BreakPoint} from '../types/interfaces';

const prisma = new PrismaClient();

// create
export async function createLog(
    logID: string,
    userID: string,
    fileName: string,
    creditsUsed: number,
    emails:number,
): Promise<Logs | null> {
    try {
        const log = await prisma.logs.create({
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
        const logs = await prisma.logs.findMany({
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
        const logs = await prisma.logs.findMany();
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
        const log = await prisma.logs.findUnique({
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
        const existingLog = await prisma.logs.findUnique({
            where: {
                LogID: logID
            }
        });

        if (!existingLog) {
            return null;
        }

        const log = await prisma.logs.update({
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