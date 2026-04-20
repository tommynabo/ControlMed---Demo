// Extension to api.ts for Reminder endpoints
// Add this to your existing api/api.ts file in the appropriate section

export const reminders = {
    // Create a new reminder
    create: async (data: {
        patientId: string;
        description: string;
        dueDate: string;
        priority: 'LOW' | 'MEDIUM' | 'HIGH';
        notificationMethod: 'IN_APP' | 'WHATSAPP' | 'EMAIL' | 'BOTH';
        notes?: string;
    }) => {
        const response = await fetch('/api/reminders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(await response.text());
        return response.json();
    },

    // Get reminders by patient
    getByPatient: async (patientId: string) => {
        const response = await fetch(`/api/reminders?patientId=${patientId}`);
        if (!response.ok) throw new Error(await response.text());
        return response.json();
    },

    // Get a single reminder
    getById: async (reminderId: string) => {
        const response = await fetch(`/api/reminders/${reminderId}`);
        if (!response.ok) throw new Error(await response.text());
        return response.json();
    },

    // Update a reminder
    update: async (reminderId: string, data: Partial<{
        description: string;
        dueDate: string;
        priority: 'LOW' | 'MEDIUM' | 'HIGH';
        status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
        notes: string;
    }>) => {
        const response = await fetch(`/api/reminders/${reminderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(await response.text());
        return response.json();
    },

    // Delete a reminder
    delete: async (reminderId: string) => {
        const response = await fetch(`/api/reminders/${reminderId}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error(await response.text());
        return response.json();
    },

    // Get pending reminders due today
    getPendingDue: async () => {
        const response = await fetch('/api/reminders/pending/due');
        if (!response.ok) throw new Error(await response.text());
        return response.json();
    }
};
