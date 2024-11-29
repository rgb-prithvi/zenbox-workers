import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const createSupabaseClient = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export const supabase = createSupabaseClient();
