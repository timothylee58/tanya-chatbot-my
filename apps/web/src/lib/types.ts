export interface Citation {
  source_url?: string;
  source_title?: string;
  ministry: string;
  url?: string;
  title?: string;
  confidence?: number;
  stale_disclaimer?: boolean;
  /** ISO date (YYYY-MM-DD) the cited rule/figure takes effect, from the
   * backend's analyst_node. Optional and often absent — many chunks carry
   * no date. Render nothing when it's missing; never substitute today's
   * date or a fetch timestamp, which would misrepresent how current the
   * underlying government source actually is. */
  effective_date?: string | null;
  /** ISO timestamp NakTahu last ingested/verified this specific source
   * (document_chunks.created_at, via migration 048). Distinct from
   * effective_date: this says "we checked this on {date}", not "this rule
   * took effect on {date}". Render nothing when missing. */
  retrieved_at?: string | null;
}

/** Real government contact for a personal-record query NakTahu can't answer
 * (it has no access to any user's case-specific data) — see
 * apps/api/app/agents/personal_data.py for the curated directory. */
export interface AgencyContact {
  agency: string;
  domain: string;
  hotline: string;
  portal: string;
}

export interface SSEMetadata {
  detectedLanguage?: string;
  confidence?: number;
  domain?: string;
  agency_contact?: AgencyContact;
  [key: string]: unknown;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tokens: string[];
  citations: Citation[];
  confidence: number | null;
  isStreaming: boolean;
  /** For assistant messages: the user query this answered, plus its resolved domain/language. Used for feedback submission. */
  query?: string;
  domain?: string;
  language?: string;
  suggestions?: string[];
  agencyContact?: AgencyContact;
  /** True when this assistant message is a stream/network failure, not a
   * real answer — rendered distinctly (error styling + explicit retry)
   * instead of looking like a normal completed response. */
  isError?: boolean;
}

export type UILocale = 'en' | 'ms' | 'zh';
