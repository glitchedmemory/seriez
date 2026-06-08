-- Seriez: Add role column + set admin
-- Run this in Supabase Dashboard → SQL Editor
-- https://zntyjtjodyzizoafxord.supabase.co

-- 1. Add role column
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' NOT NULL;

-- 2. Set your account as admin (replace 'YOUR_USERNAME' with your actual username)
-- UPDATE public.users SET role = 'admin' WHERE username = 'YOUR_USERNAME';
