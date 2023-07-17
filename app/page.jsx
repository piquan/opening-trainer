import * as React from 'react';
import {AppBar, Box, Button, Container, CssBaseline, IconButton, Toolbar,
        Paper, Typography} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChessField from './chess';

//import styles from './page.module.css'

export default function App() {
    return (
        <>
            <CssBaseline />
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
        </>
    );
}
