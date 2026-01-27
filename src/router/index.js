import { createRouter, createWebHashHistory } from 'vue-router'

// Lazy load views for better performance
const Home = () => import('@/views/Home.vue')
const PayloadParser = () => import('@/views/PayloadParser.vue')
const SignatureExtractor = () => import('@/views/SignatureExtractor.vue')
const AddressChecksum = () => import('@/views/AddressChecksum.vue')
const VanityGenerator = () => import('@/views/VanityGenerator.vue')
const BlockExplorers = () => import('@/views/BlockExplorers.vue')
const ProtocolLinks = () => import('@/views/ProtocolLinks.vue')
const VnetReader = () => import('@/views/VnetReader.vue')
const CacheManager = () => import('@/views/CacheManager.vue')

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { title: 'ETH Dev Tools' }
  },
  {
    path: '/payload',
    name: 'PayloadParser',
    component: PayloadParser,
    meta: { title: 'Payload Parser - ETH Dev Tools' }
  },
  {
    path: '/signature',
    name: 'SignatureExtractor',
    component: SignatureExtractor,
    meta: { title: 'Signature Extractor - ETH Dev Tools' }
  },
  {
    path: '/checksum',
    name: 'AddressChecksum',
    component: AddressChecksum,
    meta: { title: 'Address Checksum - ETH Dev Tools' }
  },
  {
    path: '/vanity',
    name: 'VanityGenerator',
    component: VanityGenerator,
    meta: { title: 'Vanity Generator - ETH Dev Tools' }
  },
  {
    path: '/explorers',
    name: 'BlockExplorers',
    component: BlockExplorers,
    meta: { title: 'Block Explorers - ETH Dev Tools' }
  },
  {
    path: '/protocols',
    name: 'ProtocolLinks',
    component: ProtocolLinks,
    meta: { title: 'Protocol Links - ETH Dev Tools' }
  },
  {
    path: '/vnet-reader',
    name: 'VnetReader',
    component: VnetReader,
    meta: { title: 'Contract Reader - ETH Dev Tools' }
  },
  {
    path: '/cache',
    name: 'CacheManager',
    component: CacheManager,
    meta: { title: 'Cache Manager - ETH Dev Tools' }
  },
  // Catch-all redirect to home
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0 }
  }
})

// Update document title on navigation
router.beforeEach((to, from, next) => {
  document.title = to.meta.title || 'ETH Dev Tools'
  next()
})

export default router
