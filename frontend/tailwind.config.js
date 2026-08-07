// tailwind.config.js
module.exports = {
  content: [
    // ... mevcut içerik yollarınız
  ],
  theme: {
    extend: {
      colors: {
        // Tasarımın ana renk paleti
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
          950: '#083344',
        },
        deepblue: {
          DEFAULT: '#030712',
          light: '#1e3a8a', // Gradyanlar için
        },
      },
      animation: {
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'cloud-drift': 'cloud-drift 20s ease-in-out infinite',
      },
      keyframes: {
        'cloud-drift': {
          '0%, 100%': { transform: 'translateX(-10px)' },
          '50%': { transform: 'translateX(10px)' },
        },
      },
      boxShadow: {
        // Neon parlama efektleri
        'neon-cyan': '0 0 20px rgba(34, 211, 238, 0.3), 0 0 40px rgba(34, 211, 238, 0.1)',
        'neon-blue': '0 0 20px rgba(59, 130, 246, 0.3), 0 0 40px rgba(59, 130, 246, 0.1)',
        'neon-green': '0 0 15px rgba(74, 222, 128, 0.15)',
        'glass-inner': 'inset 0 0 10px rgba(255, 255, 255, 0.05)',
      },
    },
  },
  plugins: [],
  // Önemli: Koyu tema sınıf tabanlı olmalı
  darkMode: 'class',
}