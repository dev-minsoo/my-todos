/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // 첫 로딩 성능: eager로 쓰는 큰·안정 벤더만 캐시 단위로 떼어낸다.
        // lazy 전용 의존성(tiptap→MemoEditor, recharts→ReportPage)은 건드리지 않아
        // 각자의 lazy 청크에 그대로 남는다(eager로 끌려오지 않게).
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return;
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor';
          if (id.includes('/node_modules/@supabase/')) return 'supabase';
          if (/\/node_modules\/(framer-motion|motion-dom|motion-utils)\//.test(id)) return 'motion';
          if (id.includes('/node_modules/@tanstack/')) return 'query';
          // 에디터 코어(메모 탭 전용·lazy). 떼어내도 lazy 그래프에 남아 메모 진입 시 병렬 로딩된다.
          if (/\/node_modules\/(prosemirror-|markdown-it)/.test(id)) return 'editor-pm';
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
