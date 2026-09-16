<script setup>
import { computed, onMounted, ref } from 'vue'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { db } from '@/firebase.js'
import { useAuthStore } from '@/stores/auth'
import { useSifrarnici } from '@/composables/useSifrarnici.js'
import { fmtDatumKratki } from '@/utils/format.js'
import { najvecaRiba, ukupnoKg } from '@/utils/statistika.js'
import UlovSazetak from '@/components/UlovSazetak.vue'
import { Button } from '@/components/ui/button'
import { FishIcon } from '@lucide/vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'

const props = defineProps({
    id: { type: String, required: true },
})

const authStore = useAuthStore()
const { user } = storeToRefs(authStore)
const { ucitaj: ucitajSifrarnike, nazivVrste } = useSifrarnici()

const profil = ref(null)
const ulovi = ref([])
const ucitavanje = ref(true)
const greska = ref('')

const vlastiti = computed(() => user.value?.uid === props.id)

const fmtMjesec = new Intl.DateTimeFormat('hr-HR', { month: 'long', year: 'numeric' })

async function ucitajUlove() {
    const uvjeti = [where('korisnikId', '==', props.id)]
    if (!vlastiti.value) uvjeti.push(where('vidljivost', '==', 'Javno'))

    const snap = await getDocs(query(collection(db, 'ulovi'), ...uvjeti))

    ulovi.value = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => b.vrijemeUlova.toMillis() - a.vrijemeUlova.toMillis())
}

async function ucitaj() {
    try {
        const snap = await getDoc(doc(db, 'korisnici', props.id))
        if (!snap.exists()) {
            greska.value = 'Ribolovac ne postoji.'
            return
        }
        profil.value = snap.data()

        await Promise.all([ucitajUlove(), ucitajSifrarnike()])
    } catch (e) {
        console.error(e)
        greska.value =
            e.code === 'permission-denied' ? 'Ovaj profil nije javan.' : 'Profil se nije učitao.'
    } finally {
        ucitavanje.value = false
    }
}

onMounted(ucitaj)

const ime = computed(() => {
    const p = profil.value
    if (!p) return ''
    return `${p.ime ?? ''} ${p.prezime ?? ''}`.trim() || 'Ribolovac'
})

const uredjivanje = ref(false)
const formaIme = ref('')
const formaPrezime = ref('')
const spremanje = ref(false)
const greskaForme = ref('')

const mozeSpremiti = computed(
    () => !spremanje.value && !!formaIme.value.trim() && !!formaPrezime.value.trim(),
)

function otvoriUredjivanje() {
    formaIme.value = profil.value?.ime ?? ''
    formaPrezime.value = profil.value?.prezime ?? ''
    greskaForme.value = ''
    uredjivanje.value = true
}

async function spremiProfil() {
    if (!mozeSpremiti.value) return

    greskaForme.value = ''
    spremanje.value = true

    try {
        const noviIme = formaIme.value.trim()
        const noviPrezime = formaPrezime.value.trim()

        await authStore.azurirajProfil(noviIme, noviPrezime)
        profil.value = { ...profil.value, ime: noviIme, prezime: noviPrezime }
        uredjivanje.value = false
        toast.success('Profil je spremljen.')
    } catch (e) {
        console.error(e)
        greskaForme.value =
            e.code === 'permission-denied'
                ? 'Nemate ovlasti za izmjenu ovog profila.'
                : 'Profil nije spremljen. Pokušajte ponovno.'
    } finally {
        spremanje.value = false
    }
}

const najveca = computed(() => najvecaRiba(ulovi.value))

const brojke = computed(() => {
    const komada = ulovi.value.length
    const kg = ukupnoKg(ulovi.value)
    const pusteno = ulovi.value.filter((u) => u.pusten).length
    const vrsta = new Set(ulovi.value.map((u) => u.vrstaRibeId)).size

    return [
        { oznaka: 'Ulova', vrijednost: String(komada) },
        { oznaka: 'Ukupno', vrijednost: `${kg.toFixed(2)} kg` },
        { oznaka: 'Vrsta', vrijednost: String(vrsta) },
        { oznaka: 'Pušteno', vrijednost: String(pusteno) },
    ]
})
</script>

<template>
    <div class="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <p v-if="ucitavanje" class="text-muted-foreground text-sm">Učitavam…</p>

        <Alert v-else-if="greska" variant="destructive">
            <AlertDescription>{{ greska }}</AlertDescription>
        </Alert>

        <template v-else-if="profil">
            <Card>
                <CardHeader>
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <CardTitle>{{ ime }}</CardTitle>
                            <p v-if="profil.datumRegistracije" class="text-muted-foreground text-sm">
                                Član od {{ fmtMjesec.format(profil.datumRegistracije.toDate()) }}
                            </p>
                        </div>

                        <div v-if="vlastiti" class="flex shrink-0 flex-wrap gap-2">
                            <Button variant="outline" size="sm" @click="otvoriUredjivanje">
                                Uredi profil
                            </Button>
                            <Button as-child variant="outline" size="sm">
                                <RouterLink :to="{ name: 'izlasci' }">Moji izlasci</RouterLink>
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent class="space-y-3">
                    <dl class="flex flex-wrap gap-6 border-t pt-3 text-sm">
                        <div v-for="b in brojke" :key="b.oznaka">
                            <dt class="text-muted-foreground">{{ b.oznaka }}</dt>
                            <dd class="font-medium">{{ b.vrijednost }}</dd>
                        </div>
                    </dl>

                    <p v-if="najveca" class="text-muted-foreground text-sm">
                        Najveća ulovljena riba:
                        <RouterLink :to="{ name: 'ulov', params: { id: najveca.id } }"
                            class="text-foreground font-medium underline underline-offset-4">
                            {{ nazivVrste(najveca.vrstaRibeId) }} - {{ najveca.masaKg }} kg
                        </RouterLink>
                    </p>
                </CardContent>
            </Card>

            <section class="space-y-3">
                <h2 class="text-lg font-semibold tracking-tight">
                    {{ vlastiti ? 'Svi moji ulovi' : 'Javni ulovi' }}
                </h2>

                <p v-if="!ulovi.length"
                    class="text-muted-foreground rounded-lg border border-dashed px-4 py-12 text-center text-sm">
                    {{ vlastiti ? 'Još niste zabilježili nijedan ulov.' : 'Ovaj ribolovac još nema javnih ulova.' }}
                </p>

                <ul v-else class="grid gap-3 lg:grid-cols-2">
                    <li v-for="ulov in ulovi" :key="ulov.id">
                        <RouterLink :to="{ name: 'ulov', params: { id: ulov.id } }"
                            class="group bg-card hover:border-foreground/25 flex h-full items-start gap-3 rounded-xl border p-3 transition hover:shadow-sm">
                            <div class="bg-muted size-16 shrink-0 overflow-hidden rounded-lg">
                                <img v-if="ulov.naslovnaUrl" :src="ulov.naslovnaUrl" alt="" loading="lazy"
                                    class="size-full object-cover transition duration-300 group-hover:scale-105" />
                                <div v-else class="text-muted-foreground/50 grid size-full place-items-center">
                                    <FishIcon class="size-1/2" />
                                </div>
                            </div>

                            <UlovSazetak :ulov="ulov"
                                :podnaslov="fmtDatumKratki.format(ulov.vrijemeUlova.toDate())" />
                        </RouterLink>
                    </li>
                </ul>
            </section>

            <Dialog :open="uredjivanje" @update:open="uredjivanje = $event">
                <DialogContent class="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Uredi profil</DialogTitle>
                        <DialogDescription>
                            Ime i prezime prikazuju se uz vaše javne ulove.
                        </DialogDescription>
                    </DialogHeader>

                    <form novalidate class="space-y-4" @submit.prevent="spremiProfil">
                        <Alert v-if="greskaForme" variant="destructive">
                            <AlertDescription>{{ greskaForme }}</AlertDescription>
                        </Alert>

                        <div class="space-y-2">
                            <Label for="profil-ime">Ime</Label>
                            <Input id="profil-ime" v-model="formaIme" type="text" placeholder="Marko"
                                :disabled="spremanje" />
                        </div>

                        <div class="space-y-2">
                            <Label for="profil-prezime">Prezime</Label>
                            <Input id="profil-prezime" v-model="formaPrezime" type="text" placeholder="Markić"
                                :disabled="spremanje" />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" :disabled="spremanje" @click="uredjivanje = false">
                                Odustani
                            </Button>
                            <Button type="submit" :disabled="!mozeSpremiti">
                                {{ spremanje ? 'Spremam…' : 'Spremi' }}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </template>
    </div>
</template>
