// Shared, lazily loaded list of states plus the learner's chosen state.
import { ref, computed } from 'vue';
import { api } from '../api.js';

const KEY = 'notary.state';
const states = ref([]);
const practiceSizes = ref([10, 20, 30, 50]);
const loading = ref(false);
const error = ref('');
let pending = null;

function readSaved() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
const selectedCode = ref(readSaved());

export function useCatalog() {
  async function load() {
    if (states.value.length) return;
    if (!pending) {
      loading.value = true;
      error.value = '';
      pending = api.states()
        .then((data) => {
          states.value = data.states;
          practiceSizes.value = data.practiceSizes;
          if (!states.value.some((s) => s.code === selectedCode.value)) {
            selectedCode.value = states.value.find((s) => s.code === 'TX')?.code ?? states.value[0]?.code ?? null;
          }
        })
        .catch((e) => { error.value = e.message; pending = null; })
        .finally(() => { loading.value = false; });
    }
    return pending;
  }

  function select(code) {
    selectedCode.value = code;
    try { localStorage.setItem(KEY, code); } catch { /* not critical */ }
  }

  const current = computed(() => states.value.find((s) => s.code === selectedCode.value) ?? null);

  return { states, practiceSizes, loading, error, selectedCode, current, load, select };
}
