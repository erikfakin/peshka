<script setup>
import { computed } from 'vue'

const props = defineProps({
    // [{ oznaka: string, vrijednost: number, opis?: string }]
    redci: { type: Array, default: () => [] },
    decimala: { type: Number, default: 0 },
    prazno: { type: String, default: 'Nema podataka.' },
})

const najveca = computed(() => Math.max(...props.redci.map((r) => r.vrijednost), 0))

function udio(vrijednost) {
    if (!najveca.value) return 0
    return (vrijednost / najveca.value) * 100
}

function broj(v) {
    return v.toFixed(props.decimala)
}
</script>

<template>
    <p v-if="!redci.length" class="text-muted-foreground text-sm">{{ prazno }}</p>

    <ul v-else class="space-y-2">
        <li v-for="red in redci" :key="red.oznaka" class="grid grid-cols-[8rem_1fr_auto] items-center gap-3"
            :title="red.opis ? `${red.oznaka}: ${broj(red.vrijednost)} · ${red.opis}` : undefined">
            <span class="truncate text-sm">{{ red.oznaka }}</span>

            <span class="bg-muted h-2 overflow-hidden rounded-full">
                <span class="bg-chart-2 block h-full rounded-r-[4px]" :style="{ width: `${udio(red.vrijednost)}%` }" />
            </span>

            <span class="text-right text-sm tabular-nums">
                {{ broj(red.vrijednost) }}
                <span v-if="red.opis" class="text-muted-foreground ml-1 text-xs">{{ red.opis }}</span>
            </span>
        </li>
    </ul>
</template>
