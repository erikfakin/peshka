<script setup>
import { computed, onMounted, ref } from 'vue'
import { doc, getDoc } from 'firebase/firestore'
import { storeToRefs } from 'pinia'
import { db } from '@/firebase.js'
import { ucitajFotografijeUlova } from '@/utils/fotografije.js'
import { useAuthStore } from '@/stores/auth'
import { useSifrarnici } from '@/composables/useSifrarnici.js'
import MapPrikaz from '@/components/MapPrikaz.vue'
import Komentari from '@/components/Komentari.vue'
import OznakeUlova from '@/components/OznakeUlova.vue'
import PregledSlike from '@/components/PregledSlike.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const props = defineProps({
    id: { type: String, required: true },
})

const { user } = storeToRefs(useAuthStore())
const { ucitaj: ucitajSifrarnike, nazivVrste, nazivNacina, nazivMamca } = useSifrarnici()

const ulov = ref(null)
const fotografije = ref([])
const autor = ref('')
const ucitavanje = ref(true)
const greska = ref('')
const pregled = ref(null)

const vlasnik = computed(() => !!user.value && user.value.uid === ulov.value?.korisnikId)

const fmtDatum = new Intl.DateTimeFormat('hr-HR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
})

async function ucitajAutora(korisnikId) {
    const snap = await getDoc(doc(db, 'korisnici', korisnikId))
    const p = snap.data()
    autor.value = p ? `${p.ime} ${p.prezime}`.trim() : 'Ribolovac'
}

async function ucitaj() {
    try {
        const snap = await getDoc(doc(db, 'ulovi', props.id))
        if (!snap.exists()) {
            greska.value = 'Ulov ne postoji.'
            return
        }

        ulov.value = { id: snap.id, ...snap.data() }
        const jeVlasnik = user.value?.uid === ulov.value.korisnikId

        await Promise.all([
            ucitajSifrarnike(),
            ucitajAutora(ulov.value.korisnikId),
            ucitajFotografijeUlova(props.id, { korisnikId: jeVlasnik ? user.value.uid : null })
                .then((f) => (fotografije.value = f))
                .catch((e) => console.error(e)),
        ])
    } catch (e) {
        console.error(e)
        greska.value =
            e.code === 'permission-denied' ? 'Ovaj ulov nije javan.' : 'Podaci se nisu učitali.'
    } finally {
        ucitavanje.value = false
    }
}

onMounted(ucitaj)

const vrsta = computed(() => nazivVrste(ulov.value?.vrstaRibeId))
const podnaslov = computed(() =>
    [
        fmtDatum.format(ulov.value.vrijemeUlova.toDate()),
        nazivNacina(ulov.value.nacinLovaId),
        nazivMamca(ulov.value.mamacId),
    ]
        .filter(Boolean)
        .join(' · '),
)

const mjere = computed(() => {
    const u = ulov.value
    if (!u) return []
    return [
        u.duljinaCm != null && { oznaka: 'Duljina', vrijednost: `${u.duljinaCm} cm` },
        u.masaKg != null && { oznaka: 'Masa', vrijednost: `${u.masaKg} kg` },
    ].filter(Boolean)
})

function sPredznakom(n) {
    return `${n > 0 ? '+' : ''}${n}`
}

function opisSvjetla(s) {
    if (!s?.dio) return null

    const blizu = [s.minutaDoIzlaska, s.minutaDoZalaska].find(
        (m) => m != null && Math.abs(m) <= 180,
    )
    if (blizu == null) return s.dio

    const dogadjaj = blizu === s.minutaDoIzlaska ? 'izlaska' : 'zalaska'
    const opis =
        blizu > 0
            ? `${blizu} min do ${dogadjaj} sunca`
            : `${Math.abs(blizu)} min nakon ${dogadjaj} sunca`
    return `${s.dio} · ${opis}`
}

const uvjetiRedci = computed(() => {
    const u = ulov.value?.uvjeti
    const m = ulov.value?.mjesec
    const t = ulov.value?.trendTlaka
    const p = ulov.value?.plimaOseka

    return [
        {
            oznaka: 'Vjetar',
            vrijednost:
                u?.smjerVjetra &&
                [u.smjerVjetra, u.brzinaVjetraCv != null && `${u.brzinaVjetraCv} čv`]
                    .filter(Boolean)
                    .join(' · '),
        },
        {
            oznaka: 'More',
            vrijednost:
                u &&
                [u.stanjeMora, u.valoviM != null && `valovi ${u.valoviM} m`]
                    .filter(Boolean)
                    .join(' · '),
        },
        { oznaka: 'Temperatura zraka', vrijednost: u?.tempZrakaC != null && `${u.tempZrakaC} °C` },
        { oznaka: 'Temperatura mora', vrijednost: u?.tempMoraC != null && `${u.tempMoraC} °C` },
        {
            oznaka: 'Tlak',
            vrijednost:
                u?.tlakHpa != null &&
                (t
                    ? `${u.tlakHpa} hPa · ${t.smjer} ${sPredznakom(t.promjena)} hPa u ${t.sati} h`
                    : `${u.tlakHpa} hPa`),
        },
        {
            oznaka: 'Plima / oseka',
            vrijednost: p && `${p.smjer} ${sPredznakom(p.promjena)} m u ${p.sati} h`,
        },
        {
            oznaka: 'Mjesec',
            vrijednost: m?.naziv && `${m.naziv} · ${m.osvijetljenost} % osvijetljen`,
        },
        { oznaka: 'Svjetlo', vrijednost: opisSvjetla(ulov.value?.sunce) },
    ].filter((r) => r.vrijednost)
})
</script>

<template>
    <div class="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <p v-if="ucitavanje" class="text-muted-foreground text-sm">Učitavam…</p>

        <Alert v-else-if="greska" variant="destructive">
            <AlertDescription>{{ greska }}</AlertDescription>
        </Alert>

        <template v-else-if="ulov">
            <Button v-if="vlasnik" as-child variant="link" size="xs" class="text-muted-foreground px-0">
                <RouterLink :to="{ name: 'izlazak', params: { id: ulov.izlazakId } }">
                    ← Natrag na izlazak
                </RouterLink>
            </Button>

            <Card>
                <CardHeader>
                    <div class="flex flex-wrap items-center gap-2">
                        <CardTitle>{{ vrsta }}</CardTitle>
                        <OznakeUlova :ulov="ulov" />
                    </div>

                    <p class="text-muted-foreground text-sm">{{ podnaslov }}</p>
                </CardHeader>

                <CardContent class="space-y-3">
                    <p class="text-sm">
                        Dodao:
                        <RouterLink :to="{ name: 'profil', params: { id: ulov.korisnikId } }"
                            class="font-medium underline underline-offset-4">
                            {{ autor }}
                        </RouterLink>
                    </p>

                    <dl v-if="mjere.length" class="flex flex-wrap gap-6 border-t pt-3 text-sm">
                        <div v-for="m in mjere" :key="m.oznaka">
                            <dt class="text-muted-foreground">{{ m.oznaka }}</dt>
                            <dd class="font-medium">{{ m.vrijednost }}</dd>
                        </div>
                    </dl>
                </CardContent>
            </Card>

            <section v-if="fotografije.length" class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <button v-for="foto in fotografije" :key="foto.id" type="button"
                    class="focus-visible:ring-ring overflow-hidden rounded-lg outline-none focus-visible:ring-2"
                    @click="pregled = { url: foto.url, opis: vrsta }">
                    <img :src="foto.url" :alt="vrsta" loading="lazy"
                        class="bg-muted aspect-square w-full object-cover transition hover:opacity-90" />
                </button>
            </section>

            <section v-if="uvjetiRedci.length" class="space-y-2">
                <h2 class="text-lg font-semibold tracking-tight">Uvjeti</h2>

                <div class="overflow-hidden rounded-lg border">
                    <table class="w-full border-collapse text-sm">
                        <tbody>
                            <tr v-for="red in uvjetiRedci" :key="red.oznaka" class="border-b last:border-0">
                                <th scope="row"
                                    class="bg-muted text-muted-foreground w-2/5 px-4 py-2.5 text-left align-top font-medium">
                                    {{ red.oznaka }}
                                </th>
                                <td class="px-4 py-2.5">{{ red.vrijednost }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section v-if="ulov.lokacija?.gpsSirina != null" class="space-y-2">
                <div class="flex items-baseline justify-between gap-3">
                    <h2 class="text-lg font-semibold tracking-tight">Lokacija</h2>
                    <span v-if="ulov.lokacija.naziv" class="text-muted-foreground text-sm">
                        {{ ulov.lokacija.naziv }}
                    </span>
                </div>
                <MapPrikaz :gps-sirina="ulov.lokacija.gpsSirina" :gps-duzina="ulov.lokacija.gpsDuzina"
                    :naziv="ulov.lokacija.naziv ?? ''" />
            </section>

            <Komentari :ulov-id="ulov.id" />
        </template>

        <PregledSlike v-model:slika="pregled" />
    </div>
</template>
