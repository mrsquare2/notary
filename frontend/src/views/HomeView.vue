<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import { useCatalog } from '../stores/catalog.js';
import { api } from '../api.js';
import { formatDate, scoreSeverity } from '../utils/format.js';

const router = useRouter();
const { current, loading, error, load } = useCatalog();
const recent = ref([]);

onMounted(async () => {
  load();
  try {
    recent.value = (await api.results()).results.slice(0, 3);
  } catch { /* history is optional on the home page */ }
});

const recentForState = computed(() => recent.value.filter((r) => !current.value || r.state === current.value.code));

function practiceTopic(id) {
  router.push({ name: 'practice', query: { topics: id } });
}
</script>

<template>
  <div>
    <section class="hero">
      <div class="container hero-inner">
        <div class="eyebrow gold">Notary public exam prep</div>
        <h1 v-if="current">Pass your <span class="hl">{{ current.name }}</span> notary exam with confidence</h1>
        <h1 v-else>Pass your notary exam with confidence</h1>
        <p class="lead">
          Practice by topic with instant explanations, then test yourself under exam conditions with a timed mock.
          Every question is drawn at random and every answer list is shuffled, so no two tests are the same.
        </p>
        <div class="row">
          <Button label="Start practising" icon="pi pi-book" @click="router.push('/practice')" />
          <Button label="Take a timed mock exam" icon="pi pi-stopwatch" severity="contrast" outlined class="ghost" @click="router.push('/mock')" />
        </div>
        <div v-if="current" class="facts">
          <div><b>{{ current.questionCount }}</b><span>questions</span></div>
          <div><b>{{ current.topics.length }}</b><span>topics</span></div>
          <div><b>{{ current.mock.questions }} / {{ current.mock.minutes }} min</b><span>mock exam</span></div>
          <div><b>{{ current.mock.passPercent }}%</b><span>to pass</span></div>
        </div>
      </div>
    </section>

    <div class="container page stack">
      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

      <div class="grid-2">
        <RouterLink to="/practice" class="surface mode">
          <i class="pi pi-book icon" />
          <div>
            <h2>Topic-wise practice</h2>
            <p class="muted">Pick one or more areas, such as identification, acknowledgments, jurats, fees or recordkeeping. You see the answer and its explanation after every question.</p>
          </div>
          <i class="pi pi-arrow-right go" />
        </RouterLink>
        <RouterLink to="/mock" class="surface mode">
          <i class="pi pi-stopwatch icon" />
          <div>
            <h2>Timed mock exam</h2>
            <p class="muted" v-if="current">{{ current.mock.questions }} questions across every topic, {{ current.mock.minutes }} minutes on the clock, no feedback until you submit. {{ current.mock.passPercent }}% to pass.</p>
            <p class="muted" v-else>A full-length exam under timed conditions.</p>
          </div>
          <i class="pi pi-arrow-right go" />
        </RouterLink>
      </div>

      <section class="surface">
        <div class="row" style="margin-bottom: 14px">
          <h2 class="h2">Practice a topic</h2>
          <span class="spacer" />
          <span class="small muted" v-if="current">{{ current.name }} · {{ current.authority }}</span>
        </div>
        <div v-if="loading && !current" class="topics">
          <Skeleton v-for="n in 6" :key="n" height="74px" borderRadius="12px" />
        </div>
        <div v-else-if="current" class="topics">
          <button v-for="t in current.topics" :key="t.id" class="topic" @click="practiceTopic(t.id)">
            <span class="t-name">{{ t.name }}</span>
            <span class="t-desc">{{ t.description }}</span>
            <span class="t-count">{{ t.count }} questions</span>
          </button>
        </div>
      </section>

      <section v-if="recentForState.length" class="surface">
        <div class="row" style="margin-bottom: 10px">
          <h2 class="h2">Recent results</h2>
          <span class="spacer" />
          <RouterLink to="/history" class="small">See all</RouterLink>
        </div>
        <RouterLink v-for="r in recentForState" :key="r.id" :to="`/results/${r.id}`" class="recent">
          <span class="row" style="gap: 8px">
            <Tag :value="r.mode === 'mock' ? 'Mock exam' : 'Practice'" :severity="r.mode === 'mock' ? 'info' : 'secondary'" />
            <span class="small muted">{{ formatDate(r.submittedAt) }}</span>
          </span>
          <span class="spacer" />
          <Tag :value="`${r.percent}%`" :severity="scoreSeverity(r.percent, r.passPercent ?? 70)" />
        </RouterLink>
      </section>

      <p v-if="current?.notes" class="disclaimer"><i class="pi pi-info-circle" /> {{ current.notes }}</p>
      <p v-if="current?.disclaimer" class="disclaimer">{{ current.disclaimer }}</p>
    </div>
  </div>
</template>

<style scoped>
.hero { background: linear-gradient(160deg, var(--navy) 0%, var(--navy-2) 100%); color: #fff; }
.hero-inner { padding: 48px 16px 40px; }
.gold { color: var(--gold); }
.hero h1 { font-size: clamp(1.8rem, 4vw, 2.6rem); max-width: 760px; margin: 10px 0 14px; }
.hl { color: var(--gold); }
.lead { color: #d6dcf5; max-width: 680px; font-size: 1.05rem; margin: 0 0 22px; }
.ghost { color: #fff !important; border-color: rgba(255, 255, 255, 0.5) !important; }
.facts { display: flex; gap: 32px; flex-wrap: wrap; margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.15); }
.facts div { display: flex; flex-direction: column; }
.facts b { font-size: 1.25rem; }
.facts span { color: #b8c2ea; font-size: 0.85rem; }

.mode { display: flex; gap: 16px; align-items: flex-start; text-decoration: none; transition: border-color 0.15s, box-shadow 0.15s; }
.mode:hover { border-color: var(--p-primary-300); box-shadow: 0 6px 20px rgba(30, 42, 90, 0.08); }
.mode h2 { font-size: 1.15rem; margin-bottom: 6px; }
.mode p { margin: 0; }
.mode .icon { font-size: 1.4rem; color: var(--p-primary-600); background: var(--p-primary-50); padding: 12px; border-radius: 12px; }
.mode .go { margin-left: auto; color: var(--muted); padding-top: 4px; }

.h2 { font-size: 1.1rem; }
.topics { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
.topic {
  display: flex; flex-direction: column; gap: 4px; text-align: left; font: inherit; color: inherit;
  border: 1px solid var(--line); border-radius: 12px; background: #fff; padding: 12px 14px; cursor: pointer;
}
.topic:hover { border-color: var(--p-primary-300); background: var(--p-primary-50); }
.t-name { font-weight: 600; }
.t-desc { font-size: 0.82rem; color: var(--muted); }
.t-count { font-size: 0.78rem; color: var(--p-primary-700); font-weight: 600; margin-top: 2px; }

.recent { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--line); text-decoration: none; }
</style>
