/**
 * Chain selection composable
 */
import { ref, computed } from 'vue'
import { chains, getChain, getChainIds, getExplorerUrl } from '@/utils/chains.js'
import { useStorage } from './useStorage.js'

export function useChain(defaultChainId = 1) {
  const { data: chainId } = useStorage('selectedChainId', defaultChainId)
  
  const chain = computed(() => getChain(chainId.value))
  const chainName = computed(() => chain.value?.name || `Chain ${chainId.value}`)
  
  const allChains = computed(() => {
    return getChainIds().map(id => ({
      id,
      ...getChain(id),
    }))
  })
  
  function setChain(id) {
    chainId.value = Number(id)
  }
  
  function explorerUrl(value, type = 'address') {
    return getExplorerUrl(chainId.value, value, type)
  }
  
  return {
    chainId,
    chain,
    chainName,
    allChains,
    setChain,
    explorerUrl,
  }
}
