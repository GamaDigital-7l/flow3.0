"use client";

import React from 'react';

interface QuestionProps {
  questionText: string;
}

const Question = ({ questionText }: QuestionProps) => {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-foreground">{questionText}</label>
      <input
        type="text"
        className="mt-1 p-2 w-full border rounded-md bg-input text-foreground focus:ring-ring focus:border-ring"
      />
    </div>
  );
};

export default Question;