<script setup>
import { ref } from 'vue'
import {
    LMap,
    LMarker,
    LTileLayer,
} from '@vue-leaflet/vue-leaflet'

const zoom = ref(10)


const center = ref([45.15, 13.90])

const selectedPlace = ref(null)

const places = [
    {
        id: 1,
        name: 'Pula',
        lat: 44.8666,
        lng: 13.8496,
        description: 'Pula location description.',
    },
    {
        id: 2,
        name: 'Rovinj',
        lat: 45.0812,
        lng: 13.6387,
        description: 'Rovinj location description.',
    },
    {
        id: 3,
        name: 'Poreč',
        lat: 45.2272,
        lng: 13.5957,
        description: 'Poreč location description.',
    },
    {
        id: 4,
        name: 'Pazin',
        lat: 45.2408,
        lng: 13.9367,
        description: 'Pazin location description.',
    },
]

function openPlace(place) {
    selectedPlace.value = place
}

function closeModal() {
    selectedPlace.value = null
}
</script>

<template>
    <div class="h-[calc(100vh-3.5rem)] w-full">
        <LMap v-model:zoom="zoom" :center="center" class="h-full w-full">
            <LTileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors" />

            <LMarker v-for="place in places" :key="place.id" :lat-lng="[place.lat, place.lng]"
                @click="openPlace(place)" />
        </LMap>
    </div>

    <Teleport to="body">
        <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0"
            enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100" leave-to-class="opacity-0">
            <div v-if="selectedPlace" class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4"
                @click.self="closeModal">
                <Transition appear enter-active-class="transition duration-200 ease-out"
                    enter-from-class="scale-95 opacity-0" enter-to-class="scale-100 opacity-100">
                    <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                        <div class="flex items-start justify-between gap-4">
                            <div>
                                <h2 class="text-xl font-semibold text-slate-900">
                                    {{ selectedPlace.name }}
                                </h2>

                                <p class="mt-2 text-sm text-slate-600">
                                    {{ selectedPlace.description }}
                                </p>
                            </div>

                            <button class="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" @click="closeModal">
                                ✕
                            </button>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>