import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/solid';

interface CameraCompProps {
  image: string;
  setImage: (image: string) => void;
  setDisplayImage: (display: boolean) => void;
  onClose: () => void;
  onAnalyze: () => void;
}

const CameraComp: React.FC<CameraCompProps> = ({ image, setImage, setDisplayImage, onClose, onAnalyze }) => {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const webcamRef = useRef<Webcam>(null);
  const [isCaptured, setIsCaptured] = useState(false);

  const capturePhoto = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setImage(imageSrc);
      setIsCaptured(true);
    }
  }, [setImage]);

  const retakePhoto = useCallback(() => {
    setImage('');
    setIsCaptured(false);
  }, [setImage]);

  const flipCamera = useCallback(() => {
    setFacingMode(prevMode => prevMode === 'user' ? 'environment' : 'user');
  }, []);

  const cancelCapture = useCallback(() => {
    setDisplayImage(false);
    setImage('');
    setIsCaptured(false);
    onClose();
  }, [setDisplayImage, setImage, onClose]);

  return (
    <div className="relative w-full h-auto" style={{ maxWidth: '640px', margin: '0 auto' }}>
      {!isCaptured ? (
        <>
          <Webcam 
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{
              facingMode: facingMode,
              aspectRatio: 4/3
            }}
            style={{ width: '100%', height: 'auto', borderRadius: '8px' }}
          />
          <button
            onClick={cancelCapture}
            className="absolute top-4 left-4 text-white p-2 z-10"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
          <button
            onClick={flipCamera}
            className="absolute top-4 right-4 text-white p-2"
          >
            <ArrowPathIcon className="h-6 w-6" />
          </button>
          <button
            onClick={capturePhoto}
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-12 h-12 bg-white bg-opacity-50 rounded-full flex items-center justify-center"
          >
            <div className="w-10 h-10 bg-white rounded-full"></div>
          </button>
        </>
      ) : (
        <div className="relative">
          <img 
            src={image} 
            alt="Captured" 
            className="w-full h-auto rounded-lg"
          />
          <div className="absolute bottom-4 left-0 right-0 flex justify-between px-4">
            <button
              onClick={retakePhoto}
              className="bg-blue-500 text-white px-4 py-2 rounded-md"
            >
              Retake
            </button>
            <button
              onClick={onAnalyze}
              className="bg-green-500 text-white px-4 py-2 rounded-md"
            >
              Analyze Receipt
            </button>
            <button
              onClick={cancelCapture}
              className="bg-red-500 text-white px-4 py-2 rounded-md"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { CameraComp };
