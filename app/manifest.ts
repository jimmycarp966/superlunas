import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Cotizador Lunas Confort",
        short_name: "Lunas",
        description: "Cotizador de ventas y planes para Lunas Confort",
        start_url: "/cotizador",
        display: "standalone",
        background_color: "#0a1729",
        theme_color: "#0f1f36",
        orientation: "portrait",
        lang: "es-AR",
        icons: [
            {
                src: "/icons/icon-192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "maskable",
            },
            {
                src: "/icons/icon-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
        ],
    };
}
