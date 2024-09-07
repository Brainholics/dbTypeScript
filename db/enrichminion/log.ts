import { Logs, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


// create
export async function createLog(
   logID: string,
    userID: string,
    firstName: string,
    lastName: string,   
    email: string,
    phoneNumber: string,
    currency: string,
    creditUsed: number,
    fileName: string,
): Promise<Logs | null> {
    try {
        const log = await prisma.logs.create({
            data:{
                LogID: logID,
                userID: userID,
                fileName: fileName,
                creditsUsed: creditUsed,
                firstName: firstName,
                lastName: lastName,
                email: email,
                phoneNumber: phoneNumber,
                currency: currency,
                Date: new Date(),
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

export async function deleteLog(logID: string): Promise<Logs | null> {
    try {
        const log = await prisma.logs.delete({
            where: {
                LogID: logID
            }
        });

        return log;
    } catch (error: any) {
        throw new Error(error.message);
    }
}


//logs getall getone update  admin login change pricing gen api , 