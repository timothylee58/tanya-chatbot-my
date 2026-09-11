'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import type { Citation } from '@/lib/types';

interface CitationChipProps {
  citation: Citation;
  /** 1-based position in the answer's citation list. Shown as a small
   * numbered badge so a citation can be referenced unambiguously ("source
   * 2") even though the answer text itself has no inline [1][2] markers —
   * those would need the synthesiser to emit them, a backend change. */
  index?: number;
}

function truncate(s: string, max: number) {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

/** Formats the backend's ISO effective_date for display. Returns null for
 * missing OR unparseable input so a malformed value renders as no date
 * rather than "Invalid Date" — on a government-data product a broken date
 * next to a tax figure reads as a broken figure.
 *
 * Parses the parts explicitly instead of `new Date(iso)`: ECMAScript reads a
 * bare "YYYY-MM-DD" as UTC midnight, which toLocaleDateString then renders in
 * the viewer's own zone — showing the PREVIOUS calendar day for anyone west
 * of UTC. Building from parts gives local midnight, so the date a rule takes
 * effect reads identically in KL and in Vancouver. (Confirmed Cursor Bugbot
 * finding on PR #158.)
 */
function formatEffectiveDate(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!parts) return null;
  const y = Number(parts[1]);
  const mo = Number(parts[2]);
  const d = Number(parts[3]);
  const date = new Date(y, mo - 1, d);
  // Reject out-of-range components (e.g. month 13, day 32), which the Date
  // constructor silently rolls forward into a different — and wrong — date
  // rather than reporting as invalid.
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    return null;
  }
  const tag = locale === 'zh' ? 'zh-CN' : locale === 'ms' ? 'ms-MY' : 'en-MY';
  return date.toLocaleDateString(tag, { year: 'numeric', month: 'short', day: 'numeric' });
}

// The "stamp" is this app's one signature, brand-owned visual moment —
// every other surface (nav, forms, cards) stays quiet and disciplined so
// this doesn't compete with a second decorative element. A double border
// echoes an official rubber stamp; the mono face reads as "record/data",
// distinct from the conversational sans used everywhere else; the slight
// rotation on hover gives it a tactile, physical-stamp feel. It's earned
// here specifically because this chip *is* the proof of official sourcing
// — the product's core differentiator, encoded into the interface itself.
export function CitationChip({ citation, index }: CitationChipProps) {
  const { t, locale } = useI18n();
  const reduceMotion = useReducedMotion();
  const url = citation.url ?? citation.source_url;
  const title = citation.title ?? citation.source_title ?? '';
  const hasUrl = Boolean(url);
  const popoverId = useId();
  // Pinned = opened by click/tap (stays open until an explicit close or an
  // outside click); hover alone shows the popover on desktop without
  // pinning it, so a stray mouse-over on a chip mid-scroll doesn't leave a
  // popover stuck open.
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const open = pinned || hovered;

  useEffect(() => {
    if (!pinned) return;
    function onOutsideClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setPinned(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setPinned(false);
    }
    document.addEventListener('mousedown', onOutsideClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onOutsideClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [pinned]);

  const effectiveDate = formatEffectiveDate(citation.effective_date, locale);
  // retrieved_at is a full timestamptz (not a bare YYYY-MM-DD like
  // effective_date), so plain `new Date(iso)` carries no timezone ambiguity
  // — it already encodes an instant, not a calendar date to be interpreted
  // in the viewer's zone.
  const retrievedDate = citation.retrieved_at ? new Date(citation.retrieved_at) : null;
  const retrievedLabel =
    retrievedDate && !Number.isNaN(retrievedDate.getTime())
      ? retrievedDate.toLocaleDateString(locale === 'zh' ? 'zh-CN' : locale === 'ms' ? 'ms-MY' : 'en-MY', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : null;
  const confidencePct = typeof citation.confidence === 'number' ? Math.round(citation.confidence * 100) : null;
  const confidenceColor =
    confidencePct === null
      ? ''
      : confidencePct >= 80
        ? 'text-green-600 dark:text-green-400'
        : confidencePct >= 60
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-red-600 dark:text-red-400';

  return (
    <div
      ref={rootRef}
      className="relative inline-block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <motion.button
        type="button"
        // Stamp-down entrance: a small overshoot-and-settle when a citation
        // first appears in a streamed answer — this is the one place we
        // allow a slightly more expressive motion, because it reinforces
        // meaning ("this claim just got verified/stamped"), not decoration.
        initial={reduceMotion ? false : { opacity: 0, scale: 1.08, rotate: -2 }}
        animate={{ opacity: 1, scale: 1, rotate: -1 }}
        transition={reduceMotion ? { duration: 0.15 } : { duration: 0.25, ease: 'easeOut' }}
        whileHover={reduceMotion ? undefined : { rotate: 1.5, scale: 1.02 }}
        aria-expanded={open}
        aria-describedby={open ? popoverId : undefined}
        onClick={() => setPinned((p) => !p)}
        className="inline-flex items-center gap-1.5 rounded-md border-2 border-double border-nk-official/50 bg-nk-official/5 text-nk-official-dim px-3 py-1 text-xs font-medium transition-colors dark:bg-nk-official/10 dark:border-nk-official/40 dark:text-nk-official cursor-pointer hover:bg-nk-official/10 dark:hover:bg-nk-official/15"
      >
        {typeof index === 'number' && (
          <span
            aria-hidden="true"
            className="flex-shrink-0 flex items-center justify-center w-4 h-4 rounded-full bg-nk-official text-white text-[10px] font-bold font-mono"
          >
            {index}
          </span>
        )}
        <span className="font-mono font-semibold uppercase tracking-tight truncate max-w-[6rem]">{citation.ministry}</span>
        <span className="opacity-70">·</span>
        <span className="truncate max-w-[12rem]">{truncate(title, 32)}</span>
        {/* On the chip face, not only in the popover — a date behind a
            hover/click isn't "visible" for someone reading a tax figure on
            mobile. Mono matches the stamp motif's record/data register. */}
        {effectiveDate && (
          <span className="font-mono text-[10px] opacity-70 flex-shrink-0 locale-nowrap">
            {effectiveDate}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={popoverId}
            role="tooltip"
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 left-0 top-full mt-1.5 w-64 rounded-xl border border-zinc-200 bg-white p-3 text-left shadow-lg dark:border-white/10 dark:bg-nk-surface"
          >
            <p className="text-xs font-mono font-semibold uppercase tracking-tight text-zinc-900 dark:text-zinc-100">{citation.ministry}</p>
            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400 locale-text-balance">{title}</p>
            {effectiveDate && (
              <p className="mt-1.5 text-[11px] font-mono text-zinc-700 dark:text-zinc-300">
                {t('citation.as_of').replace('{date}', effectiveDate)}
              </p>
            )}
            {confidencePct !== null && (
              <p className={`mt-1.5 text-[11px] font-medium ${confidenceColor}`}>
                {t('citation.confidence')}: {confidencePct}%
              </p>
            )}
            {retrievedLabel && (
              <p className="mt-1 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                {t('citation.retrieved').replace('{date}', retrievedLabel)}
              </p>
            )}
            {citation.stale_disclaimer && (
              <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">{t('citation.stale')}</p>
            )}
            {hasUrl ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-nk-official-dim hover:text-nk-official dark:text-nk-official dark:hover:text-nk-official/80"
              >
                {t('citation.view_source')}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3" aria-hidden>
                  <path
                    fillRule="evenodd"
                    d="M4.5 11.5a.75.75 0 0 0 1.06 0l5-5v2.69a.75.75 0 0 0 1.5 0V5a.75.75 0 0 0-.75-.75H7.06a.75.75 0 0 0 0 1.5H9.75l-5 5a.75.75 0 0 0 0 1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            ) : (
              <p className="mt-2 text-[11px] text-zinc-400">{t('citation.no_link')}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
