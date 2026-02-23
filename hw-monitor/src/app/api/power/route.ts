import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, delay = 10 } = body;

        // Clamp delay between 0 and 300 seconds
        const safeDelay = Math.max(0, Math.min(300, parseInt(delay) || 10));

        switch (action) {
            case 'shutdown':
                await execAsync(
                    `shutdown /s /t ${safeDelay} /c "Remote shutdown initiated from HW Monitor"`,
                    { timeout: 10000 }
                );
                return NextResponse.json({
                    success: true,
                    message: `Shutdown initiated. System will shut down in ${safeDelay} seconds.`,
                    action: 'shutdown',
                    delay: safeDelay,
                });

            case 'reboot':
                await execAsync(
                    `shutdown /r /t ${safeDelay} /c "Remote reboot initiated from HW Monitor"`,
                    { timeout: 10000 }
                );
                return NextResponse.json({
                    success: true,
                    message: `Reboot initiated. System will restart in ${safeDelay} seconds.`,
                    action: 'reboot',
                    delay: safeDelay,
                });

            case 'cancel':
                await execAsync('shutdown /a', { timeout: 5000 });
                return NextResponse.json({
                    success: true,
                    message: 'Pending shutdown/reboot has been cancelled.',
                    action: 'cancel',
                });

            default:
                return NextResponse.json(
                    { error: 'Invalid action. Use: shutdown, reboot, or cancel' },
                    { status: 400 }
                );
        }
    } catch (error: any) {
        const msg = error?.stderr || error?.message || 'Unknown error';
        // "No shutdown" error from /a when nothing is pending — not a real failure
        if (msg.includes('Unable to abort') || msg.includes('unable to abort')) {
            return NextResponse.json({
                success: false,
                message: 'No pending shutdown/reboot to cancel.',
            });
        }
        console.error('[Power] Command failed:', msg);
        return NextResponse.json(
            { error: 'Failed to execute power command', details: msg },
            { status: 500 }
        );
    }
}
