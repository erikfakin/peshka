<script setup>
import { computed, onMounted, ref } from 'vue'
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    increment,
    orderBy,
    query,
    updateDoc,
    where,
} from 'firebase/firestore'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { db } from '@/firebase.js'
import { useAuthStore } from '@/stores/auth'
import { useSifrarnici } from '@/composables/useSifrarnici.js'
import { obrisiFotografijeUlova, ucitajFotografijeIzlaska } from '@/utils/fotografije.js'
import { fmtSat, oblik } from '@/utils/format.js'
import { ukupnoKg } from '@/utils/statistika.js'
import UlovForma from '@/components/UlovForma.vue'
import UlovSazetak from '@/components/UlovSazetak.vue'
import PregledSlike from '@/components/PregledSlike.vue'
import PotvrdaDialog from '@/components/PotvrdaDialog.vue'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const props = defineProps({
    id: { type: String, required: true },
})

const router = useRouter()
const { user } = storeToRefs(useAuthStore())
const { ucitaj: ucitajSifrarnike, nazivVrste, nazivNacina, nazivMamca } = useSifrarnici()

const izlazak = ref(null)
const ulovi = ref([])
const fotografije = ref({})

const ucitavanje = ref(true)
const greska = ref('')
const formaOtvorena = ref(false)
const ulovZaUredjivanje = ref(null) // null = forma radi novi ulov
const pregled = ref(null)
const zaBrisanje = ref(null)
const brisanjeIzlaska = ref(false)
const brisem = ref(false)

const fmtDatum = new Intl.DateTimeFormat('hr-HR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
})

function podnaslov(ulov) {
    return [
        fmtSat.format(ulov.vrijemeUlova.toDate()),
        nazivNacina(ulov.nacinLovaId),
        nazivMamca(ulov.mamacId),
    ]
        .filter(Boolean)
        .join(' · ')
}

async function ucitajUlove() {
    if (!user.value) return
    const snap = await getDocs(
        query(
            collection(db, 'ulovi'),
            where('izlazakId', '==', props.id),
            where('korisnikId', '==', user.value.uid),
            orderBy('vrijemeUlova'),
        ),
    )
    ulovi.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

async function ucitajFotke() {
    if (!user.value) return
    try {
        fotografije.value = await ucitajFotografijeIzlaska(props.id, user.value.uid)
    } catch (e) {
        console.error(e)
        fotografije.value = {}
    }
}

async function ucitaj() {
    greska.value = ''

    try {
        const snap = await getDoc(doc(db, 'izlasci', props.id))
        if (!snap.exists()) {
            greska.value = 'Izlazak ne postoji.'
            return
        }

        izlazak.value = { id: snap.id, ...snap.data() }
        await Promise.all([ucitajUlove(), ucitajSifrarnike(), ucitajFotke()])
    } catch (e) {
        console.error(e)
        greska.value =
            e.code === 'permission-denied'
                ? 'Nemate pristup ovom izlasku.'
                : 'Podaci se nisu učitali.'
    } finally {
        ucitavanje.value = false
    }
}

onMounted(ucitaj)

function otvoriFormu(ulov = null) {
    ulovZaUredjivanje.value = ulov
    formaOtvorena.value = true
}

function zatvoriFormu() {
    formaOtvorena.value = false
    ulovZaUredjivanje.value = null
}

async function naSpremljeno({ novo }) {
    zatvoriFormu()
    await Promise.all([ucitajUlove(), ucitajFotke()])
    if (novo) izlazak.value.brojUlova = (izlazak.value.brojUlova ?? 0) + 1
}

async function obrisiUlov() {
    const ulov = zaBrisanje.value
    zaBrisanje.value = null
    if (!user.value) return

    try {
        await obrisiFotografijeUlova(ulov.id, user.value.uid)
        await deleteDoc(doc(db, 'ulovi', ulov.id))
        await updateDoc(doc(db, 'izlasci', props.id), { brojUlova: increment(-1) })

        ulovi.value = ulovi.value.filter((z) => z.id !== ulov.id)
        delete fotografije.value[ulov.id]
        izlazak.value.brojUlova = Math.max(0, (izlazak.value.brojUlova ?? 1) - 1)
        if (ulovZaUredjivanje.value?.id === ulov.id) zatvoriFormu()
    } catch (e) {
        console.error(e)
        greska.value = 'Brisanje nije uspjelo.'
    }
}


async function obrisiIzlazak() {
    brisanjeIzlaska.value = false
    brisem.value = true
    greska.value = ''

    try {
        await Promise.all(
            ulovi.value.map(async (ulov) => {
                await obrisiFotografijeUlova(ulov.id, user.value.uid)
                await deleteDoc(doc(db, 'ulovi', ulov.id))
            }),
        )
        await deleteDoc(doc(db, 'izlasci', props.id))

        toast.success('Izlazak je obrisan.')
        router.push({ name: 'izlasci' })
    } catch (e) {
        console.error(e)
        greska.value = 'Izlazak nije obrisan do kraja. Pokušajte ponovno.'
        brisem.value = false
        await ucitajUlove()
    }
}

const ukupno = computed(() => ({
    komada: ulovi.value.length,
    kg: ukupnoKg(ulovi.value),
    pusteno: ulovi.value.filter((u) => u.pusten).length,
}))

const pocetnaLokacija = computed(() => ({
    gpsSirina: izlazak.value.gpsSirina,
    gpsDuzina: izlazak.value.gpsDuzina,
}))

const uvjetiRedci = computed(() => {
    const u = izlazak.value?.uvjetiNaMoru
    if (!u) return []
    return [
        u.smjerVjetra && `${u.smjerVjetra}${u.brzinaVjetraCv ? ` ${u.brzinaVjetraCv} čv` : ''}`,
        u.stanjeMora,
        u.tempZrakaC != null && `zrak ${u.tempZrakaC} °C`,
        u.tempMoraC != null && `more ${u.tempMoraC} °C`,
        u.tlakHpa != null && `${u.tlakHpa} hPa`,
    ].filter(Boolean)
})
</script>

<template>
    <div class="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <p v-if="ucitavanje" class="text-muted-foreground text-sm">Učitavam…</p>

        <Alert v-else-if="greska && !izlazak" variant="destructive">
            <AlertDescription>{{ greska }}</AlertDescription>
        </Alert>

        <template v-else-if="izlazak">
            <Button as-child variant="link" size="xs" class="text-muted-foreground px-0">
                <RouterLink :to="{ name: 'izlasci' }">← Svi izlasci</RouterLink>
            </Button>

            <Card>
                <CardHeader class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <CardTitle>{{ izlazak.naziv }}</CardTitle>
                        <p class="text-muted-foreground text-sm">
                            {{ fmtDatum.format(izlazak.vrijemeOd.toDate()) }} ·
                            {{ fmtSat.format(izlazak.vrijemeOd.toDate()) }}<template v-if="izlazak.vrijemeDo"> – {{
                                fmtSat.format(izlazak.vrijemeDo.toDate()) }}</template>
                        </p>
                    </div>

                    <div class="flex shrink-0 gap-1">
                        <Button as-child variant="outline" size="sm">
                            <RouterLink :to="{ name: 'uredi-izlazak', params: { id: izlazak.id } }">
                                Uredi
                            </RouterLink>
                        </Button>
                        <Button variant="ghost" size="sm" class="text-muted-foreground hover:text-destructive"
                            :disabled="brisem" @click="brisanjeIzlaska = true">
                            {{ brisem ? 'Brišem…' : 'Obriši' }}
                        </Button>
                    </div>
                </CardHeader>

                <CardContent class="space-y-3">
                    <p v-if="izlazak.biljeska" class="text-sm">{{ izlazak.biljeska }}</p>

                    <div v-if="uvjetiRedci.length" class="flex flex-wrap gap-2">
                        <span v-for="red in uvjetiRedci" :key="red"
                            class="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs">
                            {{ red }}
                        </span>
                    </div>

                    <dl class="flex gap-6 border-t pt-3 text-sm">
                        <div>
                            <dt class="text-muted-foreground">Komada</dt>
                            <dd class="font-medium">{{ ukupno.komada }}</dd>
                        </div>
                        <div>
                            <dt class="text-muted-foreground">Ukupno</dt>
                            <dd class="font-medium">{{ ukupno.kg.toFixed(2) }} kg</dd>
                        </div>
                        <div>
                            <dt class="text-muted-foreground">Pušteno</dt>
                            <dd class="font-medium">{{ ukupno.pusteno }}</dd>
                        </div>
                    </dl>
                </CardContent>
            </Card>

            <Alert v-if="greska" variant="destructive">
                <AlertDescription>{{ greska }}</AlertDescription>
            </Alert>

            <section class="space-y-3">
                <div class="flex items-center justify-between">
                    <h2 class="text-lg font-semibold tracking-tight">Ulovi</h2>
                    <Button v-if="!formaOtvorena" @click="otvoriFormu()">Dodaj ulov +</Button>
                </div>

                <p v-if="!ulovi.length && !formaOtvorena"
                    class="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
                    Još nema zabilježenih ulova.
                </p>

                <ul v-else-if="ulovi.length" class="space-y-2">
                    <li v-for="ulov in ulovi" :key="ulov.id"
                        class="bg-card flex items-start justify-between gap-4 rounded-xl border p-3"
                        :class="ulovZaUredjivanje?.id === ulov.id ? 'border-foreground' : ''">
                        <UlovSazetak :ulov="ulov" :podnaslov="podnaslov(ulov)" poveznica>
                            <div v-if="fotografije[ulov.id]?.length" class="flex flex-wrap gap-1.5 pt-1">
                                <button v-for="foto in fotografije[ulov.id]" :key="foto.id" type="button"
                                    class="focus-visible:ring-ring overflow-hidden rounded-md outline-none focus-visible:ring-2"
                                    @click="pregled = { url: foto.url, opis: nazivVrste(ulov.vrstaRibeId) }">
                                    <img :src="foto.url" :alt="nazivVrste(ulov.vrstaRibeId)" loading="lazy" width="64"
                                        height="64" class="bg-muted size-16 object-cover transition hover:opacity-80" />
                                </button>
                            </div>
                        </UlovSazetak>

                        <div class="flex shrink-0 gap-1">
                            <Button variant="ghost" size="sm" @click="otvoriFormu(ulov)">Uredi</Button>
                            <Button variant="ghost" size="sm" class="text-muted-foreground hover:text-destructive"
                                @click="zaBrisanje = ulov">
                                Obriši
                            </Button>
                        </div>
                    </li>
                </ul>

                <UlovForma v-if="formaOtvorena" :key="ulovZaUredjivanje?.id ?? `novi-${ulovi.length}`"
                    :ulov="ulovZaUredjivanje"
                    :postojece-fotografije="ulovZaUredjivanje ? (fotografije[ulovZaUredjivanje.id] ?? []) : []"
                    :izlazak-id="izlazak.id" :vrijeme-od="izlazak.vrijemeOd.toDate()"
                    :vrijeme-do="izlazak.vrijemeDo?.toDate() ?? null" :pocetna-lokacija="pocetnaLokacija"
                    @spremljeno="naSpremljeno" @odustani="zatvoriFormu" />
            </section>
        </template>

        <PregledSlike v-model:slika="pregled" />

        <PotvrdaDialog :open="!!zaBrisanje" naslov="Obrisati ulov?"
            :opis="zaBrisanje ? `${nazivVrste(zaBrisanje.vrstaRibeId)} i pripadajuće fotografije brišu se trajno.` : ''"
            @update:open="zaBrisanje = null" @potvrda="obrisiUlov" />

        <PotvrdaDialog :open="brisanjeIzlaska" naslov="Obrisati izlazak?" :opis="ulovi.length
            ? `Trajno se brišu i ${ulovi.length} ${oblik(ulovi.length, ['ulov', 'ulova', 'ulova'])} s fotografijama.`
            : 'Izlazak se briše trajno.'" @update:open="brisanjeIzlaska = $event" @potvrda="obrisiIzlazak" />
    </div>
</template>
