import React from 'react';

interface TimePickerProps {
    value: string | null;
    onChange: (time: string | null) => void;
}

const TimePicker: React.FC<TimePickerProps> = ({ value, onChange }) => {
    return (
        <input type="time" value={value || ''} onChange={(e) => onChange(e.target.value)} />
    );
};

export default TimePicker;