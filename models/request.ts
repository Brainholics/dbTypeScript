// models.ts

export type Email = string;
export type ResponseType = 'json' | 'csv';

export function isResponseTypeValid(rt: ResponseType): boolean {
  return rt === 'json' || rt === 'csv';
}

export function isEmailValid(email: Email): boolean {
  // A simple regex-based validation for email addresses.
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export interface Request {
  csvFile: File; // In TypeScript, multipart files are generally handled as File objects
  responseType: ResponseType;
  discordUsername: string;
  email: Email;
  responseFormat: string;
}

export interface ScanRequest {
  csvFile: File;
  discordUsername: string;
  email: Email;
  wantedFields: string;
}

export interface ApiResponse {
  state: boolean;
  email: string;
}

export interface ChangeWebhookRequest {
  url: string;
}

export interface GetOneByLIIDRequest {
  liid: string;
}

export interface GetMultipleByLIIDRequest {
  liids: string[];
}
