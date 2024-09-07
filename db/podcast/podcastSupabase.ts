import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseBaseUrl = process.env.podcastdb_url as string;
const supabaseAnonKey = process.env.podcastdb_anonkey as string;


const supabase = createClient(supabaseBaseUrl, supabaseAnonKey,);

export default supabase;