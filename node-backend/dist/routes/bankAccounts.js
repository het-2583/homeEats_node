import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../prisma';
const router = Router();
router.get('/', authenticate, async (req, res) => {
    const accounts = await prisma.bankAccount.findMany({ where: { userId: req.user.id } });
    return res.json(accounts);
});
router.post('/', authenticate, async (req, res) => {
    const { account_holder_name, bank_name, account_number, ifsc_code, is_primary } = req.body;
    if (!account_holder_name || !bank_name || !account_number || !ifsc_code) {
        return res.status(400).json({ detail: 'Missing fields' });
    }
    if (is_primary) {
        await prisma.bankAccount.updateMany({ where: { userId: req.user.id }, data: { isPrimary: false } });
    }
    const account = await prisma.bankAccount.create({
        data: {
            userId: req.user.id,
            accountHolderName: account_holder_name,
            bankName: bank_name,
            accountNumber: account_number,
            ifscCode: ifsc_code,
            isPrimary: is_primary !== false,
        },
    });
    return res.status(201).json(account);
});
router.delete('/:id/', authenticate, async (req, res) => {
    const account = await prisma.bankAccount.findFirst({
        where: { id: req.params.id, userId: req.user.id },
    });
    if (!account)
        return res.status(404).json({ detail: 'Not found' });
    await prisma.bankAccount.delete({ where: { id: account.id } });
    return res.status(204).send();
});
export default router;
//# sourceMappingURL=bankAccounts.js.map