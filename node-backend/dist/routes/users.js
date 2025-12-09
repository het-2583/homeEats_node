import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../prisma';
const router = Router();
router.post('/', async (req, res) => {
    const { username, email, password, confirm_password, user_type, phone_number, address, pincode, business_name, business_address, vehicle_number, fssai_number, } = req.body;
    if (!username || !password || !confirm_password || !user_type) {
        return res.status(400).json({ detail: 'Missing required fields' });
    }
    if (password !== confirm_password) {
        return res.status(400).json({ confirm_password: 'Confirm password must match password.' });
    }
    try {
        const existing = await prisma.user.findFirst({
            where: { OR: [{ username }, { email }] },
        });
        if (existing) {
            if (existing.username === username)
                return res.status(400).json({ username: 'Username already exists' });
            return res.status(400).json({ email: 'Email already exists' });
        }
        const hashed = bcrypt.hashSync(password, 10);
        const user = await prisma.user.create({
            data: {
                username,
                email,
                password: hashed,
                userType: user_type,
                phone: phone_number,
                address,
                pincode,
                wallet: { create: { balance: 0 } },
            },
        });
        if (user_type === 'owner') {
            await prisma.tiffinOwner.create({
                data: {
                    userId: user.id,
                    businessName: business_name || `${username} business`,
                    businessAddress: business_address || address,
                    businessPincode: pincode,
                    isVerified: false,
                    fssaiNumber: fssai_number || null,
                },
            });
        }
        if (user_type === 'delivery') {
            await prisma.deliveryBoy.create({
                data: {
                    userId: user.id,
                    vehicleNumber: vehicle_number || 'NA',
                    isAvailable: true,
                    currentLocation: '',
                },
            });
        }
        return res.status(201).json({
            id: user.id,
            username: user.username,
            email: user.email,
            user_type: user.userType,
            phone_number: user.phone,
            address: user.address,
            pincode: user.pincode,
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ detail: 'Internal server error' });
    }
});
router.get('/me/', authenticate, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: { tiffinOwner: true, deliveryBoy: true },
        });
        if (!user)
            return res.status(404).json({ detail: 'User not found' });
        return res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            user_type: user.userType,
            phone_number: user.phone,
            address: user.address,
            pincode: user.pincode,
            tiffin_owner: user.tiffinOwner
                ? {
                    business_name: user.tiffinOwner.businessName,
                    business_address: user.tiffinOwner.businessAddress,
                    business_pincode: user.tiffinOwner.businessPincode,
                    is_verified: user.tiffinOwner.isVerified,
                }
                : null,
            delivery_boy: user.deliveryBoy
                ? {
                    vehicle_number: user.deliveryBoy.vehicleNumber,
                    is_available: user.deliveryBoy.isAvailable,
                }
                : null,
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ detail: 'Internal server error' });
    }
});
router.patch('/me/', authenticate, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user)
            return res.status(404).json({ detail: 'User not found' });
        const data = {};
        if (req.body.email !== undefined)
            data.email = req.body.email;
        if (req.body.phone_number !== undefined)
            data.phone = req.body.phone_number;
        if (req.body.address !== undefined)
            data.address = req.body.address;
        if (req.body.pincode !== undefined)
            data.pincode = req.body.pincode;
        const updated = await prisma.user.update({ where: { id: user.id }, data });
        return res.json(updated);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ detail: 'Internal server error' });
    }
});
router.get('/', authenticate, requireRole('owner'), async (_req, res) => {
    const list = await prisma.user.findMany();
    return res.json(list);
});
export default router;
//# sourceMappingURL=users.js.map