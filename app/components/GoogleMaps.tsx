"use client";
import React, { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Spinner = () => (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
);

// Helper function to calculate distance between two coordinates
const calculateDistance = (coord1: google.maps.LatLng, coord2: google.maps.LatLng) => {
    return google.maps.geometry.spherical.computeDistanceBetween(coord1, coord2);
};

// Helper function to calculate time in minutes and seconds
const calculateTime = (distance: number, speed: number) => {
    const timeInHours = distance / 1000 / speed; // distance in km, speed in km/h
    const totalSeconds = timeInHours * 3600; // Convert hours to seconds
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return { minutes, seconds };
};

// Helper function to calculate total time in h:mm:ss format
const calculateTotalTime = (distances: number[], speed: number) => {
    let totalSeconds = distances.reduce((acc, distance) => acc + (distance / (speed * 1000 / 3600)), 0);

    const hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);

    return { hours, minutes, seconds };
};

// Helper function to format seconds into hh:mm:ss format
const formatTimeHMS = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Helper function to calculate cumulative times
const calculateCumulativeTimes = (distances: number[], speed: number) => {
    let cumulativeSeconds = 0;
    return distances.map(distance => {
        const timeInHours = distance / 1000 / speed;
        const segmentSeconds = timeInHours * 3600;
        cumulativeSeconds += segmentSeconds;
        return cumulativeSeconds;
    });
};

// Builds the pin content element used for AdvancedMarkerElement labels
const createMarkerPinContent = (name: string): HTMLElement => {
    const pin = new google.maps.marker.PinElement({
        glyphText: name,
        glyphColor: 'black',
    } as google.maps.marker.PinElementOptions);
    return pin.element;
};

const MAGNETIC_DECLINATION = 6; // degrees East, approximate for Romania (2026)

const getSatellitePositions = (
    count: number,
    pageWidth: number
): Array<{ x: number; y: number; w: number; h: number }> => {
    const marginX = 15;
    const startY = 30;
    const gapX = 5;
    const gapY = 5;
    const imgW = (pageWidth - 2 * marginX - gapX) / 2;
    const imgH = imgW * 0.75;
    return Array.from({ length: count }, (_, i) => {
        const isLast = i === count - 1 && count % 2 === 1;
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = isLast ? (pageWidth - imgW) / 2 : marginX + col * (imgW + gapX);
        return { x, y: startY + row * (imgH + gapY), w: imgW, h: imgH };
    });
};

const computeHeading = (
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
    type: 'true' | 'magnetic'
): string => {
    const fromLatLng = new google.maps.LatLng(from.lat, from.lng);
    const toLatLng = new google.maps.LatLng(to.lat, to.lng);
    let hdg = google.maps.geometry.spherical.computeHeading(fromLatLng, toLatLng);
    if (hdg < 0) hdg += 360;
    if (type === 'magnetic') hdg = (hdg - MAGNETIC_DECLINATION + 360) % 360;
    return hdg.toFixed(1) + '°';
};

export default function GoogleMaps() {
    const mapRef = useRef<HTMLDivElement>(null);
    const [markers, setMarkers] = useState<Array<{ lat: number, lng: number, name: string }>>([]);
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [distances, setDistances] = useState<number[]>([]);
    const [speed, setSpeed] = useState<number>(120); // Default speed in km/h
    const polylineRef = useRef<google.maps.Polyline | null>(null);
    const polygonRef = useRef<google.maps.Polygon | null>(null);
    const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

    const getMarkerName = (index: number) => index === 0 ? 'SP/FP' : `T${index}`;

    // Polygon coordinates in decimal degrees
    const polygonCoordinates = [
        { lat: 46.024722, lng: 25.732500 },
        { lat: 45.865556, lng: 26.110000 },
        { lat: 45.446667, lng: 25.712778 },
        { lat: 45.530833, lng: 25.543056 },
        { lat: 45.460278, lng: 25.373889 },
        { lat: 45.486944, lng: 25.318056 },
        { lat: 45.516667, lng: 25.377778 },
        { lat: 45.583333, lng: 25.275000 },
        { lat: 45.583333, lng: 25.235278 },
        { lat: 45.633611, lng: 25.197222 },
        { lat: 46.024722, lng: 25.732500 }, // Closing the polygon
    ];

    const [apiKey, setApiKey] = useState<string>('');
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const [isA3Loading, setIsA3Loading] = useState(false);
    const [maxPoints, setMaxPoints] = useState<number>(6);
    const maxPointsRef = useRef<number>(6);
    const [headingType, setHeadingType] = useState<'true' | 'magnetic'>('true');

    // Initialize the map only once
    useEffect(() => {
        const initializeMap = async () => {
            const response = await fetch("/api/config");
            const { googleMapsApiKey } = await response.json();
            setApiKey(googleMapsApiKey);
            setOptions({
                key: googleMapsApiKey,
                v: 'quarterly',
                libraries: ['geometry'] // Required for distance calculations
            });

            const { Map } = await importLibrary('maps');
            await importLibrary('marker'); // Required for AdvancedMarkerElement

            const locationInMap = {
                lat: 45.657974,
                lng: 25.601198
            };

            const options: google.maps.MapOptions = {
                center: locationInMap,
                zoom: 9, // Adjust zoom to fit the polygon
                mapId: 'NEXT_MAPS_TUTS', // Ensure this is a valid Map ID if used
                streetViewControl: false, // Disable Street View
                gestureHandling: 'auto', // Optional: To control user interactions with the map
            };

            const mapInstance = new Map(mapRef.current as HTMLDivElement, options);
            setMap(mapInstance);

            // Add polygon overlay to the map
            const polygon = new google.maps.Polygon({
                paths: polygonCoordinates,
                strokeColor: '#FF0000',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: '#FF0000',
                fillOpacity: 0.10,
                map: mapInstance,
                clickable: false, // Allow clicks to pass through the polygon
            });
            polygonRef.current = polygon;

            const handleMapClick = (e: google.maps.MapMouseEvent) => {
                if (e.latLng) {
                    const lat = e.latLng.lat();
                    const lng = e.latLng.lng();

                    setMarkers(prevMarkers => {
                        if (prevMarkers.length >= maxPointsRef.current) {
                            alert(`You can only add up to ${maxPointsRef.current} markers.`);
                            return prevMarkers;
                        }

                        const newMarker = {
                            lat,
                            lng,
                            name: getMarkerName(prevMarkers.length)
                        };

                        const updatedMarkers = [...prevMarkers, newMarker];

                        // Add new marker to the map with label
                        const markerInstance = new google.maps.marker.AdvancedMarkerElement({
                            position: newMarker,
                            map: mapInstance,
                            gmpDraggable: true,
                            content: createMarkerPinContent(newMarker.name),
                        });

                        markersRef.current = [...markersRef.current, markerInstance];

                        // Add dragend listener
                        google.maps.event.addListener(markerInstance, 'dragend', (e: google.maps.MapMouseEvent) => {
                            if (e.latLng) { // Ensure latLng is not null
                                const latLng = e.latLng;
                                const updatedMarkers = prevMarkers.map(marker =>
                                    marker.lat === newMarker.lat && marker.lng === newMarker.lng
                                        ? { ...marker, lat: latLng.lat(), lng: latLng.lng() }
                                        : marker
                                );
                                setMarkers(updatedMarkers);
                            }
                        });

                        return updatedMarkers;
                    });
                }
            };

            // Add event listener for adding markers
            mapInstance.addListener('click', handleMapClick);
        };

        initializeMap();
    }, []);

    const generateOSMMapImage = async (
        mkrs: Array<{ lat: number; lng: number; name: string }>,
        targetAspect?: number
    ): Promise<{ dataUrl: string; canvasWidth: number; canvasHeight: number }> => {
        const TILE_SIZE = 256;
        const PADDING = 0.06;

        const lats = mkrs.map(m => m.lat);
        const lngs = mkrs.map(m => m.lng);
        let minLat = Math.min(...lats);
        let maxLat = Math.max(...lats);
        let minLng = Math.min(...lngs);
        let maxLng = Math.max(...lngs);

        // Guard against zero-size bounding box
        if (minLat === maxLat) { minLat -= 0.01; maxLat += 0.01; }
        if (minLng === maxLng) { minLng -= 0.01; maxLng += 0.01; }

        const latPad = (maxLat - minLat) * PADDING;
        const lngPad = (maxLng - minLng) * PADDING;
        const paddedMinLat = Math.max(-85.05, minLat - latPad);
        const paddedMaxLat = Math.min(85.05, maxLat + latPad);
        const paddedMinLng = Math.max(-180, minLng - lngPad);
        const paddedMaxLng = Math.min(180, maxLng + lngPad);

        const lon2tile = (lon: number, z: number) =>
            Math.floor((lon + 180) / 360 * Math.pow(2, z));
        const lat2tile = (lat: number, z: number) => {
            const r = lat * Math.PI / 180;
            return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z));
        };
        const latLngToPixel = (lat: number, lng: number, z: number, originTX: number, originTY: number) => {
            const r = lat * Math.PI / 180;
            const wx = (lng + 180) / 360 * Math.pow(2, z);
            const wy = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
            return { px: (wx - originTX) * TILE_SIZE, py: (wy - originTY) * TILE_SIZE };
        };

        // Auto-select zoom so tile grid fits within 8×8
        let zoom = 6;
        for (let z = 12; z >= 6; z--) {
            const cols = lon2tile(paddedMaxLng, z) - lon2tile(paddedMinLng, z) + 1;
            const rows = lat2tile(paddedMinLat, z) - lat2tile(paddedMaxLat, z) + 1;
            if (cols <= 8 && rows <= 8) { zoom = z; break; }
        }

        let txMin = lon2tile(paddedMinLng, zoom);
        let txMax = lon2tile(paddedMaxLng, zoom);
        let tyMin = lat2tile(paddedMaxLat, zoom);
        let tyMax = lat2tile(paddedMinLat, zoom);
        let cols = txMax - txMin + 1;
        let rows = tyMax - tyMin + 1;

        // Expand tile grid symmetrically to better match target page aspect ratio
        if (targetAspect) {
            const currentAspect = cols / rows;
            if (currentAspect > targetAspect) {
                // Canvas too wide: add rows symmetrically up to limit of 8
                const targetRows = Math.min(8, Math.round(cols / targetAspect));
                const extra = targetRows - rows;
                tyMin -= Math.floor(extra / 2);
                tyMax += Math.ceil(extra / 2);
            } else if (currentAspect < targetAspect) {
                // Canvas too tall: add cols symmetrically up to limit of 8
                const targetCols = Math.min(8, Math.round(rows * targetAspect));
                const extra = targetCols - cols;
                txMin -= Math.floor(extra / 2);
                txMax += Math.ceil(extra / 2);
            }
            cols = txMax - txMin + 1;
            rows = tyMax - tyMin + 1;
        }

        const canvas = document.createElement('canvas');
        canvas.width = cols * TILE_SIZE;
        canvas.height = rows * TILE_SIZE;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Fetch all tiles in parallel via the proxy (avoids CORS canvas taint)
        await Promise.all(
            Array.from({ length: rows }, (_, ry) =>
                Array.from({ length: cols }, (_, rx) => {
                    const tx = txMin + rx;
                    const ty = tyMin + ry;
                    return new Promise<void>(resolve => {
                        const img = new Image();
                        img.onload = () => { ctx.drawImage(img, rx * TILE_SIZE, ry * TILE_SIZE, TILE_SIZE, TILE_SIZE); resolve(); };
                        img.onerror = () => resolve();
                        img.src = `/api/tile?z=${zoom}&x=${tx}&y=${ty}`;
                    });
                })
            ).flat()
        );

        // Draw closed-loop route polyline
        const pts = mkrs.map(m => latLngToPixel(m.lat, m.lng, zoom, txMin, tyMin));
        ctx.beginPath();
        ctx.moveTo(pts[0].px, pts[0].py);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].px, pts[i].py);
        ctx.lineTo(pts[0].px, pts[0].py);
        ctx.strokeStyle = '#FF3300';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Draw markers
        pts.forEach((pt, i) => {
            // White halo
            ctx.beginPath();
            ctx.arc(pt.px, pt.py, 7, 0, 2 * Math.PI);
            ctx.fillStyle = 'white';
            ctx.fill();
            // Coloured circle
            ctx.beginPath();
            ctx.arc(pt.px, pt.py, 5, 0, 2 * Math.PI);
            ctx.fillStyle = i === 0 ? '#1a73e8' : '#FF3300';
            ctx.fill();
            // Label above circle
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.strokeText(mkrs[i].name, pt.px, pt.py - 13);
            ctx.fillStyle = '#222';
            ctx.fillText(mkrs[i].name, pt.px, pt.py - 13);
        });

        // --- Map scale bar ---
        // Meters per pixel at the centre latitude for the current zoom level
        const centerLat = (paddedMinLat + paddedMaxLat) / 2;
        const metersPerPixel =
            (2 * Math.PI * 6378137 * Math.cos(centerLat * Math.PI / 180)) /
            (TILE_SIZE * Math.pow(2, zoom));

        // Pick a "nice" round km value whose bar width is between 60 and 200 px
        const niceKm = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
        const targetBarKm = niceKm.find(km => {
            const px = (km * 1000) / metersPerPixel;
            return px >= 60 && px <= 200;
        }) ?? niceKm[niceKm.length - 1];
        const barPx = (targetBarKm * 1000) / metersPerPixel;

        // Draw scale bar in the bottom-left corner
        const barX = 20;
        const barY = canvas.height - 28;
        const barH = 6;
        const fontSize = 14;
        const label = targetBarKm >= 1 ? `${targetBarKm} km` : `${targetBarKm * 1000} m`;

        // White background pill for readability
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.roundRect(barX - 8, barY - fontSize - 4, barPx + 16, fontSize + barH + 12, 4);
        ctx.fill();

        // Bar ticks and fill
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barPx, barH);
        // Left tick
        ctx.fillRect(barX, barY - 4, 2, barH + 4);
        // Right tick
        ctx.fillRect(barX + barPx - 2, barY - 4, 2, barH + 4);

        // Labels
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#111';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.strokeText(label, barX, barY - 2);
        ctx.fillText(label, barX, barY - 2);

        return { dataUrl: canvas.toDataURL('image/png'), canvasWidth: canvas.width, canvasHeight: canvas.height };
    };

    const handleGenerateA3Map = async () => {
        if (markers.length !== maxPoints) return;
        setIsA3Loading(true);
        try {

        const doc = new jsPDF('portrait', 'mm', 'a3');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const { dataUrl: osmDataUrl, canvasWidth, canvasHeight } = await generateOSMMapImage(markers, pageWidth / pageHeight);
        const aspect = canvasWidth / canvasHeight;
        let imgW = pageWidth;
        let imgH = imgW / aspect;
        if (imgH > pageHeight) { imgH = pageHeight; imgW = imgH * aspect; }
        const imgX = (pageWidth - imgW) / 2;
        const imgY = (pageHeight - imgH) / 2;
        doc.addImage(osmDataUrl, 'PNG', imgX, imgY, imgW, imgH, undefined, 'FAST');

        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
        doc.save(`a3-map_${timestamp}.pdf`);
        } finally {
            setIsA3Loading(false);
        }
    };

    const handleGeneratePDF = async () => {
        if (markers.length !== maxPoints || !apiKey) return;
        setIsPdfLoading(true);
        try {

        const doc = new jsPDF('portrait', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // First page: satellite thumbnails (one per marker, dynamic layout)
        const imgPositions = getSatellitePositions(markers.length, pageWidth);
        for (let i = 0; i < markers.length; i++) {
            const marker = markers[i];
            const markerLabel = i === 0 ? 'S' : `${i}`;
            const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${marker.lat},${marker.lng}&zoom=18&size=600x400&maptype=satellite&markers=color:red%7Clabel:${markerLabel}%7C${marker.lat},${marker.lng}&key=${apiKey}`;
            const imgData = await fetchImageAsDataURL(staticMapUrl);
            const pos = imgPositions[i];
            doc.addImage(imgData, 'JPEG', pos.x, pos.y, pos.w, pos.h);
            // Marker label below thumbnail
            doc.setFontSize(9);
            doc.setTextColor(80, 80, 80);
            doc.text(marker.name, pos.x + pos.w / 2, pos.y + pos.h + 4, { align: 'center' });
        }
        doc.setTextColor(0, 0, 0);

        // Second page with table
        doc.addPage();
        const cumulativeTimes = calculateCumulativeTimes(distances, speed);

        let tableStartY = 40;
        const headingLabel = headingType === 'magnetic'
            ? `Magnetic Heading (decl. ${MAGNETIC_DECLINATION}° E)`
            : 'True Heading';
        doc.setFontSize(12);
        doc.text(`Speed: ${speed} km/h   |   ${headingLabel}`, 20, tableStartY - 10);

        const hdgColHeader = headingType === 'magnetic' ? 'Mag. Hdg' : 'True Hdg';
        autoTable(doc, {
            head: [['From', 'To', hdgColHeader, 'Distance (km)', 'Time (min:sec)', 'Cumul. Time']],
            body: distances.map((dist, index) => {
                const { minutes, seconds } = calculateTime(dist, speed);
                const from = markers[index];
                const to = markers[(index + 1) % markers.length];
                return [
                    from.name,
                    to.name,
                    computeHeading(from, to, headingType),
                    (dist / 1000).toFixed(2),
                    `${minutes}:${seconds.toString().padStart(2, '0')}`,
                    formatTimeHMS(cumulativeTimes[index])
                ];
            }),
            theme: 'grid',
            styles: { cellPadding: 3, fontSize: 10 },
            margin: { horizontal: 20 },
            startY: tableStartY
        });

        // Add marker coordinates below the table
        let finalY = (doc as any).lastAutoTable.finalY || 40;
        doc.setFontSize(14);
        doc.text('Markers Coordinates:', 20, finalY + 15);
        doc.setFontSize(12);
        markers.forEach((marker, idx) => {
            doc.text(`${marker.name}: Lat: ${marker.lat.toFixed(6)}, Lng: ${marker.lng.toFixed(6)}`,
                20, finalY + 25 + idx * 8);
        });

        // Page 3: OSM route overview (full page)
        doc.addPage();

        const { dataUrl: osmDataUrl, canvasWidth, canvasHeight } = await generateOSMMapImage(markers, pageWidth / pageHeight);
        const aspect = canvasWidth / canvasHeight;
        let imgW = pageWidth;
        let imgH = imgW / aspect;
        if (imgH > pageHeight) { imgH = pageHeight; imgW = imgH * aspect; }
        const imgX = (pageWidth - imgW) / 2;
        const imgY = (pageHeight - imgH) / 2;
        doc.addImage(osmDataUrl, 'PNG', imgX, imgY, imgW, imgH, undefined, 'FAST');

        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
        doc.save(`journey-report_${timestamp}.pdf`);
        } finally {
            setIsPdfLoading(false);
        }
    };

    const handleGenerateCRS = () => {
        if (markers.length !== maxPoints) return;
        const sp = markers[0];
        const lines: string[] = [];
        lines.push(`${sp.lat},${sp.lng},0,250,SP`);
        for (let i = 1; i < markers.length; i++) {
            lines.push(`${markers[i].lat},${markers[i].lng},0,250,TP${i}`);
        }
        lines.push(`${sp.lat},${sp.lng},0,250,FP`);
        const content = lines.join('\n');
        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `route_${timestamp}.crs`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Add this helper function
    const fetchImageAsDataURL = async (url: string): Promise<string> => {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    // Function to clear all markers
    const clearMarkers = () => {
        // Remove all markers from the map
        markersRef.current.forEach(marker => { marker.map = null; });
        // Clear the markers from the state
        setMarkers([]);
        // Clear the markers reference
        markersRef.current = [];
        // Remove the polyline from the map if present
        if (polylineRef.current) {
            polylineRef.current.setMap(null);
            polylineRef.current = null;
        }
        // Reset distance and distances
        setDistance(null);
        setDistances([]);
    };

    // Ensure markers are managed correctly
    useEffect(() => {
        if (map) {
            // Remove old markers from the map
            markersRef.current.forEach(marker => { marker.map = null; });
            markersRef.current = [];

            // Add new markers to the map
            markers.forEach((marker, index) => {
                const markerInstance = new google.maps.marker.AdvancedMarkerElement({
                    position: marker,
                    map: map,
                    gmpDraggable: true,
                    content: createMarkerPinContent(marker.name),
                });
                markersRef.current.push(markerInstance);

                // Add dragend listener
                google.maps.event.addListener(markerInstance, 'dragend', (e: google.maps.MapMouseEvent) => {
                    if (e.latLng) { // Ensure latLng is not null
                        const latLng = e.latLng;
                        const updatedMarkers = markers.map(m =>
                            m.lat === marker.lat && m.lng === marker.lng
                                ? { ...m, lat: latLng.lat(), lng: latLng.lng() }
                                : m
                        );
                        setMarkers(updatedMarkers);
                    }
                });
            });

            // Recalculate and update polyline if there are markers
            if (markers.length > 1) {
                let totalDistance = 0;
                const path = markers.map(marker => new google.maps.LatLng(marker.lat, marker.lng));
                const newDistances: number[] = [];

                for (let i = 0; i < markers.length - 1; i++) {
                    const coord1 = path[i];
                    const coord2 = path[i + 1];
                    const segmentDistance = calculateDistance(coord1, coord2);
                    totalDistance += segmentDistance;
                    newDistances.push(segmentDistance);
                }

                if (markers.length === maxPoints) {
                    // Calculate distance from last to first marker
                    const firstCoord = path[0];
                    const lastCoord = path[path.length - 1];
                    const closingDistance = calculateDistance(lastCoord, firstCoord);
                    totalDistance += closingDistance;
                    newDistances.push(closingDistance);

                    // Update path to close the loop
                    path.push(firstCoord);
                }

                setDistance(totalDistance);
                setDistances(newDistances);

                if (polylineRef.current) {
                    polylineRef.current.setPath(path);
                } else {
                    const newPolyline = new google.maps.Polyline({
                        path: path,
                        strokeColor: '#FF0000',
                        strokeOpacity: 1.0,
                        strokeWeight: 2,
                        map: map
                    });
                    polylineRef.current = newPolyline;
                }
            } else {
                setDistance(null);
                setDistances([]);
                if (polylineRef.current) {
                    polylineRef.current.setMap(null);
                    polylineRef.current = null;
                }
            }
        }
    }, [markers, map, speed, maxPoints]);

    return (
        <div className="lg:flex lg:flex-row lg:h-[calc(100vh-3.5rem)] lg:overflow-hidden">

            {/* Map */}
            <div className="h-[50vh] lg:h-full lg:flex-1" ref={mapRef} />

            {/* Right panel */}
            <div className="lg:w-96 lg:h-full lg:overflow-y-auto border-t border-slate-700 lg:border-t-0 lg:border-l lg:border-slate-700 bg-slate-900 p-4 space-y-4">

                {/* Progress */}
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Route Setup</h2>
                    <div className="flex gap-2 mb-2">
                        {Array.from({ length: maxPoints }, (_, i) => (
                            <div
                                key={i}
                                className={`h-3 w-3 rounded-full border-2 transition-all duration-200 ${
                                    i < markers.length
                                        ? 'bg-blue-500 border-blue-500'
                                        : 'bg-transparent border-slate-600'
                                }`}
                            />
                        ))}
                    </div>
                    <p className="text-sm text-slate-400">
                        {markers.length === maxPoints
                            ? 'Route complete — ready to export'
                            : `${markers.length} of ${maxPoints} markers placed`}
                    </p>
                </div>

                {/* Configuration */}
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-4">
                    <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Configuration</h2>

                    {/* Number of points */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-sm text-slate-300">Number of Points</label>
                            <span className="text-sm font-bold text-amber-400 bg-slate-700 px-2 py-0.5 rounded-md">{maxPoints}</span>
                        </div>
                        <input
                            type="range"
                            min="3"
                            max="6"
                            step="1"
                            value={maxPoints}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                maxPointsRef.current = val;
                                setMaxPoints(val);
                                if (markers.length > val) clearMarkers();
                            }}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>3</span>
                            <span>4</span>
                            <span>5</span>
                            <span>6</span>
                        </div>
                    </div>

                    {/* Heading type */}
                    <div>
                        <label className="text-sm text-slate-300 block mb-2">Heading Type</label>
                        <div className="flex flex-col gap-2">
                            {(['true', 'magnetic'] as const).map((val) => (
                                <label key={val} className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="radio"
                                        name="headingType"
                                        value={val}
                                        checked={headingType === val}
                                        onChange={() => setHeadingType(val)}
                                        className="accent-blue-500"
                                    />
                                    <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors">
                                        {val === 'true' ? 'True Heading' : `Magnetic Heading (±${MAGNETIC_DECLINATION}° E)`}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Speed */}
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Speed</h2>
                        <span className="text-sm font-bold text-amber-400 bg-slate-700 px-2 py-0.5 rounded-md">{speed} km/h</span>
                    </div>
                    <input
                        id="speed"
                        type="range"
                        min="100"
                        step="10"
                        max="180"
                        value={speed}
                        onChange={(e) => setSpeed(parseInt(e.target.value))}
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>100</span>
                        <span>180</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                    <button
                        onClick={handleGeneratePDF}
                        disabled={markers.length !== maxPoints || !apiKey || isPdfLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
                    >
                        {isPdfLoading ? <><Spinner /> Generating…</> : 'Generate PDF Report'}
                    </button>
                    <button
                        onClick={handleGenerateA3Map}
                        disabled={markers.length !== maxPoints || isA3Loading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-blue-400 font-medium rounded-lg transition-colors text-sm"
                    >
                        {isA3Loading ? <><Spinner /> Generating…</> : 'Generate A3 Map'}
                    </button>
                    <button
                        onClick={handleGenerateCRS}
                        disabled={markers.length !== maxPoints}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-green-400 font-medium rounded-lg transition-colors text-sm"
                    >
                        Generate CRS
                    </button>
                    <button
                        onClick={clearMarkers}
                        className="w-full px-4 py-2.5 border border-red-500/50 hover:border-red-400 hover:bg-red-500/10 text-red-400 font-medium rounded-lg transition-colors text-sm"
                    >
                        Clear All Markers
                    </button>
                </div>

                {/* Waypoints */}
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Waypoints</h2>
                    {markers.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">Click the map to place markers</p>
                    ) : (
                        <ul className="space-y-2">
                            {markers.map((marker, index) => (
                                <li key={index} className="flex items-center gap-2.5">
                                    <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${index === 0 ? 'bg-blue-500' : 'bg-red-500'}`} />
                                    <span className="text-xs font-bold text-slate-200 w-9 flex-shrink-0">{marker.name}</span>
                                    <span className="text-xs font-mono text-slate-400 truncate">
                                        {marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Stats */}
                {distance !== null && (() => {
                    const { hours, minutes, seconds } = calculateTotalTime(distances, speed);
                    return (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Distance</p>
                                <p className="text-2xl font-bold text-slate-100 leading-none">{(distance / 1000).toFixed(2)}</p>
                                <p className="text-xs text-slate-400 mt-1">km</p>
                            </div>
                            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Time</p>
                                <p className="text-xl font-bold text-slate-100 leading-none font-mono">
                                    {`${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">hh:mm:ss</p>
                            </div>
                        </div>
                    );
                })()}

                {/* Leg details table */}
                {distances.length > 0 && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-700">
                            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Leg Details</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-700 text-slate-300 text-xs uppercase">
                                        <th className="px-3 py-2 text-left font-medium">From</th>
                                        <th className="px-3 py-2 text-left font-medium">To</th>
                                        <th className="px-3 py-2 text-right font-medium">Heading</th>
                                        <th className="px-3 py-2 text-right font-medium">km</th>
                                        <th className="px-3 py-2 text-right font-medium">Time</th>
                                        <th className="px-3 py-2 text-right font-medium">Cumul.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const cumulativeTimes = calculateCumulativeTimes(distances, speed);
                                        return distances.map((dist, index) => {
                                            const { minutes, seconds } = calculateTime(dist, speed);
                                            return (
                                                <tr key={index} className={index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-800/60'}>
                                                    <td className="px-3 py-2 text-slate-300">{markers[index].name}</td>
                                                    <td className="px-3 py-2 text-slate-300">{markers[(index + 1) % markers.length].name}</td>
                                                <td className="px-3 py-2 text-right font-mono text-slate-300">{computeHeading(markers[index], markers[(index + 1) % markers.length], headingType)}</td>
                                                <td className="px-3 py-2 text-right text-slate-300">{(dist / 1000).toFixed(2)}</td>
                                                <td className="px-3 py-2 text-right font-mono text-slate-300">{`${minutes}:${seconds.toString().padStart(2, '0')}`}</td>
                                                <td className="px-3 py-2 text-right font-mono text-amber-400">{formatTimeHMS(cumulativeTimes[index])}</td>
                                            </tr>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}