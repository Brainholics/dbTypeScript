import {PrismaClient as EnrichminionDB, User}
 from "../../prisma/enrichminion/generated"

 const prisma = new EnrichminionDB();

export async function createUser(
    fullName: string, 
    companyName: string, 
    phoneNumber: string, 
    location: string,   
    userID: string, 
    email: string,
    currency: string
): Promise<User | null> {
    try {
        const user = await prisma.user.create({
            data: {
                UserID: userID,
                email: email,
                name: fullName,
                companyName: companyName,
                phoneNumber: phoneNumber,
                location: location,
                credits: 0,
                currency: currency,
            },
        });

        return user;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function getUser(userID: string): Promise<User | null> {
    try {
        const user = await prisma.user.findUnique({
            where: {
                UserID: userID,
            },
        });
        return user || null;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function addCredits(addCreds: number, userId: string): Promise<User | null> {
    try {
        let data = await prisma.user.findUnique({
            where: {
                UserID: userId,
            },
        });

        if (!data) {
            return null;
        }

        const updatedCred = data.credits + Math.abs(addCreds);

        data = await prisma.user.update({
            where: {
                UserID: userId,
            },
            data: {
                credits: updatedCred,
            },
        });

        return data;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function removeCredits(removeCreds: number, userId: string): Promise<User | null> {
    try {
        let data = await prisma.user.findUnique({
            where: {
                UserID: userId,
            },
        });

        if (!data) {
            return null;
        }

        const updatedCred = data.credits - Math.abs(removeCreds);

        if (updatedCred < 0) {
            throw new Error("Insufficient credits");
        }
        data = await prisma.user.update({
            where: {
                UserID: userId,
            },
            data: {
                credits: updatedCred,
            },
        });
        return data;
    } catch (error: any) {
        throw new Error(error.message);
    }
    
}

export async function getCredits(userID: string): Promise<number | null> {
    try {
        const data = await prisma.user.findUnique({
            where: {
                UserID: userID,
            },
        });

        return data ? data.credits : null;
    } catch (error: any) {
        throw new Error(error.message);
    }
}
