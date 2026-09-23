-- Enable pgvector for retrieval (blueprint §7.1) and pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
