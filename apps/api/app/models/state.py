"""AgentState TypedDict and Citation model for the LangGraph pipeline."""
from __future__ import annotations

from typing import Any, Literal, NotRequired, Optional, TypedDict

from app.services.vector_store import ChunkResult


class Citation(TypedDict):
    title: str
    ministry: str
    url: str
    confidence: float
    stale_disclaimer: bool  # True when expiry_aware chunk is >90 days old
    # ISO date (YYYY-MM-DD) the cited rule/figure takes effect, or the
    # source's own date for expiry_aware chunks — see analyst_node's
    # _staleness_ref, which is the same value the staleness verdict is
    # computed from. None when the chunk carries no date at all.
    #
    # This is deliberately surfaced to the UI: a bare "may be outdated"
    # flag tells a user something is wrong but not whether it matters —
    # "as of Jan 2024" on a tax figure lets them judge for themselves.
    # Never synthesise a date here; None must render as no date, not as
    # today's date or an ingestion timestamp.
    effective_date: NotRequired[str | None]
    # ISO timestamp NakTahu last ingested/verified this specific source, from
    # document_chunks.created_at (migration 048). NOT the same thing as
    # effective_date above — this says "we checked this source on {date}",
    # not "this rule took effect on {date}". Both can be shown together.
    # None when the chunk predates the RPC returning this column.
    retrieved_at: NotRequired[str | None]


class AgentState(TypedDict, total=False):
    query: str
    language: Literal["bm", "en", "zh"]
    # None means "couldn't confidently classify" — hybrid_search treats a
    # None domain_filter as search-everything, which is the correct
    # fallback. A string default here is a trap: "government" looks like
    # a safe default but is itself a domain, and if it happens to be
    # empty of content (as it has been), every misclassified query
    # silently retrieves nothing instead of falling back to full-corpus
    # search — see CLAUDE.md Trap #6.
    domain: Optional[str]
    intent: str
    session_id: str
    user_id: Optional[str]
    retrieved_chunks: list[ChunkResult]
    citations: list[Citation]
    confidence_score: float
    needs_clarification: bool
    streaming_token_buffer: str
    error: Optional[str]
    output_flagged: bool
    skip_history_persist: bool
    suggestions: list[str]
    # Freshness signals. faithfulness/confidence only measure answer-to-chunk
    # consistency, not whether the chunk is still current — these carry the
    # recency verdict from analyst_node to synthesiser_node so a stale-but-
    # faithful answer is date-stamped and hedged rather than stated as current.
    stale_warning: bool
    answer_as_of: Optional[str]
    # Structured per-chunk staleness records (chunk_id, source_title,
    # effective_date, days_since_effective) for chunks whose effective_date has
    # passed by more than the staleness window.
    stale_warnings: list[dict[str, Any]]
    # Set when the query asks about the user's own case-specific record
    # (e.g. "what's my EPF balance") rather than a general rules question —
    # NakTahu has no access to any user's records, so this carries the real
    # agency contact to show instead of attempting an answer.
    agency_contact: Optional[dict[str, str]]
    # Warung Watch — set by router_node when the query is asking about a
    # named place's live crowd status ("Is Pelita packed right now?")
    # rather than a knowledge-base question. When true, graph.py routes
    # straight to warung_watch_node instead of rag/analyst/synthesiser —
    # this is live, ephemeral crowd data, not something the RAG pipeline's
    # confidence-gated document citations model applies to.
    is_live_status_query: bool
    place_name: Optional[str]
    # Parliament structured-lookup short-circuit — set by router_node when
    # a domain='parliament' query is asking about a specific bill's vote
    # record or a specific MP/constituency, rather than general Hansard
    # debate content ("what did parliament debate about tax reform" stays
    # on the normal RAG path, since that's chunk-retrieval-shaped, not a
    # structured lookup). When true, graph.py routes straight to
    # parliament_query_node instead of rag/analyst/synthesiser — this is a
    # direct read from mp_profiles/mp_votes/parliament_bills (already a
    # Postgres property graph — FK edges mp_votes.mp_id/bill_id — per
    # migration 025), not something the confidence-gated citation model
    # applies to.
    is_structured_parliament_query: bool
    parliament_bill_number: Optional[str]
    parliament_mp_query: Optional[str]
    # Speculative query-embedding task, started by router_node in parallel
    # with its own classification LLM call (see cache.has_query_been_seen's
    # docstring for why this is only ever fired when it's guaranteed not to
    # be wasted work) and consumed by rag_node instead of computing its own
    # embedding from scratch on a cache miss. An asyncio.Task, not
    # JSON-serializable — safe ONLY because this pipeline runs stateless
    # (checkpointer=None, app/agents/graph.py's `pipeline`) and never
    # persists AgentState anywhere; a checkpointed graph must never carry
    # this field.
    _speculative_embedding_task: NotRequired[Any]
