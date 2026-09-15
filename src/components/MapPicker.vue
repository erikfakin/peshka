<script setup>
import { computed, ref } from 'vue'
import { LMap, LMarker, LTileLayer } from '@vue-leaflet/vue-leaflet'
import { Button } from '@/components/ui/button'
import { ikonaOznake } from '@/utils/oznaka.js'

const props = defineProps({
    // { gpsSirina: number, gpsDuzina: number } ili null
    modelValue: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue'])

const POCETNI_CENTAR = [45.15, 13.9]

const center = ref(
    props.modelValue ? [props.modelValue.gpsSirina, props.modelValue.gpsDuzina] : POCETNI_CENTAR,
)
const zoom = ref(10)

const greska = ref('')
const traziLokaciju = ref(false)

const markerLatLng = computed(() =>
    props.modelValue ? [props.modelValue.gpsSirina, props.modelValue.gpsDuzina] : null,
)

function posalji(lat, lng) {
    emit('update:modelValue', {
        gpsSirina: Number(lat.toFixed(5)),
        gpsDuzina: Number(lng.toFixed(5)),
    })
}

function mojaLokacija() {
    if (!navigator.geolocation) {
        greska.value = 'Preglednik ne podržava geolokaciju.'
        return
    }

    greska.value = ''
    traziLokaciju.value = true

    navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
            traziLokaciju.value = false
            center.value = [coords.latitude, coords.longitude]
            zoom.value = 11
            posalji(coords.latitude, coords.longitude)
        },
        (err) => {
            traziLokaciju.value = false
            greska.value =
                err.code === err.PERMISSION_DENIED
                    ? 'Pristup lokaciji je odbijen.'
                    : 'Lokaciju nije moguće dohvatiti.'
        },
        { enableHighAccuracy: true, timeout: 10000 },
    )
}
</script>

<template>
    <div class="space-y-2">
        <div class="flex items-center justify-between gap-3">
            <p class="text-muted-foreground text-sm">Kliknite na kartu ili povucite oznaku.</p>
            <Button type="button" variant="outline" size="sm" :disabled="traziLokaciju" @click="mojaLokacija">
                {{ traziLokaciju ? 'Tražim…' : 'Moja lokacija' }}
            </Button>
        </div>

        <div class="h-100 w-full overflow-hidden rounded-lg border">
            <LMap v-model:zoom="zoom" v-model:center="center" @click="posalji($event.latlng.lat, $event.latlng.lng)">
                <LTileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                <LMarker v-if="markerLatLng" :lat-lng="markerLatLng" :draggable="true" :icon="ikonaOznake()"
                    @update:lat-lng="posalji($event.lat, $event.lng)" />
            </LMap>
        </div>

        <p v-if="greska" role="alert" class="text-destructive text-xs">{{ greska }}</p>

        <p v-if="modelValue" class="text-muted-foreground font-mono text-xs">
            {{ modelValue.gpsSirina.toFixed(5) }}, {{ modelValue.gpsDuzina.toFixed(5) }}
        </p>
        <p v-else class="text-muted-foreground text-xs">Lokacija nije odabrana.</p>
    </div>
</template>
