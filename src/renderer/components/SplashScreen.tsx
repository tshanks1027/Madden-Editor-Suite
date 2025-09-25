import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onClose: () => void;
  duration?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onClose, duration = 3000 }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 500); // Allow fade animation to complete
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  if (!isVisible) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50 opacity-0 transition-opacity duration-500">
        <img src="/assets/splash.png" alt="Loading..." className="max-w-full max-h-full" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50 transition-opacity duration-500">
      <img src="/assets/splash.png" alt="Loading..." className="max-w-full max-h-full" />
    </div>
  );
};