<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
    modelValue: { type: String, default: '' },
    opcije: { type: Array, default: () => [] },
    id: { type: String, required: true },
    placeholder: { type: String, default: 'Pretraži…' },
    prazno: { type: String, default: 'Nema rezultata.' },
    disabled: Boolean,
})
const emit = defineEmits(['update:modelValue'])

const korijen = ref(null)
const unos = ref(null)
const otvoren = ref(false)
const upit = ref('')
const oznaceni = ref(0)

function bezKvacica(s) {
    return String(s)
        .toLowerCase()
        .replaceAll('đ', 'd')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

const odabrano = computed(
    () => props.opcije.find((o) => o.id === props.modelValue) ?? null,
)

const filtrirane = computed(() => {
    const q = bezKvacica(upit.value.trim())
    if (!q) return props.opcije
    return props.opcije.filter(
        (o) => bezKvacica(o.naziv).includes(q) || bezKvacica(o.pomocni ?? '').includes(q),
    )
})

watch(filtrirane, () => (oznaceni.value = 0))

function otvori() {
    if (props.disabled) return
    otvoren.value = true
    upit.value = ''
    oznaceni.value = Math.max(
        0,
        props.opcije.findIndex((o) => o.id === props.modelValue),
    )
    nextTick(() => unos.value?.focus())
}

function zatvori() {
    otvoren.value = false
    upit.value = ''
}

function odaberi(opcija) {
    emit('update:modelValue', opcija.id)
    zatvori()
}

function ocisti() {
    emit('update:modelValue', '')
    zatvori()
}

function tipka(e) {
    if (e.key === 'ArrowDown') {
        e.preventDefault()
        oznaceni.value = Math.min(oznaceni.value + 1, filtrirane.value.length - 1)
        pomakni()
    } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        oznaceni.value = Math.max(oznaceni.value - 1, 0)
        pomakni()
    } else if (e.key === 'Enter') {
        e.preventDefault()
        const o = filtrirane.value[oznaceni.value]
        if (o) odaberi(o)
    } else if (e.key === 'Escape') {
        zatvori()
    }
}

function pomakni() {
    nextTick(() => {
        korijen.value
            ?.querySelector(`[data-indeks="${oznaceni.value}"]`)
            ?.scrollIntoView({ block: 'nearest' })
    })
}

function izvana(e) {
    if (otvoren.value && korijen.value && !korijen.value.contains(e.target)) zatvori()
}

onMounted(() => document.addEventListener('mousedown', izvana))
onUnmounted(() => document.removeEventListener('mousedown', izvana))

const okvir =
    'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-slate-900 ' +
    'transition focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15 ' +
    'disabled:cursor-not-allowed disabled:bg-slate-50'
</script>

<template>
    <div ref="korijen" class="relative">

        <button v-if="!otvoren" :id="id" type="button" role="combobox" :aria-expanded="false"
            :aria-controls="`${id}-lista`" :disabled="disabled"
            :class="[okvir, 'flex items-center justify-between gap-2']" @click="otvori">
            <span :class="odabrano ? 'truncate' : 'truncate text-slate-400'">
                {{ odabrano?.naziv ?? placeholder }}
            </span>
            <span class="shrink-0 text-slate-400">▾</span>
        </button>


        <input v-else ref="unos" v-model="upit" type="text" role="combobox" :aria-expanded="true"
            :aria-controls="`${id}-lista`" :aria-activedescendant="`${id}-opcija-${oznaceni}`" autocomplete="off"
            :placeholder="placeholder" :class="okvir" @keydown="tipka" />

        <ul v-if="otvoren" :id="`${id}-lista`" role="listbox"
            class="absolute z-9999 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            <li v-if="!filtrirane.length" class="px-3 py-2 text-sm text-slate-500">
                {{ prazno }}
            </li>

            <li v-for="(opcija, i) in filtrirane" :id="`${id}-opcija-${i}`" :key="opcija.id" :data-indeks="i"
                role="option" :aria-selected="opcija.id === modelValue" class="cursor-pointer px-3 py-2 text-sm"
                :class="i === oznaceni ? 'bg-slate-100' : ''" @mouseenter="oznaceni = i"
                @mousedown.prevent="odaberi(opcija)">
                <span class="text-slate-900">{{ opcija.naziv }}</span>
                <span v-if="opcija.pomocni" class="ml-2 text-xs text-slate-400">
                    {{ opcija.pomocni }}
                </span>
                <span v-if="opcija.id === modelValue" class="float-right text-slate-400">✓</span>
            </li>

            <li v-if="modelValue" class="mt-1 border-t border-slate-100 pt-1">
                <button type="button" class="w-full px-3 py-1.5 text-left text-xs text-slate-500 hover:text-slate-900"
                    @mousedown.prevent="ocisti">
                    Poništi odabir
                </button>
            </li>
        </ul>
    </div>
</template>