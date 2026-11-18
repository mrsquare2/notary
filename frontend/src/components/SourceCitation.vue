<script setup>
// The legal citation under an explanation. The citation text links to the question's first
// official source; any further sources follow as their own links.
defineProps({ source: { type: String, required: true }, refs: { type: Array, default: () => [] } });
</script>

<template>
  <div class="source">
    <i class="pi pi-book" aria-hidden="true" />
    <span>
      <a v-if="refs.length" :href="refs[0].url" :title="refs[0].title" target="_blank" rel="noopener noreferrer">{{ source }}<span class="sr-only"> (opens in a new tab)</span></a>
      <template v-else>{{ source }}</template>
      <template v-for="r in refs.slice(1)" :key="r.url"> · <a :href="r.url" target="_blank" rel="noopener noreferrer">{{ r.title }}<span class="sr-only"> (opens in a new tab)</span></a></template>
    </span>
  </div>
</template>
