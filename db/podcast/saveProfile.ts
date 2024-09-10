import { PrismaClient as PodcastDB,SavedProfiles } from "../../prisma/podcast/generated";

const prisma = new PodcastDB();

export async function saveProfile(
    id: string,
    userID: string,
    email: string,
    title: string,
    sentiment: string,
    authorName: string,
    rank: number,
    audience: string,
    adCost: number,
    host: string,
    category: string,
    language: string,
    episodes: number,
    lastedPublished: Date,
    publishingFrequency: string
): Promise<SavedProfiles | null>{
    try{
        const profile = await prisma.savedProfiles.create({
            data: {
                id: id,
                UserID: userID,
                email: email,
                title: title,
                sentiment: sentiment,
                authorName: authorName,
                rank: rank,
                audience: audience,
                adCost: adCost,
                host: host,
                category: category,
                language: language,
                episodes: episodes,
                lastedPublished: lastedPublished,
                publishingFrequency: publishingFrequency
            },
        });

        return profile;
    }catch(error: any){
        throw new Error(error.message);
    }
}

export async function getUserProfile(userID: string): Promise<SavedProfiles[] | null>{
    try{
        const profile = await prisma.savedProfiles.findMany({
            where: {
                UserID: userID
            }
        });

        return profile;
    }catch(error: any){
        throw new Error(error.message);
    }
}

export async function getAllProfiles(): Promise<SavedProfiles[] | null>{
    try{
        const profile = await prisma.savedProfiles.findMany();
        return profile;
    }catch(error: any){
        throw new Error(error.message);
    }
}

export async function deleteProfile(Id: string): Promise<SavedProfiles | null>{
    try{
        const profile = await prisma.savedProfiles.delete({
            where: {
                id:Id
            }
        });

        return profile;
    }catch(error: any){
        throw new Error(error.message);
    }
}

export async function deleteAllProfiles(): Promise<boolean | null>{
    try{
        const profile = await prisma.savedProfiles.deleteMany();
        return true;
    }catch(error: any){
        throw new Error(error.message);
    }
}
