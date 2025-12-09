import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../prisma';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  let wallet = await prisma.wallet.findUnique({ where: { userId: req.user!.id } });
  if (!wallet) {
    wallet = await prisma.wallet.create({ data: { userId: req.user!.id, balance: 0 } });
  }
  return res.json(wallet);
});

router.get('/transactions/', authenticate, async (req: AuthRequest, res) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId: req.user!.id } });
  if (!wallet) return res.json([]);
  const txns = await prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(txns);
});

router.post('/deposit/', authenticate, async (req: AuthRequest, res) => {
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  const wallet = await prisma.wallet.upsert({
    where: { userId: req.user!.id },
    create: { userId: req.user!.id, balance: amount },
    update: { balance: { increment: amount } },
  });
  await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      txnType: 'credit',
      amount,
      reference: 'Added to Wallet',
    },
  });
  return res.json(wallet);
});

router.post('/withdraw/', authenticate, (req: AuthRequest, res) => {
  return res.status(403).json({ message: 'The withdrawal facility is temporarily stopped.' });
});

router.get('/bank-accounts/', authenticate, async (req: AuthRequest, res) => {
  const accounts = await prisma.bankAccount.findMany({ where: { userId: req.user!.id } });
  return res.json(accounts);
});

router.post('/bank-accounts/', authenticate, async (req: AuthRequest, res) => {
  const { account_holder_name, bank_name, account_number, ifsc_code, is_primary } = req.body;
  if (!account_holder_name || !bank_name || !account_number || !ifsc_code) {
    return res.status(400).json({ detail: 'Missing fields' });
  }
  if (is_primary) {
    await prisma.bankAccount.updateMany({
      where: { userId: req.user!.id },
      data: { isPrimary: false },
    });
  }
  const account = await prisma.bankAccount.create({
    data: {
      userId: req.user!.id,
      accountHolderName: account_holder_name,
      bankName: bank_name,
      accountNumber: account_number,
      ifscCode: ifsc_code,
      isPrimary: is_primary !== false,
    },
  });
  return res.status(201).json(account);
});

router.delete('/bank-accounts/:id/', authenticate, async (req: AuthRequest, res) => {
  const account = await prisma.bankAccount.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
  });
  if (!account) return res.status(404).json({ detail: 'Not found' });
  await prisma.bankAccount.delete({ where: { id: account.id } });
  return res.status(204).send();
});

export default router;

