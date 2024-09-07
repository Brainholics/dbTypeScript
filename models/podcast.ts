export interface User {
    id: string;
    email: string;
    name: string;
    companyName: string;
    phoneNumber: string;
    location: string;
    credits: number;
    apikey: string;
  }
  
  export interface Admin {
    email: string;
    password: string;
  }