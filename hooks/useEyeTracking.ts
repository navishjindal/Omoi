import { useEffect, useRef, useState } from 'react';

export const useEyeTracking = (enabled: boolean, dwellTime: number = 2000) => {
    const [gazePosition, setGazePosition] = useState<{ x: number, y: number } | null>(null);
    const [hoveredElement, setHoveredElement] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const dwellTimerRef = useRef<NodeJS.Timeout | null>(null);
    const dwellStartTimeRef = useRef<number>(0);

    useEffect(() => {
        if (!enabled) {
            // Cleanup when disabled
            if ((window as any).webgazer) {
                (window as any).webgazer.end();
            }
            setGazePosition(null);
            setHoveredElement(null);
            setIsInitialized(false);
            if (dwellTimerRef.current) {
                clearTimeout(dwellTimerRef.current);
            }
            return;
        }

        // Load WebGazer library
        const script = document.createElement('script');
        script.src = 'https://webgazer.cs.brown.edu/webgazer.js';
        script.async = true;

        script.onload = () => {
            const webgazer = (window as any).webgazer;

            console.log('🔄 Starting WebGazer...');

            webgazer
                .setGazeListener((data: any) => {
                    if (data == null) return;

                    const { x, y } = data;
                    // Log every 10th gaze point to avoid console spam
                    if (Math.random() < 0.1) {
                        console.log(`👁️ Gaze: (${Math.round(x)}, ${Math.round(y)})`);
                    }
                    setGazePosition({ x, y });

                    // Check what element is being looked at
                    const elements = document.elementsFromPoint(x, y);
                    const buttonElement = elements.find(el =>
                        el.hasAttribute('data-symbol-id') ||
                        el.hasAttribute('data-action-button')
                    );

                    if (buttonElement) {
                        const elementId = buttonElement.getAttribute('data-symbol-id') ||
                            buttonElement.getAttribute('data-action-button');

                        if (elementId !== hoveredElement) {
                            // New element - start dwell timer
                            setHoveredElement(elementId);
                            dwellStartTimeRef.current = Date.now();

                            if (dwellTimerRef.current) {
                                clearTimeout(dwellTimerRef.current);
                            }

                            dwellTimerRef.current = setTimeout(() => {
                                // Trigger click after dwell time
                                console.log(`✅ Dwell complete on: ${elementId}`);
                                (buttonElement as HTMLElement).click();
                                setHoveredElement(null);
                            }, dwellTime);
                        }
                    } else {
                        // Not looking at any button
                        if (dwellTimerRef.current) {
                            clearTimeout(dwellTimerRef.current);
                        }
                        setHoveredElement(null);
                    }
                })
                .showVideoPreview(true)
                .showPredictionPoints(true)
                .begin()
                .then(() => {
                    console.log('✅ WebGazer started successfully!');

                    // Wait for video element to be created
                    setTimeout(() => {
                        const videoContainer = document.getElementById('webgazerVideoContainer');
                        const videoFeed = document.getElementById('webgazerVideoFeed');
                        const faceOverlay = document.getElementById('webgazerFaceOverlay');
                        const faceFeedbackBox = document.getElementById('webgazerFaceFeedbackBox');

                        console.log('🔍 Looking for video elements...');
                        console.log('Video container:', videoContainer);
                        console.log('Video feed:', videoFeed);

                        if (videoContainer) {
                            videoContainer.style.position = 'fixed';
                            videoContainer.style.bottom = '10px';
                            videoContainer.style.left = '10px';
                            videoContainer.style.zIndex = '99999';
                            videoContainer.style.display = 'block';
                            console.log('✅ Video container styled');
                        }

                        if (videoFeed) {
                            videoFeed.style.display = 'block';
                            videoFeed.style.border = '4px solid #22c55e';
                            videoFeed.style.borderRadius = '8px';
                            console.log('✅ Video feed styled');
                        }

                        if (faceOverlay) {
                            faceOverlay.style.display = 'block';
                        }

                        if (faceFeedbackBox) {
                            faceFeedbackBox.style.display = 'block';
                        }

                        setIsInitialized(true);
                        console.log('✅ Eye tracking fully initialized!');
                    }, 2000);
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
            if ((window as any).webgazer) {
                (window as any).webgazer.end();
            }
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        };
    }, [enabled, hoveredElement, dwellTime]);

    return { gazePosition, hoveredElement, isInitialized };
};
