import HomePage from '@/pages/HomePage.vue'
import IzlasciPage from '@/pages/IzlasciPage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import NoviIzlazakPage from '@/pages/NoviIzlazakPage.vue'
import RegisterPage from '@/pages/RegisterPage.vue'
import TestPage from '@/pages/TestPage.vue'
import { useAuthStore } from '@/stores/auth'
import { createRouter, createWebHistory } from 'vue-router'

const routes = [{
  path: '',
  name: 'home',
  component: HomePage
},
{
  path: '/register',
  name: 'register',
  component: RegisterPage
},
{
  path: '/login',
  name: 'login',
  component: LoginPage
},
{
  path: '/test',
  name: 'test',
  component: TestPage
},
{
  path: '/izlasci/novi',
  name: 'novi-izlazak',
  component: NoviIzlazakPage,
  meta: { requiresAuth: true }
},
{
  path: '/izlasci',
  name: 'izlasci',
  component: IzlasciPage,
  meta: { requiresAuth: true }
},
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: routes,
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  await authStore.whenAuthReady()

  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return { name: 'login' }
  }
})

export default router
