<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
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
import { db } from '@/firebase.js'
import UlovForma from '@/components/UlovForma.vue'
import { obrisiFotografijeUlova, ucitajFotografijeIzlaska } from '@/utils/fotografije.js'
import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'

const props = defineProps({
    id: { type: String, required: true },
})

const izlazak = ref(null)
const ulovi = ref([])
const fotografije = ref({})
const sifrarnici = ref({ vrste: {}, nacini: {}, mamci: {} })

const ucitavanje = ref(true)
const greska = ref('')
const formaOtvorena = ref(false)
const ulovZaUredjivanje = ref(null) // null , forma radi novi ulov
const pregled = ref(null)

const authStore = useAuthStore()
const { user } = storeToRefs(authStore)

const fmtDatum = new Intl.DateTimeFormat('hr-HR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
})
const fmtSat = new Intl.DateTimeFormat('hr-HR', { hour: '2-digit', minute: '2-digit' })

function uMapu(snap, polje) {
    return Object.fromEntries(snap.docs.map((d) => [d.id, d.data()[polje]]))
}

function nazivVrste(ulov) {
    return sifrarnici.value.vrste[ulov.vrstaRibeId] ?? 'Nepoznata vrsta'
}

async function ucitajSifrarnike() {
    const [vr, nl, mm] = await Promise.all([
        getDocs(collection(db, 'vrsteRibe')),
        getDocs(collection(db, 'naciniLova')),
        getDocs(collection(db, 'mamci')),
    ])
    sifrarnici.value = {
        vrste: uMapu(vr, 'nazivHr'),
        nacini: uMapu(nl, 'naziv'),
        mamci: uMapu(mm, 'naziv'),
    }
}

async function ucitajUlove() {
    if (!user.value) return
    const q = query(
        collection(db, 'ulovi'),
        where('izlazakId', '==', props.id),
        where('korisnikId', '==', user.value.uid),
        orderBy('vrijemeUlova'),
    )
    const snap = await getDocs(q)
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


function noviUlov() {
    ulovZaUredjivanje.value = null
    formaOtvorena.value = true
}

function urediUlov(ulov) {
    ulovZaUredjivanje.value = ulov
    formaOtvorena.value = true
}

function zatvoriFormu() {
    formaOtvorena.value = false
    ulovZaUredjivanje.value = null
}

async function naSpremljeno({ novo } = { novo: true }) {
    zatvoriFormu()
    await Promise.all([ucitajUlove(), ucitajFotke()])
    if (novo && izlazak.value) izlazak.value.brojUlova = (izlazak.value.brojUlova ?? 0) + 1
}

async function obrisiUlov(ulov) {
    if (!confirm(`Obrisati ulov (${nazivVrste(ulov)})?`)) return
    if (!user.value) return

    try {
        // Prvo fotografije, inače u Storageu ostaju datoteke bez vlasnika.
        await obrisiFotografijeUlova(ulov.id, user.value.uid)
        await deleteDoc(doc(db, 'ulovi', ulov.id))
        await updateDoc(doc(db, 'izlasci', props.id), { brojUlova: increment(-1) })

        ulovi.value = ulovi.value.filter((u) => u.id !== ulov.id)
        delete fotografije.value[ulov.id]
        izlazak.value.brojUlova = Math.max(0, (izlazak.value.brojUlova ?? 1) - 1)
        if (ulovZaUredjivanje.value?.id === ulov.id) zatvoriFormu()
    } catch (e) {
        console.error(e)
        greska.value = 'Brisanje nije uspjelo.'
    }
}



function otvoriPregled(foto, opis) {
    pregled.value = { ...foto, opis }
}

function zatvoriPregled() {
    pregled.value = null
}

function naTipku(e) {
    if (e.key === 'Escape') zatvoriPregled()
}

onMounted(() => window.addEventListener('keydown', naTipku))
onUnmounted(() => window.removeEventListener('keydown', naTipku))


const ukupno = computed(() => {
    const komada = ulovi.value.reduce((z, u) => z + (u.brojKomada ?? 1), 0)
    const kg = ulovi.value.reduce((z, u) => z + (u.masaKg ?? 0) * (u.brojKomada ?? 1), 0)
    const pusteno = ulovi.value
        .filter((u) => u.pusten)
        .reduce((z, u) => z + (u.brojKomada ?? 1), 0)
    return { komada, kg, pusteno }
})


const pocetnaLokacija = computed(() => {
    const i = izlazak.value
    return {
        gpsSirina: i?.gpsSirina ?? i?.lokacija?.gpsSirina ?? 45.32,
        gpsDuzina: i?.gpsDuzina ?? i?.lokacija?.gpsDuzina ?? 13.56,
    }
})

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
    <div class="mx-auto max-w-2xl space-y-6">
        <p v-if="ucitavanje" class="text-sm text-slate-500">Učitavam…</p>

        <p v-else-if="greska && !izlazak" role="alert"
            class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {{ greska }}
        </p>

        <template v-else-if="izlazak">
            <RouterLink :to="{ name: 'izlasci' }"
                class="inline-block text-sm text-slate-500 underline underline-offset-4 hover:text-slate-900">
                ← Svi izlasci
            </RouterLink>

            <!-- Zaglavlje izlaska -->
            <section class="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                    <h1 class="text-xl font-semibold tracking-tight text-slate-900">
                        {{ fmtDatum.format(izlazak.datum.toDate()) }}
                    </h1>
                    <p class="mt-1 text-sm text-slate-500">
                        {{ fmtSat.format(izlazak.vrijemeOd.toDate()) }}<template v-if="izlazak.vrijemeDo">
                            – {{ fmtSat.format(izlazak.vrijemeDo.toDate()) }}</template>
                        · {{ izlazak.polaziste }}
                    </p>
                </div>

                <p v-if="izlazak.biljeska" class="text-sm text-slate-700">{{ izlazak.biljeska }}</p>

                <div v-if="uvjetiRedci.length" class="flex flex-wrap gap-2">
                    <span v-for="red in uvjetiRedci" :key="red"
                        class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                        {{ red }}
                    </span>
                </div>

                <dl class="flex gap-6 border-t border-slate-100 pt-3 text-sm">
                    <div>
                        <dt class="text-slate-500">Komada</dt>
                        <dd class="font-medium text-slate-900">{{ ukupno.komada }}</dd>
                    </div>
                    <div>
                        <dt class="text-slate-500">Ukupno</dt>
                        <dd class="font-medium text-slate-900">{{ ukupno.kg.toFixed(2) }} kg</dd>
                    </div>
                    <div>
                        <dt class="text-slate-500">Pušteno</dt>
                        <dd class="font-medium text-slate-900">{{ ukupno.pusteno }}</dd>
                    </div>
                </dl>
            </section>

            <p v-if="greska" role="alert"
                class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {{ greska }}
            </p>

            <!-- Ulovi -->
            <section class="space-y-3">
                <div class="flex items-center justify-between">
                    <h2 class="text-lg font-semibold tracking-tight text-slate-900">Ulovi</h2>
                    <button v-if="!formaOtvorena" type="button"
                        class="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
                        @click="noviUlov">
                        Dodaj ulov
                    </button>
                </div>

                <p v-if="!ulovi.length && !formaOtvorena"
                    class="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                    Još nema zabilježenih ulova.
                </p>

                <ul v-else-if="ulovi.length" class="space-y-2">
                    <li v-for="ulov in ulovi" :key="ulov.id"
                        class="flex items-start justify-between gap-4 rounded-lg border bg-white px-4 py-3"
                        :class="ulovZaUredjivanje?.id === ulov.id ? 'border-slate-900' : 'border-slate-200'">
                        <div class="min-w-0 space-y-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="font-medium text-slate-900">{{ nazivVrste(ulov) }}</span>
                                <span v-if="ulov.brojKomada > 1" class="text-sm text-slate-500">
                                    ×{{ ulov.brojKomada }}
                                </span>
                                <span v-if="ulov.pusten"
                                    class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                                    puštena
                                </span>
                                <span v-if="ulov.vidljivost === 'Privatno'"
                                    class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                                    privatno
                                </span>
                            </div>

                            <p class="text-sm text-slate-600">
                                <template v-if="ulov.duljinaCm">{{ ulov.duljinaCm }} cm</template>
                                <template v-if="ulov.duljinaCm && ulov.masaKg"> · </template>
                                <template v-if="ulov.masaKg">{{ ulov.masaKg }} kg</template>
                            </p>

                            <p class="text-xs text-slate-500">
                                {{ fmtSat.format(ulov.vrijemeUlova.toDate()) }}
                                · {{ sifrarnici.nacini[ulov.nacinLovaId] ?? '?' }}
                                <template v-if="ulov.mamacId">
                                    · {{ sifrarnici.mamci[ulov.mamacId] ?? '?' }}
                                </template>
                                <template v-if="ulov.lokacija?.naziv"> · {{ ulov.lokacija.naziv }}</template>
                            </p>

                            <!-- Fotografije ulova -->
                            <div v-if="fotografije[ulov.id]?.length" class="flex flex-wrap gap-1.5 pt-1">
                                <button v-for="foto in fotografije[ulov.id]" :key="foto.id" type="button"
                                    class="overflow-hidden rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                                    @click="otvoriPregled(foto, nazivVrste(ulov))">
                                    <img :src="foto.url" :alt="nazivVrste(ulov)" loading="lazy" width="64" height="64"
                                        class="h-16 w-16 bg-slate-100 object-cover transition hover:opacity-80" />
                                </button>
                            </div>
                        </div>

                        <div class="flex shrink-0 gap-1">
                            <button type="button"
                                class="rounded-md px-2 py-1 text-sm text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
                                @click="urediUlov(ulov)">
                                Uredi
                            </button>
                            <button type="button"
                                class="rounded-md px-2 py-1 text-sm text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                @click="obrisiUlov(ulov)">
                                Obriši
                            </button>
                        </div>
                    </li>
                </ul>

                <UlovForma v-if="formaOtvorena" :key="ulovZaUredjivanje?.id ?? `novi-${ulovi.length}`"
                    :ulov="ulovZaUredjivanje"
                    :postojece-fotografije="ulovZaUredjivanje ? (fotografije[ulovZaUredjivanje.id] ?? []) : []"
                    :izlazak-id="izlazak.id" :vrijeme-od="izlazak.vrijemeOd.toDate()"
                    :vrijeme-do="izlazak.vrijemeDo?.toDate() ?? null" :pocetna-lokacija="pocetnaLokacija"
                    :uvjeti-satno="izlazak.uvjetiSatno ?? []" @spremljeno="naSpremljeno" @odustani="zatvoriFormu" />
            </section>
        </template>

        <!-- Pregled fotografije -->
        <div v-if="pregled" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4"
            role="dialog" aria-modal="true" @click.self="zatvoriPregled">
            <img :src="pregled.url" :alt="pregled.opis" class="max-h-full max-w-full rounded-lg object-contain" />
            <button type="button" aria-label="Zatvori"
                class="absolute right-4 top-4 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white transition hover:bg-white/20"
                @click="zatvoriPregled">
                Zatvori
            </button>
        </div>
    </div>
</template>