import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as UTIF from 'utif';

const ImageViewRef: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const inputRefs = [
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null)
    ];
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [renderTime, setRenderTime] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [tiffData, setTiffData] = useState<ArrayBuffer | null>(null);
    const [tiffPages, setTiffPages] = useState<any[]>([]);
    const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
    
    // Non-overlapping rectangle coordinates: [x1, y1, x2, y2] format (top-left to bottom-right)
    const [rectangleCoordinates] = useState([
        { id: 1, topLeft: { x: 50, y: 50 }, bottomRight: { x: 150, y: 150 } },
        { id: 2, topLeft: { x: 200, y: 50 }, bottomRight: { x: 300, y: 150 } },
        { id: 3, topLeft: { x: 50, y: 200 }, bottomRight: { x: 150, y: 300 } },
        { id: 4, topLeft: { x: 200, y: 200 }, bottomRight: { x: 300, y: 300 } }
    ]);
    const [zoomLevel, setZoomLevel] = useState(1);

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
                        const imageData = ctx.createImageData(width, height);
                        imageData.data.set(rgbaData);
                        ctx.putImageData(imageData, 0, 0);
                        
                        // Update canvas dimensions state for SVG overlay
                        setCanvasDimensions({ width, height });
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
    
    // Zoom functions
    const zoomIn = useCallback(() => {
        setZoomLevel(prev => Math.min(prev + 0.25, 5)); // Max 5x zoom
    }, []);
    
    const zoomOut = useCallback(() => {
        setZoomLevel(prev => Math.max(prev - 0.25, 0.25)); // Min 0.25x zoom
    }, []);
    
    const resetZoom = useCallback(() => {
        setZoomLevel(1);
    }, []);
    
    // Handle rectangle click to focus corresponding text box
    const handleRectangleClick = useCallback((index: number) => {
        if (inputRefs[index] && inputRefs[index].current) {
            inputRefs[index].current.focus();
        }
    }, [inputRefs]);

    return (
        <div className="w-full h-full bg-gray-800 flex flex-col items-center justify-center p-4">
            {loading && <span className="text-white mb-4">Loading TIFF...</span>}
            {error && <span className="text-red-500 mb-4">{error}</span>}
            {renderTime && <span className="text-green-400 mb-4">{renderTime}</span>}
            
            <div className="flex flex-row gap-4">
                <div className="relative">
                    <div style={{ 
                        overflow: 'auto', 
                        maxWidth: '100%', 
                        maxHeight: '70vh',
                        border: '2px solid #555',
                        position: 'relative'
                    }}>
                        <canvas 
                            ref={canvasRef} 
                            style={{ 
                                display: loading || error ? 'none' : 'block',
                                transform: `scale(${zoomLevel})`,
                                transformOrigin: 'top left',
                                transition: 'transform 0.2s ease'
                            }} 
                        />
                        {!loading && !error && tiffPages.length > 0 && (
                            <svg
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: canvasDimensions.width,
                                    height: canvasDimensions.height,
                                    transform: `scale(${zoomLevel})`,
                                    transformOrigin: 'top left',
                                    transition: 'transform 0.2s ease'
                                }}
                            >
                                {/* SVG content will go here */}
                                {rectangleCoordinates.map((rect, index) => {
                                    // Different colors for each rectangle
                                    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ff00ff'];
                                    const fillColor = colors[index % colors.length];
                                    
                                    return (
                                        <rect
                                            key={rect.id}
                                            x={rect.topLeft.x}
                                            y={rect.topLeft.y}
                                            width={rect.bottomRight.x - rect.topLeft.x}
                                            height={rect.bottomRight.y - rect.topLeft.y}
                                            stroke={fillColor}
                                            strokeWidth="2"
                                            fill={fillColor}
                                            fillOpacity="0.1"
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => handleRectangleClick(index)}
                                        />
                                    );
                                })}
                            </svg>
                        )}
                    </div>
                </div>
                
                {/* Text boxes section to the right */}
                <div className="flex flex-col gap-3 min-w-[200px]">
                    <div className="bg-gray-700 p-3 rounded text-white">
                        <input
                            ref={inputRefs[0]}
                            type="text"
                            value="First"
                            readOnly
                            className="w-full bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="bg-gray-700 p-3 rounded text-white">
                        <input
                            ref={inputRefs[1]}
                            type="text"
                            value="Second"
                            readOnly
                            className="w-full bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="bg-gray-700 p-3 rounded text-white">
                        <input
                            ref={inputRefs[2]}
                            type="text"
                            value="Third"
                            readOnly
                            className="w-full bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="bg-gray-700 p-3 rounded text-white">
                        <input
                            ref={inputRefs[3]}
                            type="text"
                            value="Fourth"
                            readOnly
                            className="w-full bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
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
                
                {/* Zoom Controls */}
                <div className="flex gap-2">
                    <button 
                        className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-500"
                        onClick={zoomIn}
                        disabled={loading || zoomLevel >= 5}
                    >
                        Zoom In (+)
                    </button>
                    <button 
                        className="px-4 py-2 bg-yellow-600 text-white rounded disabled:bg-gray-500"
                        onClick={resetZoom}
                        disabled={loading || zoomLevel === 1}
                    >
                        Reset Zoom ({Math.round(zoomLevel * 100)}%)
                    </button>
                    <button 
                        className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-500"
                        onClick={zoomOut}
                        disabled={loading || zoomLevel <= 0.25}
                    >
                        Zoom Out (-)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImageViewRef;
