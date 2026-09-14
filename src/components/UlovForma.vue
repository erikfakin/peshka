<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
    collection,
    doc,
    getDocs,
    increment,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc,
} from 'firebase/firestore'
import { db } from '@/firebase.js'
import { useAuthStore } from '@/stores/auth.js'
import SearchSelect from '@/components/SearchSelect.vue'
import { satZaVrijeme } from '@/utils/meteo.js'
import { dodajFotografije, obrisiFotografiju } from '@/utils/fotografije.js'
import { nazivZaKoordinate } from '@/utils/geokod.js'
import MapPicker from './MapPicker.vue'

const props = defineProps({
    izlazakId: { type: String, required: true },
    vrijemeOd: { type: Date, required: true },
    vrijemeDo: { type: Date, default: null },
    pocetnaLokacija: { type: Object, required: true }, // { gpsSirina, gpsDuzina }
    uvjetiSatno: { type: Array, default: () => [] },
    ulov: { type: Object, default: null },
    postojeceFotografije: { type: Array, default: () => [] },
})
const emit = defineEmits(['spremljeno', 'odustani'])

const authStore = useAuthStore()
const uredjivanje = computed(() => !!props.ulov)

const vrsteRibe = ref([])
const naciniLova = ref([])
const mamci = ref([])
const ucitavanje = ref(true)

function pocetnoVrijeme() {
    const sada = new Date()
    const unutar = sada >= props.vrijemeOd && (!props.vrijemeDo || sada <= props.vrijemeDo)
    return (unutar ? sada : props.vrijemeOd).toTimeString().slice(0, 5)
}

function satIzZapisa(ts) {
    const d = ts?.toDate?.() ?? ts
    if (!(d instanceof Date)) return pocetnoVrijeme()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Početne vrijednosti iz ulova kad uređujemo, inače prazno
const u = props.ulov
const vrijemeUlova = ref(u ? satIzZapisa(u.vrijemeUlova) : pocetnoVrijeme())
const vrstaRibeId = ref(u?.vrstaRibeId ?? '')
const duljinaCm = ref(u?.duljinaCm ?? '')
const masaKg = ref(u?.masaKg ?? '')
const brojKomada = ref(u?.brojKomada ?? 1)
const nacinLovaId = ref(u?.nacinLovaId ?? '')
const mamacId = ref(u?.mamacId ?? '')
const pusten = ref(u?.pusten ?? false)
const vidljivost = ref(u?.vidljivost ?? 'Javno')
const nazivMjesta = ref(u?.lokacija?.naziv ?? '')

const lokacija = ref(
    u?.lokacija?.gpsSirina != null
        ? { gpsSirina: u.lokacija.gpsSirina, gpsDuzina: u.lokacija.gpsDuzina }
        : { ...props.pocetnaLokacija },
)

const submitting = ref(false)
const greska = ref('')

// Fotografije: { kljuc, datoteka, pregled }
const slike = ref([])
const napredak = ref(null)
const ucitane = ref([])
const postojece = ref([...props.postojeceFotografije])
const ulovId = ref(u?.id ?? null)
const zapisano = ref(false)


const trazimNaziv = ref(false)
const rucnoUpisano = ref(!!u?.lokacija?.naziv)
let odgoda
let prekid

const trenutakUlova = computed(() => {
    if (!vrijemeUlova.value) return null
    const [h, m] = vrijemeUlova.value.split(':').map(Number)
    const d = new Date(props.vrijemeOd)
    d.setHours(h, m, 0, 0)
    if (d < props.vrijemeOd) d.setDate(d.getDate() + 1)
    return d
})

const vrijemeGreska = computed(() => {
    const d = trenutakUlova.value
    if (!d) return ''

    if (props.vrijemeDo && d > props.vrijemeDo) {
        return `Izlazak je završio u ${fmtSat.format(props.vrijemeDo)}.`
    }

    if (!props.vrijemeDo && d - props.vrijemeOd > 24 * 3600 * 1000) {
        return 'Više od 24 sata nakon polaska.'
    }
    return ''
})

const pomaknuta = computed(
    () =>
        lokacija.value &&
        (lokacija.value.gpsSirina !== props.pocetnaLokacija.gpsSirina ||
            lokacija.value.gpsDuzina !== props.pocetnaLokacija.gpsDuzina),
)

const mozeSpremiti = computed(
    () =>
        !submitting.value &&
        vrstaRibeId.value &&
        nacinLovaId.value &&
        lokacija.value &&
        !vrijemeGreska.value,
)

const tekstGumba = computed(() => {
    if (submitting.value) {
        if (napredak.value) {
            const postotak = Math.round(napredak.value.udio * 100)
            return `Učitavam fotografiju ${napredak.value.indeks + 1}/${napredak.value.ukupno} · ${postotak} %`
        }
        return 'Spremam…'
    }
    if (zapisano.value) return 'Nastavi učitavanje'
    return uredjivanje.value ? 'Spremi promjene' : 'Dodaj ulov'
})

const fmtSat = new Intl.DateTimeFormat('hr-HR', { hour: '2-digit', minute: '2-digit' })

function broj(r) {
    return r.value === '' || r.value == null ? null : Number(r.value)
}

function vratiLokaciju() {
    lokacija.value = { ...props.pocetnaLokacija }
}


watch(
    () => `${lokacija.value?.gpsSirina},${lokacija.value?.gpsDuzina}`,
    () => {
        if (rucnoUpisano.value) return

        clearTimeout(odgoda)
        prekid?.abort()

        const { gpsSirina, gpsDuzina } = lokacija.value ?? {}
        if (gpsSirina == null || gpsDuzina == null) return

        // Odgoda zbog povlačenja pribadače po karti — inače zahtjev po svakom pomaku.
        odgoda = setTimeout(async () => {
            prekid = new AbortController()
            trazimNaziv.value = true
            try {
                const naziv = await nazivZaKoordinate(gpsSirina, gpsDuzina, {
                    signal: prekid.signal,
                })
                if (naziv && !rucnoUpisano.value) nazivMjesta.value = naziv
            } catch (e) {
                if (e.name !== 'AbortError') console.error(e)
            } finally {
                trazimNaziv.value = false
            }
        }, 700)
    },
    { immediate: true },
)


function naOdabir(e) {
    const nove = Array.from(e.target.files ?? []).filter((d) => d.type.startsWith('image/'))
    for (const datoteka of nove) {
        slike.value.push({
            kljuc: `${datoteka.name}-${datoteka.lastModified}-${slike.value.length}-${Date.now()}`,
            datoteka,
            pregled: URL.createObjectURL(datoteka),
        })
    }
    e.target.value = ''
}

function makniSliku(kljuc) {
    const i = slike.value.findIndex((s) => s.kljuc === kljuc)
    if (i === -1) return
    URL.revokeObjectURL(slike.value[i].pregled)
    slike.value.splice(i, 1)
}

function makniPoDatoteci(datoteka) {
    const stavka = slike.value.find((s) => s.datoteka === datoteka)
    if (stavka) makniSliku(stavka.kljuc)
}

function ocistiPreglede() {
    slike.value.forEach((s) => URL.revokeObjectURL(s.pregled))
    slike.value = []
}

function brojac() {
    const sve = [...postojece.value, ...ucitane.value]
    return { brojFotografija: sve.length, naslovnaUrl: sve[0]?.url ?? null }
}


async function obrisiPostojecu(foto) {
    if (!confirm('Obrisati ovu fotografiju?')) return
    try {
        await obrisiFotografiju(foto)
        postojece.value = postojece.value.filter((f) => f.id !== foto.id)
        await updateDoc(doc(db, 'ulovi', ulovId.value), brojac())
    } catch (e) {
        console.error(e)
        greska.value = 'Fotografija nije obrisana.'
    }
}

onUnmounted(() => {
    ocistiPreglede()
    clearTimeout(odgoda)
    prekid?.abort()
})



onMounted(async () => {
    try {
        const [vr, nl, mm] = await Promise.all([
            getDocs(query(collection(db, 'vrsteRibe'), orderBy('nazivHr'))),
            getDocs(query(collection(db, 'naciniLova'), orderBy('naziv'))),
            getDocs(query(collection(db, 'mamci'), orderBy('naziv'))),
        ])
        vrsteRibe.value = vr.docs.map((d) => ({
            id: d.id,
            naziv: d.data().nazivHr,
            pomocni: d.data().nazivLat,
        }))
        naciniLova.value = nl.docs.map((d) => ({ id: d.id, naziv: d.data().naziv }))
        mamci.value = mm.docs.map((d) => ({
            id: d.id,
            naziv: d.data().naziv,
            pomocni: d.data().tip,
        }))
    } catch (e) {
        console.error(e)
        greska.value = 'Šifrarnici se nisu učitali.'
    } finally {
        ucitavanje.value = false
    }
})

function podaciUlova(kada) {
    return {
        izlazakId: props.izlazakId,
        korisnikId: authStore.user.uid,
        vrijemeUlova: Timestamp.fromDate(kada),
        vrstaRibeId: vrstaRibeId.value,
        nacinLovaId: nacinLovaId.value,
        mamacId: mamacId.value || null,
        duljinaCm: broj(duljinaCm),
        masaKg: broj(masaKg),
        brojKomada: Number(brojKomada.value) || 1,
        pusten: pusten.value,
        vidljivost: vidljivost.value,
        lokacija: {
            naziv: nazivMjesta.value.trim() || null,
            gpsSirina: lokacija.value.gpsSirina,
            gpsDuzina: lokacija.value.gpsDuzina,
        },
        uvjeti: satZaVrijeme(props.uvjetiSatno, kada),
    }
}

async function spremi() {
    if (!mozeSpremiti.value) return

    greska.value = ''
    submitting.value = true

    try {

        if (!zapisano.value) {
            const kada = trenutakUlova.value

            if (uredjivanje.value) {
                await updateDoc(doc(db, 'ulovi', ulovId.value), {
                    ...podaciUlova(kada),
                    azurirano: serverTimestamp(),
                })
            } else {
                const ulovRef = doc(collection(db, 'ulovi'))
                await setDoc(ulovRef, {
                    ...podaciUlova(kada),
                    brojFotografija: 0,
                    naslovnaUrl: null,
                    stvoreno: serverTimestamp(),
                })
                await updateDoc(doc(db, 'izlasci', props.izlazakId), { brojUlova: increment(1) })
                ulovId.value = ulovRef.id
            }

            zapisano.value = true
        }

        if (slike.value.length) {
            await dodajFotografije(
                slike.value.map((s) => s.datoteka),
                {
                    ulovId: ulovId.value,
                    izlazakId: props.izlazakId,
                    korisnikId: authStore.user.uid,
                    vidljivost: vidljivost.value,
                    pocetniRedoslijed: postojece.value.length + ucitane.value.length,
                    onNapredak: (n) => (napredak.value = n),
                    onSpremljena: (zapis, datoteka) => {
                        ucitane.value.push(zapis)
                        makniPoDatoteci(datoteka)
                    },
                },
            )
        }

        if (ucitane.value.length) {
            await updateDoc(doc(db, 'ulovi', ulovId.value), brojac())
        }

        const novo = !uredjivanje.value
        if (novo) resetiraj()
        else ocistiPreglede()
        emit('spremljeno', { novo })
    } catch (e) {
        console.error(e)
        greska.value = zapisano.value
            ? `Ulov je spremljen, ali ${slike.value.length} fotografija nije učitano. Pokušajte ponovno ili zatvorite formu.`
            : 'Ulov nije spremljen. Pokušajte ponovno.'
    } finally {
        submitting.value = false
        napredak.value = null
    }
}

function resetiraj() {
    duljinaCm.value = ''
    masaKg.value = ''
    brojKomada.value = 1
    pusten.value = false
    vrijemeUlova.value = pocetnoVrijeme()
    ocistiPreglede()
    ucitane.value = []
    ulovId.value = null
    zapisano.value = false
    rucnoUpisano.value = false
}

const polje =
    'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 ' +
    'placeholder:text-slate-400 transition focus:border-slate-900 focus:outline-none ' +
    'focus:ring-2 focus:ring-slate-900/15 disabled:cursor-not-allowed disabled:bg-slate-50'
const oznaka = 'block text-sm font-medium text-slate-700'
</script>

<template>
    <form novalidate class="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        @submit.prevent="spremi">
        <header class="flex items-start justify-between gap-4">
            <h2 class="text-lg font-semibold tracking-tight text-slate-900">
                {{ uredjivanje ? 'Uredi ulov' : 'Novi ulov' }}
            </h2>
            <button type="button" :disabled="submitting"
                class="rounded-md px-2 py-1 text-sm text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
                @click="emit('odustani')">
                Zatvori
            </button>
        </header>

        <p v-if="ucitavanje" class="text-sm text-slate-500">Učitavam šifrarnike…</p>

        <template v-else>
            <p v-if="greska" role="alert"
                class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {{ greska }}
            </p>

            <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                    <label for="vrsta" :class="oznaka">Vrsta ribe</label>
                    <SearchSelect id="vrsta" v-model="vrstaRibeId" :opcije="vrsteRibe" :disabled="submitting"
                        placeholder="Odaberite vrstu…" prazno="Nema takve vrste." />
                </div>
                <div class="space-y-1.5">
                    <label for="vrijeme" :class="oznaka">Vrijeme</label>
                    <input id="vrijeme" v-model="vrijemeUlova" type="time" :disabled="submitting"
                        :aria-invalid="!!vrijemeGreska" :class="[polje, vrijemeGreska ? 'border-rose-400' : '']" />
                    <p v-if="vrijemeGreska" class="text-xs text-rose-600">{{ vrijemeGreska }}</p>
                </div>
            </div>

            <div class="grid grid-cols-3 gap-3">
                <div class="space-y-1.5">
                    <label for="duljina" :class="oznaka">Duljina (cm)</label>
                    <input id="duljina" v-model="duljinaCm" type="number" step="0.5" min="0" :disabled="submitting"
                        :class="polje" />
                </div>
                <div class="space-y-1.5">
                    <label for="masa" :class="oznaka">Masa (kg)</label>
                    <input id="masa" v-model="masaKg" type="number" step="0.01" min="0" :disabled="submitting"
                        :class="polje" />
                </div>
                <div class="space-y-1.5">
                    <label for="komada" :class="oznaka">Komada</label>
                    <input id="komada" v-model="brojKomada" type="number" min="1" :disabled="submitting"
                        :class="polje" />
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                    <label for="nacin" :class="oznaka">Način lova</label>
                    <SearchSelect id="nacin" v-model="nacinLovaId" :opcije="naciniLova" :disabled="submitting"
                        placeholder="Odaberite način…" />
                </div>
                <div class="space-y-1.5">
                    <label for="mamac" :class="oznaka">Mamac</label>
                    <SearchSelect id="mamac" v-model="mamacId" :opcije="mamci" :disabled="submitting"
                        placeholder="Bez mamca" />
                </div>
            </div>

            <fieldset class="space-y-3 rounded-lg border border-slate-200 p-4">
                <legend class="px-1 text-sm font-medium text-slate-700">Lokacija</legend>

                <div class="flex items-center justify-between gap-3">
                    <p class="text-xs text-slate-500">
                        {{ pomaknuta ? 'Pomaknuto s lokacije izlaska.' : 'Preuzeto s izlaska.' }}
                    </p>
                    <button v-if="pomaknuta" type="button"
                        class="shrink-0 text-xs text-slate-500 underline underline-offset-4 hover:text-slate-900"
                        @click="vratiLokaciju">
                        Vrati na izlazak
                    </button>
                </div>

                <MapPicker v-model="lokacija" />

                <div class="space-y-1.5">
                    <label for="mjesto" :class="oznaka">Naziv mjesta</label>
                    <input id="mjesto" v-model="nazivMjesta" type="text" placeholder="Npr. Porer" :disabled="submitting"
                        :class="polje" @input="rucnoUpisano = true" />
                    <p v-if="trazimNaziv" class="text-xs text-slate-400">Tražim naziv…</p>
                </div>
            </fieldset>

            <!-- Fotografije -->
            <fieldset class="space-y-3 rounded-lg border border-slate-200 p-4">
                <legend class="px-1 text-sm font-medium text-slate-700">Fotografije</legend>

                <ul v-if="postojece.length" class="flex flex-wrap gap-2">
                    <li v-for="foto in postojece" :key="foto.id" class="relative">
                        <img :src="foto.url" alt="" class="h-20 w-20 rounded-md bg-slate-100 object-cover" />
                        <button type="button" :disabled="submitting" aria-label="Obriši fotografiju"
                            class="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full bg-slate-900 text-xs text-white transition hover:bg-rose-600 disabled:opacity-40"
                            @click="obrisiPostojecu(foto)">
                            ×
                        </button>
                    </li>
                </ul>

                <input id="fotke" type="file" accept="image/*" multiple :disabled="submitting"
                    class="block w-full text-sm text-slate-500 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800 disabled:cursor-not-allowed"
                    @change="naOdabir" />

                <ul v-if="slike.length" class="flex flex-wrap gap-2">
                    <li v-for="slika in slike" :key="slika.kljuc" class="relative">
                        <img :src="slika.pregled" :alt="slika.datoteka.name"
                            class="h-20 w-20 rounded-md bg-slate-100 object-cover" />
                        <button type="button" :disabled="submitting" :aria-label="`Ukloni ${slika.datoteka.name}`"
                            class="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full bg-slate-900 text-xs text-white transition hover:bg-rose-600 disabled:opacity-40"
                            @click="makniSliku(slika.kljuc)">
                            ×
                        </button>
                    </li>
                </ul>

                <p class="text-xs text-slate-500">
                    <template v-if="slike.length">
                        {{ slike.length }} {{ slike.length === 1 ? 'fotografija' : 'fotografije' }} za učitavanje.
                        Smanjuju se na 1600 px prije slanja.
                    </template>
                    <template v-else-if="postojece.length">
                        Nove fotografije dodaju se uz postojeće.
                    </template>
                    <template v-else>Bez fotografija. Možete ih dodati i kasnije.</template>
                </p>
            </fieldset>

            <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
                <label class="flex items-center gap-2 text-sm text-slate-700">
                    <input v-model="pusten" type="checkbox" :disabled="submitting"
                        class="h-4 w-4 rounded border-slate-300" />
                    Puštena
                </label>

                <label class="flex items-center gap-2 text-sm text-slate-700">
                    Vidljivost
                    <select v-model="vidljivost" :disabled="submitting"
                        class="rounded-md border border-slate-300 px-2 py-1 text-sm">
                        <option value="Javno">Javno</option>
                        <option value="Privatno">Privatno</option>
                    </select>
                </label>
            </div>

            <button type="submit" :disabled="!mozeSpremiti"
                class="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">
                {{ tekstGumba }}
            </button>
        </template>
    </form>
</template>