import { MongoClient, Db, Collection, Filter, WithId, Document } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { Payload } from '../../models/maindb';



interface Query {
  Collection: string;
  Filter: Filter<Document>;
  Projection: object;
}

let noDataCounter = 0;



const scanDBservice = async (
  db: Db,
  uniqueID: string,
  idType: string,
  wantedFields: Record<string, boolean>
): Promise<Payload> => {
  const projections: any = {};

  for (const [key, value] of Object.entries(wantedFields)) {
    if (value) {
      if (key === 'PersonalEmail' || key === 'ProfessionalEmail' || key === 'e') {
        if (projections['e']) continue;
        projections['e'] = 1;
      } else {
        projections[key] = 1;
      }
    }
  }

  const queries: Query[] = [];

  const createQueries = (collections: string[]) => {
    for (const collection of collections) {
      queries.push({
        Collection: collection,
        Filter: { [idType]: uniqueID },
        Projection: projections,
      });
    }
  };

  if (wantedFields["Organization Name"] || wantedFields["Organization Domain"]) {
    if (!wantedFields["linkedin"] && idType === "liid") {
      createQueries(["ap3", "ap2"]);
    }
    if (!wantedFields["e"] && idType === "email") {
      createQueries(["ap3", "ap2"]);
    }
    if (!wantedFields["t"] && idType === "phone") {
      createQueries(["ap3", "ap2"]);
    }
  } else {
    if (!wantedFields["linkedin"] && idType === "liid") {
      createQueries(["pe1", "ap2", "ap3"]);
    }
    if (!wantedFields["e"] && idType === "email") {
      createQueries(["pe1", "ap2", "ap3"]);
    }
    if (!wantedFields["t"] && idType === "phone") {
      createQueries(["pe1", "ap2", "ap3"]);
    }
  }

  for (const query of queries) {
    try {
      const collection: Collection = db.collection(query.Collection);
      const result: WithId<Document> | null = await collection.findOne(query.Filter, { projection: query.Projection });
      if (result) {
        return {
          emails: result['e'],
          phoneNumbers: result['t'],
          organizationDomain: result['OrganizationDomain'],
          organizationName: result['OrganizationName'],
          linkedInUrl: result['LinkedInUrl'],
          firstName: result['FirstName'],
          lastName: result['LastName'],
        };
      } else {
        noDataCounter++;
      }
    } catch (error) {
      console.error(`Error occurred in collection: ${query.Collection}`, error);
      throw error;
    }
  }

  return {
    emails: [],
    phoneNumbers: [],
    organizationDomain: "",
    organizationName: "",
    linkedInUrl: "",
    firstName: "",
    lastName: "",
  };
};

/**
 * Retrieves personal emails matching the LinkedIn ID.
 */
const getPersonalEmailservice = async (
  db:Db,
  linkedInID: string
): Promise<Payload> => {
  const emailRegex = { "e": { "$regex": `@(gmail\\.com|hotmail\\.me|yahoo\\.in)$` } };

  const queries: Query[] = [
    { Collection: "ap2", Filter: { liid: linkedInID, ...emailRegex }, Projection: { e: 1, t: 1 } },
    { Collection: "pe1", Filter: { liid: linkedInID, ...emailRegex }, Projection: { e: 1, t: 1 } },
  ];

  return processQueries(db, queries);
};

/**
 * Retrieves professional emails matching the LinkedIn ID.
 */
const getProfessionalEmailservice = async (
  db: Db,
  linkedInID: string
): Promise<Payload> => {
  const professionalEmailsRegex = { "e": { "$not": { "$regex": `@(gmail\\.com|hotmail\\.me|yahoo\\.in)$` } } };

  const queries: Query[] = [
    { Collection: "ap2", Filter: { liid: linkedInID, ...professionalEmailsRegex }, Projection: { e: 1, t: 1 } },
    { Collection: "pe1", Filter: { liid: linkedInID, ...professionalEmailsRegex }, Projection: { e: 1, t: 1 } },
  ];

  return processQueries(db, queries);
};

/**
 * Helper function to process queries.
 */
const processQueries = async (db: Db, queries: Query[]): Promise<Payload> => {
  for (const query of queries) {
    try {
      const collection: Collection = db.collection(query.Collection);
      const result: WithId<Document> | null = await collection.findOne(query.Filter, { projection: query.Projection });

      if (result) {
        return {
          emails: result['e'] || [],
          phoneNumbers: result['t'] || [],
          organizationDomain: "",
          organizationName: "",
          linkedInUrl: "",
          firstName: "",
          lastName: "",
        };
      }
    } catch (error) {
      console.error(`Error occurred in collection: ${query.Collection}`, error);
      throw error;
    }
  }

  return {
    emails: [],
    phoneNumbers: [],
    organizationDomain: "",
    organizationName: "",
    linkedInUrl: "",
    firstName: "",
    lastName: "",
  };
};


export {
  scanDBservice,
  getPersonalEmailservice,
  getProfessionalEmailservice
};
