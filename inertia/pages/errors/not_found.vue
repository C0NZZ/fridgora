<script setup lang="ts">
import { useAppPath } from '~/composables/use_app_path'
import Button from 'primevue/button'
import { useI18n } from '~/composables/use_i18n'

const appPath = useAppPath()

const { t } = useI18n()
</script>

<template>
  <div
    class="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center dark:bg-zinc-950"
  >
    <span class="pi pi-exclamation-circle mb-6 block text-8xl text-slate-300 dark:text-zinc-700" />
    <h1 class="mb-2 text-5xl font-bold text-slate-800 dark:text-zinc-100">404</h1>
    <p class="mb-8 text-lg text-slate-500 dark:text-zinc-400">{{ t('common.page_not_found') }}</p>
    <Button as="a" :href="appPath('/')" :label="t('common.back_to_home')" icon="pi pi-home" />
  </div>
</template>
