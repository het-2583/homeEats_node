import { Router } from 'express';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { prisma } from '../prisma';
import { OrderStatus } from '@prisma/client';

const router = Router();
const DELIVERY_FEE = 10;

async function getWallet(userId: string) {
  let wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await prisma.wallet.create({ data: { userId, balance: 0 } });
  }
  return wallet;
}

async function adjustWallet(userId: string, delta: number, reference: string, txnType: string) {
  await prisma.$transaction(async (tx: any) => {
    const wallet = await tx.wallet.upsert({
      where: { userId },
      update: { balance: { increment: delta } },
      create: { userId, balance: delta },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        txnType,
        amount: delta,
        reference,
      },
    });
  });
}

router.get('/', authenticate, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ detail: 'Unauthorized' });
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ detail: 'User not found' });

  if (user.userType === 'customer') {
    const result = await prisma.order.findMany({ where: { customerId: user.id } });
    return res.json(result);
  }
  if (user.userType === 'owner') {
    const owner = await prisma.tiffinOwner.findUnique({ where: { userId: user.id } });
    if (!owner) return res.json([]);
    const ownerTiffins = await prisma.tiffin.findMany({ where: { ownerId: owner.id }, select: { id: true } });
    const tiffinIds = ownerTiffins.map((t: any) => t.id);
    const result = await prisma.order.findMany({ where: { tiffinId: { in: tiffinIds } } });
    return res.json(result);
  }
  if (user.userType === 'delivery') {
    const dBoy = await prisma.deliveryBoy.findUnique({ where: { userId: user.id } });
    const result = await prisma.order.findMany({
      where: {
        deliveryPincode: user.pincode,
        status: { in: ['ready_for_delivery', 'picked_up'] as OrderStatus[] },
        OR: [{ deliveryBoyId: null }, { deliveryBoyId: dBoy?.id }],
      },
    });
    return res.json(result);
  }
  return res.json([]);
});

router.post('/', authenticate, requireRole('customer'), async (req: AuthRequest, res) => {
  const { tiffin: tiffinId, quantity, delivery_address, delivery_pincode } = req.body;
    const tiffin = await prisma.tiffin.findUnique({ where: { id: tiffinId } });
  if (!tiffin) return res.status(400).json({ detail: 'Invalid tiffin' });
  const qty = Number(quantity) || 1;
  const total = Number(tiffin.price) * qty;

  const wallet = await getWallet(req.user!.id);
  if (wallet.balance < total) {
    return res.status(400).json({ wallet: 'Insufficient wallet balance. Please add money to your wallet before placing an order.' });
  }

  const order = await prisma.$transaction(async (tx: any) => {
    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: wallet.balance - total },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: updatedWallet.id,
        txnType: 'debit',
        amount: -total,
        reference: 'ORDER:NEW',
      },
    });
    return tx.order.create({
      data: {
        customerId: req.user!.id,
        tiffinId: tiffin.id,
        deliveryBoyId: null,
        quantity: qty,
        totalPrice: total,
        deliveryAddress: delivery_address,
        deliveryPincode: delivery_pincode,
        status: 'pending',
      },
    });
  });

  return res.status(201).json(order);
});

router.post('/:id/update_status/', authenticate, async (req: AuthRequest, res) => {
  const newStatus = req.body.status as OrderStatus;
  const allowed: OrderStatus[] = [
    'pending',
    'confirmed',
    'preparing',
    'ready_for_delivery',
    'picked_up',
    'delivered',
    'cancelled',
  ];
  if (!allowed.includes(newStatus)) return res.status(400).json({ error: 'Invalid status' });

  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ detail: 'Order not found' });

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(401).json({ detail: 'Unauthorized' });

  if (user.userType === 'owner') {
    const owner = await prisma.tiffinOwner.findUnique({ where: { userId: user.id } });
    const tiffin = await prisma.tiffin.findUnique({ where: { id: order.tiffinId } });
    if (!owner || !tiffin || tiffin.ownerId !== owner.id) return res.status(403).json({ detail: 'Not owner' });
  }

  const previous = order.status;
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: newStatus },
  });

  if (previous === 'pending' && ['confirmed', 'preparing', 'ready_for_delivery', 'picked_up', 'delivered'].includes(newStatus)) {
    const tiffin = await prisma.tiffin.findUnique({ where: { id: order.tiffinId } });
    if (tiffin) {
      const owner = await prisma.tiffinOwner.findUnique({ where: { id: tiffin.ownerId } });
      if (owner) await adjustWallet(owner.userId, order.totalPrice, `ORDER:${order.id}`, 'credit for tiffin');
    }
  }

  if (newStatus === 'ready_for_delivery') {
    const tiffin = await prisma.tiffin.findUnique({ where: { id: order.tiffinId } });
    const owner = tiffin ? await prisma.tiffinOwner.findUnique({ where: { id: tiffin.ownerId } }) : null;
    await prisma.delivery.create({
      data: {
        orderId: order.id,
        deliveryBoyId: null,
        pickupAddress: owner?.businessAddress || '',
        deliveryAddress: order.deliveryAddress,
        status: 'pending',
        customerId: order.customerId,
      },
    });
  }

  return res.json(updated);
});

export default router;

