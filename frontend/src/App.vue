<script setup>
import { onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import Select from 'primevue/select';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import { useCatalog } from './stores/catalog.js';

const route = useRoute();
const { states, selectedCode, current, load, select } = useCatalog();
onMounted(load);

// Switching state mid-exam would be confusing, so hide the picker on the quiz page.
const inQuiz = computed(() => route.name === 'quiz');
</script>

<template>
  <header class="topbar">
    <div class="container bar">
      <RouterLink to="/" class="brand" aria-label="Notary Exam Prep home">
        <span class="seal" aria-hidden="true">
          <svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2" /><polygon points="16,7 18.4,13.4 25.2,13.4 19.7,17.5 21.8,24 16,19.9 10.2,24 12.3,17.5 6.8,13.4 13.6,13.4" fill="currentColor" /></svg>
        </span>
        <span>Notary<b>Prep</b></span>
      </RouterLink>
      <nav class="nav" v-if="!inQuiz">
        <RouterLink to="/practice">Practice</RouterLink>
        <RouterLink to="/mock">Mock exam</RouterLink>
        <RouterLink to="/history">History</RouterLink>
      </nav>
      <div class="spacer" />
      <Select
        v-if="!inQuiz && states.length"
        :modelValue="selectedCode"
        @update:modelValue="select"
        :options="states"
        optionLabel="name"
        optionValue="code"
        aria-label="Exam state"
        class="state-select"
      >
        <template #value="{ value }">
          <span class="row" style="gap: 6px"><i class="pi pi-map-marker" />{{ states.find((s) => s.code === value)?.name ?? 'Choose state' }}</span>
        </template>
      </Select>
      <span v-else-if="inQuiz && current" class="quiz-state">{{ current.name }}</span>
    </div>
  </header>

  <main>
    <RouterView />
  </main>

  <footer class="footer">
    <div class="container small muted">
      Study aid only — not legal advice and not affiliated with any Secretary of State. Always confirm rules against your state's current official notary publications.
    </div>
  </footer>

  <Toast position="bottom-right" />
  <ConfirmDialog />
</template>

<style scoped>
.topbar { background: var(--navy); color: #fff; position: sticky; top: 0; z-index: 20; }
.bar { display: flex; align-items: center; gap: 20px; height: 60px; }
.brand { display: flex; align-items: center; gap: 10px; text-decoration: none; font-size: 1.15rem; letter-spacing: -0.01em; }
.brand b { color: var(--gold); }
.seal { width: 30px; height: 30px; color: var(--gold); display: grid; }
.nav { display: flex; gap: 4px; }
.nav a { text-decoration: none; padding: 6px 12px; border-radius: 8px; color: #cbd5ff; font-weight: 500; }
.nav a:hover { color: #fff; background: rgba(255, 255, 255, 0.08); }
.nav a.router-link-active { color: #fff; background: rgba(255, 255, 255, 0.14); }
.state-select { min-width: 160px; }
.quiz-state { color: #cbd5ff; font-weight: 500; }
.footer { border-top: 1px solid var(--line); padding: 20px 0 32px; }
@media (max-width: 760px) {
  .bar { height: auto; padding-top: 10px; padding-bottom: 10px; flex-wrap: wrap; gap: 8px 12px; }
  .nav { order: 3; width: 100%; overflow-x: auto; }
  .state-select { min-width: 0; }
}
</style>
