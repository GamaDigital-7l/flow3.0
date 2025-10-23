import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem", // Reduzir padding padrão do container
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Nova Paleta de Cores - Dark Futurista (Gama Flow)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))", // Fundo principal escuro
        foreground: "hsl(var(--foreground))", // Texto principal claro

        primary: {
          DEFAULT: "hsl(var(--primary))", // Gama Pink: #ED1857
          foreground: "hsl(var(--primary-foreground))", // Texto para o rosa
          hover: "hsl(var(--primary-hover))", // Versão mais viva: #FF2E6E
          light: "hsl(var(--primary-light))", // Rosa mais claro para uso em backgrounds sutis
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))", // Cinza escuro para cards/botões secundários
          foreground: "hsl(var(--secondary-foreground))", // Texto para o cinza
          hover: "hsl(var(--secondary-hover))", // Hover do cinza
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))", // Vermelho para ações perigosas
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))", // Cinza para elementos secundários
          foreground: "hsl(var(--muted-foreground))", // Texto para o cinza
        },
        accent: {
          DEFAULT: "hsl(var(--accent))", // Cinza claro para hover/active
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))", // Fundo de popovers/menus
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))", // Fundo de cards
          foreground: "hsl(var(--card-foreground))",
        },
        // Cores de status
        status: {
          success: "var(--status-success)", // #2ECC71
          alert: "var(--status-alert)",     // #F1C40F
          overdue: "var(--status-overdue)", // Roxo forte (mantido)
          urgent: "var(--status-urgent)",   // Azul vibrante (mantido)
          today: "var(--status-today)",     // Verde suave (mantido)
          completed: "var(--status-completed)", // Cinza translúcido (mantido)
          recurring: "var(--status-recurring)", // Lilás (mantido)
        },
        // Cores específicas para a Sidebar
        'sidebar-background': 'hsl(var(--sidebar-background))',
        'sidebar-foreground': 'hsl(var(--sidebar-foreground))',
        'sidebar-primary': 'hsl(var(--sidebar-primary))',
        'sidebar-primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
        'sidebar-accent': 'hsl(var(--sidebar-accent))',
        'sidebar-accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
        'sidebar-border': 'hsl(var(--sidebar-border))',
        'sidebar-ring': 'hsl(var(--sidebar-ring))',
      },
      borderRadius: {
        lg: "var(--radius)", // Padrão: 0.75rem (12px)
        md: "calc(var(--radius) - 2px)", // 10px
        sm: "calc(var(--radius) - 4px)", // 8px
        // Adicionando um radius maior para cards e botões, conforme solicitado (16px a 24px)
        "xl": "1rem", // 16px
        "2xl": "1.5rem", // 24px
        "3xl": "2rem", // 32px (para elementos maiores ou mais arredondados)
      },
      fontSize: { // Ajustar tamanhos de fonte para densidade
        xs: ['0.75rem', { lineHeight: '1rem' }], // 12px
        sm: ['0.8125rem', { lineHeight: '1.25rem' }], // 13px (ligeiramente menor que o padrão)
        base: ['0.875rem', { lineHeight: '1.375rem' }], // 14px (ligeiramente menor que o padrão)
        lg: ['1rem', { lineHeight: '1.5rem' }], // 16px
        xl: ['1.125rem', { lineHeight: '1.75rem' }], // 18px
        '2xl': ['1.25rem', { lineHeight: '1.75rem' }], // 20px
        '3xl': ['1.5rem', { lineHeight: '2rem' }], // 24px
        '4xl': ['2rem', { lineHeight: '2.5rem' }], // 32px
        '5xl': ['2.5rem', { lineHeight: '1' }], // 40px
      },
      spacing: { // Espaçamentos mais compactos
        'px': '1px',
        '0': '0px',
        '0.5': '0.125rem', // 2px
        '1': '0.25rem', // 4px
        '1.5': '0.375rem', // 6px
        '2': '0.5rem', // 8px
        '2.5': '0.625rem', // 10px
        '3': '0.75rem', // 12px
        '3.5': '0.875rem', // 14px
        '4': '1rem', // 16px
        '5': '1.25rem', // 20px
        '6': '1.5rem', // 24px
        '7': '1.75rem', // 28px
        '8': '2rem', // 32px
        '9': '2.25rem', // 36px
        '10': '2.5rem', // 40px
        '11': '2.75rem', // 44px (altura mínima para toque)
        '12': '3rem', // 48px
        '14': '3.5rem', // 56px
        '16': '4rem', // 64px
        '20': '5rem', // 80px
        '24': '6rem', // 96px
        '28': '7rem', // 112px
        '32': '8rem', // 128px
        '36': '9rem', // 144px
        '40': '10rem', // 160px
        '44': '11rem', // 176px
        '48': '12rem', // 192px
        '52': '13rem', // 208px
        '56': '14rem', // 224px
        '60': '15rem', // 240px
        '64': '16rem', // 256px
        '72': '18rem', // 288px
        '80': '20rem', // 320px
        '96': '24rem', // 384px
        'safe-top': 'var(--sat)',
        'safe-bottom': 'var(--sab)',
        'safe-left': 'var(--sal)',
        'safe-right': 'var(--sar)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Definindo Inter como a fonte principal
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // Keyframes para o efeito de glow
        glow: {
          "0%, 100%": { boxShadow: "0 0 5px rgba(95, 119, 255, 0.4), 0 0 10px rgba(76, 46, 255, 0.3)" },
          "50%": { boxShadow: "0 0 10px rgba(95, 119, 255, 0.6), 0 0 20px rgba(76, 46, 255, 0.5)" },
        },
        // Keyframes para fade + slide
        "fade-in-slide-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out-slide-down": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(10px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        glow: "glow 3s ease-in-out infinite", // Animação de glow contínua
        "fade-in-slide-up": "fade-in-slide-up 0.3s ease-out forwards",
        "fade-out-slide-down": "fade-out-slide-down 0.3s ease-out forwards",
      },
      boxShadow: {
        // Sombras personalizadas para profundidade
        "light-sm": "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",
        "light-md": "0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)",
        "light-lg": "0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)",
        "glow-sm": "0 0 8px rgba(95, 119, 255, 0.5)", // Pequeno glow
        "glow-md": "0 0 15px rgba(95, 119, 255, 0.7)", // Médio glow
        "glow-lg": "0 0 25px rgba(95, 119, 255, 0.9)", // Grande glow
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;