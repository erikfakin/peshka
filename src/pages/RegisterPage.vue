<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useFlashStore } from '@/stores/flash.js'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const { setFlash } = useFlashStore()

const { register } = useAuthStore()

const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const submitting = ref(false)
const formError = ref('')




const passwordTooShort = computed(
    () => password.value.length > 0 && password.value.length < 6,
)

const passwordsMismatch = computed(
    () => passwordConfirm.value.length > 0 && password.value !== passwordConfirm.value,
)

const canSubmit = computed(
    () =>
        !submitting.value &&
        email.value.length > 0 &&
        password.value.length >= 6 &&
        password.value === passwordConfirm.value,
)

async function submitRegister() {
    if (!canSubmit.value) return

    formError.value = ''
    submitting.value = true

    try {
        await register(email.value, password.value)
        setFlash('Račun je otvoren. Dobro došli!')
        router.push({ name: 'home' })
    } catch (error) {
        formError.value = error.code
        submitting.value = false
    }
}

const baseField =
    'w-full rounded-md border bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 ' +
    'transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50'
const fieldIdle = 'border-slate-300 focus:border-slate-900 focus:ring-slate-900/15'
const fieldInvalid = 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
</script>

<template>
    <div class="flex justify-center">
        <form novalidate
            class="w-full max-w-sm space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
            @submit.prevent="submitRegister">
            <header class="space-y-1">
                <h1 class="text-xl font-semibold tracking-tight text-slate-900">Registracija</h1>
                <p class="text-sm text-slate-500">Otvorite račun s email adresom i lozinkom.</p>
            </header>

            <p v-if="formError" class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {{ formError }}
            </p>

            <div class="space-y-1.5">
                <label for="email" class="block text-sm font-medium text-slate-700">Email</label>
                <input id="email" v-model.trim="email" type="email" autocomplete="email" required
                    placeholder="ime@primjer.com" :disabled="submitting" :class="[baseField, fieldIdle]" />
            </div>

            <div class="space-y-1.5">
                <label for="password" class="block text-sm font-medium text-slate-700">Lozinka</label>
                <input id="password" v-model="password" type="password" autocomplete="new-password" required
                    placeholder="••••••••" :disabled="submitting" :aria-invalid="passwordTooShort"
                    aria-describedby="password-hint"
                    :class="[baseField, passwordTooShort ? fieldInvalid : fieldIdle]" />
                <p id="password-hint" class="text-xs" :class="passwordTooShort ? 'text-rose-600' : 'text-slate-500'">
                    Najmanje 6 znakova.
                </p>
            </div>

            <div class="space-y-1.5">
                <label for="password-confirm" class="block text-sm font-medium text-slate-700">
                    Ponovite lozinku
                </label>
                <input id="password-confirm" v-model="passwordConfirm" type="password" autocomplete="new-password"
                    required placeholder="••••••••" :disabled="submitting" :aria-invalid="passwordsMismatch"
                    :class="[baseField, passwordsMismatch ? fieldInvalid : fieldIdle]" />
                <p v-if="passwordsMismatch" class="text-xs text-rose-600">
                    Lozinke se ne podudaraju.
                </p>
            </div>

            <button type="submit" :disabled="!canSubmit" class="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5
               text-sm font-medium text-white transition hover:bg-slate-800
               focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2
               disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">
                <svg v-if="submitting" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                </svg>
                {{ submitting ? 'Otvaramo račun…' : 'Registriraj se' }}
            </button>

            <p class="text-center text-sm text-slate-500">
                Već imate račun?
                <RouterLink to="/login"
                    class="font-medium text-slate-900 underline underline-offset-4 hover:text-slate-700">
                    Prijavite se
                </RouterLink>
            </p>
        </form>
    </div>
</template>