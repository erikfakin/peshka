<script setup>
import { computed } from 'vue'
import { LMap, LMarker, LTileLayer, LTooltip } from '@vue-leaflet/vue-leaflet'
import { ikonaOznake } from '@/utils/oznaka.js'

const props = defineProps({
    gpsSirina: { type: Number, required: true },
    gpsDuzina: { type: Number, required: true },
    naziv: { type: String, default: '' },
    zum: { type: Number, default: 13 },
})

const tocka = computed(() => [props.gpsSirina, props.gpsDuzina])
</script>

<template>
    <div class="h-64 w-full overflow-hidden rounded-lg border">
        <LMap :zoom="zum" :center="tocka" class="h-full w-full">
            <LTileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors" />

            <LMarker :lat-lng="tocka" :icon="ikonaOznake()">
                <LTooltip v-if="naziv">{{ naziv }}</LTooltip>
            </LMarker>
        </LMap>
    </div>
</template>