import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { areFilterParamsEqual, type FilterParams } from './use_filter_params'
import { useAppPath } from './use_app_path'

interface UseListFiltersOptions {
  route: string
  onlyProps: string[]
  buildParams: () => FilterParams
  getCurrentPage: () => number
}

/**
 * Encapsulates the repeated pagination + filter navigation boilerplate.
 *
 * Usage:
 *   const { applyFilters, navigateClear, onPageChange, navigateSort } = useListFilters({
 *     route: '/orders',
 *     onlyProps: ['orders', 'filters'],
 *     buildParams: buildFilterParams,
 *     getCurrentPage: () => props.orders.meta.currentPage,
 *   })
 *
 *   // In clearFilters — reset your own refs first, then call navigateClear()
 *   // In onSort     — update your own sort refs first, then call navigateSort()
 *   // In onSort (audit-style) — update sort ref, then call applyFilters()
 */
export function useListFilters({
  route,
  onlyProps,
  buildParams,
  getCurrentPage,
}: UseListFiltersOptions) {
  const appPath = useAppPath()
  const url = () => appPath(route)
  const routerOpts = { preserveState: true as const, only: onlyProps }
  const lastAppliedFilterParams = ref(buildParams())

  function applyFilters() {
    const nextParams = buildParams()
    const page = areFilterParamsEqual(nextParams, lastAppliedFilterParams.value)
      ? getCurrentPage()
      : 1
    router.get(url(), { ...nextParams, page }, routerOpts)
    lastAppliedFilterParams.value = nextParams
  }

  /** Call AFTER resetting your own filter refs — reads their current (reset) values. */
  function navigateClear() {
    const params = buildParams()
    lastAppliedFilterParams.value = params
    router.get(url(), params, routerOpts)
  }

  function onPageChange(event: { page: number }) {
    router.get(url(), { ...buildParams(), page: event.page + 1 }, routerOpts)
  }

  /** Call AFTER updating your own sort refs — reads their current (updated) values. */
  function navigateSort() {
    router.get(url(), { ...buildParams(), page: 1 }, routerOpts)
  }

  return { applyFilters, navigateClear, onPageChange, navigateSort }
}
