import { useEffect, useRef, useState } from 'react';

// Global flag to track if WebGazer is already initialized
let webgazerInitialized = false;

export const useEyeTracking = (enabled: boolean, dwellTime: number = 2000) => {
    const [gazePosition, setGazePosition] = useState<{ x: number, y: number } | null>(null);
    const [hoveredElement, setHoveredElement] = useState<string | null>(null);
    const [dwellProgress, setDwellProgress] = useState<number>(0);
    const [isInitialized, setIsInitialized] = useState(false);

    const dwellTimerRef = useRef<NodeJS.Timeout | null>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const dwellStartTimeRef = useRef<number>(0);
    const currentHoveredRef = useRef<string | null>(null); // Use ref to avoid closure issues

    useEffect(() => {
        if (!enabled) {
            if ((window as any).webgazer && webgazerInitialized) {
                (window as any).webgazer.pause();
                console.log('⏸️ Eye tracking paused');
            }
            setGazePosition(null);
            setHoveredElement(null);
            setDwellProgress(0);
            currentHoveredRef.current = null;
            setIsInitialized(false);
            if (dwellTimerRef.current) {
                clearTimeout(dwellTimerRef.current);
            }
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
            return;
        }

        if (webgazerInitialized && (window as any).webgazer) {
            console.log('▶️ Resuming existing WebGazer instance');
            (window as any).webgazer.resume();
            setIsInitialized(true);
            return;
        }

        if (webgazerInitialized) {
            return;
        }

        console.log('🆕 Initializing WebGazer for the first time');

        const script = document.createElement('script');
        script.src = 'https://webgazer.cs.brown.edu/webgazer.js';
        script.async = true;

        script.onload = () => {
            const webgazer = (window as any).webgazer;

            console.log('🔄 Starting WebGazer...');

            const gazeListener = (data: any) => {
                if (data == null) return;

                const { x, y } = data;
                setGazePosition({ x, y });

                const elements = document.elementsFromPoint(x, y);

                // --- TOLERANCE CHECK ---
                // If nothing found at exact point, check surrounding area (50px radius)
                if (!elements.some(el => el.hasAttribute('data-symbol-id'))) {
                    const tolerance = 50; // pixels
                    const pointsToCheck = [
                        { x: x, y: y - tolerance }, // Top
                        { x: x, y: y + tolerance }, // Bottom
                        { x: x - tolerance, y: y }, // Left
                        { x: x + tolerance, y: y }  // Right
                    ];

                    for (const point of pointsToCheck) {
                        const nearbyElements = document.elementsFromPoint(point.x, point.y);
                        const nearbyButton = nearbyElements.find(el => el.hasAttribute('data-symbol-id'));
                        if (nearbyButton) {
                            elements.push(nearbyButton);
                            break; // Found one, stop looking
                        }
                    }
                }

                let buttonElement: Element | null = null;

                // Find button with data-symbol-id
                for (const el of elements) {
                    if (el.hasAttribute && el.hasAttribute('data-symbol-id')) {
                        buttonElement = el;
                        break;
                    }
                }

                // Try closest if not found
                if (!buttonElement) {
                    for (const el of elements) {
                        if (el instanceof HTMLElement) {
                            const closest = el.closest('[data-symbol-id]');
                            if (closest) {
                                buttonElement = closest;
                                break;
                            }
                        }
                    }
                }

                if (buttonElement) {
                    const elementId = buttonElement.getAttribute('data-symbol-id');

                    if (elementId && elementId !== currentHoveredRef.current) {
                        // NEW element - start dwell timer
                        console.log('🎯 NEW DWELL START:', elementId);
                        currentHoveredRef.current = elementId;
                        setHoveredElement(elementId);
                        dwellStartTimeRef.current = Date.now();
                        setDwellProgress(0);

                        // Clear existing timers
                        if (dwellTimerRef.current) {
                            clearTimeout(dwellTimerRef.current);
                            dwellTimerRef.current = null;
                        }
                        if (progressIntervalRef.current) {
                            clearInterval(progressIntervalRef.current);
                            progressIntervalRef.current = null;
                        }

                        // Update progress every 50ms
                        progressIntervalRef.current = setInterval(() => {
                            const elapsed = Date.now() - dwellStartTimeRef.current;
                            const progress = Math.min((elapsed / dwellTime) * 100, 100);
                            setDwellProgress(progress);
                        }, 50);

                        // Trigger click after dwell time
                        dwellTimerRef.current = setTimeout(() => {
                            console.log('🚀 DWELL COMPLETE! CLICKING:', elementId);
                            console.log('Button element:', buttonElement);

                            try {
                                (buttonElement as HTMLElement).click();
                                console.log('✅ CLICK SUCCESSFUL!');
                            } catch (err) {
                                console.error('❌ Click error:', err);
                                // Try manual event
                                const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
                                buttonElement.dispatchEvent(evt);
                            }

                            currentHoveredRef.current = null;
                            setHoveredElement(null);
                            setDwellProgress(0);

                            if (progressIntervalRef.current) {
                                clearInterval(progressIntervalRef.current);
                                progressIntervalRef.current = null;
                            }
                        }, dwellTime);
                    }
                } else {
                    // Not looking at any button
                    if (currentHoveredRef.current !== null) {
                        console.log('👋 Stopped looking at button');
                        currentHoveredRef.current = null;
                        setHoveredElement(null);
                        setDwellProgress(0);

                        if (dwellTimerRef.current) {
                            clearTimeout(dwellTimerRef.current);
                            dwellTimerRef.current = null;
                        }
                        if (progressIntervalRef.current) {
                            clearInterval(progressIntervalRef.current);
                            progressIntervalRef.current = null;
                        }
                    }
                }
            };

            webgazer
                .setGazeListener(gazeListener)
                .showVideoPreview(true)
                .showPredictionPoints(false)
                .begin()
                .then(() => {
                    console.log('✅ WebGazer started successfully!');
                    webgazerInitialized = true;

                    setTimeout(() => {
                        const videoContainer = document.getElementById('webgazerVideoContainer');
                        const videoFeed = document.getElementById('webgazerVideoFeed');
                        const faceOverlay = document.getElementById('webgazerFaceOverlay');
                        const faceFeedbackBox = document.getElementById('webgazerFaceFeedbackBox');

                        if (videoContainer) {
                            videoContainer.style.position = 'fixed';
                            videoContainer.style.bottom = '20px';
                            videoContainer.style.right = '20px';
                            videoContainer.style.left = 'auto';
                            videoContainer.style.top = 'auto';
                            videoContainer.style.width = '200px';
                            videoContainer.style.height = '150px';
                            videoContainer.style.zIndex = '9998';
                            videoContainer.style.display = 'block';
                        }

                        if (videoFeed) {
                            videoFeed.style.display = 'block';
                            videoFeed.style.width = '200px';
                            videoFeed.style.height = '150px';
                            videoFeed.style.border = '3px solid #22c55e';
                            videoFeed.style.borderRadius = '8px';
                        }

                        if (faceOverlay) {
                            faceOverlay.style.display = 'none';
                        }

                        if (faceFeedbackBox) {
                            faceFeedbackBox.style.display = 'none';
                        }

                        setIsInitialized(true);
                        console.log('✅ Eye tracking fully initialized!');
                    }, 1000);
                })
                .catch((err: any) => {
                    console.error('❌ WebGazer failed to start:', err);
                });
        };

        script.onerror = () => {
            console.error('❌ Failed to load WebGazer script');
        };

        document.head.appendChild(script);

        return () => {
            if ((window as any).webgazer && enabled) {
                (window as any).webgazer.pause();
            }
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
            if (dwellTimerRef.current) {
                clearTimeout(dwellTimerRef.current);
            }
        };
    }, [enabled, dwellTime]);

    return { gazePosition, hoveredElement, dwellProgress, isInitialized };
};
