<script setup>
import { MapPinIcon } from '@lucide/vue'
import OznakeUlova from '@/components/OznakeUlova.vue'
import { useSifrarnici } from '@/composables/useSifrarnici.js'


defineProps({
    ulov: { type: Object, required: true },
    podnaslov: { type: String, default: '' },
    poveznica: Boolean,
})

const { nazivVrste } = useSifrarnici()
</script>

<template>
    <div class="min-w-0 flex-1 space-y-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <RouterLink v-if="poveznica" :to="{ name: 'ulov', params: { id: ulov.id } }"
                class="truncate font-medium hover:underline">
                {{ nazivVrste(ulov.vrstaRibeId) }}
            </RouterLink>
            <span v-else class="truncate font-medium group-hover:underline">
                {{ nazivVrste(ulov.vrstaRibeId) }}
            </span>
            <OznakeUlova :ulov="ulov" />
        </div>

        <p v-if="ulov.masaKg || ulov.duljinaCm" class="text-sm font-medium tabular-nums">
            <template v-if="ulov.masaKg">{{ ulov.masaKg }} kg</template>
            <template v-if="ulov.masaKg && ulov.duljinaCm"> · </template>
            <template v-if="ulov.duljinaCm">{{ ulov.duljinaCm }} cm</template>
        </p>

        <p v-if="podnaslov" class="text-muted-foreground text-xs">{{ podnaslov }}</p>

        <p v-if="ulov.lokacija?.naziv" class="text-muted-foreground flex items-center gap-1 text-xs">
            <MapPinIcon class="size-3 shrink-0" />
            <span class="truncate">{{ ulov.lokacija.naziv }}</span>
        </p>

        <slot />
    </div>
</template>
