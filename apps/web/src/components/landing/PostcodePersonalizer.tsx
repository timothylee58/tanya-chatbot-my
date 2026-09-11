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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const resolved = resolveStateFromPostcode(postcode);
    if (!resolved) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setStateId(resolved);
    writeStoredState(resolved);
  }

  if (stateId) {
    return (
      <p className={className}>
        {t('landing.postcode.personalized').replace('{state}', t(`agents.welfare-eligibility.state.${stateId}`))}{' '}
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
          setPostcode(e.target.value.replace(/\D/g, ''));
          setInvalid(false);
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
