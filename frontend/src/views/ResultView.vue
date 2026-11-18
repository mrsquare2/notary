<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from 'primevue/button';
import SplitButton from 'primevue/splitbutton';
import SelectButton from 'primevue/selectbutton';
import ProgressBar from 'primevue/progressbar';
import Tag from 'primevue/tag';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import { api } from '../api.js';
import { useCatalog } from '../stores/catalog.js';
import { LETTERS, formatDate, formatDuration } from '../utils/format.js';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { select } = useCatalog();

const result = ref(null);
const error = ref('');
const filter = ref('all');
const exporting = ref(false);

onMounted(async () => {
  try {
    result.value = await api.result(route.params.id);
    select(result.value.state);
  } catch (e) {
    error.value = e.status === 404 ? 'This result could not be found.' : e.message;
  }
});

const isMock = computed(() => result.value?.mode === 'mock');
const target = computed(() => result.value?.passPercent ?? 70);
const counts = computed(() => {
  const qs = result.value?.questions ?? [];
  return {
    all: qs.length,
    incorrect: qs.filter((q) => q.selected !== null && !q.isCorrect).length,
    unanswered: qs.filter((q) => q.selected === null).length,
    correct: qs.filter((q) => q.isCorrect).length,
  };
});
const filterOptions = computed(() => [
  { value: 'all', label: `All (${counts.value.all})` },
  { value: 'incorrect', label: `Incorrect (${counts.value.incorrect})` },
  { value: 'unanswered', label: `Unanswered (${counts.value.unanswered})` },
  { value: 'correct', label: `Correct (${counts.value.correct})` },
].filter((o) => o.value === 'all' || counts.value[o.value] > 0));

const shown = computed(() => (result.value?.questions ?? [])
  .map((q, i) => ({ ...q, n: i + 1 }))
  .filter((q) => ({
    all: true,
    incorrect: q.selected !== null && !q.isCorrect,
    unanswered: q.selected === null,
    correct: q.isCorrect,
  })[filter.value]));

const weakTopics = computed(() => (result.value?.byTopic ?? []).filter((t) => t.percent < target.value).map((t) => t.topic));
const sortedTopics = computed(() => [...(result.value?.byTopic ?? [])].sort((a, b) => a.percent - b.percent));

async function exportPdf(includeReview) {
  exporting.value = true;
  try {
    // Loaded on demand so jsPDF isn't in the main bundle.
    const { exportResultPdf } = await import('../utils/pdf.js');
    exportResultPdf(result.value, { includeReview });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'PDF export failed', detail: e.message, life: 5000 });
  } finally {
    exporting.value = false;
  }
}
const exportItems = [
  { label: 'Full report with answers', icon: 'pi pi-file-pdf', command: () => exportPdf(true) },
  { label: 'Score summary only', icon: 'pi pi-chart-bar', command: () => exportPdf(false) },
];

function practiceWeak() {
  router.push({ name: 'practice', query: { topics: weakTopics.value.join(',') } });
}
function tryAgain() {
  if (isMock.value) router.push('/mock');
  else router.push({ name: 'practice', query: { topics: result.value.topics.map((t) => t.id).join(',') } });
}

function optClass(q, opt) {
  if (opt.id === q.correctOptionId) return 'correct';
  if (opt.id === q.selected) return 'wrong';
  return '';
}
</script>

<template>
  <div class="container page">
    <Message v-if="error" severity="error" :closable="false">{{ error }} <RouterLink to="/history">View history</RouterLink></Message>
    <div v-else-if="!result" class="stack"><Skeleton height="220px" /><Skeleton height="300px" /></div>

    <div v-else class="stack">
      <section class="surface hero">
        <div class="ring" :style="{ '--pct': result.percent, '--col': result.percent >= target ? 'var(--ok)' : 'var(--bad)' }">
          <div class="ring-inner">
            <span class="pct">{{ Math.round(result.percent) }}%</span>
            <span class="small muted">{{ result.correct }}/{{ result.total }}</span>
          </div>
        </div>
        <div class="hero-body">
          <div class="row" style="gap: 8px">
            <Tag :value="isMock ? 'Mock exam' : 'Practice'" :severity="isMock ? 'info' : 'secondary'" />
            <span class="small muted">{{ result.stateName }} · {{ formatDate(result.submittedAt) }}</span>
          </div>
          <h1 v-if="isMock" class="verdict" :class="result.passed ? 'ok' : 'bad'">
            <i :class="result.passed ? 'pi pi-verified' : 'pi pi-times-circle'" />
            {{ result.passed ? 'You passed!' : 'Not passed this time' }}
          </h1>
          <h1 v-else class="verdict">Practice complete</h1>
          <p class="muted" style="margin: 0">
            <template v-if="isMock">You needed {{ result.passPercent }}% to pass. </template>
            <template v-if="result.timedOut">Time ran out and the exam was submitted automatically. </template>
            <template v-if="weakTopics.length">Focus next on {{ weakTopics.length === 1 ? 'one topic' : `${weakTopics.length} topics` }} below {{ target }}%.</template>
            <template v-else>Every topic was at or above {{ target }}%.</template>
          </p>
          <div class="grid-3 stats">
            <div class="stat"><span class="value">{{ result.answered }}/{{ result.total }}</span><span class="label">answered</span></div>
            <div class="stat"><span class="value">{{ formatDuration(result.timeUsedSeconds) }}</span><span class="label">time used{{ isMock ? ` of ${formatDuration(result.durationSeconds)}` : '' }}</span></div>
            <div class="stat"><span class="value">{{ result.byTopic.length }}</span><span class="label">topics covered</span></div>
          </div>
          <div class="row">
            <SplitButton label="Export PDF" icon="pi pi-download" :model="exportItems" @click="exportPdf(true)" :loading="exporting" />
            <Button v-if="weakTopics.length" label="Practice weak topics" icon="pi pi-bullseye" severity="secondary" outlined @click="practiceWeak" />
            <Button :label="isMock ? 'New mock exam' : 'Practice again'" icon="pi pi-refresh" text @click="tryAgain" />
          </div>
        </div>
      </section>

      <section class="surface">
        <h2 class="h2">Results by topic</h2>
        <div class="topics">
          <div v-for="t in sortedTopics" :key="t.topic" class="topic-row">
            <span class="t-name">{{ t.name }}</span>
            <ProgressBar :value="t.percent" :showValue="false" class="bar" :class="t.percent >= target ? 'good' : 'weak'" />
            <span class="t-score"><b>{{ t.correct }}/{{ t.total }}</b> <span class="muted">· {{ Math.round(t.percent) }}%</span></span>
          </div>
        </div>
      </section>

      <section class="surface">
        <div class="row" style="margin-bottom: 14px">
          <h2 class="h2" style="margin: 0">Answer review</h2>
          <span class="spacer" />
          <SelectButton v-model="filter" :options="filterOptions" optionLabel="label" optionValue="value" :allowEmpty="false" size="small" />
        </div>
        <p v-if="!shown.length" class="muted">Nothing to show for this filter.</p>
        <article v-for="q in shown" :key="q.id" class="review">
          <div class="row" style="margin-bottom: 8px">
            <span class="num">{{ q.n }}</span>
            <span class="eyebrow">{{ q.topicName }}</span>
            <span v-if="q.difficulty" class="difficulty" :class="q.difficulty">{{ q.difficulty }}</span>
            <span class="spacer" />
            <Tag v-if="q.selected === null" value="Unanswered" severity="secondary" />
            <Tag v-else-if="q.isCorrect" value="Correct" severity="success" icon="pi pi-check" />
            <Tag v-else value="Incorrect" severity="danger" icon="pi pi-times" />
          </div>
          <p class="qtext">{{ q.text }}</p>
          <div class="options">
            <div v-for="(opt, i) in q.options" :key="opt.id" class="option" :class="optClass(q, opt)">
              <span class="letter">{{ LETTERS[i] }}</span>
              <span class="text">
                {{ opt.text }}
                <small v-if="q.optionExplanations" class="why">{{ q.optionExplanations[opt.id] }}</small>
              </span>
              <span class="mark small">
                <template v-if="opt.id === q.correctOptionId">Correct answer</template>
                <template v-else-if="opt.id === q.selected">Your answer</template>
              </span>
            </div>
          </div>
          <div class="explain" style="margin-top: 12px">
            {{ q.explanation }}
            <div v-if="q.source" class="source"><i class="pi pi-book" /> {{ q.source }}</div>
          </div>
        </article>
      </section>
    </div>
  </div>
</template>

<style scoped>
.hero { display: flex; gap: 32px; align-items: center; }
.ring {
  flex: none; width: 168px; height: 168px; border-radius: 50%; display: grid; place-items: center;
  background: conic-gradient(var(--col) calc(var(--pct) * 1%), var(--brand-soft) 0);
}
.ring-inner { width: 134px; height: 134px; border-radius: 50%; background: var(--card); display: flex; flex-direction: column; align-items: center; justify-content: center; }
.pct { font-family: var(--font-display); font-size: 2.3rem; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.hero-body { display: flex; flex-direction: column; gap: 12px; flex: 1; min-width: 0; }
.verdict { font-size: 2rem; font-weight: 700; display: flex; align-items: center; gap: 10px; }
.verdict.ok { color: var(--ok); }
.verdict.bad { color: var(--bad); }
.stats { padding: 12px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.h2 { font-size: 1.2rem; font-weight: 800; margin-bottom: 14px; }
.topics { display: grid; gap: 10px; }
.topic-row { display: grid; grid-template-columns: 220px 1fr 110px; align-items: center; gap: 14px; }
.t-name { font-weight: 500; }
.t-score { text-align: right; font-size: 0.9rem; }
.bar { height: 10px; }
.bar.good :deep(.p-progressbar-value) { background: var(--ok); }
.bar.weak :deep(.p-progressbar-value) { background: var(--bad); }
.review { padding: 18px 0; border-top: 1px solid var(--line); }
.num { width: 28px; height: 28px; border-radius: 50%; background: var(--brand); color: var(--on-brand); display: grid; place-items: center; font-size: 0.8rem; font-weight: 700; }
.qtext { font-weight: 600; margin: 0 0 12px; }
.option { cursor: default; }
.option .mark { color: var(--muted); font-weight: 600; }
.option.correct .mark { color: var(--ok); }
.option.wrong .mark { color: var(--bad); }
@media (max-width: 760px) {
  .hero { flex-direction: column; align-items: stretch; text-align: left; }
  .ring { align-self: center; }
  .topic-row { grid-template-columns: 1fr auto; }
  .topic-row .bar { grid-column: 1 / -1; grid-row: 2; }
}
</style>
