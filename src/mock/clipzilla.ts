// Clipzilla easter-egg quip banks for the Kaiju Defense Network command map.
//
// Clicking the hidden Redmond hotspot on the command map summons Clipzilla — a
// nod to the Clippy assistant that once called that city home — with a fleeting
// Clippy-style one-liner. The lines are banked by command-center mood so the
// surprise reacts to the same state the top-bar mascot pose does: calm chatter
// at low threat, a grimmer tone at Critical/Cataclysm, and full klaxon energy
// during an active citywide alert. Kept in the mock/ layer (alongside the other
// content banks) so the copy and its selection logic are unit-testable and
// reusable without dragging in the MapLibre canvas.

import { threatRank, type ThreatLevel } from './severity'

/** Clippy-flavored one-liners Clipzilla offers when summoned, banked by command-
    center mood. One line is picked at random from the active bank each time, so
    repeat clicks stay fresh. */
export const CLIPZILLA_QUIPS = {
  calm: [
    'It looks like you\u2019re fighting a kaiju. Want some help with that?',
    'It looks like you\u2019re writing an evacuation order. Need a hand?',
    'Did you know? I\u2019m technically a kaiju AND a productivity tool.',
    'Did you know? Redmond tried to deprecate me once. Look who\u2019s still standing.',
    'Pro tip: undo doesn\u2019t work on collapsed buildings. I checked. \uD83D\uDCCE',
    'I bent over backwards for this city. Literally. I\u2019m a paperclip.',
  ],
  high: [
    'It looks like things are getting Critical. Want me to clip these jets together?',
    'Heads up \u2014 the big ones are surfacing. Maybe deploy those mechs?',
    'I have seen the end of the world. It was in a spreadsheet. This is worse.',
    'Pro tip: now would be a great time to raise that barrier. \uD83D\uDCCE',
  ],
  alert: [
    'CITYWIDE ALERT! It looks like you\u2019re evacuating everyone. I\u2019ll get the door.',
    'ALERT! I knew the unprompted pop-ups would pay off eventually!',
    'This is fine. This is totally fine. (It is not fine.) \uD83D\uDCCE',
    'It looks like you\u2019re holding the line. Hold it harder!',
  ],
} as const

/** Picks the quip bank that matches the current command-center mood, mirroring
    the top-bar mascot's precedence: an active alert outranks threat level, then
    Critical/Cataclysm escalates, and everything calmer gets the relaxed bank. */
export function clipzillaQuipBank(
  threatLevel: ThreatLevel,
  alertActive: boolean,
): readonly string[] {
  if (alertActive) {
    return CLIPZILLA_QUIPS.alert
  }
  if (threatRank(threatLevel) >= threatRank('Critical')) {
    return CLIPZILLA_QUIPS.high
  }
  return CLIPZILLA_QUIPS.calm
}

/** Draws a random line from the given bank, never returning `previous` so back-
    to-back summons don't repeat the same quip. A single-line bank (or no prior
    line) just returns a straight random draw. When `previous` isn't in the bank
    — e.g. the mood switched banks between summons — no exclusion is needed. */
export function pickQuip(
  bank: readonly string[],
  previous: string | null = null,
): string {
  const candidates =
    previous != null && bank.length > 1
      ? bank.filter((quip) => quip !== previous)
      : bank
  return candidates[Math.floor(Math.random() * candidates.length)]
}
