<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import { useCatalog } from '../stores/catalog.js';
import { api } from '../api.js';
import { getActiveMock } from '../utils/activeMock.js';

const router = useRouter();
const toast = useToast();
const { current, load } = useCatalog();
const starting = ref(false);
const active = ref(null);
onMounted(() => {
  load();
  active.value = getActiveMock();
});

const activeHere = computed(() => active.value && current.value && active.value.state === current.value.code ? active.value : null);
const activeExpired = computed(() => activeHere.value && Date.parse(activeHere.value.deadline) < Date.now());

async function start() {
  starting.value = true;
  try {
    const s = await api.startSession({ state: current.value.code, mode: 'mock' });
    router.push({ name: 'quiz', params: { id: s.id } });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Could not start the exam', detail: e.message, life: 5000 });
  } finally {
    starting.value = false;
  }
}
</script>

<template>
  <div class="container page" v-if="current">
    <div class="eyebrow">Mock exam mode</div>
    <h1 class="page-title">{{ current.name }} timed mock exam</h1>

    <Message v-if="activeHere" :severity="activeExpired ? 'warn' : 'info'" :closable="false" class="resume">
      <div class="row">
        <span>{{ activeExpired ? 'Time ran out on your last mock exam before it was submitted.' : 'You have a mock exam in progress, and its timer is still running.' }}</span>
        <span class="spacer" />
        <Button size="small" :label="activeExpired ? 'Submit and see results' : 'Resume exam'" icon="pi pi-arrow-right" iconPos="right"
          @click="router.push({ name: 'quiz', params: { id: activeHere.id } })" />
      </div>
    </Message>

    <div class="layout">
      <section class="surface stack">
        <div class="grid-3">
          <div class="stat"><span class="value">{{ current.mock.questions }}</span><span class="label">questions</span></div>
          <div class="stat"><span class="value">{{ current.mock.minutes }} min</span><span class="label">time limit</span></div>
          <div class="stat"><span class="value">{{ current.mock.passPercent }}%</span><span class="label">passing score</span></div>
        </div>
        <div>
          <h2 class="h2">How it works</h2>
          <ul class="rules">
            <li>Questions are drawn at random from every topic, in proportion to the size of each topic, and the answer choices are shuffled.</li>
            <li>The timer starts as soon as you begin and keeps running if you leave the page. You can come back to the same exam from this browser.</li>
            <li>No answers or explanations are shown until you submit.</li>
            <li>You can change answers, flag questions to revisit, and jump to any question from the navigator.</li>
            <li>When time runs out, your exam is submitted automatically. Unanswered questions count as incorrect.</li>
            <li>Your result shows a score breakdown by topic, a full answer review, and a PDF export.</li>
          </ul>
        </div>
        <Message v-if="current.notes" severity="secondary" :closable="false">{{ current.notes }}</Message>
      </section>
      <aside class="surface side">
        <i class="pi pi-stopwatch big" />
        <p class="muted" style="margin: 0">Find a quiet spot and set aside {{ current.mock.minutes }} minutes.</p>
        <Button label="Begin exam" icon="pi pi-play" :loading="starting" @click="start" fluid />
        <Button label="Practice by topic instead" text @click="router.push('/practice')" fluid />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.page-title { margin-bottom: 20px; }
.resume { margin-bottom: 16px; }
.resume :deep(.p-message-text) { width: 100%; }
.layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 20px; align-items: start; }
@media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }
.h2 { font-size: 1.2rem; font-weight: 800; margin-bottom: 8px; }
.rules { margin: 0; padding-left: 20px; display: grid; gap: 6px; }
.side { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; }
.big { font-size: 2.2rem; color: var(--brand-ink); background: var(--brand-soft); padding: 20px; border-radius: 50%; }
</style>
