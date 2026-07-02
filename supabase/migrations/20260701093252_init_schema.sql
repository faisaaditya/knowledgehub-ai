-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT DEFAULT 'uploading' CHECK (status IN ('uploading','processing','ready','failed')),
  chunk_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Document Chunks (Vector Store) - dimensi 768 untuk Gemini
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(768), -- 768 untuk gemini-embedding-001
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Chat Sessions
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes (Optimasi Performa)
CREATE INDEX idx_chunks_embedding ON document_chunks 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_documents_org_id ON documents(organization_id);
CREATE INDEX idx_chunks_doc_id ON document_chunks(document_id);

-- Row Level Security (RLS)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Policy 1: User hanya bisa melihat organisasi tempat dia berada
CREATE POLICY "Users view their own org" ON organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Policy 2: User hanya bisa melihat dokumen di org-nya sendiri
CREATE POLICY "Users view org docs" ON documents
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy 3: User hanya bisa insert dokumen jika dia owner di org itu
CREATE POLICY "Admins insert docs" ON documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = documents.organization_id 
      AND role = 'owner'
    )
  );

-- Policy 4: Chunks mengikuti policy dokumen (Security Barrier)
CREATE POLICY "Chunks follow doc policy" ON document_chunks
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM documents WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ---------- TRIGGER UNTUK AUTO-CREATE PROFILE ----------
-- Fungsi untuk membuat profile saat user baru mendaftar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_org_id uuid;
BEGIN
  -- Ambil atau buat organization default
  SELECT id INTO default_org_id FROM public.organizations LIMIT 1;
  IF default_org_id IS NULL THEN
    INSERT INTO public.organizations (name) 
    VALUES ('Default Organization') 
    RETURNING id INTO default_org_id;
  END IF;

  -- Buat profile untuk user baru
  INSERT INTO public.profiles (id, full_name, organization_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    default_org_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- STORAGE POLICIES untuk bucket 'documents' ----------
-- Pastikan bucket 'documents' sudah dibuat di dashboard Storage
-- Policy: user hanya bisa mengakses file di folder organization_id mereka

-- Aktifkan RLS untuk storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy untuk SELECT (membaca file)
CREATE POLICY "Users can view their org files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL 
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text 
    FROM profiles 
    WHERE id = auth.uid()
  )
);

-- Policy untuk INSERT (upload file)
CREATE POLICY "Users can upload files to their org"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL 
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text 
    FROM profiles 
    WHERE id = auth.uid()
  )
);

-- Policy untuk UPDATE (mengganti file)
CREATE POLICY "Users can update their org files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL 
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text 
    FROM profiles 
    WHERE id = auth.uid()
  )
);

-- Policy untuk DELETE (menghapus file)
CREATE POLICY "Users can delete their org files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL 
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text 
    FROM profiles 
    WHERE id = auth.uid()
  )
);

-- ---------- EXPLICIT PRIVILEGES (New Supabase CLI Defaults require explicit grants) ----------
GRANT ALL PRIVILEGES ON TABLE public.organizations TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.profiles TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.documents TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.document_chunks TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.chat_sessions TO postgres, service_role, authenticated, anon;