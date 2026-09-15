<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
    collection,
    doc,
    increment,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc,
    writeBatch,
} from 'firebase/firestore'
import { db } from '@/firebase.js'
import { useAuthStore } from '@/stores/auth.js'
import { useSifrarnici } from '@/composables/useSifrarnici.js'
import { fmtSat } from '@/utils/format.js'
import { uvjetiZaTrenutak } from '@/utils/meteo.js'
import { astroZaUlov } from '@/utils/astro.js'
import { dodajFotografije, fotografijeVlasnika, obrisiFotografiju } from '@/utils/fotografije.js'
import { nazivZaKoordinate } from '@/utils/geokod.js'
import MapPicker from '@/components/MapPicker.vue'
import FotografijeUnos from '@/components/FotografijeUnos.vue'
import PotvrdaDialog from '@/components/PotvrdaDialog.vue'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

const props = defineProps({
    izlazakId: { type: String, required: true },
    vrijemeOd: { type: Date, required: true },
    vrijemeDo: { type: Date, default: null },
    pocetnaLokacija: { type: Object, required: true }, // { gpsSirina, gpsDuzina }
    ulov: { type: Object, default: null },
    postojeceFotografije: { type: Array, default: () => [] },
})

const emit = defineEmits(['spremljeno', 'odustani'])

const authStore = useAuthStore()
const uredjivanje = computed(() => !!props.ulov)

const { sifrarnici, ucitaj: ucitajSifrarnike } = useSifrarnici()
const ucitavanje = ref(true)

// Šifrarnik u oblik koji traži Combobox, abecedno.
function opcije(zapisi, oznaka, napomena) {
    return Object.entries(zapisi)
        .map(([value, z]) => ({ value, label: z[oznaka], hint: napomena && z[napomena] }))
        .sort((a, b) => a.label.localeCompare(b.label, 'hr'))
}

const vrsteRibe = computed(() => opcije(sifrarnici.value.vrste, 'nazivHr', 'nazivLat'))
const naciniLova = computed(() => opcije(sifrarnici.value.nacini, 'naziv'))
const mamci = computed(() => opcije(sifrarnici.value.mamci, 'naziv', 'tip'))

function pocetnoVrijeme() {
    const sada = new Date()
    const unutar = sada >= props.vrijemeOd && (!props.vrijemeDo || sada <= props.vrijemeDo)
    return (unutar ? sada : props.vrijemeOd).toTimeString().slice(0, 5)
}

function satIzZapisa(ts) {
    const d = ts?.toDate?.()
    if (!d) return pocetnoVrijeme()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const u = props.ulov
const vrijemeUlova = ref(u ? satIzZapisa(u.vrijemeUlova) : pocetnoVrijeme())
const vrstaRibeId = ref(u?.vrstaRibeId ?? '')
const duljinaCm = ref(u?.duljinaCm ?? '')
const masaKg = ref(u?.masaKg ?? '')
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

const slike = ref([])
const postojece = ref([...props.postojeceFotografije])
const zaBrisanje = ref(null)

const submitting = ref(false)
const napredak = ref(null)
const greska = ref('')
const trazimNaziv = ref(false)
const rucnoUpisano = ref(!!u?.lokacija?.naziv)

const trenutakUlova = computed(() => {
    if (!vrijemeUlova.value) return null
    const [h, m] = vrijemeUlova.value.split(':').map(Number)
    const d = new Date(props.vrijemeOd)
    d.setHours(h, m, 0, 0)
    // Ranije od polaska znači da je ulov bio iza ponoći.
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
        lokacija.value.gpsSirina !== props.pocetnaLokacija.gpsSirina ||
        lokacija.value.gpsDuzina !== props.pocetnaLokacija.gpsDuzina,
)

const mozeSpremiti = computed(
    () => !submitting.value && vrstaRibeId.value && nacinLovaId.value && !vrijemeGreska.value,
)

const tekstGumba = computed(() => {
    if (napredak.value) {
        return `Učitavam fotografiju ${napredak.value.indeks + 1}/${napredak.value.ukupno}…`
    }
    if (submitting.value) return 'Spremam…'
    return uredjivanje.value ? 'Spremi promjene' : 'Dodaj ulov'
})

function broj(r) {
    return r.value === '' || r.value == null ? null : Number(r.value)
}

let odmak
watch(
    lokacija,
    () => {
        if (rucnoUpisano.value) return

        clearTimeout(odmak)
        odmak = setTimeout(async () => {
            trazimNaziv.value = true
            try {
                const naziv = await nazivZaKoordinate(
                    lokacija.value.gpsSirina,
                    lokacija.value.gpsDuzina,
                )
                if (naziv && !rucnoUpisano.value) nazivMjesta.value = naziv
            } catch (e) {
                console.error(e)
            } finally {
                trazimNaziv.value = false
            }
        }, 700)
    },
    { immediate: true, deep: true },
)

onUnmounted(() => clearTimeout(odmak))

onMounted(async () => {
    try {
        await ucitajSifrarnike()
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
        pusten: pusten.value,
        vidljivost: vidljivost.value,
        lokacija: {
            naziv: nazivMjesta.value.trim() || null,
            gpsSirina: lokacija.value.gpsSirina,
            gpsDuzina: lokacija.value.gpsDuzina,
        },
        ...astroZaUlov(kada, lokacija.value.gpsSirina, lokacija.value.gpsDuzina),
    }
}

async function meteoZaUlov(kada) {
    try {
        return await uvjetiZaTrenutak(lokacija.value.gpsSirina, lokacija.value.gpsDuzina, kada)
    } catch (e) {
        console.error(e)

        return uredjivanje.value ? {} : { uvjeti: null, trendTlaka: null, plimaOseka: null }
    }
}

async function spremi() {
    if (!mozeSpremiti.value) return

    greska.value = ''
    submitting.value = true

    let zapisan = false

    try {
        const kada = trenutakUlova.value
        const podaci = { ...podaciUlova(kada), ...(await meteoZaUlov(kada)) }
        let ulovId = props.ulov?.id

        if (uredjivanje.value) {
            const batch = writeBatch(db)
            batch.update(doc(db, 'ulovi', ulovId), { ...podaci, azurirano: serverTimestamp() })

            if (vidljivost.value !== props.ulov.vidljivost) {
                const snap = await fotografijeVlasnika(ulovId, authStore.user.uid)
                snap.docs.forEach((d) => batch.update(d.ref, { vidljivost: vidljivost.value }))
            }

            await batch.commit()
        } else {
            const ulovRef = doc(collection(db, 'ulovi'))
            await setDoc(ulovRef, { ...podaci, naslovnaUrl: null, stvoreno: serverTimestamp() })
            await updateDoc(doc(db, 'izlasci', props.izlazakId), { brojUlova: increment(1) })
            ulovId = ulovRef.id
        }

        zapisan = true

        if (slike.value.length) {
            const ucitane = await dodajFotografije(
                slike.value.map((s) => s.datoteka),
                {
                    ulovId,
                    izlazakId: props.izlazakId,
                    korisnikId: authStore.user.uid,
                    vidljivost: vidljivost.value,
                    pocetniRedoslijed: postojece.value.length,
                    onNapredak: (n) => (napredak.value = n),
                },
            )

            const sve = [...postojece.value, ...ucitane]
            await updateDoc(doc(db, 'ulovi', ulovId), { naslovnaUrl: sve[0]?.url ?? null })
        }

        emit('spremljeno', { novo: !uredjivanje.value })
    } catch (e) {
        console.error(e)
        greska.value = zapisan
            ? 'Ulov je spremljen, ali fotografije nisu učitane. Dodajte ih uređivanjem ulova.'
            : 'Ulov nije spremljen. Pokušajte ponovno.'
    } finally {
        submitting.value = false
        napredak.value = null
    }
}

async function obrisiPostojecu() {
    const foto = zaBrisanje.value
    zaBrisanje.value = null

    try {
        await obrisiFotografiju(foto)
        postojece.value = postojece.value.filter((f) => f.id !== foto.id)
        await updateDoc(doc(db, 'ulovi', props.ulov.id), {
            naslovnaUrl: postojece.value[0]?.url ?? null,
        })
    } catch (e) {
        console.error(e)
        greska.value = 'Fotografija nije obrisana.'
    }
}
</script>

<template>
    <Card>
        <CardHeader class="flex-row items-start justify-between gap-4">
            <CardTitle>{{ uredjivanje ? 'Uredi ulov' : 'Novi ulov' }}</CardTitle>
            <Button variant="ghost" size="sm" :disabled="submitting" @click="emit('odustani')">
                Zatvori
            </Button>
        </CardHeader>

        <CardContent>
            <p v-if="ucitavanje" class="text-muted-foreground text-sm">Učitavam šifrarnike…</p>

            <form v-else novalidate class="space-y-5" @submit.prevent="spremi">
                <Alert v-if="greska" variant="destructive">
                    <AlertDescription>{{ greska }}</AlertDescription>
                </Alert>

                <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-2">
                        <Label for="vrsta">Vrsta ribe</Label>
                        <Combobox id="vrsta" v-model="vrstaRibeId" :options="vrsteRibe" :disabled="submitting"
                            placeholder="Odaberite vrstu…" empty-text="Nema takve vrste." />
                    </div>
                    <div class="space-y-2">
                        <Label for="vrijeme">Vrijeme</Label>
                        <Input id="vrijeme" v-model="vrijemeUlova" type="time" :disabled="submitting"
                            :aria-invalid="!!vrijemeGreska" />
                        <p v-if="vrijemeGreska" class="text-destructive text-xs">{{ vrijemeGreska }}</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-2">
                        <Label for="duljina">Duljina (cm)</Label>
                        <Input id="duljina" v-model="duljinaCm" type="number" step="0.5" min="0"
                            :disabled="submitting" />
                    </div>
                    <div class="space-y-2">
                        <Label for="masa">Masa (kg)</Label>
                        <Input id="masa" v-model="masaKg" type="number" step="0.01" min="0" :disabled="submitting" />
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-2">
                        <Label for="nacin">Način lova</Label>
                        <Combobox id="nacin" v-model="nacinLovaId" :options="naciniLova" :disabled="submitting"
                            placeholder="Odaberite način…" />
                    </div>
                    <div class="space-y-2">
                        <Label for="mamac">Mamac</Label>
                        <Combobox id="mamac" v-model="mamacId" :options="mamci" :disabled="submitting"
                            placeholder="Bez mamca" />
                    </div>
                </div>

                <div class="space-y-2 rounded-lg border p-4">
                    <div class="flex items-center justify-between gap-3">
                        <Label>Lokacija</Label>
                        <Button v-if="pomaknuta" type="button" variant="link" size="xs"
                            @click="lokacija = { ...pocetnaLokacija }">
                            Vrati na lokaciju izlaska
                        </Button>
                    </div>

                    <MapPicker v-model="lokacija" />

                    <div class="space-y-2 pt-2">
                        <Label for="mjesto">Naziv mjesta</Label>
                        <Input id="mjesto" v-model="nazivMjesta" type="text" placeholder="Npr. Porer"
                            :disabled="submitting" @input="rucnoUpisano = true" />
                        <p v-if="trazimNaziv" class="text-muted-foreground text-xs">Tražim naziv…</p>
                    </div>
                </div>

                <div class="space-y-2 rounded-lg border p-4">
                    <Label>Fotografije</Label>
                    <FotografijeUnos v-model="slike" :postojece="postojece" :disabled="submitting"
                        @obrisi-postojecu="zaBrisanje = $event" />
                </div>

                <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <div class="flex items-center gap-2">
                        <Checkbox id="pusten" v-model="pusten" :disabled="submitting" />
                        <Label for="pusten">Puštena</Label>
                    </div>

                    <div class="flex items-center gap-2">
                        <Label for="vidljivost">Vidljivost</Label>
                        <Select v-model="vidljivost" :disabled="submitting">
                            <SelectTrigger id="vidljivost">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Javno">Javno</SelectItem>
                                <SelectItem value="Privatno">Privatno</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <Button type="submit" size="lg" class="w-full" :disabled="!mozeSpremiti">
                    {{ tekstGumba }}
                </Button>
            </form>
        </CardContent>
    </Card>

    <PotvrdaDialog :open="!!zaBrisanje" naslov="Obrisati fotografiju?"
        opis="Fotografija se briše trajno i ne može se vratiti." @update:open="zaBrisanje = null"
        @potvrda="obrisiPostojecu" />
</template>
