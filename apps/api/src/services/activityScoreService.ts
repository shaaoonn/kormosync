// ============================================================
// KormoSync - Activity Score Algorithm (Simplified Formula)
// Formula: activity% = min(100, (keystrokes + mouseClicks) / intervalMinutes)
// 100 inputs/min = 100% activity
// ============================================================

/**
 * Score Levels:
 * HIGH   (>=70): Highly active, productive interval
 * MEDIUM (40-69): Moderate activity, acceptable
 * LOW    (10-39): Below average, potential idle
 * IDLE   (<10):   No meaningful activity detected
 */

export type ActivityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'IDLE';

export interface ActivityScoreResult {
    score: number;         // 0-100
    level: ActivityLevel;
    breakdown: {
        keystrokes: number;
        mouseClicks: number;
        totalInputs: number;
        inputsPerMinute: number;
    };
}

/**
 * Calculate activity score with simplified input-per-minute formula.
 *
 * Formula: score = min(100, (keystrokes + mouseClicks) / intervalMinutes)
 * - 100 inputs per minute = 100% activity
 * - 500 total inputs in 5 minutes = 100/min = 100%
 *
 * @param activeSeconds   - Seconds with detected activity (used for interval calculation)
 * @param keystrokes      - Total keyboard events in interval
 * @param mouseClicks     - Total mouse click events in interval
 * @param mouseMovement   - (deprecated, kept for backward compat) Ignored in new formula
 * @param intervalMinutes - Duration of the interval in minutes (default: 5)
 * @returns ActivityScoreResult with score, level, and breakdown
 */
export function calculateActivityScore(
    activeSeconds: number,
    keystrokes: number,
    mouseClicks: number,
    mouseMovement: number = 0,
    intervalMinutes: number = 5
): ActivityScoreResult {
    const totalInputs = keystrokes + mouseClicks;
    const effectiveMinutes = Math.max(1, intervalMinutes); // Prevent division by zero
    const inputsPerMinute = totalInputs / effectiveMinutes;
    const score = Math.min(100, Math.round(inputsPerMinute));

    // Determine level
    let level: ActivityLevel;
    if (score >= 70) level = 'HIGH';
    else if (score >= 40) level = 'MEDIUM';
    else if (score >= 10) level = 'LOW';
    else level = 'IDLE';

    return {
        score,
        level,
        breakdown: {
            keystrokes,
            mouseClicks,
            totalInputs,
            inputsPerMinute: Math.round(inputsPerMinute * 100) / 100,
        },
    };
}

/**
 * Get color for activity level (for frontend use).
 */
export function getActivityColor(level: ActivityLevel): string {
    switch (level) {
        case 'HIGH': return '#22c55e';   // green
        case 'MEDIUM': return '#f59e0b'; // yellow
        case 'LOW': return '#ef4444';    // red
        case 'IDLE': return '#6b7280';   // gray
    }
}

/**
 * Calculate daily productivity summary from activity logs.
 */
export function calculateDailyProductivity(logs: Array<{
    activeSeconds: number;
    keystrokes: number;
    mouseClicks: number;
    mouseMovement: number;
}>): {
    averageScore: number;
    totalIntervals: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    idleCount: number;
    productiveHours: number;
    idleHours: number;
} {
    if (logs.length === 0) {
        return {
            averageScore: 0, totalIntervals: 0,
            highCount: 0, mediumCount: 0, lowCount: 0, idleCount: 0,
            productiveHours: 0, idleHours: 0,
        };
    }

    let totalScore = 0;
    let highCount = 0, mediumCount = 0, lowCount = 0, idleCount = 0;

    for (const log of logs) {
        const intervalMinutes = Math.max(1, Math.ceil(log.activeSeconds / 60)) || 5;
        const result = calculateActivityScore(
            log.activeSeconds, log.keystrokes, log.mouseClicks, log.mouseMovement, intervalMinutes
        );
        totalScore += result.score;

        switch (result.level) {
            case 'HIGH': highCount++; break;
            case 'MEDIUM': mediumCount++; break;
            case 'LOW': lowCount++; break;
            case 'IDLE': idleCount++; break;
        }
    }

    const productiveIntervals = highCount + mediumCount;
    const idleIntervals = lowCount + idleCount;

    return {
        averageScore: Math.round(totalScore / logs.length),
        totalIntervals: logs.length,
        highCount,
        mediumCount,
        lowCount,
        idleCount,
        productiveHours: parseFloat(((productiveIntervals * 5) / 60).toFixed(2)),
        idleHours: parseFloat(((idleIntervals * 5) / 60).toFixed(2)),
    };
}
