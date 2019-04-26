export enum Priority {
    LOW = 1,
    NORMAL,
    MEDIUM,
    HIGH,
    CRITICAL,
}

export function toString(priority: Priority): string {
    switch (priority) {
        case Priority.LOW:
            return "LOW";
        case Priority.NORMAL:
            return "NORMAL";
        case Priority.MEDIUM:
            return "MEDIUM";
        case Priority.HIGH:
            return "HIGH";
        case Priority.CRITICAL:
            return "CRITICAL";
    }
}
