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
const CLIP_VERSION = 'b1';
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

    <section class="hero">
      <div class="hero-main">
        <span class="free-pill">Free · no sign-up</span>
        <h1 v-if="current">Get ready to become a {{ current.name }} notary</h1>
        <h1 v-else>Get ready to become a notary public</h1>
        <p class="lead" v-if="current">
          {{ current.questionCount }} practice questions with an explanation for every answer, cited to {{ current.name }} law.
          Short rounds, timed mocks, and your progress saved on this device.
        </p>
        <div class="hero-actions">
          <Button label="Start a 10-question round" class="cta-light" :loading="starting" :disabled="!current" @click="quickRound" />
          <Button label="Try a mock exam" class="cta-ghost" @click="router.push('/mock')" />
        </div>
        <div v-if="current" class="facts">
          <span><b>{{ current.mock.questions }}</b> question mock</span>
          <span><b>{{ current.mock.minutes }}</b> minutes</span>
          <span><b>{{ current.mock.passPercent }}%</b> to pass</span>
          <span><b>{{ current.topics.length }}</b> topics</span>
        </div>
      </div>

      <aside class="surface ready" aria-labelledby="ready-title">
        <ReadinessRing :percent="readiness" label="Your readiness" />
        <h2 id="ready-title" class="section-title">Your readiness</h2>
        <template v-if="readiness !== null">
          <p class="small muted center">From your last {{ Math.min(mine.length, 5) }} {{ mine.length === 1 ? 'test' : 'tests' }} in {{ current?.name }}.</p>
          <div class="row center-row">
            <span v-if="topicStanding.strong" class="pill ok"><i class="pi pi-check" /> Strong: {{ topicStanding.strong.name }}</span>
            <button v-if="topicStanding.weak" class="pill bad as-btn" @click="practiceTopic(topicStanding.weak.id)">
              <i class="pi pi-arrow-right" /> Practice: {{ topicStanding.weak.name }}
            </button>
          </div>
        </template>
        <p v-else class="small muted center">Finish a practice round and your readiness and weakest topic show up here.</p>
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
.hero { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: 24px; }
.hero-main { background: var(--hero); color: var(--on-hero); border-radius: var(--radius-lg); padding: 48px; display: flex; flex-direction: column; gap: 20px; }
.free-pill { align-self: flex-start; background: color-mix(in srgb, var(--on-hero) 18%, transparent); border-radius: 999px; padding: 6px 14px; font-size: 0.82rem; font-weight: 700; }
.hero h1 { font-size: clamp(2rem, 4.4vw, 3rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.06; }
.lead { margin: 0; font-size: 1.1rem; color: var(--on-hero-muted); max-width: 560px; }
.hero-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.hero-actions :deep(.p-button) { border-radius: 16px; padding: 14px 24px; font-weight: 800; font-size: 1rem; }
.cta-light { background: var(--on-hero) !important; color: var(--hero) !important; border-color: var(--on-hero) !important; }
.cta-ghost { background: color-mix(in srgb, var(--on-hero) 14%, transparent) !important; color: var(--on-hero) !important; border-color: transparent !important; }
.facts { display: flex; flex-wrap: wrap; gap: 8px 22px; font-size: 0.92rem; color: var(--on-hero-muted); padding-top: 18px; border-top: 1px solid color-mix(in srgb, var(--on-hero) 22%, transparent); }
.facts b { color: var(--on-hero); font-size: 1.05rem; }

.ready { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; border-radius: var(--radius-lg); }
.center { margin: 0; max-width: 280px; }
.center-row { justify-content: center; }
.as-btn { border: 0; font: inherit; font-size: 0.82rem; font-weight: 700; cursor: pointer; }

.h2 { font-size: 1.35rem; font-weight: 800; margin-top: 4px; }
.how { display: flex; flex-direction: column; gap: 16px; }
.clip { padding: 0; overflow: hidden; margin: 0; display: flex; flex-direction: column; }
.clip video { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; object-position: top; background: var(--card-2); display: block; border-bottom: 1px solid var(--line); }
.clip figcaption { padding: 18px 20px 20px; }
.clip h3 { font-size: 1.05rem; font-weight: 800; }
.clip p { margin: 6px 0 0; }

.head-row { margin-bottom: 16px; }
.topics { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.topic {
  display: flex; flex-direction: column; gap: 6px; text-align: left; font: inherit; color: inherit;
  border: 2px solid var(--line); border-radius: 16px; background: var(--card); padding: 16px; cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.topic:hover { border-color: var(--brand); background: var(--brand-soft); }
.t-name { font-weight: 800; }
.t-desc { font-size: 0.85rem; color: var(--muted); flex: 1; }
.t-count { font-size: 0.8rem; color: var(--brand-ink); font-weight: 700; display: flex; align-items: center; gap: 6px; }
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
.faq summary { cursor: pointer; font-weight: 700; list-style: none; display: flex; gap: 10px; align-items: baseline; }
.faq summary::-webkit-details-marker { display: none; }
.faq summary::before { content: '+'; color: var(--brand-ink); font-weight: 800; width: 1ch; flex: none; }
.faq[open] summary::before { content: '–'; }
.faq p { margin: 10px 0 0; padding-left: calc(1ch + 10px); color: var(--muted); max-width: 72ch; } /* lines up with the question text */

.other { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.other .pill { text-decoration: none; padding: 8px 16px; }

@media (max-width: 900px) {
  .hero { grid-template-columns: 1fr; }
  .hero-main { padding: 32px 24px; }
}
</style>
