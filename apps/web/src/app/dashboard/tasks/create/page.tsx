"use client";

import CreateTaskForm from "@/components/dashboard/tasks/CreateTaskForm"; // Fixed Import Path

export default function CreateTaskPage() {
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">New Assignment</h1>
            <CreateTaskForm />
        </div>
    );
}
