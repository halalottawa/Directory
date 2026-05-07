import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface TimePickerProps {
  value: string; // "HH:mm" in 24h format
  onChange: (value: string) => void;
  required?: boolean;
}

export const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, required }) => {
  const [hour, minute] = value ? value.split(':') : ['12', '00'];
  const h = parseInt(hour || '12', 10);
  const isPM = h >= 12;
  const displayHour = h % 12 || 12;

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    let newH = parseInt(e.target.value, 10);
    if (isPM && newH < 12) newH += 12;
    if (!isPM && newH === 12) newH = 0;
    onChange(`${newH.toString().padStart(2, '0')}:${minute}`);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(`${hour.padStart(2, '0')}:${e.target.value}`);
  };

  const handleAmPmChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newIsPM = e.target.value === 'PM';
    let newH = h;
    if (newIsPM && h < 12) newH += 12;
    if (!newIsPM && h >= 12) newH -= 12;
    onChange(`${newH.toString().padStart(2, '0')}:${minute}`);
  };

  // Initialize if empty
  useEffect(() => {
    if (!value) {
      onChange('12:00');
    }
  }, [value, onChange]);

  return (
    <div className="relative flex items-center w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl focus-within:ring-2 focus-within:ring-[#e90b35] transition-all">
      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      <div className="flex items-center gap-1 w-full justify-center">
        <select 
          value={displayHour} 
          onChange={handleHourChange} 
          className="bg-transparent outline-none appearance-none text-center cursor-pointer font-medium"
          required={required}
        >
          {[...Array(12)].map((_, i) => (
            <option key={i+1} value={i+1}>{i+1}</option>
          ))}
        </select>
        <span className="font-bold">:</span>
        <select 
          value={minute} 
          onChange={handleMinuteChange} 
          className="bg-transparent outline-none appearance-none text-center cursor-pointer font-medium"
          required={required}
        >
          {['00', '15', '30', '45'].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select 
          value={isPM ? 'PM' : 'AM'} 
          onChange={handleAmPmChange} 
          className="bg-transparent outline-none appearance-none text-center ml-2 font-bold cursor-pointer"
          required={required}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
};
