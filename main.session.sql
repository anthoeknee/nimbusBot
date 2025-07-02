CREATE TABLE memories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  guild_id INTEGER,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL, -- Use your embedding size
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);