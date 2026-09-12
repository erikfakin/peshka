import HomePage from '@/pages/HomePage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import RegisterPage from '@/pages/RegisterPage.vue'
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
