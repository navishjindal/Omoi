import { useEffect, useRef, useState } from 'react';

// Global flag to track if WebGazer is already initialized
let webgazerInitialized = false;

export const useEyeTracking = (enabled: boolean, dwellTime: number = 2000) => {
    const [gazePosition, setGazePosition] = useState<{ x: number, y: number } | null>(null);
    const [hoveredElement, setHoveredElement] = useState<string | null>(null);
    const [dwellProgress, setDwellProgress] = useState<number>(0);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isUsingMouse, setIsUsingMouse] = useState(false);

    const dwellTimerRef = useRef<NodeJS.Timeout | null>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const dwellStartTimeRef = useRef<number>(0);
    const currentHoveredRef = useRef<string | null>(null);
    const mouseInactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isUsingMouseRef = useRef<boolean>(false);
    const latestGazePositionRef = useRef<{ x: number, y: number } | null>(null);

    // Keep track of latest gaze position in a ref for the gaze listener
    useEffect(() => {
        latestGazePositionRef.current = gazePosition;
    }, [gazePosition]);

    useEffect(() => {
        if (!enabled) {
            if ((window as any).webgazer && webgazerInitialized) {
                (window as any).webgazer.end();
                console.log('🛑 Eye tracking stopped');
                webgazerInitialized = false;

                const videoContainer = document.getElementById('webgazerVideoContainer');
                if (videoContainer) {
                    videoContainer.remove();
                }
            }
            setGazePosition(null);
            setHoveredElement(null);
            setDwellProgress(0);
            currentHoveredRef.current = null;
            setIsInitialized(false);
            setIsUsingMouse(false);
            isUsingMouseRef.current = false;
            if (dwellTimerRef.current) {
                clearTimeout(dwellTimerRef.current);
            }
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
            if (mouseInactivityTimerRef.current) {
                clearTimeout(mouseInactivityTimerRef.current);
            }

            document.body.style.cursor = 'default';
            return;
        }

        // Hide cursor when eye tracking is enabled
        document.body.style.cursor = 'none';

        // Mouse movement handler
        const handleMouseMove = (e: MouseEvent) => {
            setIsUsingMouse(true);
            isUsingMouseRef.current = true;
            setGazePosition({ x: e.clientX, y: e.clientY });

            if (mouseInactivityTimerRef.current) {
                clearTimeout(mouseInactivityTimerRef.current);
            }

            mouseInactivityTimerRef.current = setTimeout(() => {
                console.log('⏰ Mouse inactive for 5s, switching back to eye tracking');
                setIsUsingMouse(false);
                isUsingMouseRef.current = false;
            }, 5000);
        };

        document.addEventListener('mousemove', handleMouseMove);

        if (webgazerInitialized && (window as any).webgazer) {
            (window as any).webgazer.resume();
            setIsInitialized(true);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
            };
        }

        if (webgazerInitialized) {
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
            };
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

                // Only update gaze position from eye tracking if NOT using mouse
                if (!isUsingMouseRef.current) {
                    setGazePosition({ x, y });
                }

                // ALWAYS process elements for dwell timer (works in both modes)
                // Get current position from either mouse or eye tracking
                let currentX = x;
                let currentY = y;

                if (isUsingMouseRef.current && latestGazePositionRef.current) {
                    currentX = latestGazePositionRef.current.x;
                    currentY = latestGazePositionRef.current.y;
                }

                const elements = document.elementsFromPoint(currentX, currentY);

                // --- TOLERANCE CHECK ---
                if (!elements.some(el => el.hasAttribute('data-symbol-id'))) {
                    const tolerance = 50;
                    const pointsToCheck = [
                        { x: currentX, y: currentY - tolerance },
                        { x: currentX, y: currentY + tolerance },
                        { x: currentX - tolerance, y: currentY },
                        { x: currentX + tolerance, y: currentY }
                    ];

                    for (const point of pointsToCheck) {
                        const nearbyElements = document.elementsFromPoint(point.x, point.y);
                        const nearbyButton = nearbyElements.find(el => el.hasAttribute('data-symbol-id'));
                        if (nearbyButton) {
                            elements.push(nearbyButton);
                            break;
                        }
                    }
                }

                let buttonElement: Element | null = null;

                for (const el of elements) {
                    if (el.hasAttribute && el.hasAttribute('data-symbol-id')) {
                        buttonElement = el;
                        break;
                    }
                }

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
                        const mode = isUsingMouseRef.current ? 'Mouse' : 'Eye';
                        console.log(`🎯 NEW DWELL START (${mode} Mode):`, elementId);
                        currentHoveredRef.current = elementId;
                        setHoveredElement(elementId);
                        dwellStartTimeRef.current = Date.now();
                        setDwellProgress(0);

                        if (dwellTimerRef.current) {
                            clearTimeout(dwellTimerRef.current);
                            dwellTimerRef.current = null;
                        }
                        if (progressIntervalRef.current) {
                            clearInterval(progressIntervalRef.current);
                            progressIntervalRef.current = null;
                        }

                        progressIntervalRef.current = setInterval(() => {
                            const elapsed = Date.now() - dwellStartTimeRef.current;
                            const progress = Math.min((elapsed / dwellTime) * 100, 100);
                            setDwellProgress(progress);
                        }, 50);

                        dwellTimerRef.current = setTimeout(() => {
                            console.log('🚀 DWELL COMPLETE! CLICKING:', elementId);

                            try {
                                (buttonElement as HTMLElement).click();
                                console.log('✅ CLICK SUCCESSFUL!');
                            } catch (err) {
                                console.error('❌ Click error:', err);
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
                (window as any).webgazer.end();
                const videoContainer = document.getElementById('webgazerVideoContainer');
                if (videoContainer) {
                    videoContainer.remove();
                }
            }
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
            if (dwellTimerRef.current) {
                clearTimeout(dwellTimerRef.current);
            }
            if (mouseInactivityTimerRef.current) {
                clearTimeout(mouseInactivityTimerRef.current);
            }
            document.removeEventListener('mousemove', handleMouseMove);
            document.body.style.cursor = 'default';
        };
    }, [enabled, dwellTime]);

    return { gazePosition, hoveredElement, dwellProgress, isInitialized, isUsingMouse };
};
