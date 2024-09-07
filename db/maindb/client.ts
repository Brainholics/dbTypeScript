import { MongoClient } from "mongodb";


const createMongoClient = async (dbUri: string, timeout: number): Promise<MongoClient> => {
    const client = new MongoClient(dbUri, {
        serverSelectionTimeoutMS: timeout * 1000,
    });
    await client.connect();
    await client.db().command({ ping: 1 });
    console.log("Connected to MongoDB!");
    return client;
};

export async function newMongoRepository(dbUri: string, dbName: string, timeout: number){
    const client = await createMongoClient(dbUri, timeout);
    return {
        client,
        dbName,
        timeout: timeout * 1000,
    };
};