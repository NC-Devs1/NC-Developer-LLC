// ============================================================
//  Orbit Chat Handler — NC – Developer, LLC
//  Matches user input to the correct Orbit response
// ============================================================

import orbitResponses from './orbit-responses.js';

/**
 * Takes a user message and returns the best matching Orbit response.
 * Returns null if no keyword match is found (caller should fall back to API).
 * @param {string} userMessage - The raw message from the user
 * @returns {string|null} - Orbit's response, or null if no match
 */
export function getOrbitResponse(userMessage) {
  const input = userMessage.toLowerCase().trim();

  for (const key in orbitResponses) {
    const { trigger, response } = orbitResponses[key];
    const matched = trigger.some(keyword => input.includes(keyword));
    if (matched) {
      return response;
    }
  }

  return null; // No keyword match — let the AI API handle it
}
