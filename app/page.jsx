import { AppBar, Container, CssBaseline, IconButton, Toolbar, Typography } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChessField from './chess';

import { SettingsContexts } from './settings.jsx';

export default function App() {
    return (
        <>
            <CssBaseline />
            <SettingsContexts>
                <AppBar position="static">
                    <Toolbar>
                        <IconButton
                            edge="start"
                            color="inherit"
                            aria-label="menu">
                            <MenuIcon />
                        </IconButton>
                        <Typography variant="h6" sx={{ flexGrow: 1 }}>
                            Opening Trainer
                        </Typography>
                    </Toolbar>
                </AppBar>
                <Toolbar/>
                <Container maxWidth="sm">
                    <ChessField />
                </Container>
            </SettingsContexts>
        </>
    );
}
