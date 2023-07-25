'use client';

import * as React from 'react';

import { AppBar, Container, CssBaseline, Drawer, IconButton, Toolbar, Typography } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

import { LocalizationProvider } from '@mui/x-date-pickers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'

import ChessField from './chess';
import { SettingsContexts } from './settings.jsx';
import { SearchSettings } from './settings-page.jsx';

const queryClient = new QueryClient();

function Contexts({children}) {
    return (
        <>
            <CssBaseline />
            <QueryClientProvider client={queryClient}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <SettingsContexts>
                        {children}
                    </SettingsContexts>
                </LocalizationProvider>
            </QueryClientProvider>
        </>
    );
}

export default function App() {
    const [settingsOpen, setSettingsOpen] = React.useState(false);
    const onSettingsToggle = () => setSettingsOpen(s => !s);

    return (
        <Contexts>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        Opening Trainer
                    </Typography>
                    <IconButton color="inherit" aria-label="settings"
                                onClick={() => setSettingsOpen(s => !s)} >
                        <SettingsIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>
            <Toolbar/>
            <Drawer anchor="right" open={settingsOpen}
                    onClose={() => setSettingsOpen(false)}>
                <Container sx={{pt: 2}}>
                    <SearchSettings />
                </Container>
            </Drawer>
            <Container maxWidth="sm">
                <ChessField />
            </Container>
        </Contexts>
    );
}
