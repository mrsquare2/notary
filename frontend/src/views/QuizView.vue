<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from 'primevue/button';
import ProgressBar from 'primevue/progressbar';
import Tag from 'primevue/tag';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { api } from '../api.js';
import { useCatalog } from '../stores/catalog.js';
import { LETTERS, formatClock } from '../utils/format.js';
import { rememberActiveMock, forgetActiveMock } from '../utils/activeMock.js';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();
const { select } = useCatalog();

const session = ref(null);
const loadError = ref('');
const index = ref(0);
const busy = ref(false);
const submitting = ref(false);
const flagged = ref(new Set());
const remaining = ref(null);
let clockOffset = 0;
let timer = null;
let warned5 = false;
let warned1 = false;

const isMock = computed(() => session.value?.mode === 'mock');
const questions = computed(() => session.value?.questions ?? []);
const q = computed(() => questions.value[index.value]);
const answeredCount = computed(() => questions.value.filter((x) => x.selected !== null).length);
const correctSoFar = computed(() => questions.value.filter((x) => x.correct === true).length);
const isLast = computed(() => index.value === questions.value.length - 1);
const lowTime = computed(() => remaining.value !== null && remaining.value <= 300);
const flagKey = () => `notary.flags.${route.params.id}`;

onMounted(load);
onBeforeUnmount(() => {
  clearInterval(timer);
  window.removeEventListener('keydown', onKey);
});

async function load() {
  try {
    const s = await api.getSession(route.params.id);
    if (s.resultId) {
      forgetActiveMock(s.id);
      return router.replace({ name: 'result', params: { id: s.resultId } });
    }
    session.value = s;
    select(s.state);
    clockOffset = Date.parse(s.serverNow) - Date.now();
    // Resume where the learner left off: first unanswered question.
    const firstOpen = s.questions.findIndex((x) => x.selected === null);
    index.value = firstOpen === -1 ? s.questions.length - 1 : firstOpen;
    if (s.mode === 'mock') {
      try { flagged.value = new Set(JSON.parse(sessionStorage.getItem(flagKey()) ?? '[]')); } catch { /* ignore */ }
      rememberActiveMock({ id: s.id, state: s.state, deadline: s.deadline });
      tick();
      timer = setInterval(tick, 1000);
    }
    window.addEventListener('keydown', onKey);
  } catch (e) {
    loadError.value = e.status === 404 ? 'This test could not be found. It may have expired.' : e.message;
  }
}

function tick() {
  const left = (Date.parse(session.value.deadline) - (Date.now() + clockOffset)) / 1000;
  remaining.value = Math.max(0, left);
  if (left <= 300 && !warned5) {
    warned5 = true;
    toast.add({ severity: 'warn', summary: '5 minutes left', detail: 'Review any flagged questions now.', life: 6000 });
  }
  if (left <= 60 && !warned1) {
    warned1 = true;
    toast.add({ severity: 'warn', summary: '1 minute left', detail: 'Your exam will be submitted automatically.', life: 6000 });
  }
  if (left <= 0) {
    clearInterval(timer);
    toast.add({ severity: 'info', summary: "Time's up", detail: 'Submitting your exam…', life: 4000 });
    submit();
  }
}

watch(flagged, (set) => {
  try { sessionStorage.setItem(flagKey(), JSON.stringify([...set])); } catch { /* ignore */ }
}, { deep: true });

async function choose(optionId) {
  const cur = q.value;
  if (!cur || busy.value || submitting.value) return;
  if (!isMock.value && cur.selected !== null) return; // practice answers lock
  if (isMock.value && remaining.value === 0) return;
  const previous = cur.selected;
  cur.selected = optionId;
  busy.value = !isMock.value; // in mock mode, keep the UI responsive while saving
  try {
    const res = await api.answer(session.value.id, cur.id, optionId);
    if (!isMock.value) Object.assign(cur, res);
  } catch (e) {
    cur.selected = previous;
    toast.add({ severity: 'error', summary: 'Answer not saved', detail: e.message, life: 5000 });
  } finally {
    busy.value = false;
  }
}

function go(i) {
  if (i >= 0 && i < questions.value.length) index.value = i;
}

function toggleFlag() {
  const set = new Set(flagged.value);
  set.has(q.value.id) ? set.delete(q.value.id) : set.add(q.value.id);
  flagged.value = set;
}

function confirmSubmit() {
  const unanswered = questions.value.length - answeredCount.value;
  const flags = flagged.value.size;
  const parts = [];
  if (unanswered) parts.push(`${unanswered} question${unanswered === 1 ? ' is' : 's are'} unanswered and will be marked incorrect.`);
  if (flags) parts.push(`${flags} question${flags === 1 ? ' is' : 's are'} flagged for review.`);
  confirm.require({
    header: isMock.value ? 'Submit your exam?' : 'Finish this practice session?',
    message: parts.length ? parts.join(' ') : 'You have answered every question.',
    icon: 'pi pi-send',
    acceptProps: { label: isMock.value ? 'Submit exam' : 'Finish' },
    rejectProps: { label: 'Keep going', severity: 'secondary', outlined: true },
    accept: submit,
  });
}

async function submit() {
  if (submitting.value) return;
  submitting.value = true;
  clearInterval(timer);
  try {
    const { resultId } = await api.submit(session.value.id);
    forgetActiveMock(session.value.id);
    try { sessionStorage.removeItem(flagKey()); } catch { /* ignore */ }
    router.replace({ name: 'result', params: { id: resultId } });
  } catch (e) {
    submitting.value = false;
    toast.add({ severity: 'error', summary: 'Could not submit', detail: `${e.message} Try again.`, life: 8000 });
  }
}

function optionClass(opt) {
  const cur = q.value;
  if (!isMock.value && cur.correctOptionId !== undefined) {
    if (opt.id === cur.correctOptionId) return 'correct';
    if (opt.id === cur.selected) return 'wrong';
    return '';
  }
  return opt.id === cur.selected ? 'selected' : '';
}

function navState(x, i) {
  return {
    current: i === index.value,
    answered: x.selected !== null && (isMock.value || x.correct === undefined),
    right: !isMock.value && x.correct === true,
    wrong: !isMock.value && x.correct === false,
    flag: flagged.value.has(x.id),
  };
}

function onKey(e) {
  if (!q.value || e.target.closest?.('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.querySelector('.p-dialog-mask')) return;
  const k = e.key.toUpperCase();
  const n = LETTERS.indexOf(k) !== -1 ? LETTERS.indexOf(k) : Number(k) - 1;
  if (Number.isInteger(n) && n >= 0 && n < q.value.options.length) {
    e.preventDefault();
    choose(q.value.options[n].id);
  } else if (e.key === 'ArrowRight') {
    go(index.value + 1);
  } else if (e.key === 'ArrowLeft') {
    go(index.value - 1);
  } else if (k === 'F' && isMock.value) {
    toggleFlag();
  }
}
</script>

<template>
  <div class="container page">
    <Message v-if="loadError" severity="error" :closable="false">
      {{ loadError }} <RouterLink to="/">Go home</RouterLink>
    </Message>

    <div v-else-if="!session" class="stack">
      <Skeleton height="48px" /><Skeleton height="320px" />
    </div>

    <div v-else class="quiz">
      <div class="head surface">
        <div class="row">
          <Tag :value="isMock ? 'Mock exam' : 'Practice'" :severity="isMock ? 'info' : 'secondary'" />
          <span class="small muted">{{ session.stateName }}</span>
          <span class="spacer" />
          <span v-if="!isMock" class="small"><b>{{ correctSoFar }}</b> / {{ answeredCount }} correct</span>
          <span v-if="isMock" class="clock" :class="{ low: lowTime }" role="timer" aria-live="off">
            <i class="pi pi-clock" /> {{ formatClock(remaining ?? 0) }}
          </span>
        </div>
        <div class="row progress-row">
          <span class="small muted">Question {{ index + 1 }} of {{ questions.length }}</span>
          <span class="spacer" />
          <span class="small muted">{{ answeredCount }} answered</span>
        </div>
        <ProgressBar :value="Math.round((answeredCount / questions.length) * 100)" :showValue="false" style="height: 6px" />
      </div>

      <div class="body">
        <section class="surface card" v-if="q">
          <div class="row" style="margin-bottom: 10px">
            <span class="eyebrow">{{ q.topicName }}</span>
            <span class="spacer" />
            <Button v-if="isMock" :icon="flagged.has(q.id) ? 'pi pi-flag-fill' : 'pi pi-flag'" :label="flagged.has(q.id) ? 'Flagged' : 'Flag'"
              text size="small" :severity="flagged.has(q.id) ? 'warn' : 'secondary'" @click="toggleFlag" v-tooltip.bottom="'Flag for review (F)'" />
          </div>
          <h2 class="qtext">{{ q.text }}</h2>

          <div class="options" role="radiogroup" :aria-label="`Answers for question ${index + 1}`">
            <button v-for="(opt, i) in q.options" :key="opt.id" class="option" :class="optionClass(opt)"
              role="radio" :aria-checked="opt.id === q.selected" :disabled="(!isMock && q.selected !== null) || submitting"
              @click="choose(opt.id)">
              <span class="letter">{{ LETTERS[i] }}</span>
              <span class="text">{{ opt.text }}</span>
              <span class="mark" v-if="!isMock && q.correctOptionId !== undefined">
                <i v-if="opt.id === q.correctOptionId" class="pi pi-check" style="color: var(--ok)" />
                <i v-else-if="opt.id === q.selected" class="pi pi-times" style="color: var(--bad)" />
              </span>
            </button>
          </div>

          <div v-if="!isMock && q.correctOptionId !== undefined" class="feedback" aria-live="polite">
            <div class="verdict" :class="q.correct ? 'ok' : 'bad'">
              <i :class="q.correct ? 'pi pi-check-circle' : 'pi pi-times-circle'" />
              {{ q.correct ? 'Correct!' : 'Not quite.' }}
            </div>
            <div class="explain">
              {{ q.explanation }}
              <div v-if="q.source" class="source"><i class="pi pi-book" /> {{ q.source }}</div>
            </div>
          </div>

          <div class="row actions">
            <Button icon="pi pi-arrow-left" label="Previous" severity="secondary" outlined :disabled="index === 0" @click="go(index - 1)" />
            <span class="spacer" />
            <template v-if="isMock">
              <Button v-if="!isLast" label="Next" icon="pi pi-arrow-right" iconPos="right" @click="go(index + 1)" />
              <Button v-else label="Review & submit" icon="pi pi-send" @click="confirmSubmit" :loading="submitting" />
            </template>
            <template v-else>
              <Button v-if="!isLast" label="Next" icon="pi pi-arrow-right" iconPos="right" :disabled="q.selected === null" @click="go(index + 1)" />
              <Button v-else label="See results" icon="pi pi-chart-bar" :disabled="q.selected === null" @click="submit" :loading="submitting" />
            </template>
          </div>
          <p class="small muted keys">Shortcuts: A–D or 1–4 to answer, ← → to move<span v-if="isMock">, F to flag</span>.</p>
        </section>

        <aside class="surface nav">
          <div class="row" style="margin-bottom: 10px">
            <b class="small">Questions</b>
            <span class="spacer" />
            <Button v-if="isMock" label="Submit" size="small" icon="pi pi-send" @click="confirmSubmit" :loading="submitting" />
            <Button v-else label="End session" size="small" severity="secondary" outlined @click="confirmSubmit" :loading="submitting" />
          </div>
          <div class="nav-grid">
            <button v-for="(x, i) in questions" :key="x.id" class="nav-btn" :class="navState(x, i)" @click="go(i)"
              :aria-label="`Question ${i + 1}${x.selected !== null ? ', answered' : ''}${flagged.has(x.id) ? ', flagged' : ''}`">
              {{ i + 1 }}
            </button>
          </div>
          <div class="legend small muted">
            <template v-if="isMock">
              <span><i class="sw answered" /> Answered</span>
              <span><i class="sw flag" /> Flagged</span>
            </template>
            <template v-else>
              <span><i class="sw right" /> Correct</span>
              <span><i class="sw wrong" /> Incorrect</span>
            </template>
            <span><i class="sw" /> Not answered</span>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quiz { display: flex; flex-direction: column; gap: 16px; }
.head { padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; position: sticky; top: 60px; z-index: 5; }
.progress-row { margin-bottom: -4px; }
.clock { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 1.15rem; padding: 4px 12px; border-radius: 8px; background: var(--p-primary-50); color: var(--p-primary-800); }
.clock.low { background: var(--bad-bg); color: var(--bad); animation: pulse 1.2s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: 0.65; } }
@media (prefers-reduced-motion: reduce) { .clock.low { animation: none; } }

.body { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 16px; align-items: start; }
.qtext { font-size: 1.2rem; font-weight: 600; margin: 0 0 18px; line-height: 1.45; }
.feedback { margin-top: 18px; display: flex; flex-direction: column; gap: 10px; }
.verdict { font-weight: 700; display: flex; align-items: center; gap: 8px; }
.verdict.ok { color: var(--ok); }
.verdict.bad { color: var(--bad); }
.actions { margin-top: 22px; }
.keys { margin: 14px 0 0; }

.nav { position: sticky; top: 196px; padding: 16px; }
.nav-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
.nav-btn {
  font: inherit; font-size: 0.82rem; font-weight: 600; height: 34px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--line); background: #fff; color: var(--ink); position: relative;
}
.nav-btn:hover { border-color: var(--p-primary-300); }
.nav-btn.answered { background: var(--p-primary-100); border-color: var(--p-primary-200); color: var(--p-primary-800); }
.nav-btn.right { background: var(--ok-bg); border-color: #a7e3bd; color: var(--ok); }
.nav-btn.wrong { background: var(--bad-bg); border-color: #f5b5b5; color: var(--bad); }
.nav-btn.flag::after { content: ''; position: absolute; top: 3px; right: 3px; width: 7px; height: 7px; border-radius: 50%; background: var(--flag); }
.nav-btn.current { outline: 2px solid var(--p-primary-600); outline-offset: 1px; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 12px; margin-top: 12px; }
.legend span { display: inline-flex; align-items: center; gap: 5px; }
.sw { display: inline-block; width: 12px; height: 12px; border-radius: 3px; border: 1px solid var(--line); background: #fff; position: relative; }
.sw.answered { background: var(--p-primary-100); border-color: var(--p-primary-200); }
.sw.right { background: var(--ok-bg); border-color: #a7e3bd; }
.sw.wrong { background: var(--bad-bg); border-color: #f5b5b5; }
.sw.flag { background: var(--flag); border-color: var(--flag); border-radius: 50%; }

@media (max-width: 860px) {
  .body { grid-template-columns: 1fr; }
  .nav { position: static; }
  .nav-grid { grid-template-columns: repeat(auto-fill, minmax(40px, 1fr)); }
  .head { top: 0; position: relative; }
}
</style>
