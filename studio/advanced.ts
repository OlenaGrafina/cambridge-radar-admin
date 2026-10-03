/**
 * "Advanced mode" switch for the Studio.
 *
 * Off (default): a clean editor — no releases, scheduling, tasks, comments,
 * Canvas, Media Library, "What's new" or upgrade prompts, Ukrainian only.
 * On: everything Sanity offers comes back (plus Vision and English).
 * The choice is stored per browser; the button in the top bar flips it.
 */
const KEY = 'cr-studio-advanced'

export const ADVANCED: boolean = (() => {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
})()

export function setAdvanced(on: boolean) {
  try {
    if (on) window.localStorage.setItem(KEY, '1')
    else window.localStorage.removeItem(KEY)
  } catch {
    // storage blocked: nothing to remember
  }
  window.location.reload()
}
