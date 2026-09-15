<script setup>
import { computed, ref } from 'vue'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
} from 'reka-ui'
import { CheckIcon, ChevronDownIcon } from '@lucide/vue'
import { cn } from '@/lib/utils'

const props = defineProps({
  id: { type: String, required: false },
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Pretraži…' },
  emptyText: { type: String, default: 'Nema rezultata.' },
  disabled: Boolean,
  class: { type: null, required: false },
})

const emit = defineEmits(['update:modelValue'])

const upit = ref('')

// Pretraga bez kvačica, da "skarpina" pronađe "Škarpina".
function bezKvacica(s) {
  return String(s)
    .toLowerCase()
    .replaceAll('đ', 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

const odabrano = computed(() => props.options.find((o) => o.value === props.modelValue) ?? null)

const filtrirane = computed(() => {
  const q = bezKvacica(upit.value.trim())
  if (!q) return props.options
  return props.options.filter(
    (o) => bezKvacica(o.label).includes(q) || bezKvacica(o.hint ?? '').includes(q),
  )
})
</script>

<template>
  <ComboboxRoot
    :model-value="modelValue"
    :disabled="disabled"
    ignore-filter
    open-on-click
    open-on-focus
    @update:model-value="emit('update:modelValue', $event ?? '')"
    @update:open="upit = ''"
  >
    <ComboboxAnchor :class="cn('relative w-full', props.class)">
      <ComboboxInput
        :id="id"
        v-model="upit"
        :display-value="() => odabrano?.label ?? ''"
        :placeholder="placeholder"
        class="border-input focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-lg border bg-transparent py-2 pr-9 pl-3 text-sm outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <ComboboxTrigger class="absolute inset-y-0 right-0 flex items-center px-3" :disabled="disabled">
        <ChevronDownIcon class="text-muted-foreground size-4" />
      </ComboboxTrigger>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        position="popper"
        :side-offset="4"
        class="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-50 max-h-60 w-(--reka-combobox-trigger-width) overflow-hidden rounded-lg border shadow-md"
      >
        <ComboboxViewport class="max-h-60 overflow-y-auto p-1">
          <div v-if="!filtrirane.length" class="text-muted-foreground px-3 py-2 text-sm">
            {{ emptyText }}
          </div>

          <ComboboxItem
            v-for="o in filtrirane"
            :key="o.value"
            :value="o.value"
            class="data-highlighted:bg-accent data-highlighted:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none"
          >
            <span>{{ o.label }}</span>
            <span v-if="o.hint" class="text-muted-foreground text-xs">{{ o.hint }}</span>
            <CheckIcon v-if="o.value === modelValue" class="text-muted-foreground ml-auto size-4" />
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
