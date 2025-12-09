import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate, AuthRequest, requireRole, issueTokens } from '../middleware/auth.js';
import { prisma } from '../prisma.js';
import { UserType } from '@prisma/client';

const router = Router();

router.post('/', async (req, res) => {
  const {
    username,
    email,
    password,
    confirm_password,
    user_type,
    phone_number,
    address,
    pincode,
    business_name,
    business_address,
    vehicle_number,
    fssai_number,
  } = req.body;

  if (!username || !password || !confirm_password || !user_type) {
    return res.status(400).json({ detail: 'Missing required fields' });
  }
  if (password !== confirm_password) {
    return res.status(400).json({ confirm_password: 'Confirm password must match password.' });
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, ...(email ? [{ email }] : [])] },
    });
    if (existing) {
      if (existing.username === username) return res.status(400).json({ username: 'Username already exists' });
      return res.status(400).json({ email: 'Email already exists' });
    }

    const hashed = bcrypt.hashSync(password, 10);
    
    // Prepare address data
    let addressData = undefined;
    if (address) {
      if (typeof address === 'string') {
        addressData = {
          street: address,
          city: '',
          state: '',
          zipCode: pincode || '',
          country: 'India'
        };
      } else {
        addressData = {
          street: address.street || '',
          city: address.city || '',
          state: address.state || '',
          zipCode: address.zipCode || pincode || '',
          country: address.country || 'India'
        };
      }
    }

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashed,
        userType: user_type as UserType,
        phone: phone_number,
        ...(addressData && { address: addressData }),
      },
    });

    // Create related profiles based on user type
    if (user_type === 'tiffinOwner') {
      await prisma.tiffinOwner.create({
        data: {
          userId: user.id,
          businessName: business_name || `${username} business`,
          businessAddress: business_address || address || '',
          businessPincode: pincode || '',
        },
      });
    }
    
    if (user_type === 'deliveryBoy') {
      await prisma.deliveryBoy.create({
        data: {
          userId: user.id,
          vehicleNo: vehicle_number || 'NA',
          isActive: true,
        },
      });
    }

    // Issue tokens
    const tokens = issueTokens({ id: user.id, user_type: user.userType as UserType });

    return res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        user_type: user.userType,
        phone_number: user.phone,
        address: user.address,
      },
      ...tokens,
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

router.get('/me/', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });
    if (!user) return res.status(404).json({ detail: 'User not found' });

    let tiffinOwner = null;
    let deliveryBoy = null;
    let wallet = null;

    if (user.userType === 'tiffinOwner') {
      tiffinOwner = await prisma.tiffinOwner.findUnique({
        where: { userId: user.id }
      });
    }

    if (user.userType === 'deliveryBoy') {
      deliveryBoy = await prisma.deliveryBoy.findUnique({
        where: { userId: user.id }
      });
    }

    // Try to get wallet
    try {
      wallet = await prisma.wallet.findUnique({
        where: { userId: user.id }
      });
    } catch (e) {
      // Wallet doesn't exist, that's ok
    }

    return res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      user_type: user.userType,
      phone_number: user.phone,
      address: user.address,
      wallet_balance: wallet?.balance || 0,
      tiffin_owner: tiffinOwner
        ? {
            business_name: tiffinOwner.businessName,
            business_address: tiffinOwner.businessAddress,
            business_pincode: tiffinOwner.businessPincode,
          }
        : null,
      delivery_boy: deliveryBoy
        ? {
            vehicle_number: deliveryBoy.vehicleNo,
            is_active: deliveryBoy.isActive,
          }
        : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

router.patch('/me/', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ detail: 'User not found' });
    
    const data: any = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.email !== undefined) data.email = req.body.email;
    if (req.body.phone_number !== undefined) data.phone = req.body.phone_number;
    
    // Handle address update
    if (req.body.address !== undefined) {
      if (typeof req.body.address === 'string') {
        data.address = {
          street: req.body.address,
          city: user.address?.city || '',
          state: user.address?.state || '',
          zipCode: req.body.pincode || user.address?.zipCode || '',
          country: 'India'
        };
      } else {
        data.address = req.body.address;
      }
    }
    
    const updated = await prisma.user.update({ 
      where: { id: user.id }, 
      data,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        phone: true,
        userType: true,
        address: true,
      }
    });
    
    return res.json({
      id: updated.id,
      username: updated.username,
      email: updated.email,
      name: updated.name,
      user_type: updated.userType,
      phone_number: updated.phone,
      address: updated.address,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

router.get('/', authenticate, requireRole('tiffinOwner', 'admin'), async (_req, res) => {
  try {
    const list = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        userType: true,
        phone: true,
        address: true,
      }
    });
    return res.json(list);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;