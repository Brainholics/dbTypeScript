export interface BreakPoint {
    apicode: number;
    emails: string[];
}

export interface SMTPResponse {
    id: string;
    name: string;
    created_at: string;
    updated_at: string | null;
    deleted_at: string | null;
    finished_at: string | null;
    user: string | null;
    user_id: string;
    size: number;
    progress: number;
    type: string;
}

interface EmailStats {
    total: number;
    deliverable: number;
    undeliverable: number;
    risky: number;
    unknown: number;
    invalid_format: number;
    invalid_domain: number;
    invalid_smtp: number;
    rejected_email: number;
    catch_all: number;
    disposable: number;
    timeout: number;
    no_connect: number;
    other: number;
}

export interface Email {
    id: string;
    email: string;
    username: string;
    domain: string;
    did_you_mean: string | null;
    mx_record: string | null;
    provider: string;
    score: number;
    isv_format: boolean;
    isv_domain: boolean;
    isv_mx: boolean | null;
    isv_noblock: boolean;
    isv_nocatchall: boolean;
    isv_nogeneric: boolean;
    is_disposable: boolean;
    is_free: boolean;
    result: string;
    reason: string;
}

export interface SMTPStatus {
    id: string;
    name: string;
    created_at: string;
    updated_at: string | null;
    deleted_at: string | null;
    finished_at: string | null;
    user: string | null;
    user_id: string;
    size: number;
    progress: number;
    type: string;
    stats: EmailStats;
    emails: Email[];
}

export interface SECONDAPIResponse {
    "EMAIL-status": string;
    Email: string;
}