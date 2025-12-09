import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../prisma';
const router = Router();
router.get('/', authenticate, async (req, res) => {
    if (!req.user)
        return res.status(401).json({ detail: 'Unauthorized' });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user)
        return res.status(404).json({ detail: 'User not found' });
    if (user.userType === 'customer') {
        const list = await prisma.delivery.findMany({ where: { customerId: user.id } });
        return res.json(list);
    }
    if (user.userType === 'delivery') {
        const dBoy = await prisma.deliveryBoy.findUnique({ where: { userId: user.id } });
        const list = await prisma.delivery.findMany({
            where: {
                OR: [
                    { deliveryBoyId: dBoy?.id },
                    { deliveryBoyId: null },
                ],
            },
        });
        return res.json(list);
    }
    if (user.userType === 'owner') {
        // Simplified: owners see deliveries for their orders
        const owner = await prisma.tiffinOwner.findUnique({ where: { userId: user.id } });
        if (!owner)
            return res.json([]);
        const tiffinIds = (await prisma.tiffin.findMany({ where: { ownerId: owner.id }, select: { id: true } })).map((t) => t.id);
        const orders = await prisma.order.findMany({ where: { tiffinId: { in: tiffinIds } }, select: { id: true } });
        const orderIds = orders.map((o) => o.id);
        const list = await prisma.delivery.findMany({ where: { orderId: { in: orderIds } } });
        return res.json(list);
    }
    return res.json([]);
});
router.post('/:id/accept/', authenticate, requireRole('delivery'), async (req, res) => {
    const delivery = await prisma.delivery.findUnique({ where: { id: req.params.id } });
    if (!delivery)
        return res.status(404).json({ detail: 'Not found' });
    if (delivery.deliveryBoyId)
        return res.status(400).json({ error: 'Delivery already assigned.' });
    const dBoy = await prisma.deliveryBoy.findUnique({ where: { userId: req.user.id } });
    if (!dBoy)
        return res.status(400).json({ detail: 'Delivery boy profile missing' });
    const updated = await prisma.delivery.update({
        where: { id: delivery.id },
        data: { deliveryBoyId: dBoy.id, status: 'accepted' },
    });
    return res.json(updated);
});
router.post('/:id/update_status/', authenticate, async (req, res) => {
    const newStatus = req.body.status;
    const allowed = ['pending', 'accepted', 'picked_up', 'delivered', 'cancelled'];
    if (!allowed.includes(newStatus))
        return res.status(400).json({ error: 'Invalid status' });
    const delivery = await prisma.delivery.findUnique({ where: { id: req.params.id } });
    if (!delivery)
        return res.status(404).json({ detail: 'Not found' });
    const updated = await prisma.delivery.update({
        where: { id: delivery.id },
        data: { status: newStatus },
    });
    return res.json(updated);
});
export default router;
//# sourceMappingURL=deliveries.js.map