
import { createClient, SupabaseClient } from '@supabase/supabase-js'


export default class SupabaseProvider {
    static dbClient: SupabaseClient;
    initiateSupabaseClient() {
        try {
            console.log('Creating DB Client connection...')
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabseApiKey = process.env.SUPABASE_API_KEY
            SupabaseProvider.dbClient = createClient(supabaseUrl, supabseApiKey);
        } catch (e) {
            throw new Error(`Error initialising Supabase Client: ${e}`);
        }
    }

    getDBClient(): SupabaseClient {
        return SupabaseProvider.dbClient;
    }
}