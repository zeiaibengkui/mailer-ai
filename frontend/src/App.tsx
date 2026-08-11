import { Route, Routes, NavLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import DashboardIcon from '@mui/icons-material/Dashboard'
import GroupsIcon from '@mui/icons-material/Groups'
import SettingsIcon from '@mui/icons-material/Settings'
import { useThemeMode } from './hooks/themeMode.ts'
import { Monogram } from './components/Monogram.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Characters from './pages/Characters.tsx'
import CharacterDetail from './pages/CharacterDetail.tsx'
import Jesus from './pages/Jesus.tsx'
import Settings from './pages/Settings.tsx'

const DRAWER_WIDTH = 220

const NAV = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { to: '/characters', label: 'Characters', icon: <GroupsIcon /> },
  { to: '/jesus', label: 'Jesus', icon: <AutoAwesomeIcon /> },
  { to: '/settings', label: 'Settings', icon: <SettingsIcon /> },
]

export default function App() {
  const { mode, toggle } = useThemeMode()

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, flexGrow: 1 }}>
            <Monogram name="Mailer" size={36} />
            <Box>
              <Typography variant="h6" sx={{ lineHeight: 1.1, letterSpacing: '0.01em' }}>
                Mailer AI
              </Typography>
              <Typography
                variant="overline"
                sx={{ display: 'block', lineHeight: 1.2, mt: 0.25, color: 'text.secondary' }}
              >
                control
              </Typography>
            </Box>
          </Stack>
          <IconButton color="inherit" onClick={toggle} aria-label="toggle color theme">
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {NAV.map((item) => (
              <ListItemButton
                key={item.to}
                component={NavLink}
                to={item.to}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  '&.active': {
                    color: 'primary.main',
                    bgcolor: 'action.hover',
                    boxShadow: (t) => `inset 2px 0 0 ${t.palette.secondary.main}`,
                  },
                  '&.active .MuiListItemIcon-root': { color: 'inherit' },
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/characters" element={<Characters />} />
          <Route path="/characters/:name" element={<CharacterDetail />} />
          <Route path="/jesus" element={<Jesus />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Box>
    </Box>
  )
}
