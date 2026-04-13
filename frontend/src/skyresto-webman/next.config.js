module.exports = (_phase, { defaultConfig }) => {
    /** @type {import('next').NextConfig} */
    const nextConfig = {
        reactStrictMode: false,
        poweredByHeader: false,
        images: {
            remotePatterns: [
                {
                    protocol: 'https',
                    hostname: '**.dcorp.com.vn',
                },
                {
                    protocol: 'https',
                    hostname: '**.vstorage.vngcloud.vn',
                },
                {
                    protocol: 'https',
                    hostname: 'avatars.githubusercontent.com',
                },

                {
                    protocol: 'https',
                    hostname: 'cloudflare-ipfs.com',
                },
                {
                    protocol: 'http',
                    hostname: '**.dcorp.com.vn',
                },
                {
                    protocol: 'https',
                    hostname: 'attachments.clickup.com',
                },
            ],
        },
        webpack: (config, {buildId , webpack}) => {
            config.module.rules.push({
                test: /\.svg$/,
                use: ['@svgr/webpack'],
            })
            config.resolve.alias.canvas = false;
            return config
        },
        output:
            process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
        async redirects() {
            return [
                {
                    source: '/dashboard',
                    destination: '/dashboard/overview',
                    permanent: true,
                },
            ]
        },
        experimental: {
            forceSwcTransforms: true,
            turbo: {
                rules: {
                    '*.svg': {
                        loaders: ['@svgr/webpack'],
                        as: '*.js',
                    },
                },
                resolveAlias : {
                    canvas: './empty-module.ts',
                }
            },
            optimizePackageImports: [
                "@dcorp/web-ui",
                "@dcorp/web-ui/antd",
                "@dcorp/web-ui/radix-ui",
                "@dcorp/web-editor",
                "@dcorp/web-form",
                "@dcorp/web-timeline",
                "@radix-ui/react-icons",
                "chart.js",
                "dayjs",
                "@radix-ui/react-icons",
                "react-syntax-highlighter",
                "react-pdf",
                "react-chartjs-2",
                "react-big-calendar",
                "react-beautiful-dnd",
                "query-string",
                "highlight.js",
                "embla-carousel",
                "embla-carousel-react",
                "d3-org-chart"
            ] ,
        },
        transpilePackages: ["@tanstack/query-core",'lucide-react'],
        eslint: {
            ignoreDuringBuilds: true,
        },
        typescript: {
            ignoreBuildErrors: true,
        },
    }

    return nextConfig
}
