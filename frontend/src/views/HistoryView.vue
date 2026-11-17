<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import SelectButton from 'primevue/selectbutton';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { api } from '../api.js';
import { formatDate, formatDuration, scoreSeverity } from '../utils/format.js';

const router = useRouter();
const toast = useToast();
const confirm = useConfirm();
const results = ref([]);
const loading = ref(true);
const error = ref('');
const mode = ref('all');

onMounted(async () => {
  try {
    results.value = (await api.results()).results;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});

const rows = computed(() => results.value.filter((r) => mode.value === 'all' || r.mode === mode.value));
const mocks = computed(() => results.value.filter((r) => r.mode === 'mock'));
const stats = computed(() => ({
  attempts: results.value.length,
  average: results.value.length ? Math.round(results.value.reduce((s, r) => s + r.percent, 0) / results.value.length) : 0,
  best: mocks.value.length ? Math.max(...mocks.value.map((r) => r.percent)) : null,
  passes: mocks.value.filter((r) => r.passed).length,
}));

function remove(r, event) {
  event.stopPropagation();
  confirm.require({
    header: 'Delete this result?',
    message: 'It will be removed from your history permanently.',
    icon: 'pi pi-trash',
    acceptProps: { label: 'Delete', severity: 'danger' },
    rejectProps: { label: 'Cancel', severity: 'secondary', outlined: true },
    accept: async () => {
      try {
        await api.deleteResult(r.id);
        results.value = results.value.filter((x) => x.id !== r.id);
      } catch (e) {
        toast.add({ severity: 'error', summary: 'Could not delete', detail: e.message, life: 5000 });
      }
    },
  });
}
</script>

<template>
  <div class="container page stack">
    <div>
      <div class="eyebrow">Your progress</div>
      <h1 class="title">Test history</h1>
      <p class="muted small" style="margin: 0">Results are saved for this browser only.</p>
    </div>

    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

    <div class="grid-3" v-if="results.length">
      <div class="surface stat"><span class="value">{{ stats.attempts }}</span><span class="label">tests taken</span></div>
      <div class="surface stat"><span class="value">{{ stats.average }}%</span><span class="label">average score</span></div>
      <div class="surface stat">
        <span class="value">{{ stats.best === null ? '—' : `${stats.best}%` }}</span>
        <span class="label">best mock exam · {{ stats.passes }} passed</span>
      </div>
    </div>

    <section class="surface">
      <div class="row" style="margin-bottom: 12px">
        <SelectButton v-model="mode" :allowEmpty="false" size="small" optionLabel="label" optionValue="value"
          :options="[{ label: 'All', value: 'all' }, { label: 'Mock exams', value: 'mock' }, { label: 'Practice', value: 'practice' }]" />
      </div>
      <DataTable :value="rows" :loading="loading" dataKey="id" paginator :rows="10" :alwaysShowPaginator="false"
        rowHover @row-click="(e) => router.push(`/results/${e.data.id}`)" class="clickable" stripedRows>
        <template #empty>
          <div class="empty">
            <p class="muted">No results yet.</p>
            <Button label="Start practising" icon="pi pi-book" size="small" @click="router.push('/practice')" />
          </div>
        </template>
        <Column header="Date" field="submittedAt" sortable>
          <template #body="{ data }">{{ formatDate(data.submittedAt) }}</template>
        </Column>
        <Column header="State" field="stateName" sortable />
        <Column header="Mode" field="mode" sortable>
          <template #body="{ data }"><Tag :value="data.mode === 'mock' ? 'Mock exam' : 'Practice'" :severity="data.mode === 'mock' ? 'info' : 'secondary'" /></template>
        </Column>
        <Column header="Score" field="percent" sortable>
          <template #body="{ data }">
            <Tag :value="`${data.percent}%`" :severity="scoreSeverity(data.percent, data.passPercent ?? 70)" />
            <span class="small muted" style="margin-left: 6px">{{ data.correct }}/{{ data.total }}</span>
          </template>
        </Column>
        <Column header="Result">
          <template #body="{ data }">
            <span v-if="data.mode === 'mock'" :style="{ color: data.passed ? 'var(--ok)' : 'var(--bad)', fontWeight: 600 }">{{ data.passed ? 'Pass' : 'Fail' }}</span>
            <span v-else class="muted">—</span>
          </template>
        </Column>
        <Column header="Time">
          <template #body="{ data }">{{ formatDuration(data.timeUsedSeconds) }}</template>
        </Column>
        <Column style="width: 56px">
          <template #body="{ data }">
            <Button icon="pi pi-trash" text rounded severity="secondary" aria-label="Delete result" @click="remove(data, $event)" />
          </template>
        </Column>
      </DataTable>
    </section>
  </div>
</template>

<style scoped>
.title { font-size: 1.8rem; margin: 6px 0 4px; }
.clickable :deep(tbody tr) { cursor: pointer; }
.empty { text-align: center; padding: 20px; }
</style>
