import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import tiffinRoutes from './routes/tiffins';
import orderRoutes from './routes/orders';
import deliveryRoutes from './routes/deliveries';
import walletRoutes from './routes/wallet';
import bankAccountRoutes from './routes/bankAccounts';

const app = express();
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/media', express.static(path.resolve(env.uploadDir)));
app.use('/uploads', express.static(path.resolve(env.uploadDir)));

app.use('/api', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tiffins', tiffinRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/bank-accounts', bankAccountRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ detail: 'Internal server error' });
});

app.listen(env.port, () => {
  console.log(`Node backend running on port ${env.port}`);
});

