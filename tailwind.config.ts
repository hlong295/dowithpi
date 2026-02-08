import type { Config } from "tailwindcss";

// all in fixtures is set to tailwind v3 as interims solutions

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
		keyframes: {
			'accordion-down': {
				from: { height: '0' },
				to: { height: 'var(--radix-accordion-content-height)' }
			},
			'accordion-up': {
				from: { height: 'var(--radix-accordion-content-height)' },
				to: { height: '0' }
			},
			'bio-breathe': {
				'0%, 100%': { transform: 'scale(1)', opacity: '1' },
				'50%': { transform: 'scale(1.05)', opacity: '0.95' }
			},
			'bio-pulse': {
				'0%, 100%': { opacity: '1', transform: 'scale(1)' },
				'50%': { opacity: '0.7', transform: 'scale(1.1)' }
			},
			'bio-glow-pulse': {
				'0%, 100%': { opacity: '0.3', transform: 'scale(1)' },
				'50%': { opacity: '0.6', transform: 'scale(1.15)' }
			},
			'bio-float': {
				'0%, 100%': { transform: 'translateY(0px)' },
				'50%': { transform: 'translateY(-3px)' }
			},
			'bio-icon-pulse': {
				'0%, 100%': { transform: 'scale(1)' },
				'50%': { transform: 'scale(1.08)' }
			},
			'bio-cell-expand': {
				'0%': { transform: 'scale(0.8)', opacity: '0' },
				'50%': { opacity: '1' },
				'100%': { transform: 'scale(1.2)', opacity: '0' }
			},
			'bio-fade-in-up': {
				'0%': { opacity: '0', transform: 'translateY(12px)' },
				'100%': { opacity: '1', transform: 'translateY(0)' }
			},
			'bio-page-fade': {
				'0%': { opacity: '0', transform: 'translateY(8px)' },
				'100%': { opacity: '1', transform: 'translateY(0)' }
			},
			'bio-header-gradient': {
				'0%': { backgroundPosition: '0% 50%' },
				'50%': { backgroundPosition: '100% 50%' },
				'100%': { backgroundPosition: '0% 50%' }
			},
			'bio-active-glow': {
				'0%, 100%': { boxShadow: '0 0 0 0 rgba(76, 175, 80, 0.4)' },
				'50%': { boxShadow: '0 0 0 8px rgba(76, 175, 80, 0)' }
			}
			,
			// Brand/title shimmer + subtle header micro-motion
			'bio-logo-shimmer': {
				'0%': { backgroundPosition: '-200% 0%' },
				'100%': { backgroundPosition: '200% 0%' }
			},
			'bio-idle-pulse': {
				'0%, 100%': { opacity: '0.55' },
				'50%': { opacity: '0.9' }
			},
			// Core button ring animation for bottom nav
			'bio-core-ring': {
				'0%': { transform: 'scale(0.92)', opacity: '0.0' },
				'20%': { opacity: '0.45' },
				'60%': { opacity: '0.12' },
				'100%': { transform: 'scale(1.28)', opacity: '0.0' }
			}
		},
		animation: {
			'bio-breathe': 'bio-breathe 6s ease-in-out infinite',
			'bio-pulse': 'bio-pulse 4s ease-in-out infinite',
			'bio-glow-pulse': 'bio-glow-pulse 6s ease-in-out infinite',
			'bio-float': 'bio-float 3s ease-in-out infinite',
			'bio-icon-pulse': 'bio-icon-pulse 5s ease-in-out infinite',
			'bio-cell-expand': 'bio-cell-expand 6s ease-out infinite',
			'bio-fade-in-up': 'bio-fade-in-up 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
			'bio-page-fade': 'bio-page-fade 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
			'bio-header-gradient': 'bio-header-gradient 7s ease infinite',
			'bio-active-glow': 'bio-active-glow 2s ease-in-out infinite',
			'bio-logo-shimmer': 'bio-logo-shimmer 3.8s ease-in-out infinite',
			'bio-idle-pulse': 'bio-idle-pulse 2.8s ease-in-out infinite',
			'bio-core-ring': 'bio-core-ring 2.6s ease-out infinite'
		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
