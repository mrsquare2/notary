<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import SelectButton from 'primevue/selectbutton';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import { useCatalog } from '../stores/catalog.js';
import { api } from '../api.js';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { current, practiceSizes, load } = useCatalog();

const chosen = ref([]);
const count = ref(20);
const starting = ref(false);

function initFromQuery() {
  const q = String(route.query.topics ?? '').split(',').filter(Boolean);
  const valid = new Set(current.value?.topics.map((t) => t.id) ?? []);
  chosen.value = q.filter((id) => valid.has(id));
}

onMounted(async () => {
  await load();
  initFromQuery();
});
watch(() => current.value?.code, (now, before) => { if (before) chosen.value = []; });

const allSelected = computed(() => current.value && chosen.value.length === current.value.topics.length);
const available = computed(() => {
  if (!current.value) return 0;
  const set = chosen.value.length ? new Set(chosen.value) : null;
  return current.value.topics.filter((t) => !set || set.has(t.id)).reduce((n, t) => n + t.count, 0);
});
const willGet = computed(() => Math.min(count.value, available.value));

function toggleAll() {
  chosen.value = allSelected.value ? [] : current.value.topics.map((t) => t.id);
}

async function start() {
  starting.value = true;
  try {
    const s = await api.startSession({ state: current.value.code, mode: 'practice', topics: chosen.value, count: count.value });
    router.push({ name: 'quiz', params: { id: s.id } });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Could not start practice', detail: e.message, life: 5000 });
  } finally {
    starting.value = false;
  }
}
</script>

<template>
  <div class="container page">
    <div class="eyebrow">Practice mode</div>
    <h1 class="page-title">Topic practice</h1>
    <p class="muted intro">
      Choose the areas you want to drill. Questions are drawn at random and answer choices are shuffled every time.
      After each answer you'll see whether you were right, with an explanation and the legal source.
    </p>

    <div v-if="current" class="layout">
      <section class="surface">
        <div class="row" style="margin-bottom: 12px">
          <h2 class="h2">Topics</h2>
          <span class="spacer" />
          <Button :label="allSelected ? 'Clear all' : 'Select all'" text size="small" @click="toggleAll" />
        </div>
        <div class="topic-list">
          <label v-for="t in current.topics" :key="t.id" class="topic" :class="{ on: chosen.includes(t.id) }">
            <Checkbox v-model="chosen" :value="t.id" :inputId="`t-${t.id}`" />
            <span class="t-body">
              <span class="t-name">{{ t.name }}</span>
              <span class="t-desc">{{ t.description }}</span>
            </span>
            <span class="t-count">{{ t.count }}</span>
          </label>
        </div>
      </section>

      <aside class="surface side">
        <h2 class="h2">Session</h2>
        <div>
          <div class="small muted label">Number of questions</div>
          <SelectButton v-model="count" :options="practiceSizes" :allowEmpty="false" aria-label="Number of questions" />
        </div>
        <div class="summary">
          <div class="row"><span class="muted">State</span><span class="spacer" /><b>{{ current.name }}</b></div>
          <div class="row"><span class="muted">Topics</span><span class="spacer" /><b>{{ chosen.length ? chosen.length : 'All' }}</b></div>
          <div class="row"><span class="muted">Questions available</span><span class="spacer" /><b>{{ available }}</b></div>
          <div class="row"><span class="muted">You'll get</span><span class="spacer" /><b>{{ willGet }}</b></div>
        </div>
        <Message v-if="willGet < count" severity="info" size="small" :closable="false">
          Only {{ available }} questions in the selected topics, so the session will use all of them.
        </Message>
        <Button label="Start practice" icon="pi pi-play" :loading="starting" :disabled="!available" @click="start" fluid />
        <p class="small muted" style="margin: 0">No topic selected means questions from every topic.</p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.intro { max-width: 720px; margin: 0 0 24px; }
.layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; }
@media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }
.h2 { font-size: 1.2rem; font-weight: 800; }
.topic-list { display: grid; gap: 8px; }
.topic { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid var(--line); border-radius: var(--radius-sm); cursor: pointer; background: var(--card); }
.topic:hover { border-color: var(--brand); }
.topic.on { border-color: var(--brand); background: var(--brand-soft); }
.t-body { display: flex; flex-direction: column; flex: 1; }
.t-name { font-weight: 700; }
.t-desc { font-size: 0.82rem; color: var(--muted); }
.t-count { font-size: 0.8rem; font-weight: 600; color: var(--muted); background: var(--card-2); border: 1px solid var(--line); border-radius: 999px; padding: 2px 10px; }
.side { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 92px; }
.label { margin-bottom: 6px; }
.summary { display: flex; flex-direction: column; gap: 6px; padding: 12px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
</style>
