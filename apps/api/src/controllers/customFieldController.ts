import { Request, Response } from 'express';
import prisma from '../utils/prisma';

const getUser = (req: Request) => req.user as any;

// ============================================================
// Admin: Custom Field Definition CRUD
// ============================================================

// Get all custom field definitions for a company
export const getCustomFields = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user?.companyId) return res.status(400).json({ error: 'No company' });

        const fields = await prisma.customFieldDefinition.findMany({
            where: { companyId: user.companyId, isActive: true },
            orderBy: { createdAt: 'asc' }
        });

        return res.json({ success: true, fields });
    } catch (error) {
        console.error('Get Custom Fields Error:', error);
        return res.status(500).json({ error: 'Failed to fetch custom fields' });
    }
};

// Create a custom field definition
export const createCustomField = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user?.companyId) return res.status(400).json({ error: 'No company' });
        if (!['OWNER', 'ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Admin only' });
        }

        const { name, type, options } = req.body;

        if (!name?.trim()) {
            return res.status(400).json({ error: 'Field name is required' });
        }

        const field = await prisma.customFieldDefinition.create({
            data: {
                companyId: user.companyId,
                name: name.trim(),
                type: type || 'TEXT',
                options: Array.isArray(options) ? options : [],
            }
        });

        return res.json({ success: true, field });
    } catch (error) {
        console.error('Create Custom Field Error:', error);
        return res.status(500).json({ error: 'Failed to create custom field' });
    }
};

// Update a custom field definition
export const updateCustomField = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!['OWNER', 'ADMIN'].includes(user?.role)) {
            return res.status(403).json({ error: 'Admin only' });
        }

        const { fieldId } = req.params;
        const { name, type, options, isActive } = req.body;

        const field = await prisma.customFieldDefinition.update({
            where: { id: fieldId },
            data: {
                ...(name !== undefined && { name: name.trim() }),
                ...(type !== undefined && { type }),
                ...(options !== undefined && { options }),
                ...(isActive !== undefined && { isActive }),
            }
        });

        return res.json({ success: true, field });
    } catch (error) {
        console.error('Update Custom Field Error:', error);
        return res.status(500).json({ error: 'Failed to update custom field' });
    }
};

// Delete a custom field definition (soft delete by setting isActive = false)
export const deleteCustomField = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!['OWNER', 'ADMIN'].includes(user?.role)) {
            return res.status(403).json({ error: 'Admin only' });
        }

        const { fieldId } = req.params;

        await prisma.customFieldDefinition.update({
            where: { id: fieldId },
            data: { isActive: false }
        });

        return res.json({ success: true });
    } catch (error) {
        console.error('Delete Custom Field Error:', error);
        return res.status(500).json({ error: 'Failed to delete custom field' });
    }
};

// ============================================================
// Task-Level: Custom Field Values
// ============================================================

// Get custom field values for a task
export const getTaskCustomFieldValues = async (req: Request, res: Response) => {
    try {
        const { taskId } = req.params;

        const values = await prisma.taskCustomFieldValue.findMany({
            where: { taskId },
            include: { field: true }
        });

        return res.json({ success: true, values });
    } catch (error) {
        console.error('Get Task Custom Values Error:', error);
        return res.status(500).json({ error: 'Failed to fetch custom field values' });
    }
};

// Set/Update custom field values for a task (batch upsert)
export const setTaskCustomFieldValues = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { taskId } = req.params;
        const { values } = req.body; // [{ fieldId, value }]

        if (!Array.isArray(values)) {
            return res.status(400).json({ error: 'values array is required' });
        }

        const results = await Promise.all(
            values.map((v: { fieldId: string; value: string }) =>
                prisma.taskCustomFieldValue.upsert({
                    where: { taskId_fieldId: { taskId, fieldId: v.fieldId } },
                    update: { value: String(v.value) },
                    create: { taskId, fieldId: v.fieldId, value: String(v.value) },
                    include: { field: true }
                })
            )
        );

        return res.json({ success: true, values: results });
    } catch (error) {
        console.error('Set Task Custom Values Error:', error);
        return res.status(500).json({ error: 'Failed to set custom field values' });
    }
};
