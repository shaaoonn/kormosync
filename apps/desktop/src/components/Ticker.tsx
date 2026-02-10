import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

const Ticker = () => {
    const tick = useAppStore((s) => s.tick);
    const tickRef = useRef(tick);
    tickRef.current = tick;

    useEffect(() => {
        const interval = setInterval(() => tickRef.current(), 1000);
        return () => clearInterval(interval);
    }, []); // Empty deps — interval created ONCE, never recreated

    return null;
};

export default Ticker;
