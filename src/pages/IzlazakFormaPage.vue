<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import {
    addDoc,
    collection,
    doc,
    getDoc,
    serverTimestamp,
    Timestamp,
    updateDoc,
} from 'firebase/firestore'
import { db } from '@/firebase.js'
import { useAuthStore } from '@/stores/auth.js'
import { uvjetiZaTrenutak } from '@/utils/meteo.js'
import { nazivZaKoordinate } from '@/utils/geokod.js'
import { fmtDatumKratki, isoDatum } from '@/utils/format.js'
import MapPicker from '@/components/MapPicker.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Bez id-a stranica stvara novi izlazak, s id-om uređuje postojeći.
const props = defineProps({
    id: { type: String, default: null },
})

const router = useRouter()
const authStore = useAuthStore()

const uredjivanje = computed(() => !!props.id)

const datum = ref(isoDatum(new Date()))
const vrijemeOd = ref('')
const vrijemeDo = ref('')
const naziv = ref('')
// Naziv mjesta iz obrnutog geokodiranja. Čuvamo ga odvojeno od naziva
// izlaska jer analitika grupira po mjestu, a naziv korisnik smije
// prepisati u bilo što.
const mjesto = ref('')
const rucnoUpisano = ref(false)
const trazimNaziv = ref(false)
const biljeska = ref('')
const lokacija = ref(null)
const brojUlova = ref(0)

const uvjetiPolaska = ref(null) // { uvjeti, trendTlaka, plimaOseka }
const meteoStanje = ref('prazno') // prazno | ucitavanje | ok | greska

const ucitavanje = ref(uredjivanje.value)
const submitting = ref(false)
const greska = ref('')

const mozeSpremiti = computed(
    () =>
        !submitting.value &&
        datum.value &&
        vrijemeOd.value &&
        naziv.value.trim() &&
        lokacija.value &&
        // Sprema se ono što je u pregledu, pa čekamo da se osvježi za zadnji unos.
        meteoStanje.value !== 'ucitavanje',
)

// Vrijeme "do" prije vremena "od" znači da se izlazak prelio u idući dan.
function spoji(datumStr, vrijemeStr, pocetak = null) {
    if (!vrijemeStr) return null
    const d = new Date(`${datumStr}T${vrijemeStr}`)
    if (pocetak && d < pocetak) d.setDate(d.getDate() + 1)
    return d
}

function satIzTimestampa(ts) {
    return ts ? ts.toDate().toTimeString().slice(0, 5) : ''
}

onMounted(async () => {
    if (!uredjivanje.value) return

    try {
        const snap = await getDoc(doc(db, 'izlasci', props.id))
        if (!snap.exists()) {
            greska.value = 'Izlazak ne postoji.'
            return
        }

        const iz = snap.data()
        rucnoUpisano.value = !!iz.naziv
        naziv.value = iz.naziv ?? ''
        mjesto.value = iz.mjesto ?? ''
        datum.value = isoDatum(iz.vrijemeOd.toDate())
        vrijemeOd.value = satIzTimestampa(iz.vrijemeOd)
        vrijemeDo.value = satIzTimestampa(iz.vrijemeDo)
        biljeska.value = iz.biljeska ?? ''
        lokacija.value = { gpsSirina: iz.gpsSirina, gpsDuzina: iz.gpsDuzina }
        brojUlova.value = iz.brojUlova ?? 0
    } catch (e) {
        console.error(e)
        greska.value =
            e.code === 'permission-denied' ? 'Nemate pristup ovom izlasku.' : 'Izlazak se nije učitao.'
    } finally {
        ucitavanje.value = false
    }
})

const predlozeniNaziv = computed(() => {
    const dan = datum.value ? fmtDatumKratki.format(new Date(`${datum.value}T00:00:00`)) : ''
    return [mjesto.value, dan].filter(Boolean).join(' · ');
})

// Dok korisnik ne upiše svoj naziv, pratimo prijedlog
watch(predlozeniNaziv, (novi) => {
    if (!rucnoUpisano.value) naziv.value = novi
}, { immediate: true })

// Nominatim dopušta jedan upit u sekundi, pa čekamo da oznaka stane.
let odmakNaziv
watch(
    lokacija,
    () => {
        if (!lokacija.value) return

        clearTimeout(odmakNaziv)
        odmakNaziv = setTimeout(async () => {
            trazimNaziv.value = true
            try {
                mjesto.value =
                    (await nazivZaKoordinate(
                        lokacija.value.gpsSirina,
                        lokacija.value.gpsDuzina,
                    )) ?? ''
            } catch (e) {
                console.error(e)
            } finally {
                trazimNaziv.value = false
            }
        }, 700)
    },
    { deep: true },
)

onUnmounted(() => clearTimeout(odmakNaziv))

// Brojač upita: odgovor koji stigne nakon što su se polja opet promijenila
// odbacujemo, da u pregledu nikad ne ostanu uvjeti za stari unos.
let zadnjiUpit = 0

async function ucitajMeteo() {
    if (!lokacija.value || !datum.value) return

    const upit = ++zadnjiUpit
    meteoStanje.value = 'ucitavanje'

    try {
        const rezultat = await uvjetiZaTrenutak(
            lokacija.value.gpsSirina,
            lokacija.value.gpsDuzina,
            spoji(datum.value, vrijemeOd.value || '00:00'),
        )
        if (upit !== zadnjiUpit) return
        uvjetiPolaska.value = rezultat
        meteoStanje.value = 'ok'
    } catch (e) {
        if (upit !== zadnjiUpit) return
        console.error(e)
        meteoStanje.value = 'greska'
    }
}

// Čekamo da korisnik prestane mijenjati polja da ne zovemo Open-Meteo na svaku
// tipku. Stanje se ipak odmah prebacuje u učitavanje, da se za to vrijeme ne
// može spremiti stari pregled.
let odmak
watch([lokacija, datum, vrijemeOd], () => {
    clearTimeout(odmak)
    if (!lokacija.value || !datum.value) return

    zadnjiUpit++
    meteoStanje.value = 'ucitavanje'
    odmak = setTimeout(ucitajMeteo, 600)
})

onUnmounted(() => clearTimeout(odmak))

const pregled = computed(() => {
    const u = uvjetiPolaska.value?.uvjeti
    if (!u) return []
    const t = uvjetiPolaska.value.trendTlaka
    const trend = t && `${t.smjer} ${t.promjena > 0 ? '+' : ''}${t.promjena} hPa u ${t.sati} h`
    return [
        u.smjerVjetra && `${u.smjerVjetra} ${u.brzinaVjetraCv ?? '?'} čv`,
        u.stanjeMora && (u.valoviM != null ? `${u.stanjeMora} (${u.valoviM} m)` : u.stanjeMora),
        u.tempZrakaC != null && `zrak ${u.tempZrakaC} °C`,
        u.tempMoraC != null && `more ${u.tempMoraC} °C`,
        u.tlakHpa != null && `${u.tlakHpa} hPa${trend ? ` (${trend})` : ''}`,
    ].filter(Boolean)
})

function uvjetiZaSpremanje() {
    if (meteoStanje.value === 'ok') return { uvjetiNaMoru: uvjetiPolaska.value.uvjeti }
    return uredjivanje.value ? {} : { uvjetiNaMoru: null }
}

const tekstGumba = computed(() => {
    if (submitting.value) return 'Spremam…'
    if (meteoStanje.value === 'ucitavanje') return 'Čekam uvjete…'
    return uredjivanje.value ? 'Spremi promjene' : 'Spremi izlazak'
})

async function spremi() {
    if (!mozeSpremiti.value) return

    greska.value = ''
    submitting.value = true

    try {
        const od = spoji(datum.value, vrijemeOd.value)
        const doo = spoji(datum.value, vrijemeDo.value, od)

        const podaci = {
            vrijemeOd: Timestamp.fromDate(od),
            vrijemeDo: doo ? Timestamp.fromDate(doo) : null,
            naziv: naziv.value.trim(),
            mjesto: mjesto.value || null,
            biljeska: biljeska.value.trim(),
            gpsSirina: lokacija.value.gpsSirina,
            gpsDuzina: lokacija.value.gpsDuzina,
            ...uvjetiZaSpremanje(),
        }

        let id = props.id
        if (uredjivanje.value) {
            await updateDoc(doc(db, 'izlasci', id), { ...podaci, azurirano: serverTimestamp() })
        } else {
            const ref = await addDoc(collection(db, 'izlasci'), {
                ...podaci,
                korisnikId: authStore.user.uid,
                brojUlova: 0,
                stvoreno: serverTimestamp(),
            })
            id = ref.id
        }

        toast.success('Izlazak je spremljen.')
        router.push({ name: 'izlazak', params: { id } })
    } catch (e) {
        console.error(e)
        greska.value = 'Izlazak nije spremljen. Pokušajte ponovno.'
        submitting.value = false
    }
}
</script>

<template>
    <div class="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <Button v-if="uredjivanje" as-child variant="link" size="xs" class="text-muted-foreground px-0">
            <RouterLink :to="{ name: 'izlazak', params: { id } }">← Natrag na izlazak</RouterLink>
        </Button>

        <p v-if="ucitavanje" class="text-muted-foreground text-sm">Učitavam…</p>

        <Alert v-else-if="uredjivanje && !lokacija" variant="destructive">
            <AlertDescription>{{ greska }}</AlertDescription>
        </Alert>

        <Card v-else>
            <CardHeader>
                <CardTitle>{{ uredjivanje ? 'Uredi izlazak' : 'Novi izlazak' }}</CardTitle>
                <CardDescription v-if="!uredjivanje">
                    Prvo zabilježite izlazak, pa mu dodajte ulove.
                </CardDescription>
            </CardHeader>

            <CardContent>
                <form novalidate class="space-y-5" @submit.prevent="spremi">
                    <Alert v-if="greska" variant="destructive">
                        <AlertDescription>{{ greska }}</AlertDescription>
                    </Alert>

                    <div class="space-y-2">
                        <Label for="datum">Datum</Label>
                        <Input id="datum" v-model="datum" type="date" :disabled="submitting || brojUlova > 0" />
                        <p v-if="brojUlova > 0" class="text-muted-foreground text-xs">
                            Izlazak već ima ulove, pa se datum ne može mijenjati.
                        </p>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-2">
                            <Label for="od">Od</Label>
                            <Input id="od" v-model="vrijemeOd" type="time" :disabled="submitting" />
                        </div>
                        <div class="space-y-2">
                            <Label for="do">Do</Label>
                            <Input id="do" v-model="vrijemeDo" type="time" :disabled="submitting" />
                        </div>
                    </div>

                    <div class="space-y-2">
                        <Label>Područje lova</Label>
                        <MapPicker v-model="lokacija" />
                    </div>

                    <div class="space-y-2">
                        <Label for="naziv">Naziv izlaska</Label>
                        <Input id="naziv" v-model="naziv" type="text" placeholder="Npr. Porer · 16. 9. 2026."
                            :disabled="submitting" @input="rucnoUpisano = true" />
                        <p v-if="trazimNaziv" class="text-muted-foreground text-xs">Tražim naziv mjesta…</p>
                        <p v-else-if="rucnoUpisano && predlozeniNaziv && naziv !== predlozeniNaziv"
                            class="text-muted-foreground text-xs">
                            Prijedlog: {{ predlozeniNaziv }} ·
                            <button type="button" class="underline underline-offset-2"
                                @click="rucnoUpisano = false; naziv = predlozeniNaziv">
                                vrati
                            </button>
                        </p>
                        <p v-else class="text-muted-foreground text-xs">
                            Predlaže se prema mjestu i datumu, a možete ga slobodno promijeniti.
                        </p>
                    </div>

                    <div class="space-y-2">
                        <Label>Uvjeti na moru</Label>

                        <p v-if="meteoStanje === 'prazno'" class="text-muted-foreground text-sm">
                            Odaberite lokaciju i vrijeme polaska.
                        </p>

                        <p v-else-if="meteoStanje === 'ucitavanje'" class="text-muted-foreground text-sm">
                            Dohvaćam prognozu…
                        </p>

                        <div v-else-if="meteoStanje === 'greska'" class="space-y-2">
                            <p class="text-destructive text-sm">Prognoza nije dohvaćena.</p>
                            <Button type="button" variant="outline" size="sm" @click="ucitajMeteo">
                                Pokušaj ponovno
                            </Button>
                        </div>

                        <p v-else-if="!pregled.length" class="text-muted-foreground text-sm">
                            Za taj termin nema podataka o uvjetima.
                        </p>

                        <div v-else class="flex flex-wrap gap-2">
                            <span v-for="red in pregled" :key="red"
                                class="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs">
                                {{ red }}
                            </span>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <Label for="biljeska">Bilješka</Label>
                        <Textarea id="biljeska" v-model="biljeska" rows="3"
                            placeholder="Kako je prošlo, s kim, što si primijetio…" :disabled="submitting" />
                    </div>

                    <Button type="submit" size="lg" class="w-full" :disabled="!mozeSpremiti">
                        {{ tekstGumba }}
                    </Button>
                </form>
            </CardContent>
        </Card>
    </div>
</template>
