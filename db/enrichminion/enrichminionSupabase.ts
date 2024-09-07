import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseBaseUrl = process.env.enrichminiondb_url as string;
const supabaseAnonKey = process.env.enrichminiondb_anonkey as string;


const supabase = createClient(supabaseBaseUrl, supabaseAnonKey,);

export default supabase;