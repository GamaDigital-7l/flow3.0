"use client";

import React from 'react';

interface NewFullScreenImageViewerProps {
  imageUrl: string;
  description: string;
}

const NewFullScreenImageViewer: React.FC<NewFullScreenImageViewerProps> = ({ imageUrl, description }) => {
  return (
    <div className="fixed top-0 left-0 h-screen w-screen bg-black/80 flex items-center justify-center">
      <img src={imageUrl} alt={description} className="max-h-screen max-w-screen" />
      <p className="text-white mt-4">{description}</p>
    </div>
  );
};

export default NewFullScreenImageViewer;