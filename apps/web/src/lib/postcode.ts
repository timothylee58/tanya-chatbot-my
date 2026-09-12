import { MALAYSIA_STATE_IDS, type MalaysiaStateId } from './malaysia-states';

// Standard Malaysian postcode → state mapping, keyed by the first two
// digits. This is the widely-published Pos Malaysia range table, not a
// parcel-accurate boundary lookup — a handful of border towns (e.g. around
// the Perlis/Kedah or Selangor/KL edges) can sit just outside their state's
// "usual" range. That's an acceptable approximation for a landing-page
// personalization nicety (same honesty PolitikKu itself applies to its own
// postcode lookup: "a postcode can cross seat boundaries"); it must never be
// treated as authoritative for anything eligibility- or legal-relevant.
const PREFIX_TO_STATE: Record<string, MalaysiaStateId> = {
  '01': 'perlis', '02': 'perlis',
  '05': 'kedah', '06': 'kedah', '07': 'kedah', '08': 'kedah', '09': 'kedah',
  '10': 'penang', '11': 'penang', '12': 'penang', '13': 'penang', '14': 'penang',
  '15': 'kelantan', '16': 'kelantan', '17': 'kelantan', '18': 'kelantan',
  '20': 'terengganu', '21': 'terengganu', '22': 'terengganu', '23': 'terengganu', '24': 'terengganu',
  '25': 'pahang', '26': 'pahang', '27': 'pahang', '28': 'pahang', '39': 'pahang', '49': 'pahang', '69': 'pahang',
  '30': 'perak', '31': 'perak', '32': 'perak', '33': 'perak', '34': 'perak', '35': 'perak', '36': 'perak',
  '40': 'selangor', '41': 'selangor', '42': 'selangor', '43': 'selangor', '44': 'selangor',
  '45': 'selangor', '46': 'selangor', '47': 'selangor', '48': 'selangor',
  '63': 'selangor', '64': 'selangor', '65': 'selangor', '66': 'selangor', '67': 'selangor', '68': 'selangor',
  '50': 'kl', '51': 'kl', '52': 'kl', '53': 'kl', '54': 'kl', '55': 'kl',
  '56': 'kl', '57': 'kl', '58': 'kl', '59': 'kl', '60': 'kl',
  '62': 'putrajaya',
  '70': 'negeri_sembilan', '71': 'negeri_sembilan', '72': 'negeri_sembilan', '73': 'negeri_sembilan',
  '75': 'melaka', '76': 'melaka', '77': 'melaka', '78': 'melaka',
  '79': 'johor', '80': 'johor', '81': 'johor', '82': 'johor', '83': 'johor', '84': 'johor', '85': 'johor', '86': 'johor',
  '87': 'labuan',
  '88': 'sabah', '89': 'sabah', '90': 'sabah', '91': 'sabah',
  '93': 'sarawak', '94': 'sarawak', '95': 'sarawak', '96': 'sarawak', '97': 'sarawak', '98': 'sarawak',
};

/** Resolves a 5-digit Malaysian postcode to a state id, or null if the
 * postcode isn't a plausible 5-digit code or its prefix isn't recognised.
 * Never throws — always safe to call directly off raw user input. */
export function resolveStateFromPostcode(postcode: string): MalaysiaStateId | null {
  const trimmed = postcode.trim();
  if (!/^\d{5}$/.test(trimmed)) return null;
  const state = PREFIX_TO_STATE[trimmed.slice(0, 2)];
  return state && (MALAYSIA_STATE_IDS as readonly string[]).includes(state) ? state : null;
}
