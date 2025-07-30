import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as UTIF from 'utif';

const ImageViewMag: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const loupeCanvasRef = useRef<HTMLCanvasElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [renderTime, setRenderTime] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [tiffData, setTiffData] = useState<ArrayBuffer | null>(null);
    const [tiffPages, setTiffPages] = useState<any[]>([]);
    const [showMagnifier, setShowMagnifier] = useState(false);
    const [mousePos, setMousePos] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
    const [zoomActive, setZoomActive] = useState(false);

    // Load the TIFF file
    useEffect(() => {
        async function loadTiff() {
            setLoading(true);
            setError(null);
            try {
                // Load the TIFF file
                const response = await fetch('/tiff_images/multipage_sample.tif');
                if (!response.ok) {
                    throw new Error('Failed to fetch image');
                }
                
                const buffer = await response.arrayBuffer();
                const ifds = UTIF.decode(buffer);
                
                console.log('TIFF file decoded, pages:', ifds.length);
                
                if (ifds.length === 0) {
                    throw new Error('No pages found in TIFF file');
                }
                
                // Store the TIFF data and page count
                setTiffData(buffer);
                setTiffPages(ifds);
                setTotalPages(ifds.length);
                setCurrentPage(0); // Start with the first page
            } catch (err: any) {
                setError(err.message || 'Error loading TIFF');
            } finally {
                setLoading(false);
            }
        }
        
        loadTiff();
    }, []);

    // Render the current page whenever it changes
    useEffect(() => {
        if (!tiffData || tiffPages.length === 0 || currentPage < 0 || currentPage >= tiffPages.length) {
            return;
        }
        
        const renderCurrentPage = async () => {
            setLoading(true);
            const startTime = performance.now();
            
            try {
                // Get the current page
                const pageIfd = tiffPages[currentPage];
                
                // Decode the image data
                UTIF.decodeImage(tiffData, pageIfd);
                
                // Log page properties
                console.log(`Rendering page ${currentPage + 1}/${tiffPages.length}`, pageIfd);
                
                // Get dimensions
                let width = pageIfd.width;
                let height = pageIfd.height;
                
                // Try alternative ways to get dimensions if needed
                if (!width) width = pageIfd.t256 ? (Array.isArray(pageIfd.t256) ? pageIfd.t256[0] : pageIfd.t256) : 0;
                if (!height) height = pageIfd.t257 ? (Array.isArray(pageIfd.t257) ? pageIfd.t257[0] : pageIfd.t257) : 0;
                
                // Final validation
                if (!width || !height || width <= 0 || height <= 0) {
                    throw new Error(`Invalid image dimensions: ${width}x${height}`);
                }
                
                // Convert to RGBA format for canvas display
                const rgbaData = UTIF.toRGBA8(pageIfd);
                
                // Draw to canvas
                const canvas = canvasRef.current;
                if (canvas) {
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        // Ensure rgbaData is valid
                        if (!rgbaData || rgbaData.length < width * height * 4) {
                            throw new Error('Invalid RGBA data generated');
                        }
                        
                        // Create ImageData from RGBA data
                        const imageData = new ImageData(new Uint8ClampedArray(rgbaData.buffer), width, height);
                        ctx.putImageData(imageData, 0, 0);
                    }
                }
                
            } catch (err: any) {
                setError(err.message || 'Error rendering page');
            } finally {
                const endTime = performance.now();
                const timeElapsed = (endTime - startTime).toFixed(2);
                setRenderTime(`Page ${currentPage + 1}/${tiffPages.length} | Render time: ${timeElapsed}ms`);
                setLoading(false);
            }
        };
        
        renderCurrentPage();
    }, [tiffData, tiffPages, currentPage]);
    
    // Navigation functions
    const goToNextPage = useCallback(() => {
        if (currentPage < totalPages - 1) {
            setCurrentPage(prev => prev + 1);
        }
    }, [currentPage, totalPages]);
    
    const goToPrevPage = useCallback(() => {
        if (currentPage > 0) {
            setCurrentPage(prev => prev - 1);
        }
    }, [currentPage]);
    
    // Function to update the magnifier canvas
    const updateMagnifier = useCallback((x: number, y: number) => {
        const mainCanvas = canvasRef.current;
        const loupeCanvas = loupeCanvasRef.current;
        
        if (!mainCanvas || !loupeCanvas) return;
        
        const mainCtx = mainCanvas.getContext('2d');
        const loupeCtx = loupeCanvas.getContext('2d');
        
        if (!mainCtx || !loupeCtx) return;
        
        // Size of the area to zoom
        const sourceDim = 50;
        // Size of the magnifier canvas
        const zoomFactor = 4;
        
        // Clear the loupe canvas
        loupeCtx.clearRect(0, 0, loupeCanvas.width, loupeCanvas.height);
        
        // Draw the zoomed portion of the image
        loupeCtx.drawImage(
            mainCanvas,
            Math.max(0, Math.min(x - sourceDim / 2, mainCanvas.width - sourceDim)),
            Math.max(0, Math.min(y - sourceDim / 2, mainCanvas.height - sourceDim)),
            sourceDim,
            sourceDim,
            0,
            0,
            loupeCanvas.width,
            loupeCanvas.height
        );
        
        // Optional: Add a grid to show pixels more clearly
        loupeCtx.strokeStyle = 'rgba(150, 150, 150, 0.5)';
        loupeCtx.lineWidth = 0.5;
        
        // Draw horizontal grid lines
        for (let i = 0; i <= loupeCanvas.height; i += zoomFactor) {
            loupeCtx.beginPath();
            loupeCtx.moveTo(0, i);
            loupeCtx.lineTo(loupeCanvas.width, i);
            loupeCtx.stroke();
        }
        
        // Draw vertical grid lines
        for (let i = 0; i <= loupeCanvas.width; i += zoomFactor) {
            loupeCtx.beginPath();
            loupeCtx.moveTo(i, 0);
            loupeCtx.lineTo(i, loupeCanvas.height);
            loupeCtx.stroke();
        }
        
        // Draw crosshair in the center
        loupeCtx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        loupeCtx.lineWidth = 1;
        
        // Horizontal line of crosshair
        loupeCtx.beginPath();
        loupeCtx.moveTo(0, loupeCanvas.height / 2);
        loupeCtx.lineTo(loupeCanvas.width, loupeCanvas.height / 2);
        loupeCtx.stroke();
        
        // Vertical line of crosshair
        loupeCtx.beginPath();
        loupeCtx.moveTo(loupeCanvas.width / 2, 0);
        loupeCtx.lineTo(loupeCanvas.width / 2, loupeCanvas.height);
        loupeCtx.stroke();
    }, []);
    
    // Mouse event handlers for the magnifier
    const handleMouseEnter = useCallback(() => {
        if (zoomActive) {
            setShowMagnifier(true);
        }
    }, [zoomActive]);
    
    const handleMouseLeave = useCallback(() => {
        setShowMagnifier(false);
    }, []);
    
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current || !loupeCanvasRef.current || !zoomActive) return;
        
        // Get the canvas position
        const rect = canvasRef.current.getBoundingClientRect();
        
        // Calculate cursor position relative to canvas
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Calculate magnifier position - centered above the cursor
        const magnifierWidth = 200;
        const magnifierHeight = 200;
        // Position magnifier centered horizontally above the cursor
        let magnifierX = x - (magnifierWidth / 2);
        let magnifierY = y - magnifierHeight - 20; // 20px gap above cursor
        
        // Get container scroll position and viewport
        const container = canvasRef.current.parentElement;
        const scrollLeft = container ? container.scrollLeft : 0;
        const scrollTop = container ? container.scrollTop : 0;
        
        // Adjust if it would go outside viewport boundaries
        // Left edge
        if (magnifierX < scrollLeft) {
            magnifierX = scrollLeft;
        }
        // Right edge
        if (magnifierX + magnifierWidth > rect.width + scrollLeft) {
            magnifierX = rect.width + scrollLeft - magnifierWidth;
        }
        // Top edge - if no space above, show below
        if (magnifierY < scrollTop) {
            magnifierY = y + 20; // 20px gap below cursor
        }
        
        // Update mouse position
        setMousePos({ x: magnifierX, y: magnifierY });
        
        // Draw the magnified view
        updateMagnifier(x, y);
    }, [zoomActive, updateMagnifier]);

    // Toggle zoom mode
    const toggleZoom = useCallback(() => {
        setZoomActive(prev => {
            const newState = !prev;
            if (!newState) {
                setShowMagnifier(false);
            }
            return newState;
        });
    }, []);

    return (
        <div className="w-full h-full bg-gray-800 flex flex-col items-center justify-center p-4">
            {loading && <span className="text-white mb-4">Loading TIFF...</span>}
            {error && <span className="text-red-500 mb-4">{error}</span>}
            {renderTime && <span className="text-green-400 mb-4">{renderTime}</span>}
            
            <div className="relative">
                <div style={{ 
                    overflow: 'auto', 
                    maxWidth: '100%', 
                    maxHeight: '75vh',
                    border: '2px solid #555',
                    position: 'relative'
                }}>
                    <canvas 
                        ref={canvasRef} 
                        style={{ 
                            display: loading || error ? 'none' : 'block',                            
                        }}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        onMouseMove={handleMouseMove}
                    />
                    
                    {/* Magnifier loupe */}
                    {showMagnifier && zoomActive && (
                        <div 
                            style={{
                                position: 'absolute',
                                left: `${mousePos.x}px`,
                                top: `${mousePos.y}px`,
                                width: '200px',
                                height: '200px',
                                border: '2px solid #fff',
                                borderRadius: '4px',
                                overflow: 'hidden',
                                backgroundColor: '#000',
                                boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                                pointerEvents: 'none', // Make sure this doesn't interfere with mouse events
                                zIndex: 1000,
                            }}
                        >
                            <canvas 
                                ref={loupeCanvasRef} 
                                width={200} 
                                height={200}
                            />
                        </div>
                    )}
                </div>
            </div>
            
            <div className="mt-4 flex flex-wrap justify-center gap-4">
                {/* Page Navigation Controls */}
                {tiffPages.length > 1 && (
                    <div className="flex gap-2">
                        <button 
                            className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-500"
                            onClick={goToPrevPage}
                            disabled={currentPage === 0 || loading}
                        >
                            Previous Page
                        </button>
                        <button 
                            className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-500"
                            onClick={goToNextPage}
                            disabled={currentPage === tiffPages.length - 1 || loading}
                        >
                            Next Page
                        </button>
                    </div>
                )}
                
                {/* Zoom Toggle Button */}
                <div className="flex gap-2">
                    <button
                        className={`px-4 py-2 ${zoomActive ? 'bg-green-600' : 'bg-blue-600'} text-white rounded`}
                        onClick={toggleZoom}
                        disabled={loading}
                    >
                        {zoomActive ? 'Disable Magnifier' : 'Enable Magnifier'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImageViewMag;
