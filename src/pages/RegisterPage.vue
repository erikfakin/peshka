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
const { register } = useAuthStore()

const email = ref('')
const ime = ref('')
const prezime = ref('')
const lozinka = ref('')
const potvrda = ref('')
const submitting = ref(false)
const greska = ref('')

const kratkaLozinka = computed(() => lozinka.value.length > 0 && lozinka.value.length < 6)
const lozinkeSeRazlikuju = computed(
    () => potvrda.value.length > 0 && lozinka.value !== potvrda.value,
)

const mozeSpremiti = computed(
    () =>
        !submitting.value &&
        email.value.length > 0 &&
        ime.value.length > 0 &&
        prezime.value.length > 0 &&
        lozinka.value.length >= 6 &&
        lozinka.value === potvrda.value,
)

async function registracija() {
    if (!mozeSpremiti.value) return

    greska.value = ''
    submitting.value = true

    try {
        await register(email.value, lozinka.value, ime.value, prezime.value)
        toast.success('Račun je otvoren. Dobro došli!')
        router.push({ name: 'home' })
    } catch (e) {
        console.error(e)
        greska.value =
            e.code === 'auth/email-already-in-use'
                ? 'Ta email adresa je već registrirana.'
                : 'Registracija nije uspjela. Pokušajte ponovno.'
        submitting.value = false
    }
}
</script>

<template>
    <div class="mx-auto max-w-md px-4 py-10">
        <Card>
            <CardHeader>
                <CardTitle>Registracija</CardTitle>
                <CardDescription>Otvorite račun s email adresom i lozinkom.</CardDescription>
            </CardHeader>

            <CardContent>
                <form novalidate class="space-y-5" @submit.prevent="registracija">
                    <Alert v-if="greska" variant="destructive">
                        <AlertDescription>{{ greska }}</AlertDescription>
                    </Alert>

                    <div class="space-y-2">
                        <Label for="email">Email</Label>
                        <Input id="email" v-model.trim="email" type="email" autocomplete="email"
                            placeholder="ime@primjer.com" :disabled="submitting" />
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-2">
                            <Label for="ime">Ime</Label>
                            <Input id="ime" v-model.trim="ime" type="text" placeholder="Marko"
                                :disabled="submitting" />
                        </div>
                        <div class="space-y-2">
                            <Label for="prezime">Prezime</Label>
                            <Input id="prezime" v-model.trim="prezime" type="text" placeholder="Markić"
                                :disabled="submitting" />
                        </div>
                    </div>

                    <div class="space-y-2">
                        <Label for="lozinka">Lozinka</Label>
                        <Input id="lozinka" v-model="lozinka" type="password" autocomplete="new-password"
                            placeholder="••••••••" :disabled="submitting" :aria-invalid="kratkaLozinka" />
                        <p class="text-xs" :class="kratkaLozinka ? 'text-destructive' : 'text-muted-foreground'">
                            Najmanje 6 znakova.
                        </p>
                    </div>

                    <div class="space-y-2">
                        <Label for="potvrda">Ponovite lozinku</Label>
                        <Input id="potvrda" v-model="potvrda" type="password" autocomplete="new-password"
                            placeholder="••••••••" :disabled="submitting" :aria-invalid="lozinkeSeRazlikuju" />
                        <p v-if="lozinkeSeRazlikuju" class="text-destructive text-xs">
                            Lozinke se ne podudaraju.
                        </p>
                    </div>

                    <Button type="submit" size="lg" class="w-full" :disabled="!mozeSpremiti">
                        {{ submitting ? 'Otvaram račun…' : 'Registriraj se' }}
                    </Button>

                    <p class="text-muted-foreground text-center text-sm">
                        Već imate račun?
                        <RouterLink to="/login" class="text-foreground font-medium underline underline-offset-4">
                            Prijavite se
                        </RouterLink>
                    </p>
                </form>
            </CardContent>
        </Card>
    </div>
</template>
