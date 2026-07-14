import { useEffect, useState } from 'react';

// Merge stored data over defaults, one level deep for nested objects
// (e.g. setup.tire_pressure). Keys that no longer exist in the defaults are
// dropped, and keys missing from storage fall back to the default — so the
// app keeps working when the setup schema gains or loses fields between
// versions of the code.
export function mergeWithDefaults(defaults, stored) {
  if (typeof defaults !== 'object' || defaults === null || Array.isArray(defaults)) {
    return typeof stored === typeof defaults && stored !== null ? stored : defaults;
  }
  if (typeof stored !== 'object' || stored === null) return defaults;

  const out = { ...defaults };
  for (const key of Object.keys(stored)) {
    if (!(key in defaults)) continue; // stale key from an older schema
    const defVal = defaults[key];
    if (typeof defVal === 'object' && defVal !== null && !Array.isArray(defVal)) {
      out[key] = {
        ...defVal,
        ...(typeof stored[key] === 'object' && stored[key] !== null ? stored[key] : {}),
      };
    } else {
      out[key] = stored[key];
    }
  }
  return out;
}

function load(key, defaults) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults;
    return mergeWithDefaults(defaults, JSON.parse(raw));
  } catch {
    return defaults; // corrupt storage or private-mode restrictions
  }
}

// useState that survives page reloads via localStorage.
// Pass enabled=false to pause writing (existing stored data is still read
// on mount; clearing it is the caller's choice — see App's persist toggle).
export default function usePersistentState(key, defaults, enabled = true) {
  const [value, setValue] = useState(() => load(key, defaults));

  useEffect(() => {
    if (!enabled) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or unavailable — persistence is best-effort
    }
  }, [key, value, enabled]);

  return [value, setValue];
}
