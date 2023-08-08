import * as React from 'react';

import { AppBar, Container, CssBaseline, Drawer, IconButton, Toolbar, Typography } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { Settings } from '@mui/icons-material';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import ChessField from './chess';
import { SettingsContexts } from './settings';
import { SearchSettings } from './settings-page';

const queryClient = new QueryClient();

export default function App() {
    const [settingsOpen, setSettingsOpen] = React.useState(false);
    const onSettingsToggle = () => setSettingsOpen(s => !s);

    return (<>
                <CssBaseline />
                <QueryClientProvider client={queryClient}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <SettingsContexts>
                            <>
                                <AppBar position="static">
                                    <Toolbar>
                                        <Typography variant="h6"
                                                    sx={{ flexGrow: 1 }}>
                                            HumanEdge Chess
                                        </Typography>
                                        <IconButton color="inherit"
                                                    aria-label="settings"
                                                    onClick={onSettingsToggle} >
                                            <Settings />
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
                            </>
                        </SettingsContexts>
                    </LocalizationProvider>
                </QueryClientProvider>
            </>);
}
