import React, { useState } from 'react';
import { X } from 'lucide-react';

interface CalibrationScreenProps {
    onComplete: () => void;
    onSkip: () => void;
}

export const CalibrationScreen: React.FC<CalibrationScreenProps> = ({ onComplete, onSkip }) => {
    const [currentPoint, setCurrentPoint] = useState(0);
    const [clickedPoints, setClickedPoints] = useState<number[]>([]);

    // 9 calibration points in a grid
    const calibrationPoints = [
        { x: '10%', y: '10%', label: '1' },
        { x: '50%', y: '10%', label: '2' },
        { x: '90%', y: '10%', label: '3' },
        { x: '10%', y: '50%', label: '4' },
        { x: '50%', y: '50%', label: '5' },
        { x: '90%', y: '50%', label: '6' },
        { x: '10%', y: '90%', label: '7' },
        { x: '50%', y: '90%', label: '8' },
        { x: '90%', y: '90%', label: '9' },
    ];

    const handlePointClick = (index: number) => {
        if (!clickedPoints.includes(index)) {
            setClickedPoints([...clickedPoints, index]);

            if (clickedPoints.length + 1 >= 9) {
                // All points clicked
                setTimeout(() => {
                    onComplete();
                }, 500);
            } else {
                setCurrentPoint(index + 1);
            }
        }
    };

    const progress = (clickedPoints.length / 9) * 100;

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 z-50 flex flex-col items-center justify-center">
            {/* Header */}
            <div className="absolute top-8 left-0 right-0 text-center">
                <h2 className="text-3xl font-black text-slate-800 mb-2">👁️ Eye Tracking Calibration</h2>
                <p className="text-slate-600 text-lg">Look at each point and click it to calibrate</p>
                <div className="mt-4 max-w-md mx-auto">
                    <div className="bg-white rounded-full h-3 overflow-hidden shadow-inner">
                        <div
                            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-sm text-slate-500 mt-2">{clickedPoints.length} / 9 points</p>
                </div>
            </div>

            {/* Skip Button */}
            <button
                onClick={onSkip}
                className="absolute top-8 right-8 flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 rounded-xl shadow-lg transition-colors"
            >
                <X size={20} />
                Skip Calibration
            </button>

            {/* Calibration Points */}
            {calibrationPoints.map((point, index) => {
                const isClicked = clickedPoints.includes(index);
                const isCurrent = currentPoint === index && !isClicked;

                return (
                    <button
                        key={index}
                        onClick={() => handlePointClick(index)}
                        className={`absolute w-16 h-16 rounded-full transition-all duration-300 flex items-center justify-center font-bold text-xl
              ${isClicked
                                ? 'bg-green-500 scale-75 opacity-50'
                                : isCurrent
                                    ? 'bg-indigo-500 scale-125 animate-pulse shadow-2xl'
                                    : 'bg-purple-400 hover:bg-purple-500 hover:scale-110 shadow-lg'
                            }
              ${!isClicked ? 'cursor-pointer' : 'cursor-default'}
            `}
                        style={{
                            left: point.x,
                            top: point.y,
                            transform: `translate(-50%, -50%) ${isClicked ? 'scale(0.75)' : isCurrent ? 'scale(1.25)' : 'scale(1)'}`,
                        }}
                    >
                        <span className="text-white drop-shadow-lg">
                            {isClicked ? '✓' : point.label}
                        </span>
                    </button>
                );
            })}

            {/* Instructions */}
            <div className="absolute bottom-8 left-0 right-0 text-center">
                <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg mx-auto">
                    <h3 className="font-bold text-lg text-slate-800 mb-2">📝 Tips for Best Results:</h3>
                    <ul className="text-left text-slate-600 space-y-1 text-sm">
                        <li>• <strong>Look directly at each point</strong> before clicking</li>
                        <li>• Keep your head still and centered</li>
                        <li>• Ensure good lighting on your face</li>
                        <li>• Sit about 50-70cm from the screen</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};
