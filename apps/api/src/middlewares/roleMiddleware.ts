import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== Role.SUPER_ADMIN) {
        res.status(403).json({ error: 'Forbidden: Super Admin access required' });
        return;
    }
    next();
};
