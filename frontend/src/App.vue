<script setup>
import { onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Select from 'primevue/select';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import { useCatalog } from './stores/catalog.js';
import { BRAND } from './brand.js';

const route = useRoute();
const router = useRouter();
const { states, selectedCode, current, load, select } = useCatalog();
onMounted(load);

// Switching state mid-exam would be confusing, so hide the picker on the quiz page.
const inQuiz = computed(() => route.name === 'quiz');

function pickState(code) {
  select(code);
  // On the home or a state page, move to that state's own page (shareable, indexable URL).
  if (route.name === 'home' || route.name === 'state') {
    const slug = states.value.find((s) => s.code === code)?.slug;
    if (slug) router.push(`/${slug}`);
  }
}
</script>

<template>
  <a href="#main" class="skip">Skip to content</a>
  <header class="topbar">
    <div class="container">
      <div class="bar">
        <RouterLink :to="current ? `/${current.slug}` : '/'" class="brand" :aria-label="`${BRAND} home`">
          <span class="mark" aria-hidden="true">
            <svg viewBox="0 0 30 30"><circle cx="15" cy="15" r="13.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2" /><circle cx="15" cy="15" r="9.5" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M15 9.5l1.6 3.4 3.7.4-2.8 2.5.8 3.7-3.3-1.9-3.3 1.9.8-3.7-2.8-2.5 3.7-.4z" fill="currentColor" /></svg>
          </span>
          <span class="name">{{ BRAND }}</span>
        </RouterLink>
        <nav class="nav" v-if="!inQuiz" aria-label="Main">
          <RouterLink to="/practice">Practice</RouterLink>
          <RouterLink to="/mock">Mock exam</RouterLink>
          <RouterLink to="/history">Progress</RouterLink>
        </nav>
        <div class="spacer" />
        <Select
          v-if="!inQuiz && states.length"
          :modelValue="selectedCode"
          @update:modelValue="pickState"
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
        <span v-else-if="inQuiz && current" class="pill">{{ current.name }}</span>
      </div>
    </div>
  </header>

  <main id="main">
    <RouterView />
  </main>

  <footer class="footer">
    <div class="container foot">
      <div class="foot-brand">
        <span class="name">{{ BRAND }}</span>
        <p class="small muted">Free notary exam practice with every answer explained and cited to the law.</p>
      </div>
      <nav class="foot-links" aria-label="States">
        <span class="eyebrow">States</span>
        <RouterLink v-for="s in states" :key="s.code" :to="`/${s.slug}`">{{ s.name }} practice test</RouterLink>
      </nav>
      <nav class="foot-links" aria-label="Study">
        <span class="eyebrow">Study</span>
        <RouterLink to="/practice">Topic practice</RouterLink>
        <RouterLink to="/mock">Timed mock exam</RouterLink>
        <RouterLink to="/history">Your progress</RouterLink>
      </nav>
    </div>
    <div class="container">
      <p class="disclaimer legal">
        Study aid only, not legal advice, and not affiliated with any Secretary of State or state agency.
        Always confirm rules against your state's current official notary publications.
      </p>
    </div>
  </footer>

  <Toast position="bottom-right" />
  <ConfirmDialog />
</template>

<style scoped>
.skip { position: absolute; left: -9999px; top: 8px; background: var(--card); padding: 8px 14px; border-radius: 6px; z-index: 50; }
.skip:focus { left: 16px; }
.topbar { position: sticky; top: 0; z-index: 20; background: var(--header); color: var(--on-header); border-bottom: 2px solid var(--gold); }
.bar { display: flex; align-items: center; gap: 36px; height: 68px; }
.brand { display: flex; align-items: center; gap: 12px; text-decoration: none; color: var(--on-header); }
.mark { width: 30px; height: 30px; color: var(--gold); display: grid; }
.name { font-family: var(--font-display); font-size: 1.3rem; font-weight: 700; letter-spacing: -0.01em; }
.nav { display: flex; gap: 26px; align-self: stretch; }
.nav a { text-decoration: none; color: var(--on-header-muted); font-weight: 500; font-size: 0.95rem; display: flex; align-items: center; border-bottom: 2px solid transparent; margin-bottom: -2px; }
.nav a:hover { color: var(--on-header); }
.nav a.router-link-active { color: var(--on-header); border-bottom-color: var(--gold); }
.state-select { min-width: 170px; }
.topbar .pill { background: transparent; color: var(--on-header); border: 1px solid var(--on-header-muted); }

.footer { margin-top: 24px; border-top: 1px solid var(--line); padding: 40px 0 32px; background: var(--card); }
.foot { display: grid; grid-template-columns: minmax(0, 1.4fr) repeat(2, minmax(0, 1fr)); gap: 32px; }
.foot .name { color: var(--ink); }
.foot-brand p { margin: 6px 0 0; max-width: 340px; }
.foot-links { display: flex; flex-direction: column; gap: 8px; }
.foot-links a { color: var(--ink); text-decoration: none; font-size: 0.92rem; }
.foot-links a:hover { color: var(--brand-ink); text-decoration: underline; }
.legal { margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--line); }

@media (max-width: 760px) {
  .topbar { position: static; }
  .bar { height: auto; flex-wrap: wrap; gap: 8px 14px; padding: 12px 0; }
  .nav { order: 3; width: 100%; overflow-x: auto; overflow-y: hidden; gap: 20px; }
  .nav a { padding: 6px 0; margin-bottom: 0; }
  .state-select { min-width: 0; }
  .foot { grid-template-columns: 1fr; gap: 24px; }
}
</style>
