import React from 'react';

interface GazeCursorProps {
    gazePosition: { x: number; y: number } | null;
    enabled: boolean;
}

export const GazeCursor: React.FC<GazeCursorProps> = ({ gazePosition, enabled }) => {
    if (!enabled || !gazePosition) return null;

    return (
        <div
            className="fixed pointer-events-none z-50"
            style={{
                left: gazePosition.x - 25,
                top: gazePosition.y - 25,
                width: 50,
                height: 50,
            }}
        >
            <div className="w-full h-full rounded-full bg-green-400 opacity-70 animate-pulse border-4 border-green-600 shadow-lg">
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-green-900 rounded-full"></div>
            </div>
        </div>
    );
};
