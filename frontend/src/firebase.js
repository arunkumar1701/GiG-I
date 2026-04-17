// firebase.js
// Firebase App + Phone Auth + Analytics for GiG-I.
// All values are loaded from .env (git-ignored) — never hardcode credentials here.

import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Validate that required config values are present
const REQUIRED_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missing = REQUIRED_KEYS.filter((k) => !firebaseConfig[k]);
if (missing.length > 0) {
  throw new Error(
    `[Firebase] Missing required env vars: ${missing.map((k) => `VITE_FIREBASE_${k.toUpperCase()}`).join(', ')}.\n` +
    'Check frontend/.env — copy from .env.example and fill in your project values.'
  );
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth — used for Phone OTP
export const auth = getAuth(app);

// Analytics — initialize only when supported (blocked in some browsers)
isSupported().then((supported) => {
  if (supported) getAnalytics(app);
});

/**
 * Set up an invisible reCAPTCHA verifier bound to a DOM element ID.
 * Clears any previously rendered widget first to avoid duplicates on retry.
 *
 * @param {string} containerId - ID of the DOM container element
 * @returns {RecaptchaVerifier}
 */
export function setupRecaptcha(containerId = 'recaptcha-container') {
  // Step 1 — destroy the existing verifier instance
  if (window._gigIRecaptchaVerifier) {
    try {
      window._gigIRecaptchaVerifier.clear();
    } catch (_) {
      // ignore — widget may already be gone
    }
    window._gigIRecaptchaVerifier = null;
  }

  // Step 2 — fully wipe and recreate the DOM container
  // RecaptchaVerifier.clear() removes the verifier but leaves the iframe
  // inside the element; creating a fresh element guarantees a clean slate.
  const existing = document.getElementById(containerId);
  if (existing) {
    const parent = existing.parentNode;
    if (parent) {
      const fresh = document.createElement('div');
      fresh.id = containerId;
      parent.replaceChild(fresh, existing);
    } else {
      existing.innerHTML = '';
    }
  }

  // Step 3 — create a brand new verifier on the clean element
  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved — OTP send will proceed
    },
    'expired-callback': () => {
      console.warn('[Firebase] reCAPTCHA expired — user must retry.');
    },
  });

  window._gigIRecaptchaVerifier = verifier;
  return verifier;
}

/**
 * Send a Firebase OTP to an Indian phone number (+91 prefix).
 * Pre-renders the reCAPTCHA widget first to avoid auth/invalid-app-credential
 * on localhost where the token can be requested before reCAPTCHA is ready.
 *
 * @param {string} phoneNumber    - 10-digit Indian mobile (no country code)
 * @param {RecaptchaVerifier} appVerifier
 * @returns {Promise<ConfirmationResult>}
 */
export async function sendOtp(phoneNumber, appVerifier) {
  // Pre-render resolves the reCAPTCHA token synchronously before the API call.
  // This prevents auth/invalid-app-credential on localhost.
  try {
    await appVerifier.render();
  } catch (_) {
    // Already rendered — safe to ignore
  }

  const e164Phone = `+91${phoneNumber}`;
  return signInWithPhoneNumber(auth, e164Phone, appVerifier);
}
