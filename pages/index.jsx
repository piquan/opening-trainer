'use client';

import * as React from 'react';

import { AppBar, Container, Drawer, IconButton, Toolbar, Typography } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

import ChessField from './chess';
import { SettingsContexts } from './settings.jsx';
import { SearchSettings } from './settings-page.jsx';

export default function App() {
    const [settingsOpen, setSettingsOpen] = React.useState(false);
    const onSettingsToggle = () => setSettingsOpen(s => !s);

    return (
        <>
            <SettingsContexts>
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
            </SettingsContexts>
        </>
    );
}
