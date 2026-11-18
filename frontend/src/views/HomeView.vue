<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from 'primevue/button';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import { useCatalog } from '../stores/catalog.js';
import { api } from '../api.js';
import { setTitle } from '../brand.js';
import { formatDate } from '../utils/format.js';
import ReadinessRing from '../components/ReadinessRing.vue';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { states, current, loading, error, load, select } = useCatalog();
const results = ref([]);
const starting = ref(false);
const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// /texas, /new-york, ... pick that state; an unknown slug goes home.
async function applyRoute() {
  await load();
  const slug = route.params.state;
  if (slug) {
    const s = states.value.find((x) => x.slug === slug);
    if (!s) return router.replace('/');
    select(s.code);
  }
}
onMounted(async () => {
  await applyRoute();
  try { results.value = (await api.results()).results; } catch { /* progress is optional here */ }
});
watch(() => route.params.state, applyRoute);
watch(current, (s) => setTitle(route.name === 'state' && s ? `${s.name} Notary Practice Test` : null), { immediate: true });

// Readiness comes only from this learner's own results for the selected state.
const mine = computed(() => results.value.filter((r) => current.value && r.state === current.value.code));
const readiness = computed(() => {
  const recent = mine.value.slice(0, 5);
  const total = recent.reduce((n, r) => n + r.total, 0);
  return total ? (recent.reduce((n, r) => n + r.correct, 0) / total) * 100 : null;
});
const topicStanding = computed(() => {
  const agg = new Map();
  for (const r of mine.value.slice(0, 10)) {
    for (const t of r.byTopic ?? []) {
      const a = agg.get(t.topic) ?? { id: t.topic, name: t.name, correct: 0, total: 0 };
      a.correct += t.correct;
      a.total += t.total;
      agg.set(t.topic, a);
    }
  }
  const ranked = [...agg.values()].filter((a) => a.total >= 3).map((a) => ({ ...a, pct: (a.correct / a.total) * 100 })).sort((a, b) => b.pct - a.pct);
  const pass = current.value?.mock.passPercent ?? 70;
  return { strong: ranked.find((a) => a.pct >= pass) ?? null, weak: [...ranked].reverse().find((a) => a.pct < pass) ?? null };
});

// Bump CLIP_VERSION whenever the clips are re-recorded so browsers don't show cached ones.
const CLIP_VERSION = 'a1';
const clips = [
  { src: `/media/practice.webm?v=${CLIP_VERSION}`, title: 'Practice by topic', text: 'Answer a question and see why every option is right or wrong, with the law it comes from.' },
  { src: `/media/mock.webm?v=${CLIP_VERSION}`, title: 'Take a timed mock', text: 'Your state\'s exam format with a real countdown, flags for review and auto-submit.' },
  { src: `/media/review.webm?v=${CLIP_VERSION}`, title: 'Review and improve', text: 'Score by topic, a full answer review and a PDF report to study from.' },
];

async function quickRound() {
  starting.value = true;
  try {
    const s = await api.startSession({ state: current.value.code, mode: 'practice', topics: [], count: 10 });
    router.push({ name: 'quiz', params: { id: s.id } });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Could not start practice', detail: e.message, life: 5000 });
  } finally {
    starting.value = false;
  }
}
const practiceTopic = (id) => router.push({ name: 'practice', query: { topics: id } });
</script>

<template>
  <div class="container page home">
    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

    <section class="hero surface">
      <div class="hero-main">
        <span class="eyebrow gold">{{ current ? `${current.name} notary public · ${current.questionCount} practice questions` : 'Notary public exam prep' }}</span>
        <h1 v-if="current">Study for your {{ current.name }} notary commission with answers you can trust.</h1>
        <h1 v-else>Study for your notary commission with answers you can trust.</h1>
        <p class="lead" v-if="current">
          Every practice question is explained option by option and cited to {{ current.name }} law and official guidance. Free, with no sign-up.
        </p>
        <div class="hero-actions">
          <Button label="Start a 10-question round" :loading="starting" :disabled="!current" @click="quickRound" />
          <RouterLink to="/mock" class="text-cta">Take a timed mock exam <i class="pi pi-arrow-right" /></RouterLink>
        </div>
      </div>

      <aside v-if="current" class="glance" aria-labelledby="glance-title">
        <span id="glance-title" class="eyebrow">Your exam at a glance</span>
        <div class="glance-grid">
          <div class="stat"><span class="value">{{ current.mock.questions }}</span><span class="label">questions in the mock</span></div>
          <div class="stat"><span class="value">{{ current.mock.minutes }} min</span><span class="label">time limit</span></div>
          <div class="stat"><span class="value">{{ current.mock.passPercent }}%</span><span class="label">to pass</span></div>
          <div class="stat"><span class="value">{{ current.topics.length }}</span><span class="label">topics covered</span></div>
        </div>
        <p class="glance-source small muted"><i class="pi pi-book" /> Source: {{ current.authority }}</p>
        <div class="ready">
          <ReadinessRing :percent="readiness" :size="72" label="Your readiness" />
          <div class="ready-text">
            <span class="ready-title">Your readiness</span>
            <template v-if="readiness !== null">
              <span class="small muted">From your last {{ Math.min(mine.length, 5) }} {{ mine.length === 1 ? 'test' : 'tests' }}.</span>
              <div class="row ready-pills">
                <span v-if="topicStanding.strong" class="pill ok"><i class="pi pi-check" /> Strong: {{ topicStanding.strong.name }}</span>
                <button v-if="topicStanding.weak" class="pill bad as-btn" @click="practiceTopic(topicStanding.weak.id)">
                  <i class="pi pi-arrow-right" /> Practice: {{ topicStanding.weak.name }}
                </button>
              </div>
            </template>
            <span v-else class="small muted">Finish a practice round to see your readiness and weakest topic.</span>
          </div>
        </div>
      </aside>
    </section>

    <section class="how" aria-labelledby="how-title">
      <div>
        <span class="eyebrow">How it works</span>
        <h2 id="how-title" class="h2">Three ways to study</h2>
      </div>
      <div class="grid-3">
        <figure v-for="c in clips" :key="c.src" class="surface clip">
          <video :src="c.src" :poster="c.src.replace('.webm', '.jpg')" muted loop playsinline preload="metadata" :autoplay="!reducedMotion" :controls="reducedMotion"
            :aria-label="`${c.title}: screen recording`" />
          <figcaption>
            <h3>{{ c.title }}</h3>
            <p class="small muted">{{ c.text }}</p>
          </figcaption>
        </figure>
      </div>
    </section>

    <section class="surface" aria-labelledby="topics-title">
      <div class="row head-row">
        <h2 id="topics-title" class="h2">Practice a topic</h2>
        <span class="spacer" />
        <span class="small muted" v-if="current">{{ current.name }} · {{ current.authority }}</span>
      </div>
      <div v-if="loading && !current" class="topics">
        <Skeleton v-for="n in 6" :key="n" height="96px" borderRadius="16px" />
      </div>
      <div v-else-if="current" class="topics">
        <button v-for="t in current.topics" :key="t.id" class="topic" @click="practiceTopic(t.id)">
          <span class="t-name">{{ t.name }}</span>
          <span class="t-desc">{{ t.description }}</span>
          <span class="t-count">{{ t.count }} questions <i class="pi pi-arrow-right" /></span>
        </button>
      </div>
    </section>

    <section v-if="mine.length" class="surface">
      <div class="row head-row">
        <h2 class="h2">Recent results</h2>
        <span class="spacer" />
        <RouterLink to="/history" class="small">See all</RouterLink>
      </div>
      <RouterLink v-for="r in mine.slice(0, 3)" :key="r.id" :to="`/results/${r.id}`" class="recent">
        <span class="pill">{{ r.mode === 'mock' ? 'Mock exam' : 'Practice' }}</span>
        <span class="small muted">{{ formatDate(r.submittedAt) }}</span>
        <span class="spacer" />
        <span class="pill" :class="r.percent >= (r.passPercent ?? 70) ? 'ok' : 'bad'">{{ Math.round(r.percent) }}%</span>
      </RouterLink>
    </section>

    <section v-if="current?.faq?.length" class="surface faq-section" aria-labelledby="faq-title">
      <div class="faq-intro">
        <span class="eyebrow">FAQ</span>
        <h2 id="faq-title" class="h2">{{ current.name }} notary exam: common questions</h2>
        <p class="small muted">Straight answers about the {{ current.name }} commission, this practice test and how your results are kept.</p>
      </div>
      <div class="faq-list">
        <details v-for="(f, i) in current.faq" :key="i" class="faq" :open="i === 0">
          <summary>{{ f.q }}</summary>
          <p>{{ f.a }}</p>
        </details>
      </div>
    </section>

    <nav v-if="states.length > 1" class="other" aria-label="Other states">
      <span class="eyebrow">Studying for another state?</span>
      <div class="row">
        <RouterLink v-for="s in states.filter((x) => x.code !== current?.code)" :key="s.code" :to="`/${s.slug}`" class="pill">{{ s.name }}</RouterLink>
      </div>
    </nav>
  </div>
</template>

<style scoped>
.home { display: flex; flex-direction: column; gap: 28px; padding-top: 12px; }
.hero { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 48px; align-items: center; padding: 48px; }
.hero-main { display: flex; flex-direction: column; gap: 20px; }
.hero h1 { font-size: clamp(2rem, 4vw, 2.9rem); line-height: 1.1; letter-spacing: -0.015em; }
.lead { margin: 0; font-size: 1.1rem; color: var(--muted); max-width: 56ch; }
.hero-actions { display: flex; gap: 20px; flex-wrap: wrap; align-items: center; }
.hero-actions :deep(.p-button) { border-radius: 6px; padding: 14px 24px; font-weight: 600; font-size: 1rem; }
.text-cta { font-weight: 600; text-decoration: none; display: inline-flex; gap: 8px; align-items: center; }
.text-cta:hover { text-decoration: underline; }
.text-cta .pi { font-size: 0.8rem; }

.glance { background: var(--card-2); border: 1px solid var(--line); border-radius: var(--radius); padding: 24px; display: flex; flex-direction: column; gap: 16px; }
.glance-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.glance-source { margin: 0; padding-top: 12px; border-top: 1px solid var(--line); display: flex; gap: 6px; align-items: center; }
.ready { display: flex; gap: 14px; align-items: center; padding-top: 14px; border-top: 1px solid var(--line); }
.ready-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ready-title { font-weight: 700; }
.ready-pills { gap: 6px; margin-top: 4px; }
.as-btn { border: 0; font: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer; }

.h2 { font-size: 1.5rem; margin-top: 4px; }
.how { display: flex; flex-direction: column; gap: 16px; }
.clip { padding: 0; overflow: hidden; margin: 0; display: flex; flex-direction: column; }
.clip video { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; object-position: top; background: var(--card-2); display: block; border-bottom: 1px solid var(--line); }
.clip figcaption { padding: 18px 20px 20px; }
.clip h3 { font-size: 1.15rem; }
.clip p { margin: 6px 0 0; }

.head-row { margin-bottom: 16px; }
.topics { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.topic {
  display: flex; flex-direction: column; gap: 6px; text-align: left; font: inherit; color: inherit;
  border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--card); padding: 16px; cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.topic:hover { border-color: var(--brand); background: var(--brand-soft); }
.t-name { font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; }
.t-desc { font-size: 0.85rem; color: var(--muted); flex: 1; }
.t-count { font-size: 0.8rem; color: var(--brand-ink); font-weight: 600; display: flex; align-items: center; gap: 6px; }
.t-count .pi { font-size: 0.7rem; }

.recent { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line); text-decoration: none; color: inherit; }

/* Heading on the left, questions on the right; stacks on narrow screens. */
.faq-section { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 40px; align-items: start; }
.faq-intro { display: flex; flex-direction: column; gap: 10px; position: sticky; top: 110px; }
.faq-intro p { margin: 0; max-width: 32ch; }
.faq-list { min-width: 0; }
.faq { border-top: 1px solid var(--line); padding: 16px 0; }
.faq:first-child { border-top: 0; padding-top: 4px; }
@media (max-width: 900px) {
  .faq-section { grid-template-columns: 1fr; gap: 16px; }
  .faq-intro { position: static; }
}
.faq summary { cursor: pointer; font-weight: 600; list-style: none; display: flex; gap: 10px; align-items: baseline; }
.faq summary::-webkit-details-marker { display: none; }
.faq summary::before { content: '+'; color: var(--gold-ink); font-weight: 700; width: 1ch; flex: none; }
.faq[open] summary::before { content: '–'; }
.faq p { margin: 10px 0 0; padding-left: calc(1ch + 10px); color: var(--muted); max-width: 72ch; } /* lines up with the question text */

.other { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.other .pill { text-decoration: none; padding: 7px 14px; }

@media (max-width: 900px) {
  .hero { grid-template-columns: 1fr; gap: 28px; padding: 28px 20px; }
}
</style>
