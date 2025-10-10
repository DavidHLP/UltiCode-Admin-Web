<script setup>
import { subscribeToast, unsubscribeToast } from '@/utils/toast'
import { useToast } from 'primevue/usetoast'
import { onBeforeUnmount, onMounted } from 'vue'

const toast = useToast()

function handleToast(payload) {
  if (Array.isArray(payload)) {
    payload.filter(Boolean).forEach((item) => toast.add(item))
  } else if (payload) {
    toast.add(payload)
  }
}

onMounted(() => {
  subscribeToast(handleToast)
})

onBeforeUnmount(() => {
  unsubscribeToast(handleToast)
})
</script>

<template>
  <Toast position="top-right" />
</template>
