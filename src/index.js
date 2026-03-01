// Allow self-signed certs in development (corporate proxy)
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
const { runMigrations } = require('./db/migrations');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const taskRoutes = require('./routes/tasks');
const chatRoutes = require('./routes/chat');
const calendarRoutes = require('./routes/calendar');
const subscriptionRoutes = require('./routes/subscription');
const healthRoutes = require('./routes/health');

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: config.appBaseUrl,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files
app.use('/public', express.static('public'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/health', healthRoutes);

// Google OAuth2 callback (outside /api prefix)
app.use('/auth', require('./routes/googleOAuth'));

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

async function start() {
  try {
    await runMigrations();
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`Synapse backend running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
