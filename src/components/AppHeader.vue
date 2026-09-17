<script setup>
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'

import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'

import logo from '@/assets/icons/logo.svg'

const router = useRouter()
const authStore = useAuthStore()
const { user, punoIme, isLoggedIn, authReady } = storeToRefs(authStore)

const stavka = 'text-white/80 hover:bg-white/10 hover:text-white [&.router-link-active]:text-brand-coral'

async function odjava() {
    await authStore.logout()
    toast.success('Odjavljeni ste.')
    router.push({ name: 'home' })
}
</script>

<template>
    <header class="bg-brand-navy">
        <div class="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
            <RouterLink to="/">
                <img :src="logo" alt="Peshka" class="h-7 brightness-0 invert" />
            </RouterLink>

            <nav class="flex items-center gap-1">
                <div v-if="!authReady" class="h-5 w-32 animate-pulse rounded bg-white/10" />

                <template v-else-if="isLoggedIn">
                    <Button as-child variant="ghost" :class="stavka">
                        <RouterLink to="/izlasci">Moji izlasci</RouterLink>
                    </Button>
                    <Button as-child variant="ghost" :class="stavka">
                        <RouterLink to="/analitika">Analitika</RouterLink>
                    </Button>
                    <Button as-child variant="ghost" :class="[stavka, 'hidden sm:inline-flex']">
                        <RouterLink :to="{ name: 'profil', params: { id: user.uid } }">
                            {{ punoIme }}
                        </RouterLink>
                    </Button>
                    <Button variant="ghost" :class="stavka" @click="odjava">Odjava</Button>
                </template>

                <template v-else>
                    <Button as-child variant="ghost" :class="stavka">
                        <RouterLink to="/login">Prijava</RouterLink>
                    </Button>
                    <Button as-child>
                        <RouterLink to="/register">Registracija</RouterLink>
                    </Button>
                </template>
            </nav>
        </div>
    </header>
</template>
