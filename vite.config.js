import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        // For now, we let the JS reach 1MB without a warning.  I
        // don't really see a point in doing any manual chunking.
        chunkSizeWarningLimit: 1024,
    },
    //BASE
})
