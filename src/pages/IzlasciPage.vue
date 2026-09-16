<script setup>
import { computed, onMounted, ref } from 'vue'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { storeToRefs } from 'pinia'
import { db } from '@/firebase.js'
import { useAuthStore } from '@/stores/auth'
import { fmtDatumKratki, fmtSat, oblik } from '@/utils/format.js'
import GodinaFilter from '@/components/GodinaFilter.vue'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

const { user } = storeToRefs(useAuthStore())

const izlasci = ref([])
const godina = ref('sve')
const ucitavanje = ref(true)
const greska = ref('')

async function ucitaj() {
    if (!user.value) return

    try {
        const snap = await getDocs(
            query(collection(db, 'izlasci'), where('korisnikId', '==', user.value.uid)),
        )
        izlasci.value = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => b.vrijemeOd.toMillis() - a.vrijemeOd.toMillis())
    } catch (e) {
        console.error(e)
        greska.value = 'Izlasci se nisu učitali.'
    } finally {
        ucitavanje.value = false
    }
}

onMounted(ucitaj)

const prikazani = computed(() =>
    godina.value === 'sve'
        ? izlasci.value
        : izlasci.value.filter((i) => i.vrijemeOd.toDate().getFullYear() === Number(godina.value)),
)

const ukupno = computed(() => ({
    izlazaka: prikazani.value.length,
    ulova: prikazani.value.reduce((z, i) => z + (i.brojUlova ?? 0), 0),
}))

function trajanje(izlazak) {
    const od = fmtSat.format(izlazak.vrijemeOd.toDate())
    if (!izlazak.vrijemeDo) return `od ${od}`
    return `${od} – ${fmtSat.format(izlazak.vrijemeDo.toDate())}`
}

function uvjeti(izlazak) {
    const u = izlazak.uvjetiNaMoru
    if (!u) return '-'
    return (
        [u.smjerVjetra, u.brzinaVjetraCv != null && `${u.brzinaVjetraCv} čv`, u.stanjeMora?.toLowerCase()]
            .filter(Boolean)
            .join(', ') || '-'
    )
}
</script>

<template>
    <div class="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div class="flex flex-wrap items-center justify-between gap-4">
            <h1 class="text-2xl font-semibold tracking-tight">Moji izlasci</h1>
            <Button as-child size="lg">
                <RouterLink :to="{ name: 'novi-izlazak' }">Novi izlazak +</RouterLink>
            </Button>
        </div>

        <p v-if="ucitavanje" class="text-muted-foreground text-sm">Učitavam…</p>

        <Alert v-else-if="greska" variant="destructive">
            <AlertDescription>{{ greska }}</AlertDescription>
        </Alert>

        <template v-else>
            <div class="flex flex-wrap items-center gap-x-8 gap-y-3">
                <GodinaFilter v-model="godina" :datumi="izlasci.map((i) => i.vrijemeOd.toDate())" />

                <p class="text-muted-foreground text-sm">
                    Ukupno:
                    <span class="text-foreground font-medium">
                        {{ ukupno.izlazaka }} {{ oblik(ukupno.izlazaka, ['izlazak', 'izlaska', 'izlazaka']) }}
                    </span>
                </p>
                <p class="text-muted-foreground text-sm">
                    Ulovi: <span class="text-foreground font-medium">{{ ukupno.ulova }}</span>
                </p>
            </div>

            <p v-if="!prikazani.length"
                class="text-muted-foreground rounded-lg border border-dashed px-4 py-12 text-center text-sm">
                {{ izlasci.length ? 'Nema izlazaka u odabranoj godini.' : 'Još nema zabilježenih izlazaka.' }}
            </p>

            <div v-else class="overflow-x-auto rounded-lg border">
                <Table>
                    <TableHeader class="bg-brand-navy [&_th]:text-white">
                        <TableRow class="border-brand-navy hover:bg-transparent">
                            <TableHead>Datum</TableHead>
                            <TableHead>Naziv</TableHead>
                            <TableHead>Trajanje</TableHead>
                            <TableHead>Ulova</TableHead>
                            <TableHead>Uvjeti</TableHead>
                            <TableHead><span class="sr-only">Otvori</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow v-for="izlazak in prikazani" :key="izlazak.id">
                            <TableCell class="whitespace-nowrap">
                                {{ fmtDatumKratki.format(izlazak.vrijemeOd.toDate()) }}
                            </TableCell>
                            <TableCell>{{ izlazak.naziv }}</TableCell>
                            <TableCell class="whitespace-nowrap">{{ trajanje(izlazak) }}</TableCell>
                            <TableCell>{{ izlazak.brojUlova ?? 0 }}</TableCell>
                            <TableCell>{{ uvjeti(izlazak) }}</TableCell>
                            <TableCell class="text-right">
                                <Button as-child variant="link" size="sm">
                                    <RouterLink :to="{ name: 'izlazak', params: { id: izlazak.id } }">
                                        Otvori →
                                    </RouterLink>
                                </Button>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </template>
    </div>
</template>
