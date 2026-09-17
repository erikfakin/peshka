import AnalitikaPage from '@/pages/AnalitikaPage.vue'
import HomePage from '@/pages/HomePage.vue'
import IzlasciPage from '@/pages/IzlasciPage.vue'
import IzlazakFormaPage from '@/pages/IzlazakFormaPage.vue'
import IzlazakPage from '@/pages/IzlazakPage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import ProfilPage from '@/pages/ProfilPage.vue'
import RegisterPage from '@/pages/RegisterPage.vue'
import UlovPage from '@/pages/UlovPage.vue'
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
  path: '/izlasci/novi',
  name: 'novi-izlazak',
  component: IzlazakFormaPage,
  meta: { requiresAuth: true }
},
{
  path: '/izlasci/:id/uredi',
  name: 'uredi-izlazak',
  component: IzlazakFormaPage,
  props: true,
  meta: { requiresAuth: true }
},
{
  path: '/izlasci/:id',
  name: 'izlazak',
  component: IzlazakPage,
  props: true,
  meta: { requiresAuth: true }
},
{
  path: '/izlasci',
  name: 'izlasci',
  component: IzlasciPage,
  meta: { requiresAuth: true }
},
{
  path: '/analitika',
  name: 'analitika',
  component: AnalitikaPage,
  meta: { requiresAuth: true }
},
{
  path: '/ulov/:id',
  name: 'ulov',
  component: UlovPage,
  props: true
},
{
  path: '/profil/:id',
  name: 'profil',
  component: ProfilPage,
  props: true
}
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
