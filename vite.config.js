import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    // 500KB를 넘는 파일은 에디터(약 1,140KB)와 코드 색칠 cpp(약 1,020KB)뿐이고, 둘 다 필요할 때만 받는다.
    // 기준을 그 크기에 맞춰 두어, 앞으로 경고가 뜨면 새로 커진 파일이라는 뜻이 되게 한다.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // 자주 안 바뀌는 라이브러리는 따로 묶는다. 앱 코드만 바뀐 배포에서는 폰에 저장된 파일을 다시 쓴다.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react'
          if (id.includes('node_modules/@supabase/')) return 'supabase'
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    // 스마트폰 홈 화면에 앱처럼 설치할 수 있게 한다. 새 배포가 나오면 서비스 워커가 알아서 갱신된다.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: '내 대시보드',
        short_name: '대시보드',
        description: '업무·취미·투자·일정을 한 곳에서 보는 개인 대시보드',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#111827',
        theme_color: '#111827',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 처음 설치할 때는 화면 껍데기(html/css/아이콘)만 저장해 데이터 사용량을 줄인다.
        // 스크립트(js)는 처음 쓸 때 캐시에 쌓이고, Supabase 요청은 항상 네트워크로 가서 데이터가 낡지 않는다.
        globPatterns: ['**/*.{html,css,png,svg,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/') && url.pathname.endsWith('.js'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-scripts',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
})
