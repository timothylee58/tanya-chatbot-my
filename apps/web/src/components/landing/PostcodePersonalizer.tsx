'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { resolveStateFromPostcode } from '@/lib/postcode';

const STORAGE_KEY = 'naktahu_postcode_state';

/** Reads the remembered state id from a prior visit. Never throws — private
 * browsing / strict-privacy modes can make localStorage inaccessible, and a
 * personalization nicety must degrade to "nothing remembered", not crash the
 * landing page. */
function readStoredState(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredState(stateId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, stateId);
  } catch {
    // Same as above — best-effort only, the input still works without it.
  }
}

interface PostcodePersonalizerProps {
  className?: string;
  inputClassName?: string;
}

/** Year-round postcode → state personalization, separate from the
 * seasonal Merdeka-only state picker in LandingClient.tsx (that one fires a
 * fixed "Merdeka celebrations in {state}" query and only renders during the
 * seasonal window). This one just resolves a postcode to a state and
 * remembers it locally so a returning visitor sees a state-aware welcome
 * line without re-entering it — no backend call, no account required. */
export function PostcodePersonalizer({ className, inputClassName }: PostcodePersonalizerProps) {
  const { t } = useI18n();
  const [postcode, setPostcode] = useState('');
  const [stateId, setStateId] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const stored = readStoredState();
    if (stored) setStateId(stored);
  }, []);

  function tryResolve(value: string) {
    const resolved = resolveStateFromPostcode(value);
    if (!resolved) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setStateId(resolved);
    writeStoredState(resolved);
  }

  // Explicit submit still works (desktop Enter key), but the primary path is
  // auto-resolving the moment a plausible 5-digit code is typed — a numeric
  // mobile keypad often has no "Go"/"Enter" affordance wired to form submit,
  // so requiring it left the control looking broken on touch devices
  // (Cursor Bugbot finding on PR #202).
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    tryResolve(postcode);
  }

  if (stateId) {
    const stateLabel = t(`agents.welfare-eligibility.state.${stateId}`);
    // Deliberately NOT a "find your MP" link here. A postcode only resolves
    // to a STATE (see resolveStateFromPostcode's own caveat) — mp_profiles
    // has no postcode/constituency-boundary crosswalk to narrow further —
    // and router_node's structured parliament lookup only fires for a
    // specific named MP or constituency, not a "list MPs in my state"
    // query (see router_node.py's classifier prompt); routing a state-only
    // resolution into chat here would set up an answer that doesn't
    // reliably arrive. The real "postcode → your specific MP, with office
    // contact" flow needs constituency-boundary data this repo doesn't
    // have yet — see PR #202's description for that open question.
    return (
      <p className={className}>
        {t('landing.postcode.personalized').replace('{state}', stateLabel)}{' '}
        <button
          type="button"
          onClick={() => {
            setStateId(null);
            try {
              localStorage.removeItem(STORAGE_KEY);
            } catch {
              /* best-effort, see writeStoredState */
            }
          }}
          className="underline underline-offset-2 opacity-70 hover:opacity-100"
        >
          {t('landing.postcode.change')}
        </button>
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <input
        type="text"
        inputMode="numeric"
        maxLength={5}
        value={postcode}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 5);
          setPostcode(digits);
          setInvalid(false);
          if (digits.length === 5) tryResolve(digits);
        }}
        placeholder={t('landing.postcode.placeholder')}
        aria-label={t('landing.postcode.placeholder')}
        aria-invalid={invalid}
        className={inputClassName}
      />
      {invalid && (
        <span role="alert" className="text-[11px] text-red-500 dark:text-red-400">
          {t('landing.postcode.invalid')}
        </span>
      )}
    </form>
  );
}
