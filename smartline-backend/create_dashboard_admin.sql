-- 1. Create table structure
CREATE TABLE IF NOT EXISTS public.dashboard_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'viewer'::text,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by uuid NULL,
  CONSTRAINT dashboard_users_pkey PRIMARY KEY (id),
  CONSTRAINT dashboard_users_email_key UNIQUE (email),
  CONSTRAINT dashboard_users_created_by_fkey FOREIGN KEY (created_by) REFERENCES dashboard_users (id),
  CONSTRAINT dashboard_users_role_check CHECK (role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'viewer'::text]))
) TABLESPACE pg_default;

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_dashboard_users_email ON public.dashboard_users USING btree (email) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_dashboard_users_role ON public.dashboard_users USING btree (role) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_dashboard_users_is_active ON public.dashboard_users USING btree (is_active) TABLESPACE pg_default;

-- 3. Insert or Update Admin User
INSERT INTO public.dashboard_users (email, password_hash, full_name, role, is_active)
VALUES (
    'eslamabdaltif@gmail.com',
    '$2b$10$AHhE.pvjvj9cucTg9TAZd.QterUejiTpF0yoRQ1KMRv7WEO1hWPHa', -- Hash for 'oneone2'
    'Admin User',
    'super_admin',
    true
)
ON CONFLICT (email) DO UPDATE 
SET 
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    is_active = EXCLUDED.is_active;
