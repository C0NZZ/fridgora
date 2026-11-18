<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import GuestLayout from '~/layouts/GuestLayout.vue'
import Button from 'primevue/button'
import { useI18n } from '~/composables/use_i18n'
import { useAppPath } from '~/composables/use_app_path'

const { t } = useI18n()
const appPath = useAppPath()
</script>

<template>
  <GuestLayout>
    <Head :title="t('common.welcome')" />

    <div class="text-center">
      <Button
        as="a"
        :href="appPath('/login')"
        :label="t('common.sign_in')"
        icon="pi pi-sign-in"
        class="w-full"
      />
    </div>
  </GuestLayout>
</template>
