<script setup>
import { computed, onMounted, ref } from 'vue'
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { LMap, LMarker, LTileLayer, LTooltip } from '@vue-leaflet/vue-leaflet'
import { db } from '@/firebase.js'
import { useSifrarnici } from '@/composables/useSifrarnici.js'
import { oblik } from '@/utils/format.js'
import { ikonaOznake } from '@/utils/oznaka.js'
import GodinaFilter from '@/components/GodinaFilter.vue'
import UlovKartica from '@/components/UlovKartica.vue'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

const zoom = ref(10)
const center = ref([45.15, 13.9])

const { ucitaj: ucitajSifrarnike, nazivVrste } = useSifrarnici()

const ulovi = ref([])
const autori = ref({})
const ucitavanje = ref(true)
const greska = ref('')
const odabranaGrupa = ref(null)

const filtarVrsta = ref('sve')
const filtarGodina = ref('sve')

async function ucitaj() {
    try {
        const [snapUlovi] = await Promise.all([
            getDocs(
                query(
                    collection(db, 'ulovi'),
                    where('vidljivost', '==', 'Javno'),
                    orderBy('vrijemeUlova', 'desc'),
                    limit(200),
                ),
            ),
            ucitajSifrarnike(),
        ])

        ulovi.value = snapUlovi.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((u) => u.lokacija?.gpsSirina != null)
    } catch (e) {
        console.error(e)
        greska.value = 'Ulovi se nisu učitali.'
    } finally {
        ucitavanje.value = false
    }
}

onMounted(ucitaj)

async function ucitajAutore(grupa) {
    const nedostaju = [...new Set(grupa.ulovi.map((u) => u.korisnikId))].filter(
        (id) => id && !(id in autori.value),
    )

    await Promise.all(
        nedostaju.map(async (id) => {
            try {
                const p = (await getDoc(doc(db, 'korisnici', id))).data()
                autori.value[id] = p ? `${p.ime} ${p.prezime}`.trim() : 'Ribolovac'
            } catch (e) {
                console.error(e)
                autori.value[id] = 'Ribolovac'
            }
        }),
    )
}

function otvori(grupa) {
    odabranaGrupa.value = grupa
    ucitajAutore(grupa)
}

const vrsteUPopisu = computed(() => {
    const ids = new Set(ulovi.value.map((u) => u.vrstaRibeId).filter(Boolean))
    return [...ids]
        .map((id) => ({ id, naziv: nazivVrste(id) }))
        .sort((a, b) => a.naziv.localeCompare(b.naziv, 'hr'))
})

const filtrirani = computed(() =>
    ulovi.value.filter(
        (u) =>
            (filtarVrsta.value === 'sve' || u.vrstaRibeId === filtarVrsta.value) &&
            (filtarGodina.value === 'sve' ||
                u.vrijemeUlova.toDate().getFullYear() === Number(filtarGodina.value)),
    ),
)

const filtarAktivan = computed(
    () => filtarVrsta.value !== 'sve' || filtarGodina.value !== 'sve',
)

function ocistiFiltar() {
    filtarVrsta.value = 'sve'
    filtarGodina.value = 'sve'
}


const grupe = computed(() => {
    const mapa = new Map()

    for (const ulov of filtrirani.value) {
        const { gpsSirina, gpsDuzina } = ulov.lokacija
        const kljuc = `${gpsSirina.toFixed(4)},${gpsDuzina.toFixed(4)}`

        if (!mapa.has(kljuc)) {
            mapa.set(kljuc, { kljuc, latLng: [gpsSirina, gpsDuzina], naziv: null, ulovi: [] })
        }

        const grupa = mapa.get(kljuc)
        grupa.ulovi.push(ulov)
        grupa.naziv ??= ulov.lokacija.naziv ?? null
    }

    return [...mapa.values()]
})

const poruka = computed(() => {
    if (ucitavanje.value) return 'Učitavam ulove…'
    if (greska.value) return greska.value
    if (!ulovi.value.length) return 'Još nema javnih ulova.'
    if (!grupe.value.length) return 'Nijedan ulov ne odgovara filtru.'
    return ''
})
</script>

<template>
    <div class="relative h-[calc(100vh-3.5rem)] w-full">
        <LMap v-model:zoom="zoom" :center="center" class="h-full w-full">
            <LTileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors" />

            <LMarker v-for="grupa in grupe" :key="grupa.kljuc" :lat-lng="grupa.latLng"
                :icon="ikonaOznake(grupa.ulovi.length)" @click="otvori(grupa)">
                <LTooltip>
                    {{ grupa.naziv ?? 'Ulov' }}<template v-if="grupa.ulovi.length > 1">
                        · {{ grupa.ulovi.length }} {{ oblik(grupa.ulovi.length, ['ulov', 'ulova', 'ulova'])
                        }}</template>
                </LTooltip>
            </LMarker>
        </LMap>

        <!-- Omotač ne hvata klikove da se karta i dalje može povlačiti pored
             trake; pojedine kontrole ih vraćaju s pointer-events-auto. -->
        <div class="pointer-events-none absolute inset-x-0 top-4 z-10 flex flex-col items-center gap-2 px-4">
            <div v-if="!ucitavanje && !greska && ulovi.length"
                class="bg-background/95 pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-lg border p-2 shadow-sm">
                <Label for="filtar-vrsta" class="sr-only">Vrsta ribe</Label>
                <Select v-model="filtarVrsta">
                    <SelectTrigger id="filtar-vrsta" class="w-40">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="sve">Sve vrste</SelectItem>
                        <SelectItem v-for="v in vrsteUPopisu" :key="v.id" :value="v.id">
                            {{ v.naziv }}
                        </SelectItem>
                    </SelectContent>
                </Select>

                <GodinaFilter id="filtar-godina" v-model="filtarGodina" sve-tekst="Sve godine" skrivena-oznaka
                    :datumi="ulovi.map((u) => u.vrijemeUlova.toDate())" />

                <Button v-if="filtarAktivan" variant="ghost" size="sm" @click="ocistiFiltar">
                    Očisti
                </Button>

                <span class="text-muted-foreground px-1 text-xs tabular-nums">
                    {{ filtrirani.length }} / {{ ulovi.length }}
                </span>
            </div>

            <p v-if="poruka" class="bg-background/90 rounded-full px-3 py-1.5 text-sm shadow"
                :class="greska ? 'text-destructive' : 'text-muted-foreground'">
                {{ poruka }}
            </p>
        </div>
    </div>

    <Dialog :open="!!odabranaGrupa" @update:open="odabranaGrupa = null">
        <!-- Zaglavlje stoji na mjestu, a kartice se pomiču ispod njega kad ih
             na istom mjestu ima više nego što stane na ekran. -->
        <DialogContent class="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
            <DialogHeader class="border-b px-4 pt-4 pb-3 pr-12">
                <DialogTitle>{{ odabranaGrupa?.naziv ?? 'Ulovi na ovom mjestu' }}</DialogTitle>
                <DialogDescription>
                    {{ odabranaGrupa?.ulovi.length }}
                    {{ oblik(odabranaGrupa?.ulovi.length ?? 0, ['ulov', 'ulova', 'ulova']) }}
                </DialogDescription>
            </DialogHeader>

            <ul class="bg-muted/50 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
                <li v-for="ulov in odabranaGrupa?.ulovi" :key="ulov.id">
                    <UlovKartica :ulov="ulov" :autor="autori[ulov.korisnikId] ?? null" />
                </li>
            </ul>
        </DialogContent>
    </Dialog>
</template>
