-- CLEAN DATABASE SETUP FOR GEMINI GLOBAL DASHBOARD
-- Run this FIRST before creating users in Supabase dashboard

-- Step 1: Clean up any existing setup
DROP TABLE IF EXISTS activity_log CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

DROP FUNCTION IF EXISTS is_authorized_user() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS log_contact_changes() CASCADE;
DROP FUNCTION IF EXISTS handle_updated_at() CASCADE;

-- Step 2: Create user profiles table
CREATE TABLE user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    full_name TEXT,
    email TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Step 3: Create contacts table
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

-- Step 4: Create activity log table
CREATE TABLE activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    changes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Step 5: Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Step 6: Create authorization function
CREATE OR REPLACE FUNCTION is_authorized_user()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.jwt()->>'email' IN (
        'geminiglobal01@gmail.com',        -- Primary user
        'bir.s.kharbanda@gmail.com'        -- Business partner
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create security policies
CREATE POLICY "Only authorized users can view profiles" ON user_profiles
    FOR ALL USING (is_authorized_user());

CREATE POLICY "Only authorized users can access contacts" ON contacts
    FOR ALL USING (is_authorized_user());

CREATE POLICY "Only authorized users can view activity log" ON activity_log
    FOR SELECT USING (is_authorized_user());

-- Step 8: Create trigger function for new users (simplified)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN    
    -- Create user profile when new user is created
    INSERT INTO user_profiles (id, full_name, email)
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Create trigger for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Step 10: Create function to log contact changes
CREATE OR REPLACE FUNCTION log_contact_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO activity_log (user_id, contact_id, action, changes)
        VALUES (auth.uid(), NEW.id, 'created', to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO activity_log (user_id, contact_id, action, changes)
        VALUES (auth.uid(), NEW.id, 'updated', 
                jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO activity_log (user_id, contact_id, action, changes)
        VALUES (auth.uid(), OLD.id, 'deleted', to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 11: Create trigger for logging changes
DROP TRIGGER IF EXISTS log_contact_changes_trigger ON contacts;
CREATE TRIGGER log_contact_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON contacts
    FOR EACH ROW EXECUTE FUNCTION log_contact_changes();

-- Step 12: Create function to update timestamps
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::TEXT, NOW());
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 13: Create trigger for updated timestamps
DROP TRIGGER IF EXISTS contacts_updated_at ON contacts;
CREATE TRIGGER contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Success message
DO $$ BEGIN
    RAISE NOTICE '✅ DATABASE SETUP COMPLETE! Now create users in Supabase dashboard.';
END $$;