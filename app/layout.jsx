import './globals.css'

export const metadata = {
    title: 'Opening Trainer',
    description: 'Practice openings based on actual Lichess games',
    viewport: {
        width: 'device-width',
        initialScale: 1,
    },
}

export default function RootLayout({children}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    )
}
