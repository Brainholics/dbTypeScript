import {PrismaClient as EnrichminionDB, EnrichmentLogs as Logs}
 from "../../prisma/enrichminion/generated"

 const prisma = new EnrichminionDB();


// create
export async function createLog(
   logID: string,
    userID: string,
    creditUsed: number,
    fileName: string,
    type: string,
    url: string,
): Promise<Logs | null> {
    try {
        const log = await prisma.enrichmentLogs.create({
            data:{
                LogID:logID,
                userID: userID,
                creditsUsed: creditUsed,
                status: "completed",
                fileName: fileName,
                URL:url,
                Type:type,
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
        const logs = await prisma.enrichmentLogs.findMany({
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
        const logs = await prisma.enrichmentLogs.findMany();
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
        const log = await prisma.enrichmentLogs.findUnique({
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
        const log = await prisma.enrichmentLogs.delete({
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