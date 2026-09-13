<script setup>
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

import { useAuthStore } from '@/stores/auth'
import { useFlashStore } from '@/stores/flash'

import logo from "@/assets/icons/logo.svg"

const router = useRouter()

const authStore = useAuthStore()

const { user, isLoggedIn, authReady } = storeToRefs(authStore)
const { logout } = authStore

const { setFlash } = useFlashStore()

async function handleLogout() {
    await logout()

    setFlash('Odjavljeni ste.')

    router.push({ name: 'home' })
}

const navLink =
    'rounded-md px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900'
</script>

<template>
    <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
            <RouterLink to="/"
                class="font-semibold tracking-tight text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900">
                <img :src="logo" alt="Peshka logo">
            </RouterLink>

            <nav class="flex items-center gap-1 text-sm">

                <div v-if="!authReady" class="h-5 w-32 animate-pulse rounded bg-slate-200" />

                <template v-else-if="isLoggedIn">
                    <RouterLink to="/izlasci/novi" :class="navLink" active-class="bg-slate-100 text-slate-900">
                        Novi izlazak +
                    </RouterLink>
                    <span class="mr-1 hidden text-slate-500 sm:inline">{{ user.email }}</span>
                    <button type="button" :class="navLink" @click="handleLogout">Odjava</button>
                </template>

                <template v-else>
                    <RouterLink to="/login" :class="navLink" active-class="bg-slate-100 text-slate-900">
                        Prijava
                    </RouterLink>
                    <RouterLink to="/register"
                        class="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2">
                        Registracija
                    </RouterLink>
                </template>
            </nav>
        </div>
    </header>
</template>