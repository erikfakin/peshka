<script setup>
import { computed } from 'vue'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

const props = defineProps({
    modelValue: { type: String, default: 'sve' },
    datumi: { type: Array, default: () => [] },
    id: { type: String, default: 'godina' },
    sveTekst: { type: String, default: 'Sve' },
    skrivenaOznaka: Boolean,
})

const emit = defineEmits(['update:modelValue'])

const godine = computed(() =>
    [...new Set(props.datumi.map((d) => d.getFullYear()))].sort((a, b) => b - a),
)
</script>

<template>
    <div class="flex items-center gap-2">
        <Label :for="id" :class="{ 'sr-only': skrivenaOznaka }">Godina</Label>
        <Select :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
            <SelectTrigger :id="id" class="min-w-24">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="sve">{{ sveTekst }}</SelectItem>
                <SelectItem v-for="g in godine" :key="g" :value="String(g)">{{ g }}</SelectItem>
            </SelectContent>
        </Select>
    </div>
</template>
