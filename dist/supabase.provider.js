"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
class SupabaseProvider {
    initiateSupabaseClient() {
        try {
            console.log('Creating DB Client connection...');
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabseApiKey = process.env.SUPABASE_API_KEY;
            SupabaseProvider.dbClient = (0, supabase_js_1.createClient)(supabaseUrl, supabseApiKey);
        }
        catch (e) {
            throw new Error(`Error initialising Supabase Client: ${e}`);
        }
    }
    getDBClient() {
        return SupabaseProvider.dbClient;
    }
}
exports.default = SupabaseProvider;
