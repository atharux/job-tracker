import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ncympgnvdjqpeioypkja.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jeW1wZ252ZGpxcGVpb3lwa2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2ODU0NzAsImV4cCI6MjA4NTI2MTQ3MH0.FAYTofnukoAHjS_CH2LZjH4xRdYd9a0pmkPbG2sybTo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
