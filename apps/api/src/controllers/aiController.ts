import { Request, Response } from 'express';

export const generateTaskPreview = async (req: Request, res: Response) => {
    try {
        const { roughInstruction, title } = req.body;

        // Mock AI Logic
        const mockResponse = {
            subTasks: [
                { id: Date.now() + 1, text: `Review requirements for: ${title}`, completed: false },
                { id: Date.now() + 2, text: "Draft initial document / code", completed: false },
                { id: Date.now() + 3, text: "Internal review and testing", completed: false },
                { id: Date.now() + 4, text: "Final submission", completed: false }
            ],
            allowedApps: ["Google Chrome", "VS Code", "Slack"],
            summary: "AI has analyzed your instruction and generated this preliminary plan."
        };

        // Simulate network delay
        setTimeout(() => {
            res.json({ success: true, data: mockResponse });
        }, 1500);

    } catch (error) {
        console.error("AI Generate Error:", error);
        res.status(500).json({ error: 'Failed to generate preview' });
    }
};
