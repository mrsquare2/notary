import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import Tooltip from 'primevue/tooltip';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import 'primeicons/primeicons.css';
import './style.css';
import App from './App.vue';
import router from './router.js';

// Navy scale built around the brand color #1d3a8a (docs/DESIGN-SYSTEM.md).
const NotaryTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eef2fb', 100: '#dbe3f6', 200: '#b9c8ee', 300: '#8fa8ff', 400: '#5f7fd2', 500: '#3a5fc0',
      600: '#284aa6', 700: '#1d3a8a', 800: '#182f6f', 900: '#14275a', 950: '#0c1838',
    },
    colorScheme: {
      light: { primary: { color: '{primary.700}', hoverColor: '{primary.800}', activeColor: '{primary.900}' } },
      dark: { primary: { color: '{primary.300}', hoverColor: '{primary.200}', activeColor: '{primary.100}' } },
    },
  },
});

createApp(App)
  // 'system' follows the device's light/dark setting, matching the CSS tokens in style.css.
  .use(PrimeVue, { theme: { preset: NotaryTheme, options: { darkModeSelector: 'system' } } })
  .use(ToastService)
  .use(ConfirmationService)
  .directive('tooltip', Tooltip)
  .use(router)
  .mount('#app');
