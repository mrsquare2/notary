import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';

export default createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/practice', name: 'practice', component: () => import('./views/PracticeSetupView.vue') },
    { path: '/mock', name: 'mock', component: () => import('./views/MockSetupView.vue') },
    { path: '/quiz/:id', name: 'quiz', component: () => import('./views/QuizView.vue') },
    { path: '/results/:id', name: 'result', component: () => import('./views/ResultView.vue') },
    { path: '/history', name: 'history', component: () => import('./views/HistoryView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});
