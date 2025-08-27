-- SIMPLE DATABASE SETUP WITHOUT RESTRICTIONS
-- This allows user creation first, then adds restrictions later

-- Step 1: Clean up completely
DROP TABLE IF EXISTS activity_log CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP FUNCTION IF EXISTS is_authorized_user() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS log_contact_changes() CASCADE;
DROP FUNCTION IF EXISTS handle_updated_at() CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Create tables WITHOUT triggers first
CREATE TABLE user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    full_name TEXT,
    email TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

CREATE TABLE contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    plant_name TEXT NOT NULL,
    location TEXT,
    contact_name TEXT,
    phone_number TEXT,
    email_address TEXT,
    first_contact DATE,
    recent_contact DATE,
    next_contact DATE,
    frequency TEXT,
    call_time TIME,
    notes TEXT,
    status TEXT DEFAULT 'inactive',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    changes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Step 3: Enable RLS but with permissive policies for now
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Step 4: Create permissive policies (allow all authenticated users for now)
CREATE POLICY "Allow all authenticated users" ON user_profiles
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users" ON contacts
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users" ON activity_log
    FOR ALL USING (auth.role() = 'authenticated');

-- Step 5: Create simple trigger that doesn't block users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN    
    -- Just create user profile, no restrictions
    INSERT INTO user_profiles (id, full_name, email)
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email
    )
    ON CONFLICT (id) DO NOTHING; -- Don't fail if profile already exists
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- If anything goes wrong, just continue without failing
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Success message
DO $$ BEGIN
    RAISE NOTICE '✅ SIMPLE SETUP COMPLETE! Now you can create users in the dashboard.';
END $$;