// models.ts

export interface Logs {
    id: string;
    userID: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    currency: string;
    creditUsed: number;
    fileName: string;
    date: Date;
  }
  
  export interface User {
    id: string;
    email: string;
    name: string;
    companyName: string;
    phoneNumber: string;
    location: string;
    credits: number;
    apikey: string;
    logs: Logs[];
  }
  
  export interface Admin {
    email: string;
    password: string;
  }
  