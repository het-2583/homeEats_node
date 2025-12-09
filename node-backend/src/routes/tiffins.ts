import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';
import { prisma } from '../prisma.js';
import { env } from '../config/env.js';

// Ensure upload directory exists (moved AFTER env import)
const uploadDir = env.uploadDir || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });
const router = Router();

router.get('/', async (req, res) => {
  const { pincode, search } = req.query;
  const filters: any = { isAvailable: true };
  if (search) {
    const term = String(search);
    filters.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } },
    ];
  }
  if (pincode) {
    filters.owner = { businessPincode: String(pincode) };
  }
  const list = await prisma.tiffin.findMany({
    where: filters,
    include: { owner: true },
  });
  return res.json(list);
});

router.get('/:id/', async (req, res) => {
  const tiffin = await prisma.tiffin.findUnique({ where: { id: req.params.id } });
  if (!tiffin) return res.status(404).json({ detail: 'Not found' });
  return res.json(tiffin);
});

router.post('/', authenticate, requireRole('tiffinOwner'), upload.single('image'), async (req: AuthRequest, res) => {
  const owner = await prisma.tiffinOwner.findUnique({ where: { userId: req.user!.id } });
  if (!owner) return res.status(400).json({ detail: 'Tiffin owner profile not found' });
  const { name, description, price, is_available } = req.body;
  const image = req.file ? path.join('uploads', path.basename(req.file.path)) : undefined;
  const tiffin = await prisma.tiffin.create({
    data: {
      ownerId: owner.id,
      name,
      description,
      price: Number(price),
      isAvailable: is_available !== undefined ? String(is_available) === 'true' : true,
      image,
    },
  });
  return res.status(201).json(tiffin);
});

router.patch('/:id/', authenticate, requireRole('tiffinOwner'), upload.single('image'), async (req: AuthRequest, res) => {
  const tiffin = await prisma.tiffin.findUnique({ where: { id: req.params.id } });
  if (!tiffin) return res.status(404).json({ detail: 'Not found' });
  const owner = await prisma.tiffinOwner.findUnique({ where: { userId: req.user!.id } });
  if (!owner || tiffin.ownerId !== owner.id) return res.status(403).json({ detail: 'Forbidden' });

  const { name, description, price, is_available } = req.body;
  const data: any = {};
  if (name) data.name = name;
  if (description) data.description = description;
  if (price !== undefined) data.price = Number(price);
  if (is_available !== undefined) data.isAvailable = String(is_available) === 'true';
  if (req.file) data.image = path.join('uploads', path.basename(req.file.path));

  const updated = await prisma.tiffin.update({ where: { id: tiffin.id }, data });
  return res.json(updated);
});

router.delete('/:id/', authenticate, requireRole('tiffinOwner'), async (req: AuthRequest, res) => {
  const tiffin = await prisma.tiffin.findUnique({ where: { id: req.params.id } });
  if (!tiffin) return res.status(404).json({ detail: 'Not found' });
  const owner = await prisma.tiffinOwner.findUnique({ where: { userId: req.user!.id } });
  if (!owner || tiffin.ownerId !== owner.id) return res.status(403).json({ detail: 'Forbidden' });
  await prisma.tiffin.delete({ where: { id: tiffin.id } });
  return res.status(204).send();
});

export default router;