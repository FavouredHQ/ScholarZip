
-- 1. Profiles Table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT UNIQUE,
  bio TEXT,
  education_level TEXT,
  country_origin TEXT,
  target_countries TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Public profiles are viewable" ON profiles FOR SELECT USING (true);

-- 2. User Roles Table (separate from profiles for security)
CREATE TYPE public.app_role AS ENUM ('student', 'provider');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own role" ON user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Scholarships Table
CREATE TABLE scholarships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC,
  currency TEXT DEFAULT 'USD',
  deadline DATE,
  eligibility_criteria JSONB,
  is_active BOOLEAN DEFAULT true,
  source_url TEXT,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE scholarships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active scholarships" ON scholarships FOR SELECT USING (is_active = true);
CREATE POLICY "Providers can insert scholarships" ON scholarships FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'provider') AND auth.uid() = provider_id);
CREATE POLICY "Providers can update own scholarships" ON scholarships FOR UPDATE USING (auth.uid() = provider_id);
CREATE POLICY "Providers can delete own scholarships" ON scholarships FOR DELETE USING (auth.uid() = provider_id);

-- 4. Matches Table
CREATE TABLE matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id),
  scholarship_id UUID REFERENCES scholarships(id),
  match_score FLOAT,
  ai_reasoning TEXT,
  seen_by_student BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own matches" ON matches FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "System can insert matches" ON matches FOR INSERT WITH CHECK (true);

-- 5. Applications Table
CREATE TABLE applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id),
  scholarship_id UUID REFERENCES scholarships(id),
  status TEXT CHECK (status IN ('draft', 'submitted', 'under_review', 'accepted', 'rejected')) DEFAULT 'draft',
  submission_data JSONB,
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own applications" ON applications FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students can insert applications" ON applications FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students can update own applications" ON applications FOR UPDATE USING (auth.uid() = student_id);
CREATE POLICY "Providers can view applications for their scholarships" ON applications FOR SELECT USING (
  EXISTS (SELECT 1 FROM scholarships WHERE scholarships.id = applications.scholarship_id AND scholarships.provider_id = auth.uid())
);

-- 6. Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
