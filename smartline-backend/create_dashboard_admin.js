const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function createDashboardUser() {
    const client = await pool.connect();
    try {
        const email = 'eslamabdaltif@gmail.com';
        const password = 'oneone2';
        const fullName = 'Admin User';
        const role = 'super_admin';

        console.log(`Creating dashboard user: ${email}`);

        // Create table if it doesn't exist
        await client.query(`
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

      CREATE INDEX IF NOT EXISTS idx_dashboard_users_email ON public.dashboard_users USING btree (email) TABLESPACE pg_default;
      CREATE INDEX IF NOT EXISTS idx_dashboard_users_role ON public.dashboard_users USING btree (role) TABLESPACE pg_default;
      CREATE INDEX IF NOT EXISTS idx_dashboard_users_is_active ON public.dashboard_users USING btree (is_active) TABLESPACE pg_default;
    `);

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Insert user
        const res = await client.query(
            `INSERT INTO public.dashboard_users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE 
       SET password_hash = $2, role = $4, full_name = $3
       RETURNING id, email, role`,
            [email, passwordHash, fullName, role]
        );

        console.log('User created/updated successfully:', res.rows[0]);
    } catch (err) {
        console.error('Error creating dashboard user:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

createDashboardUser();
