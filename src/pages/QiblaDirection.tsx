import React, { useState, useEffect, useCallback } from 'react';
import { Compass, MapPin, Navigation2, Crosshair, AlertCircle } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { AdDisplay } from '../components/AdDisplay';

const KAABA_LAT = 21.422487;
const KAABA_LNG = 39.826206;

export const QiblaDirection: React.FC = () => {
  const [heading, setHeading] = useState<number | null>(null);
  const [qiblaDirection, setQiblaDirection] = useState<number | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(true);
  const [needsPermission, setNeedsPermission] = useState(false);

  const calculateQibla = useCallback((lat: number, lng: number) => {
    // Math to calculate Qibla direction from current location
    const phiK = (KAABA_LAT * Math.PI) / 180.0;
    const lambdaK = (KAABA_LNG * Math.PI) / 180.0;
    const phi = (lat * Math.PI) / 180.0;
    const lambda = (lng * Math.PI) / 180.0;

    const y = Math.sin(lambdaK - lambda);
    const x = Math.cos(phi) * Math.tan(phiK) - Math.sin(phi) * Math.cos(lambdaK - lambda);
    
    let direction = (Math.atan2(y, x) * 180.0) / Math.PI;
    direction = (direction + 360) % 360;
    
    setQiblaDirection(direction);
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          setNeedsPermission(false);
          startCompass();
        } else {
          setError('Compass permission denied. Please allow access in your device settings.');
        }
      } else {
        startCompass();
      }
    } catch (err) {
      setError('Could not access compass. This feature requires a mobile device with compass sensors.');
    }
  }, []);

  const startCompass = useCallback(() => {
    const handleOrientation = (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      let compassHeading = e.webkitCompassHeading;
      
      // Fallback for non-iOS devices
      if (compassHeading === undefined || compassHeading === null) {
        if (e.alpha !== null) {
          // Note: alpha is not a perfect substitute for compass heading without absolute orientation,
          // but works on some devices if they report absolute alpha.
          // Standard alpha is relative to the device's position when the page loaded.
          compassHeading = 360 - e.alpha; 
        }
      }

      if (compassHeading !== null && compassHeading !== undefined) {
        setHeading(compassHeading);
        setIsCalibrating(false);
      }
    };

    window.addEventListener('deviceorientationabsolute', handleOrientation as any);
    window.addEventListener('deviceorientation', handleOrientation as any);

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation as any);
      window.removeEventListener('deviceorientation', handleOrientation as any);
    };
  }, []);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLocation({ lat, lng });
        calculateQibla(lat, lng);
        setError(null);
      },
      (err) => {
        setError('Unable to retrieve your location. Please ensure location services are enabled.');
      },
      { enableHighAccuracy: true }
    );
  }, [calculateQibla]);

  useEffect(() => {
    getLocation();
    
    // Check if we need explicit permission (iOS 13+)
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      setNeedsPermission(true);
    } else {
      startCompass();
    }
  }, [getLocation, startCompass]);

  const pointerAngle = heading !== null && qiblaDirection !== null 
    ? qiblaDirection - heading
    : 0;

  return (
    <div className="animate-in fade-in duration-500 bg-white md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:rounded-3xl md:shadow-sm md:overflow-hidden md:border md:border-gray-100 md:mb-12">
      <Helmet>
        <title>Qibla Direction | Halal Ottawa</title>
        <meta name="description" content="Find the Qibla direction online accurately using your device compass and location in Ottawa." />
      </Helmet>

      <div className="pt-8 pb-12 px-6 md:px-12 max-w-3xl mx-auto space-y-10">
        <AdDisplay />

        <div className="flex flex-col items-center text-center space-y-8">
        <div className="space-y-4">
          <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-[#e90b35] mx-auto">
            <Compass className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Qibla Direction</h1>
          <p className="text-gray-500 max-w-xl mx-auto">
            Align your device with the arrow below to face the Kaaba in Mecca from Ottawa or anywhere else. 
            For best accuracy, hold your device flat and away from magnetic interference.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-start gap-3 text-left w-full max-w-md">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium leading-relaxed">{error}</p>
          </div>
        )}

        {needsPermission && !error && (
          <button 
            onClick={requestPermission}
            className="px-6 py-3 bg-[#e90b35] text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg shadow-red-100 flex items-center gap-2"
          >
            <Navigation2 className="w-5 h-5" />
            Calibrate Compass
          </button>
        )}

        <div className="relative w-64 h-64 md:w-80 md:h-80 mx-auto my-8">
          {/* Compass Background */}
          <div className="absolute inset-0 rounded-full border-4 border-gray-100 shadow-inner bg-gray-50 flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Compass Ticks */}
              {[...Array(72)].map((_, i) => (
                <div 
                  key={i} 
                  className={`absolute w-0.5 ${i % 18 === 0 ? 'h-6 bg-[#e90b35]' : i % 6 === 0 ? 'h-4 bg-gray-400' : 'h-2 bg-gray-200'}`}
                  style={{ transform: `rotate(${i * 5}deg) translateY(-110px)` }}
                />
              ))}
            </div>
            
            {/* North Indicator pointing relative to true north based on heading */}
            <div 
              className="absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-out"
              style={{ transform: `rotate(${heading !== null ? -heading : 0}deg)` }}
            >
              <div className="absolute top-4 text-[#e90b35] font-bold">N</div>
              <div className="absolute bottom-4 text-gray-400 font-bold">S</div>
              <div className="absolute right-4 text-gray-400 font-bold">E</div>
              <div className="absolute left-4 text-gray-400 font-bold">W</div>
            </div>

            {/* Target Crosshair */}
            <Crosshair className="absolute w-8 h-8 text-gray-300 pointer-events-none" />

            {/* Loading / Calibrating overlay */}
            {(heading === null || qiblaDirection === null) && !needsPermission && !error && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-full flex flex-col items-center justify-center text-[#e90b35] z-10">
                <Compass className="w-8 h-8 animate-spin-slow mb-2 opacity-50" />
                <span className="text-xs font-bold uppercase tracking-widest text-[#e90b35]">
                  {location ? 'Calibrating...' : 'Locating...'}
                </span>
              </div>
            )}
          </div>

          {/* Qibla Pointer */}
          <div 
            className="absolute inset-0 flex flex-col items-center justify-start py-8 transition-transform duration-300 ease-out z-20"
            style={{ 
              transform: `rotate(${pointerAngle}deg)`,
              opacity: (heading !== null && qiblaDirection !== null) ? 1 : 0
            }}
          >
            <div className="w-1.5 h-1/2 bg-[#e90b35] rounded-t-full shadow-lg origin-bottom relative relative flex flex-col items-center">
              {/* Arrow Head */}
              <div className="absolute -top-4 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[20px] border-b-[#e90b35]"></div>
              
              {/* Kaaba Icon at the tip */}
              <div className="absolute -top-12 w-8 h-8 bg-black rounded-sm border-2 border-yellow-500 shadow-xl flex items-center justify-center transform -rotate-0">
                <div className="w-full h-2 bg-yellow-500 mt-[-50%]"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full max-w-sm text-left">
          <div className="bg-gray-50 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Your Location</span>
            <div className="font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#e90b35]" />
              {location ? `${location.lat.toFixed(2)}°, ${location.lng.toFixed(2)}°` : '...'}
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Qibla Angle</span>
            <div className="font-bold text-gray-900 flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#e90b35]" />
              {qiblaDirection ? `${qiblaDirection.toFixed(1)}°` : '...'}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
