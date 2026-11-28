export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    'grid-cols-1',
    'md:grid-cols-2',
    'lg:grid-cols-3',
    'gap-6',
    'gap-8',
    'flex',
    'flex-col',
    'min-h-screen',
    'items-center',
    'justify-between',
    'rounded-xl',
    'rounded-2xl',
    'border',
    'overflow-hidden',
    'object-cover',
    'backdrop-blur-md',
    'sticky',
    'top-0',
    'z-40',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--theme-primary, #005a87)',
          'primary-hover': 'var(--theme-primary-hover, #00476b)',
          accent: 'var(--theme-accent, #0ea5e9)',
          surface: 'var(--theme-surface, #ffffff)',
          bg: 'var(--theme-bg, #f4f8fc)',
          text: 'var(--theme-text, #0f172a)',
        },
      },
      borderRadius: {
        theme: 'var(--theme-radius, 0.75rem)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        shimmer: 'shimmer 2.5s infinite linear',
      },
    },
  },
  plugins: [],
};
