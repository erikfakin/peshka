<script setup>
import { onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useFlashStore } from '@/stores/flash.js'

const flashStore = useFlashStore()
const { flash } = storeToRefs(flashStore)

let timer = null


watch(
    flash,
    (value) => {
        clearTimeout(timer)
        if (value) timer = setTimeout(flashStore.clearFlash, 5000)
    },
    { immediate: true },
)

onUnmounted(() => clearTimeout(timer))

const tone = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-rose-200 bg-rose-50 text-rose-700',
}
</script>

<template>
    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="-translate-y-1 opacity-0"
        leave-active-class="transition duration-150 ease-in" leave-to-class="opacity-0">
        <div v-if="flash" role="status"
            class="fixed top-20 left-1/2 z-50 -translate-x-1/2 mb-6 flex items-start gap-3 rounded-md border px-3 py-2 text-sm"
            :class="tone[flash.type] ?? tone.success">
            <p class="flex-1">{{ flash.message }}</p>
            <button type="button" aria-label="Zatvori poruku"
                class="-m-1 rounded p-1 leading-none opacity-60 transition hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
                @click="flashStore.clearFlash">
                &times;
            </button>
        </div>
    </Transition>
</template>
