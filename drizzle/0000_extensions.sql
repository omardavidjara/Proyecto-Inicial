-- Extensiones que usan las migraciones siguientes (ARCHITECTURE §3 y §8).
-- pg_trgm: búsqueda de clientes por nombre (índice gin de profiles.full_name).
-- btree_gist: tarifas sin solapes por cliente (restricción de exclusión de memberships).
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;
