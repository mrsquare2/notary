<script setup>
// Percent ring. `percent` null means "no data yet" and draws an empty track.
const props = defineProps({ percent: { type: Number, default: null }, size: { type: Number, default: 150 }, label: { type: String, default: '' } });
const R = 62;
const C = 2 * Math.PI * R;
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 150 150" role="img" :aria-label="props.percent === null ? `${label}: no data yet` : `${label}: ${Math.round(props.percent)} percent`">
    <circle cx="75" cy="75" :r="R" fill="none" stroke="var(--brand-soft)" stroke-width="16" />
    <circle v-if="props.percent !== null" cx="75" cy="75" :r="R" fill="none" stroke="var(--ok)" stroke-width="16" stroke-linecap="round"
      :stroke-dasharray="`${(Math.max(0, Math.min(100, props.percent)) / 100) * C} ${C}`" transform="rotate(-90 75 75)" />
    <text x="75" y="83" text-anchor="middle" font-size="30" font-weight="800" fill="var(--ink)" font-family="inherit">
      {{ props.percent === null ? '—' : `${Math.round(props.percent)}%` }}
    </text>
  </svg>
</template>
