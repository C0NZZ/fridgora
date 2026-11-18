import { usePage } from '@inertiajs/vue3'
import type { SharedProps } from '~/types'

export function useAppPath() {
  const page = usePage<SharedProps>()
  return (path: `/${string}`) => (page.props.basePath ?? '') + path
}
