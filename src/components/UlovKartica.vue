<script setup>
import { computed } from 'vue'
import { FishIcon } from '@lucide/vue'
import { useSifrarnici } from '@/composables/useSifrarnici.js'
import { fmtDatum } from '@/utils/format.js'
import { Button } from '@/components/ui/button'

const props = defineProps({
    ulov: { type: Object, required: true },
    autor: { type: String, default: null }, // null dok se ime još učitava
})

const { nazivVrste, nazivNacina, nazivMamca } = useSifrarnici()

const detalji = computed(() => ({ name: 'ulov', params: { id: props.ulov.id } }))

const naslov = computed(() => {
    const vrsta = nazivVrste(props.ulov.vrstaRibeId)
    return props.ulov.masaKg != null ? `${vrsta}, ${props.ulov.masaKg} kg` : vrsta
})

const oznake = computed(() =>
    [
        props.ulov.duljinaCm != null && `${props.ulov.duljinaCm} cm`,
        nazivNacina(props.ulov.nacinLovaId),
        nazivMamca(props.ulov.mamacId),
    ].filter(Boolean),
)

// Npr. "Jugo 8 čv, more valovito"
const vrijeme = computed(() => {
    const u = props.ulov.uvjeti
    if (!u) return ''

    const vjetar = [u.smjerVjetra, u.brzinaVjetraCv != null && `${u.brzinaVjetraCv} čv`]
        .filter(Boolean)
        .join(' ')
    const more = u.stanjeMora && `more ${u.stanjeMora.toLowerCase()}`

    return [vjetar, more].filter(Boolean).join(', ')
})
</script>

<template>
    <article class="bg-card rounded-xl border p-3 shadow-sm">
        <RouterLink :to="detalji" tabindex="-1" aria-hidden="true"
            class="bg-muted group relative block overflow-hidden rounded-lg">
            <img v-if="ulov.naslovnaUrl" :src="ulov.naslovnaUrl" alt="" loading="lazy"
                class="aspect-video w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
            <div v-else class="text-muted-foreground/40 grid h-24 place-items-center">
                <FishIcon class="size-10" />
            </div>

            <span v-if="ulov.pusten"
                class="bg-secondary/95 text-secondary-foreground absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-medium shadow-sm">
                puštena
            </span>
        </RouterLink>

        <div class="space-y-1 px-1 pt-3">
            <h3 class="text-lg leading-tight font-bold tracking-tight">{{ naslov }}</h3>

            <p v-if="oznake.length" class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <template v-for="(o, i) in oznake" :key="o">
                    <span v-if="i" class="bg-foreground/30 h-3.5 w-px" aria-hidden="true" />
                    <span>{{ o }}</span>
                </template>
            </p>

            <p v-if="vrijeme" class="text-sm">{{ vrijeme }}</p>
        </div>

        <div class="flex items-end justify-between gap-3 px-1 pt-3">
            <div class="min-w-0 text-sm">
                <p class="truncate">
                    Objavio
                    <RouterLink v-if="autor" :to="{ name: 'profil', params: { id: ulov.korisnikId } }"
                        class="font-medium hover:underline hover:underline-offset-4">
                        {{ autor }}
                    </RouterLink>
                    <span v-else class="bg-muted inline-block h-3.5 w-24 animate-pulse rounded align-middle" />
                </p>
                <p class="text-muted-foreground text-xs">
                    {{ fmtDatum.format(ulov.vrijemeUlova.toDate()) }}
                </p>
            </div>

            <Button as-child size="lg" class="shrink-0 px-5">
                <RouterLink :to="detalji">Detalji</RouterLink>
            </Button>
        </div>
    </article>
</template>
