import { usePage } from '@inertiajs/vue3'
import type { SharedProps } from '~/types'

export function useAppPath() {
  const page = usePage<SharedProps>()
  return (url: string) =>
    url.startsWith('/') && !url.startsWith('//') ? (page.props.basePath ?? '') + url : url
}
