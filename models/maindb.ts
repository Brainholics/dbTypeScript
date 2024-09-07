export interface DbResponse {
    emails?: string[];
    telephone?: string[];
    firstName: string;
    lastName: string;
    organizationName: string;
    organizationDomain: string;
    linkedInUrl: string;
  }
  
  export interface Payload {
    emails: string[];
    phoneNumbers: string[];
    firstName: string;
    lastName: string;
    organizationName: string;
    organizationDomain: string;
    linkedInUrl: string;
  }
  
  export interface CSVFileData {
    firstName: string[];
    lastName: string[];
    organizationDomain: string[];
    organizationName?: string[];
    emails: string[];
    phoneNumbers: string[];
    liid: string[];
    linkedInURL: string[];
    personalEmails?: string[];
    professionalEmails?: string[];
  }
  
  export interface WantedFields {
    firstName: boolean;
    lastName: boolean;
    organizationDomain: boolean;
    personalEmail: boolean;
    professionalEmail: boolean;
    phoneNumber: boolean;
    linkedIn: boolean;
    companyName: boolean;
  }
  
  export interface FinalResponse {
    firstName: string;
    lastName: string;
    organizationDomain: string;
    organizationName: string;
    personalEmail: string;
    professionalEmail: string;
    phoneNumber: string;
    linkedIn: string;
    email: string;
  }