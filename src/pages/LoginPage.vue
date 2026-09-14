<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const router = useRouter()
const { login } = useAuthStore()

const email = ref('')
const lozinka = ref('')
const submitting = ref(false)
const greska = ref('')

const mozeSpremiti = computed(
    () => !submitting.value && email.value.length > 0 && lozinka.value.length >= 6,
)

async function prijava() {
    if (!mozeSpremiti.value) return

    greska.value = ''
    submitting.value = true

    try {
        await login(email.value, lozinka.value)
        toast.success('Prijavljeni ste.')
        router.push({ name: 'home' })
    } catch (e) {
        console.error(e)
        greska.value = 'Pogrešan email ili lozinka.'
        submitting.value = false
    }
}
</script>

<template>
    <div class="mx-auto max-w-sm px-4 py-10">
        <Card>
            <CardHeader>
                <CardTitle>Prijava</CardTitle>
                <CardDescription>Prijavite se s email adresom i lozinkom.</CardDescription>
            </CardHeader>

            <CardContent>
                <form novalidate class="space-y-5" @submit.prevent="prijava">
                    <Alert v-if="greska" variant="destructive">
                        <AlertDescription>{{ greska }}</AlertDescription>
                    </Alert>

                    <div class="space-y-2">
                        <Label for="email">Email</Label>
                        <Input id="email" v-model.trim="email" type="email" autocomplete="email"
                            placeholder="ime@primjer.com" :disabled="submitting" />
                    </div>

                    <div class="space-y-2">
                        <Label for="lozinka">Lozinka</Label>
                        <Input id="lozinka" v-model="lozinka" type="password" autocomplete="current-password"
                            placeholder="••••••••" :disabled="submitting" />
                    </div>

                    <Button type="submit" size="lg" class="w-full" :disabled="!mozeSpremiti">
                        {{ submitting ? 'Prijavljujem…' : 'Prijavi se' }}
                    </Button>

                    <p class="text-muted-foreground text-center text-sm">
                        Nemate račun?
                        <RouterLink to="/register" class="text-foreground font-medium underline underline-offset-4">
                            Registrirajte se
                        </RouterLink>
                    </p>
                </form>
            </CardContent>
        </Card>
    </div>
</template>
