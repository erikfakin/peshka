<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase.js'
import { useAuthStore } from '@/stores/auth.js'
import { useFlashStore } from '@/stores/flash.js'
import { dohvatiUvjete, satZaVrijeme, trendTlaka } from '@/utils/meteo.js'
import MapPicker from '@/components/MapPicker.vue'

const router = useRouter()
const authStore = useAuthStore()
const { setFlash } = useFlashStore()

const danas = new Date().toISOString().slice(0, 10)

const datum = ref(danas)
const vrijemeOd = ref('')
const vrijemeDo = ref('')
const polaziste = ref('')
const biljeska = ref('')
const lokacija = ref(null)

const satno = ref([])
const meteoStanje = ref('prazno') // prazno | ucitavanje | ok | greska

const submitting = ref(false)
const greska = ref('')

const mozeSpremiti = computed(
    () =>
        !submitting.value &&
        datum.value &&
        vrijemeOd.value &&
        polaziste.value.trim() &&
        lokacija.value,
)

// "2026-09-13" + "21:30" -> Date. Ako je kraj prije početka, izlazak je
// prešao ponoć pa dodajemo dan.
function spoji(datumStr, vrijemeStr, pocetak = null) {
    if (!vrijemeStr) return null
    const d = new Date(`${datumStr}T${vrijemeStr}`)
    if (pocetak && d < pocetak) d.setDate(d.getDate() + 1)
    return d
}

let zahtjev = 0

async function ucitajMeteo() {
    if (!lokacija.value || !datum.value) return

    meteoStanje.value = 'ucitavanje'
    const moj = ++zahtjev

    try {
        const od = spoji(datum.value, vrijemeOd.value || '00:00')
        const doo = spoji(datum.value, vrijemeDo.value, od)

        const podaci = await dohvatiUvjete(
            lokacija.value.gpsSirina,
            lokacija.value.gpsDuzina,
            od,
            doo ?? od,
        )

        if (moj !== zahtjev) return
        satno.value = podaci
        meteoStanje.value = 'ok'
    } catch (e) {
        if (moj !== zahtjev) return
        console.error(e)
        meteoStanje.value = 'greska'
    }
}


let odmak = null
watch([lokacija, datum, vrijemeOd, vrijemeDo], () => {
    clearTimeout(odmak)
    odmak = setTimeout(ucitajMeteo, 600)
})


const uvjetiNaPolasku = computed(() => {
    if (!satno.value.length) return null
    const od = spoji(datum.value, vrijemeOd.value || '00:00')
    return satZaVrijeme(satno.value, od)
})

const pregled = computed(() => {
    const u = uvjetiNaPolasku.value
    if (!u) return []
    const trend = trendTlaka(satno.value)
    return [
        u.smjerVjetra && `${u.smjerVjetra} ${u.brzinaVjetraCv ?? '?'} čv`,
        u.stanjeMora && (u.valoviM != null ? `${u.stanjeMora} (${u.valoviM} m)` : u.stanjeMora),
        u.tempZrakaC != null && `zrak ${u.tempZrakaC} °C`,
        u.tempMoraC != null && `more ${u.tempMoraC} °C`,
        u.tlakHpa != null && `${u.tlakHpa} hPa${trend ? ` (${trend})` : ''}`,
    ].filter(Boolean)
})

async function spremi() {
    if (!mozeSpremiti.value) return

    greska.value = ''
    submitting.value = true

    try {
        const od = spoji(datum.value, vrijemeOd.value)
        const doo = spoji(datum.value, vrijemeDo.value, od)

        const ref = await addDoc(collection(db, 'izlasci'), {
            korisnikId: authStore.user.uid,
            datum: Timestamp.fromDate(new Date(`${datum.value}T00:00:00`)),
            vrijemeOd: Timestamp.fromDate(od),
            vrijemeDo: doo ? Timestamp.fromDate(doo) : null,
            polaziste: polaziste.value.trim(),
            biljeska: biljeska.value.trim(),
            gpsSirina: lokacija.value.gpsSirina,
            gpsDuzina: lokacija.value.gpsDuzina,
            uvjetiNaMoru: uvjetiNaPolasku.value ?? null,
            uvjetiSatno: satno.value.length ? satno.value : null,
            brojUlova: 0,
            stvoreno: serverTimestamp(),
        })

        setFlash('Izlazak je spremljen.')
        router.push({ name: 'izlazak', params: { id: ref.id } })
    } catch (e) {
        console.error(e)
        greska.value = 'Izlazak nije spremljen. Pokušajte ponovno.'
        submitting.value = false
    }
}

const polje =
    'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 ' +
    'placeholder:text-slate-400 transition focus:border-slate-900 focus:outline-none ' +
    'focus:ring-2 focus:ring-slate-900/15 disabled:cursor-not-allowed disabled:bg-slate-50'
const oznaka = 'block text-sm font-medium text-slate-700'
</script>

<template>
    <form novalidate class="mx-auto max-w-lg space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        @submit.prevent="spremi">
        <header class="space-y-1">
            <h1 class="text-xl font-semibold tracking-tight text-slate-900">Novi izlazak</h1>
            <p class="text-sm text-slate-500">Prvo zabilježite izlazak, pa mu dodajte ulove.</p>
        </header>

        <p v-if="greska" role="alert"
            class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {{ greska }}
        </p>

        <div class="space-y-1.5">
            <label for="datum" :class="oznaka">Datum</label>
            <input id="datum" v-model="datum" type="date" required :disabled="submitting" :class="polje" />
        </div>

        <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
                <label for="od" :class="oznaka">Od</label>
                <input id="od" v-model="vrijemeOd" type="time" required :disabled="submitting" :class="polje" />
            </div>
            <div class="space-y-1.5">
                <label for="do" :class="oznaka">Do</label>
                <input id="do" v-model="vrijemeDo" type="time" :disabled="submitting" :class="polje" />
            </div>
        </div>

        <div class="space-y-1.5">
            <label for="polaziste" :class="oznaka">Polazište</label>
            <input id="polaziste" v-model="polaziste" type="text" required placeholder="Npr. Marina Veruda"
                :disabled="submitting" :class="polje" />
        </div>

        <fieldset class="space-y-3 rounded-lg border border-slate-200 p-4">
            <legend class="px-1 text-sm font-medium text-slate-700">Područje lova</legend>
            <MapPicker v-model="lokacija" />
        </fieldset>


        <section class="rounded-lg border border-slate-200 p-4">
            <h2 class="text-sm font-medium text-slate-700">Uvjeti na moru</h2>

            <p v-if="meteoStanje === 'prazno'" class="mt-2 text-sm text-slate-400">
                Odaberite lokaciju i vrijeme polaska.
            </p>

            <p v-else-if="meteoStanje === 'ucitavanje'" class="mt-2 text-sm text-slate-500">
                Dohvaćam prognozu…
            </p>

            <div v-else-if="meteoStanje === 'greska'" class="mt-2 space-y-2">
                <p class="text-sm text-rose-600">Prognoza nije dohvaćena.</p>
                <button type="button"
                    class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
                    @click="ucitajMeteo">
                    Pokušaj ponovno
                </button>
            </div>

            <div v-else class="mt-3 flex flex-wrap gap-2">
                <span v-for="red in pregled" :key="red"
                    class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                    {{ red }}
                </span>
            </div>
        </section>

        <div class="space-y-1.5">
            <label for="biljeska" :class="oznaka">Bilješka</label>
            <textarea id="biljeska" v-model="biljeska" rows="3" placeholder="Kako je prošlo, s kim, što si primijetio…"
                :disabled="submitting" :class="polje" />
        </div>

        <button type="submit" :disabled="!mozeSpremiti"
            class="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">
            {{ submitting ? 'Spremam…' : 'Spremi izlazak' }}
        </button>
    </form>
</template>