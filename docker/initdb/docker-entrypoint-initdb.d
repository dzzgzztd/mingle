CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE INDEX IF NOT EXISTS media_items_title_trgm
  ON media_items USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS media_items_creator_trgm
  ON media_items USING gin (creator gin_trgm_ops);

CREATE INDEX IF NOT EXISTS media_items_desc_trgm
  ON media_items USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS media_items_fts
  ON media_items USING gin (
    to_tsvector('simple', unaccent(coalesce(title,'') || ' ' || coalesce(creator,'') || ' ' || coalesce(description,'')))
  );
