<script setup>
import { computed, ref } from 'vue'
import {
    LControlLayers,
    LMap,
    LMarker,
    LTileLayer,
} from '@vue-leaflet/vue-leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
    // { gpsSirina: number, gpsDuzina: number } ili null
    modelValue: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue'])

const POCETNI_CENTAR = [45.15, 13.90]

const center = ref(
    props.modelValue
        ? [props.modelValue.gpsSirina, props.modelValue.gpsDuzina]
        : POCETNI_CENTAR,
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

function naKlik(e) {
    posalji(e.latlng.lat, e.latlng.lng)
}

function naPovlacenje(latlng) {
    posalji(latlng.lat, latlng.lng)
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
            <p class="text-sm text-slate-500">Kliknite na kartu ili povucite oznaku.</p>
            <button type="button" :disabled="traziLokaciju"
                class="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                @click="mojaLokacija">
                {{ traziLokaciju ? 'Tražim…' : 'Moja lokacija' }}
            </button>
        </div>


        <div class="h-[500px] w-full overflow-hidden rounded-lg border border-slate-300">
            <LMap v-model:zoom="zoom" v-model:center="center" @click="naKlik">
                <LTileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap"
                    layer-type="base" name="Osnovna karta" />
                <LControlLayers />
                <LMarker v-if="markerLatLng" :lat-lng="markerLatLng" :draggable="true" @update:lat-lng="naPovlacenje" />
            </LMap>
        </div>

        <p v-if="greska" role="alert" class="text-xs text-rose-600">{{ greska }}</p>

        <p v-if="modelValue" class="font-mono text-xs text-slate-500">
            {{ modelValue.gpsSirina.toFixed(5) }}, {{ modelValue.gpsDuzina.toFixed(5) }}
        </p>
        <p v-else class="text-xs text-slate-400">Lokacija nije odabrana.</p>
    </div>
</template>