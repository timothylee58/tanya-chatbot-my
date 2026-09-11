-- 048_hybrid_search_retrieved_at.sql
-- Extend hybrid_search() to also return document_chunks.created_at, aliased
-- as retrieved_at, so citations can show "verified/retrieved on {date}" —
-- distinct from effective_date (when the cited RULE takes effect).
--
-- document_chunks.created_at already exists (migration 001) and is already
-- stamped by every ingestion path (ingest.py, ingest_feed.py,
-- ingest_parliament/upload_parliament.py all insert without overriding the
-- column default). This migration only widens hybrid_search()'s RETURNS
-- TABLE to surface it — no new column, no backfill.
--
-- Corresponding Python changes (same PR):
--   - apps/api/app/services/vector_store.py  ChunkResult.retrieved_at + hybrid_search() row mapping
--   - apps/api/app/models/state.py           Citation.retrieved_at
--   - apps/api/app/agents/analyst_node.py    pass retrieved_at into each built Citation
--   - apps/web/src/lib/types.ts              Citation.retrieved_at
--   - apps/web/src/components/chat/CitationChip.tsx   render it
--   - apps/web/src/lib/i18n/index.tsx        citation.retrieved key (bm/en/zh)

CREATE OR REPLACE FUNCTION hybrid_search(
    query_text      text,
    query_embedding vector,
    domain_filter   text    DEFAULT NULL,
    match_count     int     DEFAULT 5
)
RETURNS TABLE (
    id             uuid,
    content        text,
    source_title   text,
    source_url     text,
    ministry       text,
    language       varchar,
    similarity     float,
    expiry_aware   boolean,
    source_date    date,
    effective_date date,
    superseded_by  uuid,
    retrieved_at   timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
    cosine_weight float := 0.7;
    bm25_weight   float := 0.3;
BEGIN
    RETURN QUERY
    WITH cosine_scores AS (
        SELECT
            dc.id,
            1 - (dc.embedding <=> query_embedding) AS cosine_sim
        FROM document_chunks dc
        WHERE domain_filter IS NULL OR dc.domain = domain_filter
    ),
    bm25_scores AS (
        SELECT
            dc.id,
            ts_rank_cd(
                to_tsvector('simple', dc.content),
                plainto_tsquery('simple', query_text)
            ) AS bm25_rank
        FROM document_chunks dc
        WHERE (domain_filter IS NULL OR dc.domain = domain_filter)
          AND to_tsvector('simple', dc.content) @@ plainto_tsquery('simple', query_text)
    ),
    combined AS (
        SELECT
            dc.id,
            dc.content,
            dc.source_title,
            dc.source_url,
            dc.ministry,
            dc.language,
            dc.expiry_aware,
            dc.source_date,
            dc.effective_date,
            dc.superseded_by,
            dc.created_at AS retrieved_at,
            (cosine_weight * COALESCE(cs.cosine_sim, 0))
            + (bm25_weight * COALESCE(bs.bm25_rank, 0)) AS combined_score
        FROM document_chunks dc
        LEFT JOIN cosine_scores cs ON cs.id = dc.id
        LEFT JOIN bm25_scores   bs ON bs.id = dc.id
        WHERE domain_filter IS NULL OR dc.domain = domain_filter
    )
    SELECT
        combined.id,
        combined.content,
        combined.source_title,
        combined.source_url,
        combined.ministry,
        combined.language,
        combined.combined_score AS similarity,
        combined.expiry_aware,
        combined.source_date,
        combined.effective_date,
        combined.superseded_by,
        combined.retrieved_at
    FROM combined
    ORDER BY combined.combined_score DESC
    LIMIT match_count;
END;
$$;
