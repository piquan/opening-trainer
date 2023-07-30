import Head from 'next/head'

import { CssBaseline } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import './globals.css'

const queryClient = new QueryClient();

export default function App({ Component, pageProps }) {
    return (<>
                <CssBaseline />
                <Head>
                    <title>Opening Trainer</title>
                    <meta name="viewport"
                          content="initial-scale=1, width=device-width" />
                </Head>
                <QueryClientProvider client={queryClient}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <Component {...pageProps} />
                    </LocalizationProvider>
                </QueryClientProvider>
            </>);
}
