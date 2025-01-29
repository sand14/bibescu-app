"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

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

export default function GoogleMaps() {
    const mapRef = useRef<HTMLDivElement>(null);
    const [markers, setMarkers] = useState<Array<{ lat: number, lng: number, name: string }>>([]);
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [distances, setDistances] = useState<number[]>([]);
    const [speed, setSpeed] = useState<number>(130); // Default speed in km/h
    const polylineRef = useRef<google.maps.Polyline | null>(null);
    const polygonRef = useRef<google.maps.Polygon | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);

    // Initialize marker counter
    let markerCounter = useRef<number>(1);

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

    // Initialize the map only once
    useEffect(() => {
        const initializeMap = async () => {
            const response = await fetch("/api/config");
            const { googleMapsApiKey } = await response.json();

            const loader = new Loader({
                apiKey: googleMapsApiKey,
                version: 'quarterly',
                libraries: ['geometry'] // Required for distance calculations
            });

            const { Map } = await loader.importLibrary('maps');

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
                    const newMarker = {
                        lat: e.latLng.lat(),
                        lng: e.latLng.lng(),
                        name: `Marker ${markerCounter.current++}`
                    };

                    setMarkers(prevMarkers => {
                        if (prevMarkers.length >= 6) {
                            alert('You can only add up to 6 markers.');
                            return prevMarkers;
                        }

                        const updatedMarkers = [...prevMarkers, newMarker];

                        // Add new marker to the map with label
                        const markerInstance = new google.maps.Marker({
                            position: newMarker,
                            map: mapInstance,
                            draggable: true,
                            label: {
                                text: newMarker.name,
                                color: 'black',
                                fontWeight: 'bold',
                            },
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

    // Function to clear all markers
    const clearMarkers = () => {
        // Remove all markers from the map
        markersRef.current.forEach(marker => marker.setMap(null));
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
        // Reset the marker counter to 1
        markerCounter.current = 1;
    };

    // Ensure markers are managed correctly
    useEffect(() => {
        if (map) {
            // Remove old markers from the map
            markersRef.current.forEach(marker => marker.setMap(null));
            markersRef.current = [];

            // Add new markers to the map
            markers.forEach((marker, index) => {
                const markerInstance = new google.maps.Marker({
                    position: marker,
                    map: map,
                    draggable: true,
                    label: {
                        text: marker.name,
                        color: 'black',
                        fontWeight: 'bold',
                    },
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

                if (markers.length === 6) {
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
    }, [markers, map, speed]);

    return (
        <div>
            <div className="h-[600px]" ref={mapRef} />
            <div className="mt-4">
                <button
                    onClick={clearMarkers}
                    className="px-4 py-2 bg-red-500 text-white rounded"
                >
                    Clear All Markers
                </button>

                <div className="mt-4">
                    <label htmlFor="speed" className="block text-sm font-medium text-gray-700">Select Speed (km/h): {speed} km/h</label>
                    <input
                        id="speed"
                        type="range"
                        min="100"
                        step="10"
                        max="180"
                        value={speed}
                        onChange={(e) => setSpeed(parseInt(e.target.value))}
                        className="w-full mt-2"
                    />
                </div>

                <h3 className="mt-4">Markers Coordinates:</h3>
                <ul>
                    {markers.map((marker, index) => (
                        <li key={index}>
                            {`${marker.name}: Lat: ${marker.lat.toFixed(6)}, Lng: ${marker.lng.toFixed(6)}`}
                        </li>
                    ))}
                </ul>
                {distance !== null && (
                    <div>
                        <h3>Total Distance: {(distance / 1000).toFixed(2)} km</h3>

                        {/* Calculate and display total travel time */}
                        {(() => {
                            const { hours, minutes, seconds } = calculateTotalTime(distances, speed);
                            return (
                                <p>
                                    Total Time: {`${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`}
                                </p>
                            );
                        })()}
                    </div>
                )}
                {distances.length > 0 && (
                    <div className="mt-4">
                        <h3>Distance and Time Between Markers:</h3>
                        <table className="border-collapse border border-gray-200 w-full">
                            <thead>
                                <tr>
                                    <th className="border border-gray-300 p-2">From Marker</th>
                                    <th className="border border-gray-300 p-2">To Marker</th>
                                    <th className="border border-gray-300 p-2">Distance (km)</th>
                                    <th className="border border-gray-300 p-2">Time (min:sec)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {distances.map((dist, index) => {
                                    const { minutes, seconds } = calculateTime(dist, speed);
                                    return (
                                        <tr key={index}>
                                            <td className="border border-gray-300 p-2">{index + 1}</td>
                                            <td className="border border-gray-300 p-2">
                                                {index + 2 > markers.length ? 1 : index + 2}
                                            </td>
                                            <td className="border border-gray-300 p-2">{(dist / 1000).toFixed(2)}</td> {/* Distance in kilometers */}
                                            <td className="border border-gray-300 p-2">{`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
