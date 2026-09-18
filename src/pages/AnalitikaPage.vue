<script setup>
import { computed, onMounted, ref } from 'vue'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { storeToRefs } from 'pinia'
import { db } from '@/firebase.js'
import { useAuthStore } from '@/stores/auth'
import { useSifrarnici } from '@/composables/useSifrarnici.js'
import { VJETROVI } from '@/utils/meteo.js'
import { MIJENE } from '@/utils/astro.js'
import { oblik } from '@/utils/format.js'
import { najvecaRiba, ukupnoKg } from '@/utils/statistika.js'
import GodinaFilter from '@/components/GodinaFilter.vue'
import TrakaGraf from '@/components/TrakaGraf.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const { user } = storeToRefs(useAuthStore())
const { ucitaj: ucitajSifrarnike, nazivVrste, nazivNacina, nazivMamca } = useSifrarnici()

const izlasci = ref([])
const ulovi = ref([])
const godina = ref('sve')
const ucitavanje = ref(true)
const greska = ref('')

const DIJELOVI_DANA = ['zora', 'dan', 'sumrak', 'noć']
const STANJA_MORA = ['Mirno', 'Valovito', 'Uzburkano']
const TRENDOVI = ['raste', 'stabilno', 'pada']
const MJESECI = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat('hr-HR', { month: 'long' }).format(new Date(2024, i, 1)),
)

async function ucitaj() {
    if (!user.value) return

    try {
        const moji = where('korisnikId', '==', user.value.uid)
        const [snapIzlasci, snapUlovi] = await Promise.all([
            getDocs(query(collection(db, 'izlasci'), moji)),
            getDocs(query(collection(db, 'ulovi'), moji)),
            ucitajSifrarnike(),
        ])

        izlasci.value = snapIzlasci.docs.map((d) => ({ id: d.id, ...d.data() }))
        ulovi.value = snapUlovi.docs.map((d) => ({ id: d.id, ...d.data() }))
    } catch (e) {
        console.error(e)
        greska.value = 'Podaci se nisu učitali.'
    } finally {
        ucitavanje.value = false
    }
}

onMounted(ucitaj)

function uGodini(datum) {
    return godina.value === 'sve' || datum.toDate().getFullYear() === Number(godina.value)
}

const mojiIzlasci = computed(() => izlasci.value.filter((i) => uGodini(i.vrijemeOd)))

const mojiUlovi = computed(() => {
    const dopusteni = new Set(mojiIzlasci.value.map((i) => i.id))
    return ulovi.value.filter((u) => dopusteni.has(u.izlazakId))
})

function poduljina(redci, vrh) {
    const poredani = [...redci].sort((a, b) => b.vrijednost - a.vrijednost)
    if (!vrh || poredani.length <= vrh) return poredani

    const ostatak = poredani.slice(vrh).reduce((z, r) => z + r.vrijednost, 0)
    const vrhovi = poredani.slice(0, vrh)
    if (ostatak) vrhovi.push({ oznaka: 'Ostalo', vrijednost: ostatak })
    return vrhovi
}

function poUlovu(kljucFn, { redoslijed = null, vrh = null } = {}) {
    const grupe = new Map()

    for (const ulov of mojiUlovi.value) {
        const kljuc = kljucFn(ulov)
        if (!kljuc) continue
        grupe.set(kljuc, (grupe.get(kljuc) ?? 0) + 1)
    }

    const redci = [...grupe].map(([oznaka, vrijednost]) => ({ oznaka, vrijednost }))

    if (!redoslijed) return poduljina(redci, vrh)
    return redci.sort((a, b) => redoslijed.indexOf(a.oznaka) - redoslijed.indexOf(b.oznaka))
}

function poIzlasku(kljucFn, { redoslijed = null } = {}) {
    const ulovaPoIzlasku = new Map()
    for (const ulov of mojiUlovi.value) {
        ulovaPoIzlasku.set(ulov.izlazakId, (ulovaPoIzlasku.get(ulov.izlazakId) ?? 0) + 1)
    }

    const grupe = new Map()
    for (const izlazak of mojiIzlasci.value) {
        const kljuc = kljucFn(izlazak)
        if (!kljuc) continue
        if (!grupe.has(kljuc)) grupe.set(kljuc, { izlazaka: 0, ulova: 0 })

        const g = grupe.get(kljuc)
        g.izlazaka += 1
        g.ulova += ulovaPoIzlasku.get(izlazak.id) ?? 0
    }

    const redci = [...grupe].map(([oznaka, g]) => ({
        oznaka,
        vrijednost: g.ulova / g.izlazaka,
        opis: `${g.izlazaka} ${oblik(g.izlazaka, ['izlazak', 'izlaska', 'izlazaka'])}`,
    }))

    if (!redoslijed) return redci.sort((a, b) => b.vrijednost - a.vrijednost)
    return redci.sort((a, b) => redoslijed.indexOf(a.oznaka) - redoslijed.indexOf(b.oznaka))
}

const najveca = computed(() => najvecaRiba(mojiUlovi.value))

const brojke = computed(() => {
    const brojIzlazaka = mojiIzlasci.value.length
    const brojUlova = mojiUlovi.value.length
    const kg = ukupnoKg(mojiUlovi.value)
    const prazni = mojiIzlasci.value.filter(
        (i) => !mojiUlovi.value.some((u) => u.izlazakId === i.id),
    ).length

    return [
        { oznaka: 'Izlazaka', vrijednost: String(brojIzlazaka) },
        { oznaka: 'Ulova', vrijednost: String(brojUlova) },
        { oznaka: 'Ukupno', vrijednost: `${kg.toFixed(1)} kg` },
        {
            oznaka: 'Ulova po izlasku',
            vrijednost: brojIzlazaka ? (brojUlova / brojIzlazaka).toFixed(1) : '-',
        },
        { oznaka: 'Bez ulova', vrijednost: String(prazni) },
    ]
})

const poVrsti = computed(() => poUlovu((u) => nazivVrste(u.vrstaRibeId), { vrh: 8 }))
const poNacinu = computed(() => poUlovu((u) => nazivNacina(u.nacinLovaId), { vrh: 8 }))
const poMamcu = computed(() => poUlovu((u) => nazivMamca(u.mamacId), { vrh: 8 }))

const poDijeluDana = computed(() =>
    poUlovu((u) => u.sunce?.dio, { redoslijed: DIJELOVI_DANA }),
)
const poMjesecuUGodini = computed(() =>
    poUlovu((u) => MJESECI[u.vrijemeUlova.toDate().getMonth()], { redoslijed: MJESECI }),
)
const poMijeni = computed(() => poUlovu((u) => u.mjesec?.naziv, { redoslijed: MIJENE }))
const poTrenduTlaka = computed(() => poUlovu((u) => u.trendTlaka?.smjer, { redoslijed: TRENDOVI }))

const poVjetru = computed(() =>
    poIzlasku((i) => i.uvjetiNaMoru?.smjerVjetra, { redoslijed: VJETROVI }),
)
const poStanjuMora = computed(() =>
    poIzlasku((i) => i.uvjetiNaMoru?.stanjeMora, { redoslijed: STANJA_MORA }),
)
const poMjestu = computed(() => poIzlasku((i) => i.mjesto))

const imaPodataka = computed(() => mojiIzlasci.value.length > 0)
</script>

<template>
    <div class="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div class="flex flex-wrap items-center justify-between gap-4">
            <h1 class="text-2xl font-semibold tracking-tight">Analitika</h1>

            <GodinaFilter v-if="!ucitavanje && izlasci.length" v-model="godina"
                :datumi="izlasci.map((i) => i.vrijemeOd.toDate())" />
        </div>

        <p v-if="ucitavanje" class="text-muted-foreground text-sm">Učitavam…</p>

        <Alert v-else-if="greska" variant="destructive">
            <AlertDescription>{{ greska }}</AlertDescription>
        </Alert>

        <p v-else-if="!imaPodataka"
            class="text-muted-foreground rounded-lg border border-dashed px-4 py-12 text-center text-sm">
            Nema izlazaka za prikaz. Zabilježite izlazak pa se ovdje počinje skupljati statistika.
        </p>

        <template v-else>
            <Card>
                <CardContent>
                    <dl class="flex flex-wrap gap-x-10 gap-y-4">
                        <div v-for="b in brojke" :key="b.oznaka">
                            <dt class="text-muted-foreground text-sm">{{ b.oznaka }}</dt>
                            <dd class="text-xl font-semibold tabular-nums">{{ b.vrijednost }}</dd>
                        </div>
                    </dl>

                    <p v-if="najveca" class="text-muted-foreground mt-4 border-t pt-4 text-sm">
                        Najveća riba:
                        <RouterLink :to="{ name: 'ulov', params: { id: najveca.id } }"
                            class="text-foreground font-medium underline underline-offset-4">
                            {{ nazivVrste(najveca.vrstaRibeId) }} -
                            {{ najveca.masaKg }} kg
                        </RouterLink>
                    </p>
                </CardContent>
            </Card>

            <!-- Sve u ovoj sekciji broji komade ulovljene ribe. -->
            <section class="space-y-4">
                <h2 class="text-lg font-semibold tracking-tight">Što sam lovio</h2>

                <div class="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle class="text-base">Po vrsti</CardTitle>
                            <CardDescription>Broj ulovljenih komada.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TrakaGraf :redci="poVrsti" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle class="text-base">Po načinu lova</CardTitle>
                            <CardDescription>Broj ulovljenih komada.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TrakaGraf :redci="poNacinu" />
                        </CardContent>
                    </Card>

                    <Card class="md:col-span-2">
                        <CardHeader>
                            <CardTitle class="text-base">Po mamcu</CardTitle>
                            <CardDescription>Ulovi bez upisanog mamca nisu uračunati.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TrakaGraf :redci="poMamcu" />
                        </CardContent>
                    </Card>
                </div>
            </section>

            <section class="space-y-4">
                <h2 class="text-lg font-semibold tracking-tight">Kada</h2>

                <div class="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle class="text-base">Po dijelu dana</CardTitle>
                            <CardDescription>Broj ulovljenih komada.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TrakaGraf :redci="poDijeluDana" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle class="text-base">Po mjesečevoj mijeni</CardTitle>
                            <CardDescription>Broj ulovljenih komada.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TrakaGraf :redci="poMijeni" />
                        </CardContent>
                    </Card>

                    <Card class="md:col-span-2">
                        <CardHeader>
                            <CardTitle class="text-base">Po mjesecu u godini</CardTitle>
                            <CardDescription>Broj ulovljenih komada.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TrakaGraf :redci="poMjesecuUGodini" />
                        </CardContent>
                    </Card>
                </div>
            </section>

            <section class="space-y-4">
                <h2 class="text-lg font-semibold tracking-tight">Uvjeti</h2>

                <p class="text-muted-foreground text-sm">
                    Grafovi u ovoj sekciji dijele ulove s brojem izlazaka u istim uvjetima. Bez toga
                    bi uvjeti u kojima se najčešće izlazi uvijek izgledali najbolje.
                </p>

                <div class="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle class="text-base">Vjetar na polasku</CardTitle>
                            <CardDescription>Ulova po izlasku.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TrakaGraf :redci="poVjetru" :decimala="1" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle class="text-base">Stanje mora na polasku</CardTitle>
                            <CardDescription>Ulova po izlasku.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TrakaGraf :redci="poStanjuMora" :decimala="1" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle class="text-base">Po mjestu</CardTitle>
                            <CardDescription>Ulova po izlasku.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TrakaGraf :redci="poMjestu" :decimala="1" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle class="text-base">Trend tlaka u trenutku ulova</CardTitle>
                            <CardDescription>Broj ulovljenih komada.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TrakaGraf :redci="poTrenduTlaka" />
                        </CardContent>
                    </Card>
                </div>
            </section>
        </template>
    </div>
</template>
