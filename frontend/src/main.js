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

// Violet scale built around the brand color #5b4bf5 (docs/DESIGN-SYSTEM.md).
const NotaryTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f4f3ff', 100: '#ecebff', 200: '#d9d6fe', 300: '#bcb5fd', 400: '#9a8cfa', 500: '#7a66f7',
      600: '#5b4bf5', 700: '#4a3be0', 800: '#3d31b8', 900: '#342d92', 950: '#1f1a57',
    },
    colorScheme: {
      light: { primary: { color: '{primary.600}', hoverColor: '{primary.700}', activeColor: '{primary.800}' } },
      dark: { primary: { color: '{primary.400}', hoverColor: '{primary.300}', activeColor: '{primary.200}' } },
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
