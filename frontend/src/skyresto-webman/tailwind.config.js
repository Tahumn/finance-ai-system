/* eslint-disable global-require */
/* eslint-disable import/no-unresolved */
// eslint-disable-next-line import/no-extraneous-dependencies
const plugin = require('tailwindcss/plugin')
const { paletteBuilder } = require('./src/themes/palette-builder')

/** @type {import('tailwindcss').Config} */
module.exports = {
    presets: [require('@dcorp/ui-preset')],
    darkMode: 'class',
    content: [
        `src/**/*.{jsx,tsx}`,
        './node_modules/@dcorp/web-ui/dist/**/*.js',
        './node_modules/@dcorp/web-editor/dist/**/*.js',
        './node_modules/@dcorp/web-form/dist/**/*.js',
        './node_modules/@dcorp/web-timeline/dist/**/*.js',
    ],
    important: true,
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--app-font-sans)'],
            },
            colors: {
                ...paletteBuilder(),
            },
            width: {
                sidebar: '256px',
                'collapse-sidebar': '64px',
            },
            minWidth: {
                sidebar: '256px',
                'collapse-sidebar': '64px',
            },
            maxWidth: {
                sidebar: '256px',
                'collapse-sidebar': '64px',
            },
            height: {
                'sidebar-header': '48px',
                screen: 'calc(100dvh)',
            },
            boxShadow: {
                1: '0px 0px 10px rgba(0, 0, 0, 0.1',
                popover:
                    '0 3px 6px -4px rgb(0 0 0 / 12%), 0 6px 16px 0 rgb(0 0 0 / 8%), 0 9px 28px 8px rgb(0 0 0 / 5%)',
                sidebar: '0 -1px 0 rgb(255,255,255,0.1) inset',
                dropdown:
                    '0px 9px 28px 8px rgba(0, 0, 0, 0.05), 0px 3px 6px -4px rgba(0, 0, 0, 0.12), 0px 6px 16px rgba(0, 0, 0, 0.08)',
                'drop-shadow': '0px 0px 10px 0px rgba(0, 0, 0, 0.10)',
                'page-title': '0px 0px 16px 0px rgba(0, 0, 0, 0.08)',
                'page-title-dark': '0px 0px 16px 0px rgba(255, 255, 255, 0.08)',
                footer: '0px 6px 16px 0px rgba(0, 0, 0, 0.08)',
                'footer-dark': '0px 0px 16px 0px rgba(255, 255, 255, 0.08)',
                'sticky-column':
                    'inset -0.625rem 0 0.5rem -0.5rem rgba(5, 5, 5, 0.06)',
            },
            spacing: {
                'sidebar-header': '48px',
                sidebar: '256px',
                'collapse-sidebar': '64px',
            },

            keyframes: {
                zomIn: {
                    '0%': { transform: 'scale(0)', opacity: 0 },
                    '100%': { transform: 'scale(1)', opacity: 1 },
                },

                fadeOut: {
                    '0%': { opacity: 1, zIndex: 0 },
                    '100%': { opacity: 0, zIndex: -10 },
                },
            },

            animation: {
                zomIn: 'zomIn .1s ease-in-out 1',
                fadeOut: 'fadeOut 5s ease-in-out 1',
            },
        },
        maxHeight: (theme) => ({
            ...theme('height'),
        }),
        minHeight: (theme) => ({
            ...theme('height'),
        }),
    },
    plugins: [
        require('@tailwindcss/aspect-ratio'),
        ({ addVariant }) => {
            addVariant('child', '& > *')
            addVariant('child-hover', '& > *:hover')
        },
        plugin(function addUtilitiesPlugin({ addUtilities }) {
            addUtilities({
                '.flex-center': {
                    display: 'flex',
                    'align-items': 'center',
                    'justify-content': 'center',
                },
                '.scrollbarHover::-webkit-scrollbar': {
                    position: 'absolute',
                    left: 0,
                },
                '.scrollbarHover::-webkit-scrollbar-track': {
                    background: 'transparent',
                },
                '.scrollbarHover::-webkit-scrollbar-thumb': {
                    background: 'transparent',
                },

                '.scrollbarHover:hover::-webkit-scrollbar-track': {
                    background: 'transparent',
                },
                '.scrollbarHover:hover::-webkit-scrollbar-thumb': {
                    'background-color': 'hsl(var(--muted-foreground))',
                    'border-radius': '8px',
                },
            })
        }),
    ],
}
