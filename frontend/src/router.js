import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';
import { setTitle } from './brand.js';

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: (to, from, saved) => saved ?? (to.hash ? { el: to.hash } : { top: 0 }),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/practice', name: 'practice', component: () => import('./views/PracticeSetupView.vue'), meta: { title: 'Topic Practice' } },
    { path: '/mock', name: 'mock', component: () => import('./views/MockSetupView.vue'), meta: { title: 'Timed Mock Exam' } },
    { path: '/quiz/:id', name: 'quiz', component: () => import('./views/QuizView.vue'), meta: { title: 'Test in progress' } },
    { path: '/results/:id', name: 'result', component: () => import('./views/ResultView.vue'), meta: { title: 'Your result' } },
    { path: '/history', name: 'history', component: () => import('./views/HistoryView.vue'), meta: { title: 'Your progress' } },
    // State landing pages (/texas, /new-york, ...). HomeView checks the slug and sends unknown ones home.
    { path: '/:state([a-z-]+)', name: 'state', component: HomeView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

// Home and state pages set their own title once the state is known.
router.afterEach((to) => { if (to.meta.title) setTitle(to.meta.title); });

export default router;
