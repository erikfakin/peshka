<script setup>
import { computed, onMounted, ref } from 'vue'
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
} from 'firebase/firestore'
import { storeToRefs } from 'pinia'
import { db } from '@/firebase.js'
import { useAuthStore } from '@/stores/auth.js'
import PotvrdaDialog from '@/components/PotvrdaDialog.vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

const props = defineProps({
    ulovId: { type: String, required: true },
})

const { user } = storeToRefs(useAuthStore())

const komentari = ref([])
const tekst = ref('')
const ucitavanje = ref(true)
const salje = ref(false)
const greska = ref('')
const zaBrisanje = ref(null)

const fmt = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
})

const mozePoslati = computed(() => !salje.value && tekst.value.trim().length > 0)

function putanja() {
    return collection(db, 'ulovi', props.ulovId, 'komentari')
}

function imeAutora() {
    return user.value?.displayName || user.value?.email?.split('@')[0] || 'Ribolovac'
}

async function ucitaj() {
    try {
        const snap = await getDocs(query(putanja(), orderBy('vrijeme')))
        komentari.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    } catch (e) {
        console.error(e)
        greska.value = 'Komentari se nisu učitali.'
    } finally {
        ucitavanje.value = false
    }
}

onMounted(ucitaj)

async function posalji() {
    if (!mozePoslati.value || !user.value) return

    greska.value = ''
    salje.value = true

    try {
        await addDoc(putanja(), {
            korisnikId: user.value.uid,
            autorIme: imeAutora(),
            tekst: tekst.value.trim(),
            vrijeme: serverTimestamp(),
        })
        tekst.value = ''
        await ucitaj()
    } catch (e) {
        console.error(e)
        greska.value = 'Komentar nije poslan.'
    } finally {
        salje.value = false
    }
}

async function obrisi() {
    const komentar = zaBrisanje.value
    zaBrisanje.value = null

    try {
        await deleteDoc(doc(db, 'ulovi', props.ulovId, 'komentari', komentar.id))
        komentari.value = komentari.value.filter((k) => k.id !== komentar.id)
    } catch (e) {
        console.error(e)
        greska.value = 'Komentar nije obrisan.'
    }
}
</script>

<template>
    <section class="space-y-4">
        <h2 class="text-lg font-semibold tracking-tight">
            Komentari<template v-if="komentari.length"> ({{ komentari.length }})</template>
        </h2>

        <Alert v-if="greska" variant="destructive">
            <AlertDescription>{{ greska }}</AlertDescription>
        </Alert>

        <p v-if="ucitavanje" class="text-muted-foreground text-sm">Učitavam…</p>

        <ul v-else-if="komentari.length" class="space-y-3">
            <li v-for="komentar in komentari" :key="komentar.id" class="rounded-lg border px-4 py-3">
                <div class="flex items-baseline justify-between gap-3">
                    <span class="text-sm font-medium">{{ komentar.autorIme }}</span>
                    <span v-if="komentar.vrijeme" class="text-muted-foreground shrink-0 text-xs">
                        {{ fmt.format(komentar.vrijeme.toDate()) }}
                    </span>
                </div>
                <p class="mt-1 text-sm whitespace-pre-line">{{ komentar.tekst }}</p>
                <Button v-if="user?.uid === komentar.korisnikId" variant="link" size="xs"
                    class="text-muted-foreground mt-1 px-0" @click="zaBrisanje = komentar">
                    Obriši
                </Button>
            </li>
        </ul>

        <p v-else class="text-muted-foreground text-sm">Još nema komentara.</p>

        <form v-if="user" class="space-y-2" @submit.prevent="posalji">
            <Textarea v-model="tekst" rows="3" maxlength="1000" :disabled="salje"
                placeholder="Napišite komentar…" aria-label="Novi komentar" />
            <Button type="submit" :disabled="!mozePoslati">
                {{ salje ? 'Šaljem…' : 'Objavi' }}
            </Button>
        </form>

        <p v-else class="text-muted-foreground text-sm">
            <RouterLink :to="{ name: 'login' }" class="underline underline-offset-4">Prijavite se</RouterLink>
            za komentiranje.
        </p>

        <PotvrdaDialog :open="!!zaBrisanje" naslov="Obrisati komentar?" @update:open="zaBrisanje = null"
            @potvrda="obrisi" />
    </section>
</template>
