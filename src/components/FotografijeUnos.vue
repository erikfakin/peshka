<script setup>
import { onUnmounted, ref } from 'vue'
import { ImagePlusIcon, XIcon } from '@lucide/vue'
import { Button } from '@/components/ui/button'

const props = defineProps({
    // Nove, još neučitane slike: [{ datoteka: File, pregled: string }]
    modelValue: { type: Array, default: () => [] },
    // Već spremljene fotografije iz Firestorea.
    postojece: { type: Array, default: () => [] },
    disabled: Boolean,
})

const emit = defineEmits(['update:modelValue', 'obrisi-postojecu'])


const odabir = ref(null)

function dodaj(e) {
    const nove = Array.from(e.target.files).filter((d) => d.type.startsWith('image/'))
    emit('update:modelValue', [
        ...props.modelValue,
        ...nove.map((datoteka) => ({ datoteka, pregled: URL.createObjectURL(datoteka) })),
    ])
    e.target.value = ''
}

function makni(i) {
    URL.revokeObjectURL(props.modelValue[i].pregled)
    emit(
        'update:modelValue',
        props.modelValue.filter((_, j) => j !== i),
    )
}

onUnmounted(() => props.modelValue.forEach((s) => URL.revokeObjectURL(s.pregled)))
</script>

<template>
    <div class="space-y-3">
        <ul v-if="postojece.length" class="flex flex-wrap gap-2">
            <li v-for="foto in postojece" :key="foto.id" class="relative">
                <img :src="foto.url" alt="" class="bg-muted size-20 rounded-md object-cover" />
                <button type="button" :disabled="disabled" aria-label="Obriši fotografiju"
                    class="bg-foreground text-background hover:bg-destructive absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full disabled:opacity-40"
                    @click="emit('obrisi-postojecu', foto)">
                    <XIcon class="size-3.5" />
                </button>
            </li>
        </ul>

        <input ref="odabir" type="file" accept="image/*" multiple hidden :disabled="disabled" @change="dodaj" />
        <Button type="button" variant="outline" size="sm" :disabled="disabled" @click="odabir.click()">
            <ImagePlusIcon />
            Dodaj fotografije
        </Button>

        <ul v-if="modelValue.length" class="flex flex-wrap gap-2">
            <li v-for="(slika, i) in modelValue" :key="i" class="relative">
                <img :src="slika.pregled" :alt="slika.datoteka.name" class="bg-muted size-20 rounded-md object-cover" />
                <button type="button" :disabled="disabled" :aria-label="`Ukloni ${slika.datoteka.name}`"
                    class="bg-foreground text-background hover:bg-destructive absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full disabled:opacity-40"
                    @click="makni(i)">
                    <XIcon class="size-3.5" />
                </button>
            </li>
        </ul>

        <p class="text-muted-foreground text-xs">
            <template v-if="modelValue.length">
                {{ modelValue.length }} za učitavanje. Smanjuju se na 1600 px prije slanja.
            </template>
            <template v-else-if="postojece.length">Nove fotografije dodaju se uz postojeće.</template>
            <template v-else>Bez fotografija. Možete ih dodati i kasnije.</template>
        </p>
    </div>
</template>
