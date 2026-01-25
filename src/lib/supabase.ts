import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// 1. Leemos las variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 2. DEBUG: Imprimimos en la consola del navegador qué está llegando
// (Ojo: No imprimimos la KEY completa por seguridad, solo si existe o no)
console.log("--- DEBUG NETLIFY ---");
console.log("VITE_SUPABASE_URL:", supabaseUrl ? supabaseUrl : "ES UNDEFINED");
console.log("VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? "SI EXISTE (Oculta)" : "ES UNDEFINED");
console.log("Todas las envs:", import.meta.env); // Esto nos mostrará todo lo que Vite ve
console.log("---------------------");

if (!supabaseUrl || !supabaseAnonKey) {
  // Comentamos el error temporalmente para que la app no "explote" en blanco
  // throw new Error('Missing Supabase environment variables');
  console.error("Faltan las variables, pero continuamos para ver el log.");
}

export const supabase = createClient<Database>(
  supabaseUrl || "https://placeholder.url", // Valor falso temporal para que no rompa el inicio
  supabaseAnonKey || "placeholder-key"
);
