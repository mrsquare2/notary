// Remembers an in-progress mock exam so the learner can return to it from the
// mock exam page after closing the tab.
const KEY = 'notary.activeMock';

export function rememberActiveMock(info) {
  try { localStorage.setItem(KEY, JSON.stringify(info)); } catch { /* not critical */ }
}

export function getActiveMock() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
}

export function forgetActiveMock(id) {
  try {
    if (!id || getActiveMock()?.id === id) localStorage.removeItem(KEY);
  } catch { /* not critical */ }
}
