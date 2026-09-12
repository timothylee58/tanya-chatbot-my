"""Supabase hybrid search — cosine similarity + BM25 via RPC."""
from __future__ import annotations

import os
from dataclasses import dataclass

from supabase import AsyncClient, acreate_client


@dataclass
class ChunkResult:
    id: str
    content: str
    source_title: str
    source_url: str
    ministry: str
    language: str
    similarity: float
    expiry_aware: bool = False
    source_date: str | None = None  # ISO date string e.g. "2024-03-15"
    # Date the rule/figure this chunk describes takes effect (ISO string). Used
    # by analyst_node's effective-date staleness check.
    effective_date: str | None = None
    # id of the chunk that replaces this one; superseded chunks are hard-rejected
    # by analyst_node and never cited.
    superseded_by: str | None = None
    # When this chunk was ingested (document_chunks.created_at, surfaced by
    # migration 048). Distinct from effective_date: this is when NakTahu last
    # verified/pulled the source, not when the cited rule takes effect. ISO
    # timestamp string or None for rows from before the RPC returned it.
    retrieved_at: str | None = None


async def _get_client() -> AsyncClient:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return await acreate_client(url, key)


async def hybrid_search(
    query: str,
    embedding: list[float],
    domain: str | None,
    limit: int = 5,
) -> list[ChunkResult]:
    """Call the hybrid_search Postgres RPC and return typed ChunkResult objects.

    Combines cosine similarity (weight 0.7) and BM25 rank (weight 0.3) as
    defined in migration 002_hybrid_search.sql.
    """
    client = await _get_client()
    params: dict = {
        "query_text": query,
        "query_embedding": embedding,
        "match_count": limit,
    }
    if domain is not None:
        params["domain_filter"] = domain

    resp = await client.rpc("hybrid_search", params).execute()

    results: list[ChunkResult] = []
    for row in (resp.data or []):
        results.append(
            ChunkResult(
                id=row["id"],
                content=row["content"],
                source_title=row["source_title"],
                source_url=row["source_url"],
                ministry=row["ministry"],
                language=row["language"],
                similarity=float(row["similarity"]),
                expiry_aware=bool(row.get("expiry_aware", False)),
                source_date=row.get("source_date"),
                effective_date=row.get("effective_date"),
                superseded_by=row.get("superseded_by"),
                retrieved_at=row.get("retrieved_at"),
            )
        )
    return results


async def hybrid_search_madani_schemes(
    query: str,
    embedding: list[float],
    *,
    category: str | None = None,
    scope: str | None = None,
    limit: int = 5,
) -> list[ChunkResult]:
    """Call the DEDICATED hybrid_search_madani_schemes RPC (migration 038)
    — not the shared hybrid_search() function above, which is hardcoded to
    document_chunks's column shape and is every domain's retrieval path.
    See that migration's header comment for why this is isolated.

    Results are normalized into ChunkResult (content = the same
    title+description+category+scope blob madani_scheme_ingest.py embeds,
    source_title = scheme_name, ministry = implementing_agency) so a
    matched scheme flows through analyst_node's existing scoring/
    staleness/supersede logic identically to a document_chunks row —
    no changes needed to analyst_node.py or synthesiser_node.py for this
    to work. aggregator_url is intentionally NOT carried into ChunkResult
    (no field for it there) — the two-tier citation (aggregator + primary
    source) only matters to the structured WelfareEligibilityAgent path
    (match_node.py), which reads madani_scheme directly, not through
    this semantic-search path.
    """
    from app.services.madani_scheme_ingest import build_scheme_embedding_text

    client = await _get_client()
    params: dict = {
        "query_text": query,
        "query_embedding": embedding,
        "match_count": limit,
    }
    if category is not None:
        params["category_filter"] = category
    if scope is not None:
        params["scope_filter"] = scope

    resp = await client.rpc("hybrid_search_madani_schemes", params).execute()

    results: list[ChunkResult] = []
    for row in (resp.data or []):
        results.append(
            ChunkResult(
                id=row["id"],
                content=build_scheme_embedding_text(row),
                source_title=row["scheme_name"],
                source_url=row["source_url"],
                ministry=row.get("implementing_agency") or "",
                language=row.get("language") or "bm",
                similarity=float(row["similarity"]),
                expiry_aware=row.get("effective_date") is not None,
                source_date=None,
                effective_date=row.get("effective_date"),
                superseded_by=row.get("superseded_by"),
            )
        )
    return results
