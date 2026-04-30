import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ogavvjjvgjbvofzqmbao.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nYXZ2amp2Z2pidm9menFtYmFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNjYyMzEsImV4cCI6MjA5Mjg0MjIzMX0.1zEVZahsvrs8XhGoBqrnmn5XnzRSSivIA8KNYihAC80';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});